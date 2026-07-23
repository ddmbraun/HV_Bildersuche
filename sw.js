// Service Worker – HV Bild-Suche
// index.html: Network-first (Updates kommen sofort an, Cache nur als Offline-Fallback)
// CDN-Bibliotheken: Cache-first (ändern sich nie, Version steckt in der URL)
// Drive-API-Daten werden NICHT gecacht (brauchen Auth-Token)

const CACHE_NAME = 'hv-bild-v16'; // v16: 🖼 BILDER BLEIBEN AUF DEM GERAET (Wunsch Frank: keine langen Ladezeiten unterwegs): (1) GROSSANSICHT laedt nicht mehr das ORIGINAL - bisher holte ladeAlsBlobUrl bei JEDEM Oeffnen die volle Datei (Handyfoto 3-8 MB) und verwarf sie danach wieder; dasselbe Bild am naechsten Tag erneut oeffnen = erneut alles laden. Jetzt wird die 1600-px-Fassung ueber thumbnailLink geholt (~200-400 KB, fuer jeden Bildschirm mehr als ausreichend, rund 15x schneller) UND im vorhandenen IndexedDB-Speicher abgelegt (Schluessel <fileId>::ansicht1600). Folge: Jedes einmal geoeffnete Bild ist beim naechsten Mal SOFORT da - ohne dass vorher irgendetwas ausgewaehlt werden muss (Frank: "Ich weiss ja nicht, welche Bilder ich brauche"). Rueckfall auf das Original bleibt, falls Drive keine Vorschau liefert. UNBERUEHRT: Download, ZIP, PDF, "Sauber teilen" und der 360-Grad-Viewer holen weiterhin das ORIGINAL ueber eigene alt=media-Aufrufe. (2) DAUERHAFTER SPEICHER: navigator.storage.persist() wird beim Start beantragt - ohne diese Zusage darf der Browser die gespeicherten Bilder bei Platzmangel jederzeit wegraeumen, danach laedt wieder alles neu. Bewusstes Abmelden loescht sie weiterhin (Datenschutz, unveraendert). · v15: 🖼 VORSCHAUBILDER ZUVERLÄSSIGER – die drei <img>-Elemente (Galerie-Kachel Z.~1631, Ordner-Browser-Kachel Z.~2139, Modal-Großbild Z.~902) senden jetzt referrerpolicy="no-referrer". Google liefert Drive-Bilder (drive.google.com/thumbnail?id=…&sz=w400 bzw. w1600) OHNE Referrer deutlich zuverlässiger aus; bisher schlugen bei großen Beständen regelmäßig Kacheln fehl (rote Konsolenfehler) und liefen unnötig in den Drive-API-Rückfall, der statt eines ~30-KB-Thumbnails das ORIGINAL lädt und clientseitig verkleinert (Zeit + Datenvolumen, besonders am iPhone). Reine Attribut-Ergänzung am Element – wirkt für alle Ladewege (Sheet-Vorschau-URL, Modal-Platzhalter, Kein-Token-Fallback); Blob-URLs aus IndexedDB/Drive-API sind davon unberührt, Logik unverändert. Gleiche Ursache und gleicher Fix wie PAM-Desktop b504 (23.07.2026). · v14: Ordner-Browser (Drive-Struktur aus Spalte G, Drill-down + Breadcrumb) · v13: Bugfixes
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
