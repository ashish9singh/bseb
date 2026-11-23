import fs from 'fs';
import path from 'path';

const SITE_PAGES = [
  {
    file: 'index.html',
    route: '/',
    title: 'BSEB Portal Hub — Home Directory',
    summary:
      'Main searchable directory of 50+ official Bihar Board (BSEB) links: Secondary (Class 9–10) & Senior Secondary (Class 11–12) portals, dummy admit cards, exam forms, results & scrutiny, BSTBPC e-books, Class 9–12 syllabus PDFs, model papers, Medhasoft & PMS scholarships, e-Shikshakosh, HRMS, STET, D.El.Ed, UDISE+, Bonafide certificate tool, Mashaal 2026, and Cyber Safety manual.',
    keywords: 'home portal links bseb matric inter dummy admit card exam form result scrutiny syllabus pdf model paper scholarship medhasoft pms udise eshikshakosh bonafide mashaal',
  },
  {
    file: 'fee.html',
    route: '/fee',
    title: 'School & Board Fee Structure + Calculator (Class 9–12)',
    summary:
      'Interactive Bihar Government School Admission Fee Calculator (Memo 720, dated 21.12.2021) for Class 9, 10, 11 & 12 (Arts/Commerce/Science/Agriculture), SC/ST 100% tuition & development fee waiver, same-school ₹50 admission fee exemption, Vikas & Chhatra Kosh breakdown, abolished fines (absence/late/re-admission/prospectus), plus Class 9 & 11 Registration fees (₹350–₹1115) and Class 10 (₹1010 Gen / ₹895 Reserved) & Class 12 (₹1430 Regular / ₹1770 Improvement) Exam Form fee tables and downloadable Memo 720 PDF.',
    keywords: 'fee shulk शुल्क admission registration exam form calculator memo 720 sc st exemption vikas chhatra kosh class 9 10 11 12 matric inter',
  },
  {
    file: 'letter.html',
    route: '/letter',
    title: 'Official Letters, Circulars & Orders',
    summary:
      'Searchable, filterable bilingual (English/Hindi) repository of official Bihar Board (BSEB) and Bihar Education Department letters, circulars, orders, notifications, and schemes with direct PDF downloads.',
    keywords: 'letter circular order notification scheme pdf patra परिपत्र आदेश अधिसूचना डाउनलोड',
  },
  {
    file: 'news.html',
    route: '/news',
    title: 'Live Bihar Board News & Updates',
    summary:
      'Live categorized Bihar Board news feed in English and Hindi with 30-second key takeaways covering Class 9/10 (Matric), Class 11/12 (Inter), D.El.Ed/B.Ed, STET/BPSC TRE, Teachers, and Scholarships.',
    keywords: 'news updates latest announcement notice samachar समाचार मैट्रिक इंटर रिजल्ट deled bed stet tre scholarship',
  },
  {
    file: 'learn.html',
    route: '/learn',
    title: 'Video Learning Hub & Computer Science Playlists',
    summary:
      'Interactive bilingual video learning hub with playlist theater and bookmarking for MS Office, C++, ICT & Digital Tools (Computer Virus, AI, Flash, Photoshop, MS Access, MS Excel, Networks, OS), and Python Programming (15 lessons covering setup, variables, operators, if-elif-else, break/continue, for loop).',
    keywords: 'videos learn tutorials courses playlist computer science notes python c++ ms office ict photoshop excel access bookmark study',
  },
  {
    file: 'aihub.html',
    route: '/aihub',
    title: 'Ultimate AI Hub — Curated AI Tools Directory',
    summary:
      'Bilingual directory of 46 curated AI tools across 10 categories: Core LLMs (ChatGPT, Claude, Gemini, Copilot, DeepSeek), Deep Research (Perplexity, NotebookLM), Coding IDEs, Autonomous Agents, Writing & Grammar (QuillBot), Image Design (Canva, Firefly), Video, Voice, Presentations (Gamma), and Academic Research (Consensus, Elicit, SciSpace, MagicSchool).',
    keywords: 'ai hub tools chatgpt claude gemini copilot perplexity notebooklm study research coding presentation canva',
  },
  {
    file: 'about.html',
    route: '/about',
    title: 'About Ashish Kumar Singh & CS Bihar Portal',
    summary:
      'Profile of Ashish Kumar Singh (Computer Science & AI Educator, Master Trainer, EdTech Web Developer, creator of bsebwala.in and cs-bihar.ai.studio — a 100% free Class 9–12 Hindi-medium Computer Science & AI notes and study portal).',
    keywords: 'about ashish kumar singh creator educator cs bihar notes hindi medium computer science study material workshop',
  },
  {
    file: 'contact.html',
    route: '/contact',
    title: 'Contact & Support — BSEB Portal Hub',
    summary:
      'Submit queries, request custom EdTech/school automation templates, find official email (Ashishkumarsingh9@gmail.com) and LinkedIn contact, or support free Bihar educational tools.',
    keywords: 'contact support query help email feedback patna bihar ashish upi',
  },
];

