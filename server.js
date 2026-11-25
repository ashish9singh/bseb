import express from 'express';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { buildSiteIndex } from './lib/site-index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname);

// Load local .env file if present (never overrides existing environment variables)
(function loadLocalEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore unreadable .env
  }
})();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// Build in-memory search index across all bsebwala.in pages
const siteIndex = buildSiteIndex(ROOT_DIR);

// Security Headers Middleware (compatible with iframe previews, no restrictive X-Frame-Options)
const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://ep2.adtrafficquality.google",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https://img.youtube.com https://api.qrserver.com https://pagead2.googlesyndication.com https://www.google-analytics.com https://googleads.g.doubleclick.net",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://ep2.adtrafficquality.google",
  "connect-src 'self' https://docs.google.com https://script.google.com https://script.googleusercontent.com https://bsebwala-news-api2.vercel.app https://translate.googleapis.com https://www.google-analytics.com https://region1.google-analytics.com https://pagead2.googlesyndication.com",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://script.google.com",
].join('; ');

app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP_HEADER);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Lightweight Brotli/Gzip compression middleware (75-85% bandwidth reduction for slow 2G/3G networks)
const COMPRESSIBLE_RE = /^(text\/|application\/(javascript|json|xml|xhtml\+xml)|image\/svg\+xml)/i;
const compressedFileCache = new Map();

function compressBuffer(buf, encoding) {
  if (encoding === 'br') {
    return zlib.brotliCompressSync(buf, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 },
    });
  }
  return zlib.gzipSync(buf, { level: 6 });
}

app.use((req, res, next) => {
  const accept = String(req.headers['accept-encoding'] || '');
  const encoding = accept.includes('br') ? 'br' : accept.includes('gzip') ? 'gzip' : null;
  if (!encoding) return next();

  const origSend = res.send.bind(res);
  res.send = function compressedSend(body) {
    if (res.headersSent || res.getHeader('Content-Encoding') || req.method === 'HEAD') {
      return origSend(body);
    }
    const contentType = String(res.getHeader('Content-Type') || '');
    const isJsonObj = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
    if (!isJsonObj && contentType && !COMPRESSIBLE_RE.test(contentType)) {
      return origSend(body);
    }

    let rawBuf;
    if (Buffer.isBuffer(body)) {
      rawBuf = body;
    } else if (typeof body === 'string') {
      rawBuf = Buffer.from(body, 'utf-8');
    } else if (isJsonObj) {
      if (!contentType) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      rawBuf = Buffer.from(JSON.stringify(body), 'utf-8');
    } else {
      return origSend(body);
    }

    if (rawBuf.length < 512) {
      return origSend(body);
    }

    const compressed = compressBuffer(rawBuf, encoding);
    res.setHeader('Content-Encoding', encoding);
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Content-Length', String(compressed.length));
    return origSend(compressed);
  };

  next();
});

app.use(express.json({ limit: '16kb' }));

// Sliding-window rate limiter for /api/chat (25 requests per minute per IP)
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 25;
const rateLimitStore = new Map();

