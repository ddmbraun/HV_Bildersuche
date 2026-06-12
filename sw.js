// Service Worker – HV Bild-Suche
// index.html: Network-first (Updates kommen sofort an, Cache nur als Offline-Fallback)
// CDN-Bibliotheken: Cache-first (ändern sich nie, Version steckt in der URL)
// Drive-API-Daten werden NICHT gecacht (brauchen Auth-Token)

const CACHE_NAME = 'hv-bild-v4'; // v4: K2 Network-first für index.html, G4 Offline-Fallback · v3: K1 vorladenAlle entfernt · v2: script.google.com ausgeschlossen
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css',
  'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  // 'https://accounts.google.com/gsi/client' entfernt:
  // Google liefert diesen Script mit Cache-Control: no-store – SW-Installation
  // schlägt fehl, wenn cache.addAll() diese URL nicht cachen kann.
];

// Installation: alles vorab cachen
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Aktivierung: alte Caches löschen
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch-Strategie:
// - Google APIs (Drive, Sheets, accounts, GAS): immer Netzwerk (brauchen Auth)
// - App selbst (Navigation / index.html): NETWORK-FIRST – frische Version laden,
//   Cache aktualisieren; nur offline aus dem Cache bedienen (K2)
// - CDN-Libs & Rest: Cache-first mit Offline-Fallback (G4)
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // API-Aufrufe immer live
  if (url.includes('googleapis.com') ||
      url.includes('accounts.google.com') ||
      url.includes('drive.google.com') ||
      url.includes('script.google.com')) {
    return; // Browser-Standard (kein SW-Cache)
  }

  // App-Shell: Network-first
  const istApp = e.request.mode === 'navigate' ||
                 url.endsWith('/index.html') ||
                 url.endsWith('/');
  if (istApp) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      }).catch(() =>
        caches.match(e.request).then(c => c || caches.match('./index.html'))
      )
    );
    return;
  }

  // Alles andere: Cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (e.request.method === 'GET' && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      }).catch(() =>
        new Response('Offline – Ressource nicht im Cache.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        })
      );
    })
  );
});
