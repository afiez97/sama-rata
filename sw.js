// Caches the static app shell so the UI still loads offline (spotty signal
// while traveling is the whole reason this matters). Trip data itself is
// never cached — every "/api/" request always goes straight to the network,
// so nobody ever sees stale balances.
const CACHE_VERSION = 'sama-rata-shell-v1';
const APP_SHELL = [
  '.',
  'index.html',
  'css/style.css',
  'js/state.js',
  'js/api.js',
  'js/settlement.js',
  'js/render.js',
  'js/app.js',
  'js/trips-history.js',
  'js/vendor/qrcode.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return;

  // Navigations (opening/reloading the page): try the network first so a
  // connected user always gets the latest shell, falling back to the
  // cached one when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('index.html')));
    return;
  }

  // Everything else (css/js/icons): cache-first, populating the cache with
  // whatever wasn't precached yet (e.g. a font or icon added later).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
