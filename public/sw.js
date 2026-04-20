const CACHE_NAME = 'timelog-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/charts.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Notification click (Stop from lock screen / shade) ──
self.addEventListener('notificationclick', (event) => {
  const tag = event.notification.tag;
  event.notification.close();

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    let client = allClients.find(c => 'focus' in c);
    if (client) {
      await client.focus();
      client.postMessage({ type: 'stop-session', tag, action: event.action || 'open' });
    } else {
      // No open window — open the app; it will resync state on load
      const newWin = await self.clients.openWindow('/');
      // Defer posting until client is ready; app will also detect active session via API on init
      setTimeout(() => {
        if (newWin) newWin.postMessage({ type: 'stop-session', tag, action: event.action || 'open' });
      }, 2000);
    }
  })());
});

self.addEventListener('notificationclose', () => { /* no-op */ });
