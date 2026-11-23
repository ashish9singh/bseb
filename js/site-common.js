/* ==========================================================================
   BSEBWALA.IN — SHARED SITE UTILITIES, THEME, MOBILE NAV & ASSISTANT LOADER
   ========================================================================== */
(function initBsebCommon() {
  'use strict';

  const THEME_STORAGE_KEY = 'bseb-hub-theme';

  /**
   * Validates that a URL is either a safe relative path ("/...") or an http(s) URL.
   * Blocks javascript:, data:, vbscript:, and malformed URLs.
   */
  function safeHttpUrl(rawUrl, allowRelative = false) {
    if (typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;

    if (allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return trimmed;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.href;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Lightweight debounce utility for search inputs.
   */
  function debounce(fn, delayMs = 120) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delayMs);
    };
  }

  /**
   * Neutralizes leading spreadsheet formula characters (=, +, -, @, tab, CR)
   * when submitting user text to Google Sheets.
   */
  function neutralizeSpreadsheetFormula(value) {
    const str = String(value || '');
    return /^[=+\-@\t\r]/.test(str) ? "'" + str : str;
  }

  window.BSEBCommon = {
    safeHttpUrl,
    debounce,
    neutralizeSpreadsheetFormula,
  };

  function setupThemeToggle() {
    const root = document.documentElement;
    const btn = document.getElementById('themeToggle');
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    function isCurrentlyDark() {
      const attr = root.getAttribute('data-theme');
      if (attr === 'dark') return true;
      if (attr === 'light') return false;
      return mediaQuery.matches;
    }

    function applyTheme(theme) {
      if (theme === 'dark' || theme === 'light') {
        root.setAttribute('data-theme', theme);
      } else {
        root.removeAttribute('data-theme');
      }
      if (btn) {
        const dark = isCurrentlyDark();
        btn.textContent = dark ? '☀️' : '🌙';
        btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        btn.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
      }
    }

    let saved = null;
    try {
      saved = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      saved = null;
    }
    applyTheme(saved);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', () => {
        if (!root.getAttribute('data-theme')) applyTheme(null);
      });
    }

    if (btn) {
      btn.addEventListener('click', () => {
        const next = isCurrentlyDark() ? 'light' : 'dark';
        applyTheme(next);
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // Ignore storage quota errors
        }
      });
    }
  }

  function setupMobileMenu() {
    const menuBtn = document.getElementById('menuToggle');
    const nav = document.querySelector('.main-nav');
    if (!menuBtn || !nav) return;

    function setOpen(open) {
      nav.classList.toggle('open', open);
      menuBtn.textContent = open ? '✕' : '☰';
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    setOpen(false);

    menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!nav.classList.contains('open'));
    });

    nav.addEventListener('click', (e) => {
      if (e.target && e.target.closest('a')) {
        setOpen(false);
      }
    });

    document.addEventListener('click', (e) => {
      if (nav.classList.contains('open') && !nav.contains(e.target) && !menuBtn.contains(e.target)) {
        setOpen(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        setOpen(false);
        menuBtn.focus();
      }
    });
  }

  function loadAssistantWidget() {
    if (document.getElementById('bseb-assistant-script')) return;
    const script = document.createElement('script');
    script.id = 'bseb-assistant-script';
    script.src = '/js/bseb-assistant.js';
    script.defer = true;
    document.body.appendChild(script);
  }

  function bootstrap() {
    setupThemeToggle();
    setupMobileMenu();
    loadAssistantWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
