/* ==========================================================================
   BSEB ASSISTANT — FLOATING BOTTOM-RIGHT AI WIDGET FOR BSEBWALA.IN
   Grounded site search + summarization + clickable page links (Zero innerHTML)
   ========================================================================== */
(function initBsebAssistant() {
  'use strict';

  if (document.getElementById('bseb-assistant-root')) return;

  const HISTORY_KEY = 'bseb-assistant-history-v1';
  const LANG_KEY = 'bseb-assistant-lang-v1';
  const MAX_STORED_MESSAGES = 20;

  const COPY = {
    en: {
      fabLabel: 'BSEB Assistant',
      title: 'BSEB Assistant',
      subtitle: 'Search exams, fees, syllabus & notes',
      langSwitch: 'हिंदी',
      clearTitle: 'Clear conversation',
      closeTitle: 'Close assistant',
      placeholder: 'Ask about BSEB exams, fees, syllabus…',
      send: 'Send',
      thinking: 'Searching bsebwala.in…',
      welcome:
        'Ask anything about Bihar Board exams, dummy admit cards, Memo 720 school/board fees, Class 9–12 syllabus PDFs, scholarships, or video lessons.',
      starters: [
        'Class 10 & 12 syllabus PDFs',
        'Matric & Inter exam form fees',
        'Dummy admit card & results',
        'PMS & Medhasoft scholarships',
      ],
      internalTag: 'bsebwala.in',
      externalTag: 'Official link',
      retry: 'Try again',
    },
    hi: {
      fabLabel: 'BSEB सहायक',
      title: 'BSEB Assistant',
      subtitle: 'परीक्षा, शुल्क, सिलेबस और नोट्स खोजें',
      langSwitch: 'English',
      clearTitle: 'चैट साफ़ करें',
      closeTitle: 'बंद करें',
      placeholder: 'परीक्षा, शुल्क, सिलेबस या छात्रवृत्ति पूछें…',
      send: 'भेजें',
      thinking: 'bsebwala.in पर खोज रहे हैं…',
      welcome:
        'बिहार बोर्ड परीक्षा, डमी एडमिट कार्ड, विद्यालय व बोर्ड शुल्क (Memo 720), कक्षा 9–12 सिलेबस PDF, छात्रवृत्ति या कंप्यूटर वीडियो के बारे में पूछें।',
      starters: [
        'कक्षा 10 व 12 का सिलेबस PDF',
        'मैट्रिक व इंटर परीक्षा फॉर्म शुल्क',
        'डमी एडमिट कार्ड और रिजल्ट लिंक',
        'PMS व मेधासॉफ्ट छात्रवृत्ति',
      ],
      internalTag: 'bsebwala.in',
      externalTag: 'आधिकारिक लिंक',
      retry: 'पुनः प्रयास करें',
    },
  };

  let state = {
    open: false,
    loading: false,
    lang: 'en',
    messages: [],
    lastFailedQuery: null,
  };

  function safeUrl(raw) {
    if (window.BSEBCommon && typeof window.BSEBCommon.safeHttpUrl === 'function') {
      return window.BSEBCommon.safeHttpUrl(raw, true);
    }
    if (typeof raw !== 'string') return null;
    const t = raw.trim();
    if (t.startsWith('/') && !t.startsWith('//')) return t;
    try {
      const u = new URL(t);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
    } catch {
      return null;
    }
  }

  function loadSession() {
    try {
      const savedLang = sessionStorage.getItem(LANG_KEY);
      if (savedLang === 'hi' || savedLang === 'en') {
        state.lang = savedLang;
      } else if (document.documentElement.lang === 'hi') {
        state.lang = 'hi';
      }
      const raw = sessionStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          state.messages = parsed
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
            .slice(-MAX_STORED_MESSAGES);
        }
      }
    } catch {
      state.messages = [];
    }
  }

  function saveSession() {
    try {
      sessionStorage.setItem(LANG_KEY, state.lang);
      sessionStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(state.messages.slice(-MAX_STORED_MESSAGES))
      );
    } catch {
      // Ignore storage failures in private browsing
    }
  }

  function createSvgIcon(pathD, size = 18) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

    const paths = Array.isArray(pathD) ? pathD : [pathD];
    for (const d of paths) {
      const p = document.createElementNS(svgNS, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    }
    return svg;
  }

  // Build widget DOM without innerHTML
  const root = document.createElement('div');
  root.id = 'bseb-assistant-root';
  root.className = 'bseb-chat-root';

  // Floating Launcher Button
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'bseb-chat-fab';
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-controls', 'bseb-chat-panel');
  fab.setAttribute('aria-label', 'Open BSEB Assistant');

  const fabIcon = createSvgIcon('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 19);
  const fabText = document.createElement('span');
  fabText.className = 'bseb-chat-fab-label';
  fab.append(fabIcon, fabText);

  // Floating Panel
  const panel = document.createElement('section');
  panel.id = 'bseb-chat-panel';
  panel.className = 'bseb-chat-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'BSEB Assistant');
  panel.hidden = true;

  // Header
  const header = document.createElement('div');
  header.className = 'bseb-chat-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'bseb-chat-title-wrap';
  const titleEl = document.createElement('h2');
  titleEl.className = 'bseb-chat-title';
  const subtitleEl = document.createElement('p');
  subtitleEl.className = 'bseb-chat-subtitle';
  titleWrap.append(titleEl, subtitleEl);

  const headerControls = document.createElement('div');
  headerControls.className = 'bseb-chat-header-actions';

  const langBtn = document.createElement('button');
  langBtn.type = 'button';
  langBtn.className = 'bseb-chat-lang-btn';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'bseb-chat-icon-btn';
  clearBtn.appendChild(createSvgIcon(['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6'], 15));

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'bseb-chat-icon-btn';
  closeBtn.appendChild(createSvgIcon(['M18 6L6 18', 'M6 6l12 12'], 16));

  headerControls.append(langBtn, clearBtn, closeBtn);
  header.append(titleWrap, headerControls);

  // Messages Feed
  const messagesEl = document.createElement('div');
  messagesEl.className = 'bseb-chat-messages';
  messagesEl.setAttribute('aria-live', 'polite');

  // Composer Form
  const form = document.createElement('form');
  form.className = 'bseb-chat-composer';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'bseb-chat-input';
  input.maxLength = 600;
  input.autocomplete = 'off';

  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.className = 'bseb-chat-send';
  sendBtn.appendChild(createSvgIcon(['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'], 16));

  form.append(input, sendBtn);
  panel.append(header, messagesEl, form);
  root.append(panel, fab);
  document.body.appendChild(root);

  function renderTextLines(container, text) {
    const lines = String(text || '').split(/\n+/).filter((l) => l.trim().length > 0);
    let currentList = null;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      const bulletMatch = trimmed.match(/^[-•*]\s+(.+)/);
      if (bulletMatch) {
        if (!currentList) {
          currentList = document.createElement('ul');
          currentList.className = 'bseb-chat-list';
          container.appendChild(currentList);
        }
        const li = document.createElement('li');
        li.textContent = bulletMatch[1];
        currentList.appendChild(li);
      } else {
        currentList = null;
        const p = document.createElement('p');
        p.textContent = trimmed;
        container.appendChild(p);
      }
    }
  }

  function renderMessages() {
    const t = COPY[state.lang];
    messagesEl.replaceChildren();

    if (state.messages.length === 0) {
      const welcomeCard = document.createElement('div');
      welcomeCard.className = 'bseb-chat-welcome';

      const welcomeText = document.createElement('p');
      welcomeText.textContent = t.welcome;
      welcomeCard.appendChild(welcomeText);

      const starterWrap = document.createElement('div');
      starterWrap.className = 'bseb-chat-starters';
      for (const prompt of t.starters) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'bseb-chat-starter-btn';
        chip.textContent = prompt;
        chip.addEventListener('click', () => sendQuestion(prompt));
        starterWrap.appendChild(chip);
      }
      welcomeCard.appendChild(starterWrap);
      messagesEl.appendChild(welcomeCard);
      return;
    }

    state.messages.forEach((msg, idx) => {
      const row = document.createElement('div');
      row.className = `bseb-chat-msg bseb-chat-msg--${msg.role}`;

      const bubble = document.createElement('div');
      bubble.className = `bseb-chat-bubble${msg.isError ? ' bseb-chat-bubble--error' : ''}`;
      renderTextLines(bubble, msg.text);

      if (msg.isError && state.lastFailedQuery && idx === state.messages.length - 1) {
        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'bseb-chat-retry-btn';
        retryBtn.textContent = t.retry;
        retryBtn.addEventListener('click', () => {
          const q = state.lastFailedQuery;
          state.messages.pop();
          sendQuestion(q, true);
        });
        bubble.appendChild(retryBtn);
      }

      row.appendChild(bubble);

      // Clickable verified links returned by BSEB Assistant
      if (msg.role === 'assistant' && Array.isArray(msg.links) && msg.links.length > 0) {
        const linksList = document.createElement('div');
        linksList.className = 'bseb-chat-links';

        for (const link of msg.links) {
          const validatedUrl = safeUrl(link.url);
          if (!validatedUrl) continue;

          const a = document.createElement('a');
          a.className = 'bseb-chat-link-card';
          a.href = validatedUrl;

          const isExternal = validatedUrl.startsWith('http://') || validatedUrl.startsWith('https://');
          if (isExternal) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
          }

          const topLine = document.createElement('span');
          topLine.className = 'bseb-chat-link-title';
          topLine.textContent = link.label;

          const metaLine = document.createElement('span');
          metaLine.className = 'bseb-chat-link-meta';
          const sourceLabel = isExternal ? t.externalTag : `${t.internalTag}${validatedUrl}`;
          metaLine.textContent = link.note ? `${sourceLabel} · ${link.note}` : sourceLabel;

          a.append(topLine, metaLine);
          linksList.appendChild(a);
        }

        if (linksList.childElementCount > 0) {
          row.appendChild(linksList);
        }
      }

      // Show follow-up suggestions only on the latest assistant message
      if (
        msg.role === 'assistant' &&
        idx === state.messages.length - 1 &&
        !state.loading &&
        Array.isArray(msg.followUps) &&
        msg.followUps.length > 0
      ) {
        const followWrap = document.createElement('div');
        followWrap.className = 'bseb-chat-followups';
        for (const q of msg.followUps) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'bseb-chat-followup-btn';
          btn.textContent = q;
          btn.addEventListener('click', () => sendQuestion(q));
          followWrap.appendChild(btn);
        }
        row.appendChild(followWrap);
      }

      messagesEl.appendChild(row);
    });

    if (state.loading) {
      const loadingRow = document.createElement('div');
      loadingRow.className = 'bseb-chat-msg bseb-chat-msg--assistant';
      const loadingBubble = document.createElement('div');
      loadingBubble.className = 'bseb-chat-bubble bseb-chat-bubble--loading';
      loadingBubble.textContent = t.thinking;
      loadingRow.appendChild(loadingBubble);
      messagesEl.appendChild(loadingRow);
    }

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function applyCopy() {
    const t = COPY[state.lang];
    fabText.textContent = t.fabLabel;
    titleEl.textContent = t.title;
    subtitleEl.textContent = t.subtitle;
    langBtn.textContent = t.langSwitch;
    clearBtn.title = t.clearTitle;
    clearBtn.setAttribute('aria-label', t.clearTitle);
    closeBtn.title = t.closeTitle;
    closeBtn.setAttribute('aria-label', t.closeTitle);
    input.placeholder = t.placeholder;
    sendBtn.setAttribute('aria-label', t.send);
    renderMessages();
  }

  function setOpen(nextOpen) {
    state.open = nextOpen;
    panel.hidden = !nextOpen;
    fab.classList.toggle('is-open', nextOpen);
    fab.setAttribute('aria-expanded', String(nextOpen));
    if (nextOpen) {
      renderMessages();
      setTimeout(() => input.focus(), 40);
    }
  }

  async function sendQuestion(rawText, skipUserPush = false) {
    const text = String(rawText || '').trim();
    if (!text || state.loading) return;

    state.lastFailedQuery = null;
    if (!skipUserPush) {
      state.messages.push({ role: 'user', text });
    }
    state.loading = true;
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    saveSession();
    renderMessages();

    const historyPayload = state.messages
      .slice(0, -1)
      .filter((m) => !m.isError)
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          lang: state.lang,
          currentPath: window.location.pathname || '/',
          history: historyPayload,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not reach BSEB Assistant right now.');
      }

      state.messages.push({
        role: 'assistant',
        text: data.answer || '',
        links: Array.isArray(data.links) ? data.links : [],
        followUps: Array.isArray(data.followUps) ? data.followUps : [],
      });
    } catch (err) {
      state.lastFailedQuery = text;
      state.messages.push({
        role: 'assistant',
        text: err && err.message ? err.message : 'Something went wrong. Please try again.',
        isError: true,
      });
    } finally {
      state.loading = false;
      input.disabled = false;
      sendBtn.disabled = false;
      saveSession();
      renderMessages();
      if (state.open) input.focus();
    }
  }

  // Event Listeners
  fab.addEventListener('click', () => setOpen(!state.open));
  closeBtn.addEventListener('click', () => {
    setOpen(false);
    fab.focus();
  });

  langBtn.addEventListener('click', () => {
    state.lang = state.lang === 'en' ? 'hi' : 'en';
    saveSession();
    applyCopy();
  });

  clearBtn.addEventListener('click', () => {
    state.messages = [];
    state.lastFailedQuery = null;
    saveSession();
    renderMessages();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sendQuestion(input.value);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.open) {
      setOpen(false);
      fab.focus();
    }
  });

  loadSession();
  applyCopy();
})();