function checkRateLimit(clientKey) {
  const now = Date.now();
  // Periodic cleanup to keep memory bounded
  if (rateLimitStore.size > 500) {
    for (const [key, timestamps] of rateLimitStore.entries()) {
      const fresh = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (fresh.length === 0) rateLimitStore.delete(key);
      else rateLimitStore.set(key, fresh);
    }
  }
  const existing = (rateLimitStore.get(clientKey) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (existing.length >= RATE_LIMIT_MAX) {
    rateLimitStore.set(clientKey, existing);
    return false;
  }
  existing.push(now);
  rateLimitStore.set(clientKey, existing);
  return true;
}

// Gemini client helper (server-side only, reads process.env.GEMINI_API_KEY)
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildDirectoryLinks(matchedEntries, maxLinks = 4) {
  const seen = new Set();
  const links = [];
  for (const match of matchedEntries) {
    if (match.pageRoute && !seen.has(match.pageRoute) && siteIndex.isAllowedLink(match.pageRoute)) {
      seen.add(match.pageRoute);
      links.push({
        label: match.pageTitle || match.title,
        url: match.pageRoute,
        note: match.category || 'bsebwala.in',
        external: false,
      });
    }
    if (links.length >= maxLinks) break;
    if (match.externalUrl && !seen.has(match.externalUrl) && siteIndex.isAllowedLink(match.externalUrl)) {
      seen.add(match.externalUrl);
      links.push({
        label: match.title,
        url: match.externalUrl,
        note: match.category || 'Official resource',
        external: match.externalUrl.startsWith('http://') || match.externalUrl.startsWith('https://'),
      });
    }
    if (links.length >= maxLinks) break;
  }
  return links;
}

const CHAT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answer: {
      type: Type.STRING,
      description:
        'Concise, helpful, student-friendly answer (2-5 short sentences or bullet lines using "- ") grounded in the provided bsebwala.in context. Reply in the same language the user used (Hindi, English, or Hinglish).',
    },
    links: {
      type: Type.ARRAY,
      description:
        'Up to 4 exact clickable links copied verbatim from the provided site index or page routes that directly help the student.',
      items: {
        type: Type.OBJECT,
        properties: {
          label: {
            type: Type.STRING,
            description: 'Short clear link label (e.g. "Fee Calculator & Exam Fees" or "Class 9–10 Full Syllabus PDF").',
          },
          url: {
            type: Type.STRING,
            description:
              'Exact internal route (like "/fee", "/learn", "/news", "/letter", "/", "/aihub", "/about", "/contact") or exact verified https:// URL from the context.',
          },
          note: {
            type: Type.STRING,
            description: 'Short 3-8 word hint describing what is on that page.',
          },
        },
        required: ['label', 'url'],
      },
    },
    followUps: {
      type: Type.ARRAY,
      description: '2 or 3 short follow-up questions a Bihar Board student might ask next (under 8 words each).',
      items: {
        type: Type.STRING,
      },
    },
  },
  required: ['answer', 'links', 'followUps'],
};

async function generateWithRetry(ai, params, maxRetries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.code;
      const retryable = status === 500 || status === 503 || status === 'ECONNRESET';
      if (!retryable || attempt === maxRetries) break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

// Precomputed compact search index JSON for fast / offline assistant lookups
const CLIENT_SEARCH_INDEX_JSON = JSON.stringify({
  version: 2,
  total: siteIndex.totalIndexed,
  items: siteIndex.getClientIndex(),
});

// API Route: Assistant capability status
app.get('/api/assistant/status', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    aiEnabled: Boolean(getGeminiClient()),
    indexedCount: siteIndex.totalIndexed,
  });
});

// API Route: Compact static search index for offline / 2G client caching
app.get('/api/search-index.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.send(CLIENT_SEARCH_INDEX_JSON);
});

// API Route: Fast grounded bsebwala.in Instant Search (always available, zero external latency)
app.get('/api/search', (req, res) => {
  const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a minute before searching again.',
    });
  }

  const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!rawQuery || rawQuery.length > 600) {
    return res.status(400).json({
      error: 'Please enter a question between 1 and 600 characters.',
    });
  }

  const lang = req.query.lang === 'hi' ? 'hi' : 'en';
  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.json(siteIndex.buildInstantAnswer(rawQuery, lang));
});