const SYNONYM_GROUPS = [
  ['matric', '10th', 'class 10', 'secondary', 'मैट्रिक', 'कक्षा 10', 'दसवीं'],
  ['inter', 'intermediate', '12th', 'class 12', 'senior', 'इंटर', 'इंटरमीडिएट', 'कक्षा 12', 'बारहवीं'],
  ['class 9', '9th', 'नौवीं', 'कक्षा 9'],
  ['class 11', '11th', 'ग्यारहवीं', 'कक्षा 11', 'ofss'],
  ['fee', 'fees', 'shulk', 'शुल्क', 'नामांकन', 'admission', 'calculator', 'memo 720'],
  ['syllabus', 'curriculum', 'सिलेबस', 'पाठ्यक्रम', 'subjects'],
  ['result', 'results', 'marksheet', 'scrutiny', 'रिजल्ट', 'परिणाम', 'अंकपत्र'],
  ['admit', 'dummy', 'registration', 'panjiyan', 'एडमिट', 'डमी', 'पंजीयन', 'पंजीकरण'],
  ['scholarship', 'medhasoft', 'pms', 'nmms', 'protsahan', 'kanya', 'छात्रवृत्ति', 'मेधासॉफ्ट'],
  ['notes', 'book', 'books', 'ebook', 'textbook', 'study', 'pdf', 'किताब', 'नोट्स', 'मॉडल पेपर', 'model paper'],
  ['video', 'videos', 'learn', 'tutorial', 'course', 'python', 'c++', 'excel', 'photoshop', 'वीडियो', 'क्लास'],
  ['letter', 'circular', 'order', 'notification', 'परिपत्र', 'आदेश', 'पत्र'],
  ['news', 'update', 'latest', 'notice', 'समाचार', 'ताजा', 'अपडेट'],
  ['teacher', 'stet', 'deled', 'sakshamta', 'eshikshakosh', 'hrms', 'शिक्षक', 'एसटीईटी', 'डीएलएड'],
  ['udise', 'apaar', 'sdms', 'kys', 'यूडायस'],
  ['bonafide', 'certificate', 'rtps', 'digilocker', 'बोनाफाइड', 'प्रमाण पत्र'],
];

function decodeBasicEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html) {
  return decodeBasicEntities(String(html || '').replace(/<[^>]+>/g, ' '));
}

function isValidHttpsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#]+/gu, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 2);
}

function expandQueryTokens(query) {
  const baseTokens = tokenize(query);
  const expanded = new Set(baseTokens);
  const lowerQuery = String(query || '').toLowerCase();

  for (const group of SYNONYM_GROUPS) {
    const matched = group.some(
      (term) => lowerQuery.includes(term) || baseTokens.includes(term)
    );
    if (matched) {
      for (const term of group) {
        for (const sub of tokenize(term)) {
          expanded.add(sub);
        }
      }
    }
  }
  return { baseTokens, expandedTokens: [...expanded] };
}

