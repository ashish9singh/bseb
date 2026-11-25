/* ==========================================================================
   BSEBWALA.IN — LIGHTWEIGHT SLOW-NETWORK & OFFLINE SERVICE WORKER
   Stale-While-Revalidate for CSS/JS/Images, Network-First with Fast Cache
   Fallback for HTML pages & search index. Never caches POST /api/chat.
   ========================================================================== */
'use strict';

const CACHE_VERSION = 'bsebwala-v2';
const CORE_ASSETS = [
  '/',
  '/style.css',
  '/js/site-common.js',
  '/js/bseb-assistant.js',
  '/api/search-index.json',
];

const STATIC_EXT_RE = /\.(css|js|jpg|jpeg|png|webp|svg|woff2|pdf)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache live status checks or chat calls
  if (url.pathname === '/api/assistant/status' || url.pathname === '/api/chat') return;

  // Stale-while-revalidate for static assets and search index (instant on slow 2G/3G)
  if (STATIC_EXT_RE.test(url.pathname) || url.pathname === '/api/search-index.json') {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(req).then((cached) => {
          const networkPromise = fetch(req)
            .then((res) => {
              if (res && res.ok) {
                cache.put(req, res.clone());
              }
              return res;
            })
            .catch(() => cached);

          return cached || networkPromise;
        })
      )
    );
    return;
  }

  // Network-first with 4s timeout fallback to cache for HTML page navigations
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        return fetch(req, { signal: controller.signal })
          .then((res) => {
            clearTimeout(timeoutId);
            if (res && res.ok) {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => {
            clearTimeout(timeoutId);
            return cache.match(req).then((cached) => cached || cache.match('/'));
          });
      })
    );
  }
});
