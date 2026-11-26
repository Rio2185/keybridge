/*
  KeyBridge Service Worker – Offline-Fähigkeit
  - App-Seite (gleiche Herkunft): NETZ ZUERST -> online immer aktuell (kein Alte-Version-Problem),
    offline aus dem Cache.
  - Scanner-Bibliotheken (jsQR / ZXing von CDN): CACHE ZUERST -> einmal online laden, dann offline da.
  - PartSurfer u. a. fremde Seiten: unberührt (laufen normal übers Netz).
*/
const CACHE = 'keybridge-cache-v1';
const PRECACHE = [
  './keybridge-app.html',
  'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'
];
const isLib = u => /cdnjs\.cloudflare\.com\/ajax\/libs\/jsQR|cdn\.jsdelivr\.net\/npm\/@zxing/.test(u);

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(PRECACHE.map(u => c.add(u)))));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Scanner-Bibliotheken: Cache zuerst (ändern sich nie, Version ist fix)
  if (isLib(req.url)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try { const res = await fetch(req); if (res && res.ok) c.put(req, res.clone()); return res; }
      catch (_) { return hit || Response.error(); }
    }));
    return;
  }

  // Eigene App-Dateien: Netz zuerst, Cache als Offline-Rückfall
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res && res.ok) c.put(req, res.clone());
        return res;
      } catch (_) {
        return (await c.match(req, { ignoreSearch: true }))
            || (await c.match('./keybridge-app.html'))
            || Response.error();
      }
    })());
  }
  // alles andere: nicht abfangen -> normales Netzverhalten
});
