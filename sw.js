// Service Worker – HV Bild-Suche
// index.html: Network-first (Updates kommen sofort an, Cache nur als Offline-Fallback)
// CDN-Bibliotheken: Cache-first (ändern sich nie, Version steckt in der URL)
// Drive-API-Daten werden NICHT gecacht (brauchen Auth-Token)

const CACHE_NAME = 'hv-bild-v23'; // v23: 🔧 NACHTRAG ZU v22 - die Anmeldung scheiterte mit "Load failed" (Safari-Wortlaut fuer: Anfrage ging gar nicht erst raus). Ursache: Die Seite hat eine Content-Security-Policy, deren connect-src auflistet, welche Server ueberhaupt kontaktiert werden duerfen - und die Cloud Function stand NICHT drin. Der Browser blockierte den Ticket-Tausch, bevor er das Geraet verliess; von Google kam nie eine Fehlermeldung, weil Google nie gefragt wurde. PAM Mobil hat keine solche Regel, deshalb trat es dort nie auf. Fix: https://europe-west1-ptp-workboard.cloudfunctions.net in connect-src ergaenzt. Uebrige Direktiven geprueft - kein form-action/navigate-to vorhanden, die Umleitung zu accounts.google.com war also nie betroffen (deshalb kam der Code auch zurueck und der Fehler erst beim Tausch). · v22: 🔐 DAUERHAFTE ANMELDUNG (Befund Frank: "wenn ich die App schliesse muss ich mich komplett neu anmelden"). Ursache: Die App holte ueber initTokenClient nur einen KURZZEIT-Schluessel, der ausschliesslich im Arbeitsspeicher lag - App zu, Schluessel weg; zusaetzlich lief er nach ~1 Stunde ab (der lange offene Punkt N6). Der PWA-Login-Umbau vom 23.07. galt nur PAM Mobil, die Bild-Suche hatte davon nichts. NEU, gleiches Verfahren wie PAM Mobil v119: Anmeldung ueber den Authorization-Code-Weg (volle Seitenumleitung statt Popup, funktioniert auch in der installierten App), die Cloud Function tauscht den Code gegen ein DAUER-TICKET; dazu das Einmal-Code-Schliessfach, weil installierte App und Login-Browser getrennte Speicher haben. WICHTIG: Die Bild-Suche benutzt ab jetzt DENSELBEN OAuth-Ausweis wie PAM (56419258975-…, Projekt ptp-workboard) statt des eigenen aus hausverwaltung-bilder - dadurch war KEINE Aenderung an der Cloud Function noetig, sie bekommt die Rueckkehr-Adresse ohnehin pro Aufruf mitgeschickt. Eigene Speicher-Schluesselnamen (hv_gdrive_refresh_token / hv_handoff_code), weil PAM Mobil unter derselben Adresse ddmbraun.github.io liegt und sich den Geraetespeicher teilt. Stuendliche Erneuerung laeuft lautlos im Hintergrund und laedt die Tabelle NICHT neu (Parameter nurSchluessel). Abmelden loescht Dauer-Ticket und Schliessfach-Code mit. Der alte GIS-Weg bleibt als Rueckfall. Der Python-Scanner ist unberuehrt - eigener Desktop-Ausweis im Projekt hausverwaltung-bilder. VORAUSSETZUNGEN in der Konsole (erledigt 23.07.): Google Sheets API im Projekt ptp-workboard aktiviert; https://ddmbraun.github.io/HV_Bildersuche/ als Weiterleitungs-URI beim PAM-Client eingetragen. · v21: DREI PUNKTE (Frank freigegeben). (1) 🔎 NUR ORDNERNAME: neuer Schalter im Zahnrad-Menue. Anlass: Suche "wilhelm kuelz" brachte auch Bilder aus "Gorkistrasse 19". Ursache war NICHT die Suche, sondern die Datenbasis - die Adressspalte entsteht aus dem GPS des Fotos, und bei ungenauem Empfang landet der Punkt daneben; Gorkistrasse 19 und Wilhelm-Kuelz-Strasse liegen 327 m auseinander, beide in Erfurt-Bruehlervorstadt (nachgemessen ueber Nominatim). Frank hat am geoeffneten Bild bestaetigt, dass dort die falsche Adresse steht. Mit dem Schalter zaehlt nur noch der Ordnerpfad, also Franks eigene Ablage. Gemessen an seinem echten Fall: AUS 5 Ordner (davon 3 falsch), AN 2 Ordner (genau die richtigen). Einstellung wird in localStorage gemerkt (hv_nur_ordner). (2) KNOEPFE UMBENANNT: "📍 Nur GPS" → "📍 Mit GPS", "📂 Nur Ordnerpfad" → "🚫 Ohne GPS". Der alte Name legte nahe, der Knopf wuerde die SUCHE auf den Ordnerpfad beschraenken - tatsaechlich filtert er die BILDER auf solche ohne GPS-Koordinaten. Frank ist genau darueber gestolpert. (3) ZURUECK-KNOPF DES HANDYS: Bisher verliess ein Druck auf "Zurueck" die App komplett, weil sie keinen eigenen Verlauf fuehrte - am Handy der haeufigste Griff. Jetzt nimmt "Zurueck" die zuletzt geoeffnete Ebene zurueck: 360-Grad-Ansicht → Bild → Menue → eine Ordnerebene hoch → Suche leeren → erst dann App verlassen. Bewusst ZUSTANDSBASIERT statt ueber einen Stapel gemerkter Schritte, damit Verlauf und Anzeige nicht auseinanderlaufen koennen, egal ob vorher per ✕, Fingertipp daneben oder Esc geschlossen wurde. Alle sechs Stufen einzeln durchgetestet. · v20: 🔢 ZAHLEN ALS ZAHL SUCHEN (Befund Frank: "Bei Alkenbrecher Urbicher und 13 kommt auch welche mit Datum 13"). Die Suche verglich stur Zeichenfolgen, dadurch traf "13" auch das JAHR in Ordnern wie "Niedernissa/2013/AHV Urbicher Weg 11-17", die Hausnummer "113" und ueber die blind mitdurchsuchte Datumsspalte jedes Foto vom 13. eines beliebigen Monats. Neu: Ein rein numerischer Begriff muss als eigenstaendige Zahl dastehen - Regex (^|[^0-9])ZAHL([^0-9]|$) - findet also "Weg 13", "11-13" und "Weg_13_WHG", aber NICHT "2013", "113" oder "1300". Die Datumsspalte wird ausserdem nur noch fuer datumsartige Begriffe geprueft (vierstellige Zahl wie "2015" oder etwas mit Punkt wie "19.02.15"); Jahressuche bleibt damit erhalten. Die Pruefer entstehen EINMAL pro Suche, nicht pro Zeile - sonst waeren es bei 19.000 Zeilen ebenso viele RegExp-Objekte. Gemessen an echten NAS-Pfaden: "urbicher 13" vorher 10 Treffer, nachher 4 - weggefallen sind genau die drei 2013-Jahresordner und die drei Fotos mit Aufnahmedatum 13.xx. Geschwindigkeit bei 19.010 Zeilen 53-85 ms, unveraendert. · v19: 🔤 UMLAUTE UND ß IN DER SUCHE (Befund Frank: "wenn ich das Suche findet es den Ordner nicht"). normalisiereStr() fasst jetzt zusaetzlich zusammen: ae/ä→a, oe/ö→o, ue/ü→u, ss/ß→s - auf BEIDE Seiten (Suchbegriff UND Datenbasis), daher passt es immer zusammen. Reihenfolge: erst str./pl. aufloesen (erzeugt "straße"), dann zusammenfassen. VORHER schlugen im Test fehl: "muhlweg"/"muehlweg" fanden "Mühlweg 5" nicht, "lons"/"loens" fanden "Hermann-Löns-Str. 5" nicht, "schutzenstrasse" fand "Schützenstraße 12" nicht - und besonders heimtueckisch: "bahnhofstraße" fand "Bahnhofstrasse 1" NICHT, hier ging es gar nicht um Tippfehler, sondern darum dass die Ordnernamen in Drive mal mit ß und mal mit ss geschrieben sind. Am Handy kommt dazu, dass Umlaute langes Druecken erfordern. NACHHER: alle 23 geprueften Schreibvarianten finden. Gegenproben bestanden (Unsinnswort → 0 Treffer, gezielte Suche liefert weiterhin nur die passenden Zeilen, Nachbarstrassen kommen nicht mit). Geschwindigkeit bei 19.010 Zeilen gemessen: 52-91 ms pro Suche, unveraendert unauffaellig. · v18: 📋 ORDNER-TREFFERLISTE (Wunsch Frank: "ich moechte eine Liste ... mit den Ordnern die meine Suchbegriffe enthalten"): Der Ordner-Modus zeigte bisher nur die Unterordner der AKTUELLEN Ebene - bei "wbg hermann" kam also zuerst nur "WBG Bad Langensalza", der eigentlich gesuchte Ordner erschien erst nach dem Hineintippen. Neu: Sobald man im Ordner-Modus sucht UND ganz oben steht (Alle Ordner), erscheint statt der Ebenen-Kacheln eine flache Liste ALLER passenden Ordner mit vollem Pfad (Elternpfad grau, Ordnername fett) und Trefferzahl; ein Tipp springt direkt dorthin. Sucht bewusst im GANZEN Bestand - das umgeht zugleich die Falle, dass eine Suche innerhalb eines Ordners nur dort sucht. Beruecksichtigt den Geo-Filter, alphabetisch deutsch sortiert, bei mehr als 80 Ordnern wird die Restzahl ausdruecklich genannt statt still abgeschnitten. Zurueck zur Liste ueber "Alle Ordner"; ohne Suchbegriff bleibt alles wie bisher. · v17: ⚙ EINSTELLUNGS-MENUE AM HANDY (Wunsch Frank: "gar keine Einstellungs-Taste wie bei den anderen ... sieht ganz schoen unuebersichtlich aus"): In #ergebnis-leiste lagen NEUN gleich aussehende Knoepfe nebeneinander (3x Sortierung, 3x Ansicht/Ordner, Auswaehlen, 2x Filter, Aktualisieren) - am Handy brachen die auf vier Zeilen um; mit Kopfzeile, Statuszeile, "Stand:" und Brotkrumen waren rund sechs Zeilen belegt, bevor das erste Bild kam. Neu: Zahnrad-Knopf in der blauen Kopfzeile oeffnet ein Menue von rechts; Sortierung, Filter, Aktualisieren (+ "Stand:") und Abmelden liegen dort in benannten Gruppen. Sichtbar bleiben nur Trefferzahl, Liste/Kacheln, Ordner und Auswaehlen (Auswaehlen ist ein Modus und braucht einen erreichbaren Ausschalter). WICHTIG: Die Knoepfe werden UMGEHAENGT, nicht verdoppelt - es sind dieselben DOM-Elemente, daher gelten alle bisherigen Klick-Handler und der .aktiv-Zustand unveraendert weiter, nichts muss abgeglichen werden. GILT NUR BIS 600 px BREITE: am PC bleibt die Leiste exakt wie vorher, das Zahnrad ist dort gar nicht sichtbar; beim Wechsel auf einen breiten Bildschirm wandern alle Knoepfe in ihre urspruengliche Reihenfolge zurueck (Rueckweg gemessen und bestaetigt). Zusaetzlicher entprellter resize-Horcher als Sicherheitsnetz - im Test blieb die matchMedia-Meldung einmal aus, die Knoepfe saessen dann im ausgeblendeten Menue fest und waeren am PC unerreichbar gewesen. Zahnrad sitzt in #nutzer-info und erscheint damit automatisch erst nach dem Anmelden. Messung bei 390 px: Ergebnis-Leiste 189 -> 47 px, Galerie beginnt bei 369 -> 184 px = 178 px bzw. rund ein Fuenftel Bildschirm mehr fuer Bilder. · v16: 🖼 BILDER BLEIBEN AUF DEM GERAET (Wunsch Frank: keine langen Ladezeiten unterwegs): (1) GROSSANSICHT laedt nicht mehr das ORIGINAL - bisher holte ladeAlsBlobUrl bei JEDEM Oeffnen die volle Datei (Handyfoto 3-8 MB) und verwarf sie danach wieder; dasselbe Bild am naechsten Tag erneut oeffnen = erneut alles laden. Jetzt wird die 1600-px-Fassung ueber thumbnailLink geholt (~200-400 KB, fuer jeden Bildschirm mehr als ausreichend, rund 15x schneller) UND im vorhandenen IndexedDB-Speicher abgelegt (Schluessel <fileId>::ansicht1600). Folge: Jedes einmal geoeffnete Bild ist beim naechsten Mal SOFORT da - ohne dass vorher irgendetwas ausgewaehlt werden muss (Frank: "Ich weiss ja nicht, welche Bilder ich brauche"). Rueckfall auf das Original bleibt, falls Drive keine Vorschau liefert. UNBERUEHRT: Download, ZIP, PDF, "Sauber teilen" und der 360-Grad-Viewer holen weiterhin das ORIGINAL ueber eigene alt=media-Aufrufe. (2) DAUERHAFTER SPEICHER: navigator.storage.persist() wird beim Start beantragt - ohne diese Zusage darf der Browser die gespeicherten Bilder bei Platzmangel jederzeit wegraeumen, danach laedt wieder alles neu. Bewusstes Abmelden loescht sie weiterhin (Datenschutz, unveraendert). · v15: 🖼 VORSCHAUBILDER ZUVERLÄSSIGER – die drei <img>-Elemente (Galerie-Kachel Z.~1631, Ordner-Browser-Kachel Z.~2139, Modal-Großbild Z.~902) senden jetzt referrerpolicy="no-referrer". Google liefert Drive-Bilder (drive.google.com/thumbnail?id=…&sz=w400 bzw. w1600) OHNE Referrer deutlich zuverlässiger aus; bisher schlugen bei großen Beständen regelmäßig Kacheln fehl (rote Konsolenfehler) und liefen unnötig in den Drive-API-Rückfall, der statt eines ~30-KB-Thumbnails das ORIGINAL lädt und clientseitig verkleinert (Zeit + Datenvolumen, besonders am iPhone). Reine Attribut-Ergänzung am Element – wirkt für alle Ladewege (Sheet-Vorschau-URL, Modal-Platzhalter, Kein-Token-Fallback); Blob-URLs aus IndexedDB/Drive-API sind davon unberührt, Logik unverändert. Gleiche Ursache und gleicher Fix wie PAM-Desktop b504 (23.07.2026). · v14: Ordner-Browser (Drive-Struktur aus Spalte G, Drill-down + Breadcrumb) · v13: Bugfixes
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
  // v23: cloudfunctions.net ergänzt – über diese Adresse läuft die Anmeldung
  // (Ticket-Tausch und -Erneuerung). Ohne den Eintrag landete sie im
  // "Cache-first"-Zweig unten: Der Service Worker schob sich dazwischen und
  // machte aus jedem Fehler eine 503-"Offline"-Antwort, die nach einem
  // Serverproblem aussah, obwohl es keines war.
  if (url.includes('googleapis.com') ||
      url.includes('accounts.google.com') ||
      url.includes('drive.google.com') ||
      url.includes('script.google.com') ||
      url.includes('cloudfunctions.net')) {
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