// API Route: BSEB Assistant Chatbot (Server-side Gemini AI)
app.post('/api/chat', async (req, res) => {
  const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a minute before asking another question.',
    });
  }

  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid request payload.' });
  }

  const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';
  if (!rawMessage || rawMessage.length > 600) {
    return res.status(400).json({
      error: 'Please enter a question between 1 and 600 characters.',
    });
  }

  const lang = body.lang === 'hi' ? 'hi' : 'en';
  const currentPath =
    typeof body.currentPath === 'string' && /^\/[a-z0-9._/-]*$/i.test(body.currentPath)
      ? body.currentPath.slice(0, 64)
      : '/';

  const rawHistory = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const safeHistory = rawHistory
    .filter(
      (item) =>
        item &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.text === 'string' &&
        item.text.trim().length > 0
    )
    .map((item) => ({
      role: item.role,
      text: item.text.trim().slice(0, 500),
    }));

  // Search across indexed bsebwala.in pages
  const matchedEntries = siteIndex.search(rawMessage, 10);

  const ai = getGeminiClient();
  if (!ai) {
    const fallbackLinks = buildDirectoryLinks(matchedEntries, 4);
    return res.status(503).json({
      error:
        lang === 'hi'
          ? 'लाइव AI उत्तर अभी सक्रिय नहीं हैं (सर्वर पर GEMINI_API_KEY सेट नहीं है)। नीचे bsebwala.in के संबंधित पेज लिंक दिए गए हैं:'
          : 'Live AI answers are not active yet because GEMINI_API_KEY is not configured in Settings > Secrets. Meanwhile, here are matching pages on bsebwala.in:',
      links: fallbackLinks,
    });
  }

  const systemInstruction = [
    'You are "BSEB Assistant", the helpful student & teacher AI assistant embedded on bsebwala.in (BSEB Portal Hub).',
    'Your job: answer questions about Bihar Board (BSEB) exams, results, admit cards, school & board fees, syllabus PDFs, scholarships, official letters, Computer Science video tutorials, and study notes by summarizing the exact information found across bsebwala.in pages.',
    'STRICT GROUNDING RULES:',
    '1. Base your factual answers on the RETRIEVED BSEBWALA.IN CONTEXT and SITE PAGES DIRECTORY provided below.',
    '2. NEVER invent URLs. Every URL in "links" MUST be copied verbatim from either the Site Pages Directory (e.g., "/", "/fee", "/letter", "/news", "/learn", "/aihub", "/about", "/contact", "/admission-fee-order-720-21-12-21.pdf") or the exact externalUrl field in the retrieved context.',
    '3. Whenever a topic lives on a bsebwala.in page, ALWAYS include that internal bsebwala.in page link in "links" (and optionally include the direct official portal/PDF link if present in the context).',
    '4. If specific current-year dates or unpublished results are not in the retrieved context, say so clearly and point the student to the relevant bsebwala.in page (such as /news, /letter, or / for official links) instead of guessing.',
    '5. Keep answers crisp, clear, scannable (under 140 words), friendly for Class 9–12 students and Bihar teachers. Match the user language: if the user asks in Hindi or if preferred UI language is Hindi ("hi") and user did not ask in English, answer in clear Hindi; otherwise answer in clear English (or Hinglish if the user wrote in Hinglish).',
    '6. Reminder: bsebwala.in is an independent educational portal, not an official government body.',
  ].join('\n');

  const contextPayload = {
    currentPage: currentPath,
    preferredUiLanguage: lang,
    sitePagesDirectory: siteIndex.pages,
    retrievedMatches: matchedEntries,
    recentConversation: safeHistory,
    studentQuestion: rawMessage,
  };

  try {
    const response = await generateWithRetry(ai, {
      model: 'gemini-4-hydrogen',
      contents: JSON.stringify(contextPayload),
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: CHAT_RESPONSE_SCHEMA,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const rawText = (response.text || '').trim();
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { answer: rawText || 'Sorry, I could not format that response.', links: [], followUps: [] };
    }

    // Validate & deduplicate every URL returned by the model
    const seenUrls = new Set();
    const safeLinks = [];
    if (Array.isArray(parsed.links)) {
      for (const link of parsed.links) {
        if (!link || typeof link.url !== 'string' || typeof link.label !== 'string') continue;
        const cleanUrl = link.url.trim();
        if (!siteIndex.isAllowedLink(cleanUrl) || seenUrls.has(cleanUrl)) continue;
        seenUrls.add(cleanUrl);
        safeLinks.push({
          label: link.label.trim().slice(0, 80),
          url: cleanUrl,
          note: typeof link.note === 'string' ? link.note.trim().slice(0, 90) : '',
          external: cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://'),
        });
        if (safeLinks.length >= 4) break;
      }
    }

    // Ensure top matching bsebwala.in internal page is included if model returned no links
    if (safeLinks.length === 0 && matchedEntries.length > 0) {
      for (const match of matchedEntries) {
        if (match.pageRoute && !seenUrls.has(match.pageRoute) && siteIndex.isAllowedLink(match.pageRoute)) {
          seenUrls.add(match.pageRoute);
          safeLinks.push({
            label: match.pageTitle,
            url: match.pageRoute,
            note: match.category,
            external: false,
          });
        }
        if (safeLinks.length >= 3) break;
      }
    }

    const safeFollowUps = Array.isArray(parsed.followUps)
      ? parsed.followUps
          .filter((q) => typeof q === 'string' && q.trim().length > 0)
          .map((q) => q.trim().slice(0, 70))
          .slice(0, 3)
      : [];

    return res.json({
      answer:
        typeof parsed.answer === 'string' && parsed.answer.trim()
          ? parsed.answer.trim()
          : 'Here are the most relevant resources on bsebwala.in:',
      links: safeLinks,
      followUps: safeFollowUps,
    });
  } catch (err) {
    console.error('[BSEB Assistant] Gemini API error:', err?.status || err?.message || err);
    const status = Number(err?.status) || 502;
    if (status === 400 || status === 403) {
      return res.status(503).json({
        error: 'Unable to authenticate with the AI service. Please check GEMINI_API_KEY in Settings > Secrets.',
      });
    }
    if (status === 429) {
      return res.status(429).json({
        error: 'The AI assistant is temporarily busy due to quota limits. Please try again shortly.',
      });
    }
    return res.status(502).json({
      error: 'Could not reach BSEB Assistant right now. Please try again in a moment.',
    });
  }
});