function extractIndexCards(html, verifiedExternalUrls) {
  const entries = [];

  // Extract Live Updates notice bar
  const noticeMatch = html.match(/<div class="notice-bar">([\s\S]*?)<\/div>/i);
  if (noticeMatch) {
    const noticeText = stripTags(noticeMatch[1]);
    if (noticeText) {
      entries.push({
        id: 'home-live-updates',
        title: 'Live BSEB Updates & Announcements',
        description: noticeText,
        category: 'Live Updates',
        pageRoute: '/',
        pageTitle: 'BSEB Portal Hub (Home)',
        externalUrl: null,
        keywords: 'live updates notice pms scholarship dummy registration mashaal 2026',
      });
    }
  }

  // Extract portal link cards inside each section
  const sectionRegex = /<section class="section" data-category="([^"]+)">([\s\S]*?)<\/section>/gi;
  let secMatch;
  while ((secMatch = sectionRegex.exec(html)) !== null) {
    const categoryKey = secMatch[1];
    const sectionBody = secMatch[2];
    const headingMatch = sectionBody.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const categoryLabel = headingMatch ? stripTags(headingMatch[1]) : categoryKey;

    const cardRegex = /<a\s+class="card"\s+href="([^"]+)"[^>]*?(?:data-tags="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/gi;
    let cardMatch;
    while ((cardMatch = cardRegex.exec(sectionBody)) !== null) {
      const href = decodeBasicEntities(cardMatch[1]);
      const tags = decodeBasicEntities(cardMatch[2] || '');
      const cardInner = cardMatch[3];
      const titleMatch = cardInner.match(/<span class="title">([\s\S]*?)<\/span>/i);
      const descMatch = cardInner.match(/<span class="desc">([\s\S]*?)<\/span>/i);
      const title = titleMatch ? stripTags(titleMatch[1]) : '';
      const desc = descMatch ? stripTags(descMatch[1]) : '';

      if (title && isValidHttpsUrl(href)) {
        verifiedExternalUrls.add(href);
        entries.push({
          id: `home-card-${entries.length}`,
          title,
          description: `${desc} (Category: ${categoryLabel})`,
          category: categoryLabel,
          pageRoute: '/',
          pageTitle: 'BSEB Portal Hub (Home)',
          externalUrl: href,
          keywords: `${categoryKey} ${categoryLabel} ${tags}`.trim(),
        });
      }
    }
  }

  return entries;
}

function extractLearnCourses(html, verifiedExternalUrls) {
  const entries = [];
  const lessonRegex = /\{\s*id:\s*'([^']+)',\s*videoId:\s*'([^']+)',\s*trackNo:\s*(\d+),\s*tag:\s*'([^']+)',\s*title:\s*'([^']+)',\s*hi_title:\s*'([^']+)',\s*desc:\s*'([^']+)',\s*duration:\s*'([^']+)'\s*\}/g;
  let match;
  while ((match = lessonRegex.exec(html)) !== null) {
    const [, id, videoId, , tag, title, hiTitle, desc, duration] = match;
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    verifiedExternalUrls.add(ytUrl);
    entries.push({
      id: `learn-${id}`,
      title: `${title} (${tag})`,
      description: `${desc} — Hindi: ${hiTitle} · Duration: ${duration}`,
      category: `Video Course: ${tag}`,
      pageRoute: '/learn',
      pageTitle: 'Video Learning Hub (/learn)',
      externalUrl: null,
      keywords: `video course tutorial learn computer science ${tag} ${hiTitle} ${desc}`,
    });
  }
  return entries;
}

function extractAiHubEntries(html, verifiedExternalUrls) {
  const entries = [];
  const secRegex = /<section class="ai-section">([\s\S]*?)<\/section>/gi;
  let secMatch;
  while ((secMatch = secRegex.exec(html)) !== null) {
    const secBody = secMatch[1];
    const h2Match = secBody.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const catTitle = h2Match ? stripTags(h2Match[1]) : 'AI Tools';

    const toolNames = [];
    const linkRegex = /<a\s+href="([^"]+)"[^>]*class="ai-btn"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(secBody)) !== null) {
      const href = decodeBasicEntities(linkMatch[1]);
      if (isValidHttpsUrl(href)) verifiedExternalUrls.add(href);
      toolNames.push(stripTags(linkMatch[2]));
    }

    if (toolNames.length > 0) {
      entries.push({
        id: `aihub-${entries.length}`,
        title: `AI Hub: ${catTitle}`,
        description: `Curated AI tools on /aihub: ${toolNames.join(', ')}.`,
        category: 'Ultimate AI Hub',
        pageRoute: '/aihub',
        pageTitle: 'Ultimate AI Hub (/aihub)',
        externalUrl: null,
        keywords: `ai tools ${catTitle} ${toolNames.join(' ')}`,
      });
    }
  }
  return entries;
}

