/* ==========================================================================
   BSEBWALA.IN — SHARED SITE UTILITIES, SLOW-NETWORK ADAPTATION, THEME,
   DEFERRED ANALYTICS/ADS, SERVICE WORKER & ASSISTANT LOADER
   ========================================================================== */
(function initBsebCommon() {
  'use strict';

  const THEME_STORAGE_KEY = 'bseb-hub-theme';
  const GA_MEASUREMENT_ID = 'G-JNFE9PSTH3';
  const ADSENSE_CLIENT_ID = 'ca-pub-7625973314285149';

  /**
   * Activates non-blocking Google Fonts stylesheets loaded with media="print"
   * without using inline onload= attributes (strict CSP compliant).
   */
  function activateAsyncFonts() {
    const links = document.querySelectorAll('link[data-async-font]');
    links.forEach((link) => {
      if (link.sheet) {
        link.media = 'all';
      } else {
        link.addEventListener('load', () => {
          link.media = 'all';
        }, { once: true });
        // Safety fallback so fonts always swap in even if load already fired
        setTimeout(() => {
          link.media = 'all';
        }, 400);
      }
    });
  }

  /**
   * Detects slow cellular connections (2G / slow-2g) or user Data Saver mode.
   */
  function isSlowNetwork() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return false;
    if (conn.saveData) return true;
    return conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
  }

  function applyNetworkClass() {
    const slow = isSlowNetwork();
    document.documentElement.classList.toggle('slow-network', slow);
  }

  // Apply immediately as soon as script executes
  applyNetworkClass();
  activateAsyncFonts();

  const netConn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (netConn && typeof netConn.addEventListener === 'function') {
    netConn.addEventListener('change', applyNetworkClass);
  }

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
    isSlowNetwork,
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

  /**
   * Smart link prefetching on hover/pointerdown ONLY on fast networks
   * (never wastes mobile data on 2G or Data-Saver).
   */
  function setupFastNavPrefetch() {
    if (isSlowNetwork()) return;
    const prefetched = new Set();
    const nav = document.querySelector('.main-nav');
    if (!nav) return;

    function prefetchHref(anchor) {
      if (!anchor || isSlowNetwork()) return;
      const href = anchor.getAttribute('href') || '';
      if (!href.startsWith('/') || href.startsWith('//') || prefetched.has(href)) return;
      if (href === window.location.pathname) return;
      prefetched.add(href);
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      link.as = 'document';
      document.head.appendChild(link);
    }

    nav.addEventListener('pointerenter', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (a) prefetchHref(a);
    }, true);

    nav.addEventListener('pointerdown', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (a) prefetchHref(a);
    }, true);
  }

  function loadAssistantWidget() {
    if (document.getElementById('bseb-assistant-script')) return;
    const script = document.createElement('script');
    script.id = 'bseb-assistant-script';
    script.src = '/js/bseb-assistant.js';
    script.defer = true;
    document.body.appendChild(script);
  }

  /**
   * Loads third-party Google Analytics & AdSense strictly after page load + idle
   * so they never block first paint or compete for bandwidth on slow 2G/3G networks.
   */
  function scheduleDeferredThirdParty() {
    const run = () => {
      if (!window.__bsebAnalyticsLoaded) {
        window.__bsebAnalyticsLoaded = true;
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', GA_MEASUREMENT_ID, { transport_type: 'beacon' });

        const gaScript = document.createElement('script');
        gaScript.async = true;
        gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        document.head.appendChild(gaScript);
      }

      // Skip eager AdSense script on Save-Data / 2G until idle delay so content loads cleanly first
      const adDelay = isSlowNetwork() ? 3500 : 1200;
      setTimeout(() => {
        if (window.__bsebAdsLoaded) return;
        window.__bsebAdsLoaded = true;
        const adScript = document.createElement('script');
        adScript.async = true;
        adScript.crossOrigin = 'anonymous';
        adScript.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
        document.head.appendChild(adScript);
      }, adDelay);
    };

    const scheduleIdle = () => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(run, { timeout: 3000 });
      } else {
        setTimeout(run, 1500);
      }
    };

    if (document.readyState === 'complete') {
      scheduleIdle();
    } else {
      window.addEventListener('load', scheduleIdle, { once: true });
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silently ignore if SW registration is unavailable in sandboxed previews
      });
    }, { once: true });
  }

  function bootstrap() {
    activateAsyncFonts();
    setupThemeToggle();
    setupMobileMenu();
    setupFastNavPrefetch();
    loadAssistantWidget();
    scheduleDeferredThirdParty();
    registerServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
