/* Service worker — caches the application shell only.
   Queue positions and application data are never served from cache:
   a stale queue position is worse than no queue position. */

const CACHE = 'fopwa-shell-v21';
const SHELL = [
  './index.html',
  './officer.html',
  './css/app.css',
  './css/officer.css',
  './js/i18n.js',
  './js/i18n-content.js',
  './js/barcode.js',
  './js/store.js',
  './js/form-reg343.js',
  './js/chat.js',
  './js/app.js',
  './js/officer.js',
  './js/pdf-fill.js',
  './vendor/pdf-lib.min.js',
  './assets/dmv-logo.png',
  './manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;          // never cache third-party
  if (url.pathname.includes('/api/')) return;          // live data only

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
