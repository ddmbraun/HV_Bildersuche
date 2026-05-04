"""
Hausverwaltung – Spalten umsortieren
=====================================
Einmaliges Skript: bringt die Google-Tabelle in die neue Spaltenreihenfolge.

Alte Reihenfolge:          Neue Reihenfolge:
  A  File-ID           →     A  File-ID
  B  Vorschau-Formel   →     B  Straße
  C  Straße            →     C  Hausnummer
  D  Ort               →     D  PLZ
  E  Datum             →     E  Ort
  F  Ordnerpfad        →     F  Datum
  G  Thumbnail-URL     →     G  Ordnerpfad
  H  Vollbild-URL      →     H  Thumbnail-URL
  I  Latitude          →     I  Vollbild-URL
  J  Longitude         →     J  Latitude
  K  PLZ               →     K  Longitude
  L  Hausnummer        →     L  Vorschau-Formel

NUR EINMAL ausführen – danach scan.py und update_sheet.py
mit der neuen Spaltenreihenfolge verwenden.

Starten:  cd D:\\_Bilder_HV  →  python reorder_columns.py
"""

import os
import time
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# ============================================================
# KONFIGURATION
# ============================================================

BASE_DIR         = r"D:\_Bilder_HV"
CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")
TOKEN_FILE       = os.path.join(BASE_DIR, "token.json")

SPREADSHEET_ID = "13V5ftPAAlZ-L5IFXpRkdqoVaI8DZjzjsJuUvn5KKgOg"
SHEET_NAME     = "Datenbank_Hausverwaltung_Bilder_V2"

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Mapping: alter Index → neuer Index (0-basiert)
# alt: A=0,B=1,C=2,D=3,E=4,F=5,G=6,H=7,I=8,J=9,K=10,L=11
# neu: A=0,B=1,C=2,D=3,E=4,F=5,G=6,H=7,I=8,J=9,K=10,L=11
#
# Neu[0] = Alt[0]  File-ID
# Neu[1] = Alt[2]  Straße       (alt C)
# Neu[2] = Alt[11] Hausnummer   (alt L)
# Neu[3] = Alt[10] PLZ          (alt K)
# Neu[4] = Alt[3]  Ort          (alt D)
# Neu[5] = Alt[4]  Datum        (alt E)
# Neu[6] = Alt[5]  Ordnerpfad   (alt F)
# Neu[7] = Alt[6]  Thumbnail    (alt G)
# Neu[8] = Alt[7]  Vollbild     (alt H)
# Neu[9] = Alt[8]  Latitude     (alt I)
# Neu[10]= Alt[9]  Longitude    (alt J)
# Neu[11]= Alt[1]  Vorschau-F.  (alt B)

NEUE_REIHENFOLGE = [0, 2, 11, 10, 3, 4, 5, 6, 7, 8, 9, 1]

NEUER_HEADER = [
    "File-ID", "Straße", "Hausnummer", "PLZ", "Ort",
    "Datum", "Ordnerpfad", "Thumbnail-URL", "Vollbild-URL",
    "Latitude", "Longitude", "Vorschau_Sheets",
]

BATCH_SCHREIB = 1000   # Zeilen pro Schreibaufruf
WRITE_SLEEP   = 1.5    # Sekunden zwischen Schreibaufrufen

# ============================================================
# AUTHENTIFIZIERUNG
# ============================================================

def anmelden():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w") as t:
            t.write(creds.to_json())
    return creds

# ============================================================
# HAUPTPROGRAMM
# ============================================================

def main():
    print("=" * 60)
    print("  Spalten umsortieren  –  EINMALIGES SKRIPT")
    print("=" * 60)

    # ── Verbindung ───────────────────────────────────────────
    print("\n[1/4] Verbindung herstellen …")
    creds  = anmelden()
    sheets = build("sheets", "v4", credentials=creds)
    print("      OK")

    # ── Alle Daten lesen ─────────────────────────────────────
    print("[2/4] Alle Daten lesen …")
    ergebnis = sheets.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{SHEET_NAME}!A1:L",
    ).execute()
    alle = ergebnis.get("values", [])
    print(f"      {len(alle)} Zeilen geladen (inkl. Kopfzeile)")

    if not alle:
        print("  Tabelle ist leer – nichts zu tun.")
        return

    # ── Zeilen umsortieren ───────────────────────────────────
    print("[3/4] Spalten umsortieren …")

    def zeile_neu(row):
        """Bringt eine Zeile in die neue Spaltenreihenfolge."""
        result = []
        for alt_idx in NEUE_REIHENFOLGE:
            result.append(row[alt_idx] if alt_idx < len(row) else "")
        return result

    neue_zeilen = [NEUER_HEADER]          # Neue Kopfzeile
    for row in alle[1:]:                   # Datenzeilen (ohne alte Kopfzeile)
        neue_zeilen.append(zeile_neu(row))

    # ── Sheet überschreiben ──────────────────────────────────
    print("[4/4] Sheet überschreiben …")

    # Erst alten Inhalt löschen
    sheets.spreadsheets().values().clear(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{SHEET_NAME}!A:L",
    ).execute()
    print("      Alte Daten gelöscht")
    time.sleep(2)

    # Neue Daten in Batches schreiben
    gesamt = len(neue_zeilen)
    geschrieben = 0
    start = 1   # Startzelle A1

    for i in range(0, gesamt, BATCH_SCHREIB):
        chunk = neue_zeilen[i : i + BATCH_SCHREIB]
        ende  = start + len(chunk) - 1

        versuche = 0
        while True:
            try:
                sheets.spreadsheets().values().update(
                    spreadsheetId=SPREADSHEET_ID,
                    range=f"{SHEET_NAME}!A{start}:L{ende}",
                    valueInputOption="USER_ENTERED",
                    body={"values": chunk},
                ).execute()
                break
            except HttpError as e:
                if e.resp.status == 429:
                    versuche += 1
                    warte = 65 * versuche
                    print(f"      ⏳ Ratenlimit – warte {warte}s …")
                    time.sleep(warte)
                else:
                    raise

        start       += len(chunk)
        geschrieben += len(chunk)
        print(f"      {geschrieben}/{gesamt} Zeilen geschrieben …")
        time.sleep(WRITE_SLEEP)

    print(f"\n{'=' * 60}")
    print(f"  Fertig! {gesamt - 1} Datenzeilen umstrukturiert.")
    print(f"  Neue Spaltenreihenfolge:")
    for i, name in enumerate(NEUER_HEADER):
        print(f"    {chr(65+i)}  {name}")
    print(f"{'=' * 60}")
    print(f"\n  Jetzt scan.py und update_sheet.py (neue Version)")
    print(f"  aus dem Ordner 'HV_Bilder suche' nach D:\\_Bilder_HV\\")
    print(f"  kopieren und verwenden.")


if __name__ == "__main__":
    main()