// Block direct static access to server files, secrets, lockfiles, and internal directories
const BLOCKED_PATHS = new Set([
  '/server.js',
  '/package.json',
  '/package-lock.json',
  '/metadata.json',
  '/cname',
  '/license',
  '/readme.md',
  '/walkthrough.md',
]);

app.use((req, res, next) => {
  let reqPath;
  try {
    reqPath = decodeURIComponent(req.path);
  } catch {
    return res.status(400).send('Bad Request');
  }

  const lowerPath = reqPath.toLowerCase();
  const segments = reqPath.split('/').filter(Boolean);

  if (
    BLOCKED_PATHS.has(lowerPath) ||
    lowerPath.startsWith('/node_modules') ||
    lowerPath.startsWith('/lib') ||
    segments.some((seg) => seg.startsWith('.') || seg === '..')
  ) {
    return res.status(404).send('Not Found');
  }

  // Path confinement verification
  const resolved = path.resolve(ROOT_DIR, '.' + reqPath);
  if (resolved !== ROOT_DIR && !resolved.startsWith(ROOT_DIR + path.sep)) {
    return res.status(403).send('Forbidden');
  }

  next();
});

// Fast compressed static file handler for text assets (HTML, CSS, JS, XML)
const STATIC_TEXT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const accept = String(req.headers['accept-encoding'] || '');
  const encoding = accept.includes('br') ? 'br' : accept.includes('gzip') ? 'gzip' : null;
  if (!encoding) return next();

  let reqPath;
  try {
    reqPath = decodeURIComponent(req.path);
  } catch {
    return next();
  }

  const candidates = reqPath === '/'
    ? ['index.html']
    : [reqPath.replace(/^\/+/, ''), reqPath.replace(/^\/+/, '') + '.html'];

  for (const rel of candidates) {
    const resolved = path.resolve(ROOT_DIR, rel);
    if (!resolved.startsWith(ROOT_DIR + path.sep)) continue;
    const ext = path.extname(resolved).toLowerCase();
    const contentType = STATIC_TEXT_TYPES[ext];
    if (!contentType) continue;

    let stat;
    try {
      stat = fs.statSync(resolved);
      if (!stat.isFile()) continue;
    } catch {
      continue;
    }

    const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}-${encoding}"`;
    if (req.headers['if-none-match'] === etag) {
      res.setHeader('ETag', etag);
      res.setHeader('Vary', 'Accept-Encoding');
      return res.status(304).end();
    }

    const cacheKey = `${resolved}|${stat.mtimeMs}|${encoding}`;
    let payload = compressedFileCache.get(cacheKey);
    if (!payload) {
      if (compressedFileCache.size > 80) compressedFileCache.clear();
      const raw = fs.readFileSync(resolved);
      payload = compressBuffer(raw, encoding);
      compressedFileCache.set(cacheKey, payload);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Encoding', encoding);
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('ETag', etag);
    res.setHeader('Content-Length', String(payload.length));

    if (ext === '.html' || path.basename(resolved) === 'sw.js') {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    }

    return res.status(200).end(payload);
  }

  next();
});

app.use(
  express.static(ROOT_DIR, {
    extensions: ['html'],
    index: 'index.html',
    dotfiles: 'deny',
    maxAge: '1d',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html') || filePath.endsWith(`${path.sep}sw.js`)) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      }
    },
  })
);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

app.use((_req, res) => {
  res.status(404).sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(
    `BSEB Portal Hub server running at http://${HOST}:${PORT} (${siteIndex.totalIndexed} entries indexed)`
  );
});