function extractFeeEntries() {
  return [
    {
      id: 'fee-admission-9-10',
      title: 'Class 9 & Class 10 School Admission / Annual Fee (Memo 720)',
      description:
        'Class 9 New Admission Total: ₹360 (Vikas Kosh ₹110: Admission ₹50 + Development ₹60; Chhatra Kosh ₹250: Lab ₹10, Sports ₹20, Cultural ₹20, Poor Students ₹10, Electricity ₹20, Maintenance ₹50, ID Card ₹20, Scout/Guide ₹10, 3 Quarterly Exams ₹120). Class 10 Annual Total: ₹290 (no Admission or ID Card fee). Same-school 8th-to-9th students pay ₹0 Admission fee (saves ₹50). SC/ST students get 100% waiver on Development fee (₹60). Official Order Memo 720 PDF available.',
      category: 'School Fees (Class 9–10)',
      pageRoute: '/fee',
      pageTitle: 'Fee Calculator & Structure (/fee)',
      externalUrl: '/admission-fee-order-720-21-12-21.pdf',
      keywords: 'class 9 10 admission annual fee memo 720 360 290 sc st waiver same school vikas chhatra kosh शुल्क नामांकन',
    },
    {
      id: 'fee-admission-11-12',
      title: 'Class 11 & Class 12 (+2) School Admission / Annual Fee (Memo 720)',
      description:
        'Class 11 Arts/Commerce: ₹920 (Vikas ₹430: Admission ₹50 + Tuition ₹180 + Development ₹200; Chhatra ₹490). Class 11 Science/Agri/Vocational: ₹1,180 (includes ₹240 tuition + ₹200 Lab fee). Class 12 Arts/Commerce: ₹850; Science/Agri: ₹1,110 (no Admission/ID Card fee). SC/ST students get 100% waiver on Tuition & Development fees. Same-school 10th-to-11th students save ₹50 Admission fee.',
      category: 'School Fees (Class 11–12)',
      pageRoute: '/fee',
      pageTitle: 'Fee Calculator & Structure (/fee)',
      externalUrl: '/admission-fee-order-720-21-12-21.pdf',
      keywords: 'class 11 12 inter +2 admission annual fee science arts commerce 920 1180 850 1110 sc st waiver tuition lab शुल्क',
    },
    {
      id: 'fee-registration-9-11',
      title: 'BSEB Class 9 & Class 11 Registration (पंजीयन) Fee Structure',
      description:
        'Class 9 Registration Fee: Regular ₹350 (₹450 with ₹100 late fee), Independent/Private ₹480 (₹580 with late fee). Class 11 Registration Fee: Regular (BSEB 10th pass) ₹515, Private (BSEB 10th pass) ₹915, Other Board Regular ₹715 (includes ₹200 migration), Other Board Private ₹1,115.',
      category: 'Board Registration Fees',
      pageRoute: '/fee',
      pageTitle: 'Fee Calculator & Structure (/fee)',
      externalUrl: null,
      keywords: 'class 9 11 registration fee panjiyan 350 480 450 580 515 915 715 1115 regular private late fee पंजीयन शुल्क',
    },
    {
      id: 'fee-exam-10-12',
      title: 'BSEB Class 10 (Matric) & Class 12 (Inter) Exam Form Fee Structure',
      description:
        'Class 10 Matric Exam Form Fee: General Category ₹1,010 (Sub-total ₹950 + Practical ₹30 + Online ₹30), Reserved Category (SC/ST/EBC/BC-I) ₹895 (₹115 exam fee waived). Class 12 Inter Exam Form Fee: Regular/Private ₹1,430, Improvement/Qualifying ₹1,770, Vocational Regular ₹1,830, Vocational Improvement ₹2,170, Ex-Student Fail (Arts/Sci/Comm) ₹1,090, Vocational Ex-Student Fail ₹1,490.',
      category: 'Board Exam Form Fees',
      pageRoute: '/fee',
      pageTitle: 'Fee Calculator & Structure (/fee)',
      externalUrl: null,
      keywords: 'class 10 12 matric inter exam form fee 1010 895 1430 1770 1830 1090 general reserved sc st ebc परीक्षा फॉर्म शुल्क',
    },
    {
      id: 'fee-abolished-rules',
      title: 'Abolished School Fines & Official Fee Directives (Memo 720)',
      description:
        'Under Bihar Education Dept Memo 720 (21.12.2021), schools CANNOT charge: Absence Fine (अनुपस्थिति दण्ड), Late Fine (विलम्ब शुल्क), Escape Fine (पलायन शुल्क), Re-admission Fee (पुनः प्रवेश शुल्क), or Form/Prospectus Fee. Official receipt (पक्की रसीद) is mandatory.',
      category: 'Fee Rules & Directives',
      pageRoute: '/fee',
      pageTitle: 'Fee Calculator & Structure (/fee)',
      externalUrl: '/admission-fee-order-720-21-12-21.pdf',
      keywords: 'abolished fine penalty absence late re-admission prospectus receipt rules directives दण्ड जुर्माना',
    },
  ];
}

