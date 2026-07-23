// Service Worker – HV Bild-Suche
// index.html: Network-first (Updates kommen sofort an, Cache nur als Offline-Fallback)
// CDN-Bibliotheken: Cache-first (ändern sich nie, Version steckt in der URL)
// Drive-API-Daten werden NICHT gecacht (brauchen Auth-Token)

const CACHE_NAME = 'hv-bild-v20'; // v20: 🔢 ZAHLEN ALS ZAHL SUCHEN (Befund Frank: "Bei Alkenbrecher Urbicher und 13 kommt auch welche mit Datum 13"). Die Suche verglich stur Zeichenfolgen, dadurch traf "13" auch das JAHR in Ordnern wie "Niedernissa/2013/AHV Urbicher Weg 11-17", die Hausnummer "113" und ueber die blind mitdurchsuchte Datumsspalte jedes Foto vom 13. eines beliebigen Monats. Neu: Ein rein numerischer Begriff muss als eigenstaendige Zahl dastehen - Regex (^|[^0-9])ZAHL([^0-9]|$) - findet also "Weg 13", "11-13" und "Weg_13_WHG", aber NICHT "2013", "113" oder "1300". Die Datumsspalte wird ausserdem nur noch fuer datumsartige Begriffe geprueft (vierstellige Zahl wie "2015" oder etwas mit Punkt wie "19.02.15"); Jahressuche bleibt damit erhalten. Die Pruefer entstehen EINMAL pro Suche, nicht pro Zeile - sonst waeren es bei 19.000 Zeilen ebenso viele RegExp-Objekte. Gemessen an echten NAS-Pfaden: "urbicher 13" vorher 10 Treffer, nachher 4 - weggefallen sind genau die drei 2013-Jahresordner und die drei Fotos mit Aufnahmedatum 13.xx. Geschwindigkeit bei 19.010 Zeilen 53-85 ms, unveraendert. · v19: 🔤 UMLAUTE UND ß IN DER SUCHE (Befund Frank: "wenn ich das Suche findet es den Ordner nicht"). normalisiereStr() fasst jetzt zusaetzlich zusammen: ae/ä→a, oe/ö→o, ue/ü→u, ss/ß→s - auf BEIDE Seiten (Suchbegriff UND Datenbasis), daher passt es immer zusammen. Reihenfolge: erst str./pl. aufloesen (erzeugt "straße"), dann zusammenfassen. VORHER schlugen im Test fehl: "muhlweg"/"muehlweg" fanden "Mühlweg 5" nicht, "lons"/"loens" fanden "Hermann-Löns-Str. 5" nicht, "schutzenstrasse" fand "Schützenstraße 12" nicht - und besonders heimtueckisch: "bahnhofstraße" fand "Bahnhofstrasse 1" NICHT, hier ging es gar nicht um Tippfehler, sondern darum dass die Ordnernamen in Drive mal mit ß und mal mit ss geschrieben sind. Am Handy kommt dazu, dass Umlaute langes Druecken erfordern. NACHHER: alle 23 geprueften Schreibvarianten finden. Gegenproben bestanden (Unsinnswort → 0 Treffer, gezielte Suche liefert weiterhin nur die passenden Zeilen, Nachbarstrassen kommen nicht mit). Geschwindigkeit bei 19.010 Zeilen gemessen: 52-91 ms pro Suche, unveraendert unauffaellig. · v18: 📋 ORDNER-TREFFERLISTE (Wunsch Frank: "ich moechte eine Liste ... mit den Ordnern die meine Suchbegriffe enthalten"): Der Ordner-Modus zeigte bisher nur die Unterordner der AKTUELLEN Ebene - bei "wbg hermann" kam also zuerst nur "WBG Bad Langensalza", der eigentlich gesuchte Ordner erschien erst nach dem Hineintippen. Neu: Sobald man im Ordner-Modus sucht UND ganz oben steht (Alle Ordner), erscheint statt der Ebenen-Kacheln eine flache Liste ALLER passenden Ordner mit vollem Pfad (Elternpfad grau, Ordnername fett) und Trefferzahl; ein Tipp springt direkt dorthin. Sucht bewusst im GANZEN Bestand - das umgeht zugleich die Falle, dass eine Suche innerhalb eines Ordners nur dort sucht. Beruecksichtigt den Geo-Filter, alphabetisch deutsch sortiert, bei mehr als 80 Ordnern wird die Restzahl ausdruecklich genannt statt still abgeschnitten. Zurueck zur Liste ueber "Alle Ordner"; ohne Suchbegriff bleibt alles wie bisher. · v17: ⚙ EINSTELLUNGS-MENUE AM HANDY (Wunsch Frank: "gar keine Einstellungs-Taste wie bei den anderen ... sieht ganz schoen unuebersichtlich aus"): In #ergebnis-leiste lagen NEUN gleich aussehende Knoepfe nebeneinander (3x Sortierung, 3x Ansicht/Ordner, Auswaehlen, 2x Filter, Aktualisieren) - am Handy brachen die auf vier Zeilen um; mit Kopfzeile, Statuszeile, "Stand:" und Brotkrumen waren rund sechs Zeilen belegt, bevor das erste Bild kam. Neu: Zahnrad-Knopf in der blauen Kopfzeile oeffnet ein Menue von rechts; Sortierung, Filter, Aktualisieren (+ "Stand:") und Abmelden liegen dort in benannten Gruppen. Sichtbar bleiben nur Trefferzahl, Liste/Kacheln, Ordner und Auswaehlen (Auswaehlen ist ein Modus und braucht einen erreichbaren Ausschalter). WICHTIG: Die Knoepfe werden UMGEHAENGT, nicht verdoppelt - es sind dieselben DOM-Elemente, daher gelten alle bisherigen Klick-Handler und der .aktiv-Zustand unveraendert weiter, nichts muss abgeglichen werden. GILT NUR BIS 600 px BREITE: am PC bleibt die Leiste exakt wie vorher, das Zahnrad ist dort gar nicht sichtbar; beim Wechsel auf einen breiten Bildschirm wandern alle Knoepfe in ihre urspruengliche Reihenfolge zurueck (Rueckweg gemessen und bestaetigt). Zusaetzlicher entprellter resize-Horcher als Sicherheitsnetz - im Test blieb die matchMedia-Meldung einmal aus, die Knoepfe saessen dann im ausgeblendeten Menue fest und waeren am PC unerreichbar gewesen. Zahnrad sitzt in #nutzer-info und erscheint damit automatisch erst nach dem Anmelden. Messung bei 390 px: Ergebnis-Leiste 189 -> 47 px, Galerie beginnt bei 369 -> 184 px = 178 px bzw. rund ein Fuenftel Bildschirm mehr fuer Bilder. · v16: 🖼 BILDER BLEIBEN AUF DEM GERAET (Wunsch Frank: keine langen Ladezeiten unterwegs): (1) GROSSANSICHT laedt nicht mehr das ORIGINAL - bisher holte ladeAlsBlobUrl bei JEDEM Oeffnen die volle Datei (Handyfoto 3-8 MB) und verwarf sie danach wieder; dasselbe Bild am naechsten Tag erneut oeffnen = erneut alles laden. Jetzt wird die 1600-px-Fassung ueber thumbnailLink geholt (~200-400 KB, fuer jeden Bildschirm mehr als ausreichend, rund 15x schneller) UND im vorhandenen IndexedDB-Speicher abgelegt (Schluessel <fileId>::ansicht1600). Folge: Jedes einmal geoeffnete Bild ist beim naechsten Mal SOFORT da - ohne dass vorher irgendetwas ausgewaehlt werden muss (Frank: "Ich weiss ja nicht, welche Bilder ich brauche"). Rueckfall auf das Original bleibt, falls Drive keine Vorschau liefert. UNBERUEHRT: Download, ZIP, PDF, "Sauber teilen" und der 360-Grad-Viewer holen weiterhin das ORIGINAL ueber eigene alt=media-Aufrufe. (2) DAUERHAFTER SPEICHER: navigator.storage.persist() wird beim Start beantragt - ohne diese Zusage darf der Browser die gespeicherten Bilder bei Platzmangel jederzeit wegraeumen, danach laedt wieder alles neu. Bewusstes Abmelden loescht sie weiterhin (Datenschutz, unveraendert). · v15: 🖼 VORSCHAUBILDER ZUVERLÄSSIGER – die drei <img>-Elemente (Galerie-Kachel Z.~1631, Ordner-Browser-Kachel Z.~2139, Modal-Großbild Z.~902) senden jetzt referrerpolicy="no-referrer". Google liefert Drive-Bilder (drive.google.com/thumbnail?id=…&sz=w400 bzw. w1600) OHNE Referrer deutlich zuverlässiger aus; bisher schlugen bei großen Beständen regelmäßig Kacheln fehl (rote Konsolenfehler) und liefen unnötig in den Drive-API-Rückfall, der statt eines ~30-KB-Thumbnails das ORIGINAL lädt und clientseitig verkleinert (Zeit + Datenvolumen, besonders am iPhone). Reine Attribut-Ergänzung am Element – wirkt für alle Ladewege (Sheet-Vorschau-URL, Modal-Platzhalter, Kein-Token-Fallback); Blob-URLs aus IndexedDB/Drive-API sind davon unberührt, Logik unverändert. Gleiche Ursache und gleicher Fix wie PAM-Desktop b504 (23.07.2026). · v14: Ordner-Browser (Drive-Struktur aus Spalte G, Drill-down + Breadcrumb) · v13: Bugfixes
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