export function buildSiteIndex(rootDir) {
  const entries = [];
  const verifiedExternalUrls = new Set(['https://cs-bihar.ai.studio/']);
  const allowedRoutes = new Set([
    '/',
    '/index',
    '/fee',
    '/letter',
    '/news',
    '/learn',
    '/aihub',
    '/about',
    '/contact',
    '/admission-fee-order-720-21-12-21.pdf',
  ]);

  // Add high-level page summaries for every page on bsebwala.in
  for (const page of SITE_PAGES) {
    entries.push({
      id: `page-${page.route}`,
      title: page.title,
      description: page.summary,
      category: 'bsebwala.in Page',
      pageRoute: page.route,
      pageTitle: page.title,
      externalUrl: null,
      keywords: page.keywords,
    });
  }

  // Parse actual HTML files for granular entries
  const readPage = (filename) => {
    const filePath = path.resolve(rootDir, filename);
    if (!filePath.startsWith(path.resolve(rootDir) + path.sep)) return '';
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return '';
    }
  };

  const indexHtml = readPage('index.html');
  if (indexHtml) {
    entries.push(...extractIndexCards(indexHtml, verifiedExternalUrls));
  }

  const learnHtml = readPage('learn.html');
  if (learnHtml) {
    entries.push(...extractLearnCourses(learnHtml, verifiedExternalUrls));
  }

  const aihubHtml = readPage('aihub.html');
  if (aihubHtml) {
    entries.push(...extractAiHubEntries(aihubHtml, verifiedExternalUrls));
  }

  // Add detailed structured Fee entries from fee.html
  entries.push(...extractFeeEntries());

  // Add CS Bihar study notes highlight from about.html
  entries.push({
    id: 'about-cs-bihar',
    title: 'CS Bihar — Free Class 9–12 Hindi-Medium Computer Science & AI Study Notes',
    description:
      'Built by Ashish Kumar Singh (creator of bsebwala.in): 100% free EdTech portal at cs-bihar.ai.studio dedicated to Class 9–12 Hindi-medium students across Bihar with simplified Hindi notes, coding fundamentals, Cyber Safety guides, and self-paced study modules.',
    category: 'Study Notes & CS Portal',
    pageRoute: '/about',
    pageTitle: 'About & CS Bihar (/about)',
    externalUrl: 'https://cs-bihar.ai.studio/',
    keywords: 'cs bihar computer science ai study notes hindi medium class 9 10 11 12 coding cyber safety free notes',
  });

  // Precompute normalized searchable text for fast lookups
  const indexed = entries.map((item) => ({
    ...item,
    _titleLower: item.title.toLowerCase(),
    _searchBlob: `${item.title} ${item.description} ${item.category} ${item.keywords}`.toLowerCase(),
  }));

  function search(query, limit = 10) {
    const { baseTokens, expandedTokens } = expandQueryTokens(query);
    if (expandedTokens.length === 0) {
      return indexed.slice(0, Math.min(limit, SITE_PAGES.length));
    }

    const scored = [];
    for (const item of indexed) {
      let score = 0;

      // Exact phrase bonus
      const lowerQ = String(query || '').trim().toLowerCase();
      if (lowerQ.length >= 3 && item._titleLower.includes(lowerQ)) {
        score += 14;
      } else if (lowerQ.length >= 3 && item._searchBlob.includes(lowerQ)) {
        score += 7;
      }

      // Direct query token matches weigh more than expanded synonyms
      for (const tok of baseTokens) {
        if (item._titleLower.includes(tok)) score += 6;
        else if (item._searchBlob.includes(tok)) score += 3;
      }

      for (const tok of expandedTokens) {
        if (baseTokens.includes(tok)) continue;
        if (item._titleLower.includes(tok)) score += 2.5;
        else if (item._searchBlob.includes(tok)) score += 1.2;
      }

      // Slight boost for page-level overviews so students always see exact bsebwala.in pages
      if (score > 0 && item.id.startsWith('page-')) {
        score += 1.5;
      }

      if (score > 0) {
        scored.push({ item, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, limit).map(({ item }) => ({
      title: item.title,
      description: item.description,
      category: item.category,
      pageRoute: item.pageRoute,
      pageTitle: item.pageTitle,
      externalUrl: item.externalUrl,
    }));

    return top;
  }

  function isAllowedLink(url) {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (allowedRoutes.has(trimmed)) return true;
    if (verifiedExternalUrls.has(trimmed)) return true;
    return false;
  }

  return {
    pages: SITE_PAGES.map(({ route, title, summary }) => ({ route, title, summary })),
    totalIndexed: indexed.length,
    search,
    isAllowedLink,
  };
}
