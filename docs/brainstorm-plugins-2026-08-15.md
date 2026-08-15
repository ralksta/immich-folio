# Brainstorm: Plugin-Struktur

_Stand: 2026-08-15 · Basis: v0.11.0 (dev, nach #462) · Fokus: wie Fremdcode an
Folio andocken könnte, ohne das Sicherheitsversprechen einzureißen_

Dieses Dokument ergänzt [`ideas.md`](ideas.md),
[`brainstorm.md`](brainstorm.md),
[`brainstorm-2026-08-05.md`](brainstorm-2026-08-05.md) und
[`brainstorm-2026-08-15.md`](brainstorm-2026-08-15.md). Das Thema Plugins kommt in
keiner der vier Listen vor — auch nicht als Einzeiler. Es ist damit kein Feature
unter vielen, sondern eine Architekturentscheidung, die vor den Features kommt:
Wer sie trifft, legt fest, welche der dort gelisteten Ideen überhaupt noch im Kern
gebaut werden müssen und welche jemand anders beisteuern kann.

Aufwand wie in den Vorgängern: XS (Stunden), S (1 Tag), M (2–5 Tage), L (Wochen).

---

## 0. Die Nähte, die es schon gibt

Ein Plugin-System erfindet man nicht auf der grünen Wiese. Folio hat an sieben
Stellen bereits eine Fuge, an der heute eine feste Liste steht, wo eine
erweiterbare stehen könnte:

| Naht                                  | Heute                                                            | Als Erweiterungspunkt |
| ------------------------------------- | ---------------------------------------------------------------- | --------------------- |
| `lib/config/theme.ts:99`              | `resolveTheme()` über sieben feste Presets                       | Theme-Packs           |
| `app/globals.css:2-7`                 | sechs `@import` auf `app/themes/*.css`                           | dito — aber siehe A2  |
| `lib/journal.ts:17`                   | `JournalBlock` als geschlossene Union, Renderer-`switch` ab :343 | eigene Blocktypen     |
| `lib/config/schema.ts:261`            | `SettingsYaml` als geschlossenes Interface                       | Plugin-Namespace      |
| `app/api/webhook/route.ts:31`         | drei eingehende Immich-Events                                    | **ausgehende** Events |
| `app/api/analytics/track/route.ts:45` | Zähler in `analytics.json`                                       | Sink-Adapter          |
| `SettingsEditor.tsx:192-199`          | acht feste Admin-Sektionen                                       | UI-Slots              |

Dazu die zwei Stellen, die _keine_ Naht sind, sondern eine Wand:
`lib/immich.ts` ist ein Singleton mit hart verdrahtetem Immich-Client, und
`proxy.ts:18` erlaubt `script-src` ausschließlich per Nonce (`'strict-dynamic'`,
kein `'unsafe-inline'`-Fallback). Beides ist für die Bewertung der Lade-Modelle
entscheidend.

---

## A. Vier Lade-Modelle

Die eigentliche Frage ist nicht „welche Erweiterungspunkte", sondern **„wie kommt
fremder Code in eine laufende Instanz"**. Davon hängt alles andere ab.

### A1. Build-time Plugins — **S für das Gerüst, aber die falsche Zielgruppe**

npm-Dependency plus eine Registry-Datei (`folio.plugins.ts`), die beim Build
eingelesen wird. Technisch mit Abstand am einfachsten: kein Sandboxing-Problem,
volle Typsicherheit, Tree-Shaking, alles was Next.js ohnehin kann.

**Der Haken ist nicht technisch, sondern demografisch.** Die Zielgruppe eines
self-hosted Portfolios macht `docker compose pull`. Wer ein eigenes Image baut,
kann heute schon forken — für den ändert ein Plugin-System wenig. Build-time
Plugins bedienen also genau die Nutzer, die das System am wenigsten brauchen.

**Trotzdem behalten:** als dokumentierter Power-User-Pfad und als Grundlage für
die mitgelieferten „First-Party"-Plugins. Nur nicht als _die_ Antwort.

### A2. Deklarative Runtime-Plugins — **S–M, sicher, deckt mehr ab als man denkt**

Ein Verzeichnis `content/plugins/<id>/` mit Manifest, CSS, Templates,
Übersetzungsdateien — **kein JavaScript**. Folio liest beim Start, was da liegt,
und erweitert damit Listen, die heute Konstanten sind.

Was damit geht: Theme-Packs, Layout-Varianten, EXIF-Feldbeschriftungen,
i18n-Pakete, Grid-Presets, Blocktypen ohne eigene Logik.
Was nicht geht: alles, was rechnen oder nach draußen reden muss.

**Der Trade-off, der benannt gehört:** Theme-CSS wird heute statisch importiert
(`app/globals.css:2-7`) und landet im Build-Output. Ein Runtime-Theme-Pack braucht
deshalb einen zweiten Weg — entweder ein `<style>`-Tag im Layout (die CSP erlaubt
das, `style-src` führt `'unsafe-inline'`, `proxy.ts:19`) oder eine Route
`/api/theme.css`. Das ist kein Blocker, aber es ist Arbeit, die man nicht sieht,
wenn man nur „Presets sind ja schon Daten" denkt.

### A3. Out-of-Process-Plugins — **M, das eigentliche Ziel**

Ein Plugin ist ein eigener Container mit einem HTTP-Kontrakt in beide Richtungen:
Folio schickt Events raus, das Plugin darf definierte Endpunkte abfragen und
liefert optional HTML-Fragmente für deklarierte UI-Slots zurück.

```yaml
# docker-compose.override.yml
services:
  folio-print:
    image: ghcr.io/someone/folio-print-orders:1
    environment:
      FOLIO_URL: http://folio:3000
      FOLIO_PLUGIN_TOKEN: ${PRINT_TOKEN}
```

**Warum das zu diesem Projekt passt:** Die Nutzer betreiben ohnehin Compose — ein
zweiter Service ist kein neues Konzept, sondern das bereits vorhandene. Der
Fremdcode läuft nie im Folio-Prozess, sieht den Immich-API-Key nicht, kann
`install.json` nicht lesen und die Admin-Session nicht signieren. Und der
Kontrakt ist sprachneutral: Ein Plugin in Python oder Go ist genauso legitim.

**Trade-offs:** Latenz für UI-Slots (mit Timeout und Fallback auf „nichts
rendern" beherrschbar); ein zweites Auth-Schema (Plugin-Token, nicht die
Admin-Session); und die Einstiegshürde ist höher als „eine Datei ablegen".

### A4. In-Process-JS aus `content/plugins/` — **wogegen ich argumentiere**

Das ist das Modell, an das man zuerst denkt, weil WordPress es so macht. Für
Folio ist es die einzige Option, die das Kernversprechen des Projekts aufhebt.

Ein solches Plugin läuft im selben Node-Prozess wie:

- der Immich-API-Key (`lib/env.ts`),
- `AUTH_SECRET`, aus dem `lib/tokens.ts` den Asset-Verschlüsselungs-Key ableitet,
- der scrypt-Hash des Admin-Passworts aus `content/install.json`,
- der Signierschlüssel der Admin-Sessions (`lib/admin/auth.ts`).

Node hat kein belastbares Sandboxing dafür. `vm` ist keins — aus dem Kontext
kommt man mit drei Zeilen wieder heraus. `worker_threads` trennt den Speicher,
aber nicht das Dateisystem und nicht das Netzwerk. Die Node-Permission-API ist
prozessweit, nicht pro Modul. Das heißt: Der Satz „der Immich-Server und der
API-Key sind nie öffentlich exponiert" wäre danach nur noch so wahr wie das
leichtsinnigste installierte Plugin.

Dazu kommt die CSP: Client-seitiges Plugin-JS müsste die Nonce aus `proxy.ts`
bekommen. Wer die Nonce vergibt, hebt `'strict-dynamic'` für diesen Code auf —
XSS-Schutz und Plugin-Freiheit sind hier dieselbe Stellschraube in zwei
Richtungen.

**Falls es trotzdem kommen soll**, dann bitte mit drei Bedingungen: nur per
Admin installierbar (nie automatisch aus einem Verzeichnis geladen), im Admin
mit einem unmissverständlichen Vollzugriffs-Hinweis, und per Default aus
(`PLUGINS_ALLOW_CODE=true`).

### Empfehlung

**A2 + A3 zuerst, A1 als dokumentierter Pfad, A4 nicht.** Das deckt geschätzt den
größten Teil der realistischen Plugin-Wünsche ab, ohne dass irgendjemand das
Bedrohungsmodell neu schreiben muss.

---

## B. Manifest und Capabilities

Ein Manifest pro Plugin, gelesen beim Start, im Admin sichtbar:

```yaml
# content/plugins/print-orders/plugin.yaml
id: print-orders
name: Print Orders
version: 1.2.0
kind: service # service | theme | blocks | locale
endpoint: http://folio-print:8080 # nur bei kind: service
capabilities:
  - events:album.published
  - events:proofing.submitted
  - ui:album-footer
settings: # erzeugt das Admin-Formular
  provider: { type: enum, values: [prodigi, whitewall, saal] }
  markup: { type: number, default: 1.4 }
```

Drei Regeln, die von Anfang an gelten sollten, weil sie sich später nicht
nachrüsten lassen:

**B1. Capabilities sind deklariert und werden angezeigt.** Im Admin steht, was
ein Plugin darf — nicht als Kleingedrucktes, sondern als Liste vor der
Installation. `config:write` gibt es für Fremd-Plugins nicht.

**B2. Assets überqueren die Plugin-Grenze nur als Token.** Die Regel aus
`CLAUDE.md` — rohe Asset-UUIDs erscheinen nie im Client — muss auch für Plugins
gelten, sonst ist sie durch die Hintertür aufgehoben. Plugins bekommen
`encodeAssetId()`-Tokens; wer das Original braucht, braucht eine eigene,
begründete Capability.

**B3. Plugin-Settings leben in einem eigenen Namespace.** `SettingsYaml`
(`lib/config/schema.ts:261`) bleibt geschlossen; Plugins schreiben unter
`plugins.<id>.*`. Sonst kollidiert das erste Plugin mit dem nächsten Kern-Feature,
das denselben Schlüsselnamen will.

Zur Verteilung: ein GitHub-Topic `immich-folio-plugin` plus eine kuratierte
`plugins.json` reicht als Registry völlig aus. Installation über URL mit
Pinning auf einen Hash — kein eigener Paket-Server, kein Signaturschema in v1.

---

## C. Was Leute tatsächlich reinhängen würden

Sortiert nach vermuteter Nachfrage, nicht nach Aufwand.

### C1. Kundengeschäft

Der stärkste Treiber, weil hier Geld dranhängt:

- **Print-Shop-Anbindung** (Prodigi, WhiteWall, Saal) mit „Print bestellen" am
  Album-Fuß — der klassische UI-Slot-Fall
- **Proofing-Auswahl → ZIP-Download**, Ablauf-Links, Download-Kontingent pro Kunde
- **Anfrage-Formular** → SMTP, ntfy, Telegram, Discord, Matrix
- **Kunden-Login per Magic-Link** statt statischem Passwort-Gate
- **Rechnungs-Trigger** bei Album-Freigabe (n8n, Lexoffice, sevDesk)

Anmerkung: C1 überschneidet sich bewusst mit Abschnitt A aus
[`brainstorm-2026-08-15.md`](brainstorm-2026-08-15.md) — dort als Kern-Feature
gedacht, hier als Plugin. Das ist genau die Entscheidung, die dieses Dokument
aufwirft: Ablaufende Client-Links gehören in den Kern (sie fassen die
Zugangsprüfung an), ein Print-Shop nicht (er fasst nur eine Ecke der UI an).

### C2. Reichweite

- **RSS/JSON-Feed**, IndexNow-Ping, erweiterte Sitemaps
- **POSSE**: Auto-Post nach Mastodon/Bluesky/Pixelfed bei Journal-Veröffentlichung
- **ActivityPub-Actor** fürs Journal — folgen statt abonnieren
- **Newsletter** (Listmonk, Buttondown) bei neuem Eintrag
- **Kommentare** via Isso, Commento, Giscus
- **Analytics-Weiterleitung** an Plausible/Umami/GoatCounter statt der
  JSON-Zähler (`app/api/analytics/track/route.ts`)

### C3. Handwerk und Darstellung

Das wird der erste echte Community-Beitrag sein, weil die Hürde am niedrigsten ist:

- **Theme-Packs** inklusive Fonts, Grain, Rahmen
- **Layout-Varianten**: Diptychon/Doppelseite, Kontaktbogen, Kiosk-/TV-Slideshow
- **EXIF-Panel-Erweiterungen**: Filmsimulation, lesbare Objektivnamen,
  Kamera-Badges, Entwicklungs-Rezept
- **Journal-Blocktypen**: Video, Karte, Vorher/Nachher-Slider, Audio, Gear-Liste
- **Kartenanbieter** tauschen (MapTiler, Thunderforest), GPX-Tracks, Reise-Modus

### C4. Vertrauen und Schutz

- **Wasserzeichen im Image-Proxy**, tier-abhängig (nur `preview`, nie `thumbnail`)
- **C2PA-Credentials**, IPTC-Erhalt beim Original-Download
- **SSO** über OIDC/Authelia/Tailscale-Header statt Per-Seite-Passwörtern
- **Hotlink-Schutz**, per-Album-Download-Regeln

### C5. Betrieb

- **Source-Adapter** jenseits Immich: lokaler Ordner, PhotoPrism, Nextcloud, S3.
  Der teuerste Punkt der Liste — `lib/immich.ts` ist ein Singleton mit
  Request-Coalescing und LRU; daraus ein Interface zu schneiden ist **L**, nicht M.
- **Statischer Export-Snapshot** nach S3/Netlify als ausfallsicherer Spiegel
- **Cache-Warmer** per Cron, Healthcheck-Ping an Uptime Kuma
- **i18n-Pakete** für die UI-Strings
- **Auto-Alt-Text** via lokalem Ollama; Akzentfarbe aus dem Hero-Bild ableiten

---

## D. Wo ich schneiden würde

Ein MVP, das für sich allein nützlich ist — auch falls nie ein zweiter Schritt kommt:

### D1. Ausgehende Events — **S, sofort nützlich**

`album.published`, `journal.published`, `proofing.submitted`, jeweils mit
HMAC-SHA256-Signatur über den Rohbody — spiegelbildlich zum eingehenden Webhook
(`app/api/webhook/route.ts:64`), dieselbe Mechanik, andere Richtung. Ziel-URLs in
`settings.yaml`.

Das ist der größte Hebel pro Zeile Code: Ohne jedes Plugin-Konzept sind damit
Newsletter, POSSE, Benachrichtigungen und halbe Kundenworkflows über n8n oder ein
Shell-Script erreichbar. Und es ist die Grundlage, auf der A3 später aufsetzt,
ohne dass man es zurücknehmen müsste.

### D2. Theme-Packs aus `content/themes/` — **S–M, größte sichtbare Wirkung**

Erweitert `resolveTheme()` (`lib/config/theme.ts:99`) um Presets aus dem
Content-Verzeichnis, plus den CSS-Auslieferungsweg aus A2. Null
Sicherheitsrisiko, und es ist das, was Leute teilen wollen.

### D3. Plugin-Namespace in `settings.yaml` — **S**

`plugins.<id>.*` plus ein aus dem Manifest generiertes Admin-Formular, damit D1
und D2 konfigurierbar sind, ohne den `SettingsEditor` pro Plugin anzufassen.

**Reihenfolge:** D1 → D2 → D3 → A3. Alles darüber (Blocktypen, Source-Adapter,
UI-Slots) baut darauf auf.

---

## E. Was offen bleibt

Drei Fragen, die dieses Dokument bewusst nicht beantwortet:

1. **Support-Last.** Ein Plugin-System verlagert Bugs in fremden Code, aber nicht
   die Issues. „Meine Galerie ist kaputt" kommt weiterhin hier an. Das spricht für
   A3 (Plugin-Crash ist ein Container-Crash, kein 500 in Folio) und gegen A4.
2. **Versionierung des Kontrakts.** Ab Plugin Nummer zwei ist jede Änderung an
   Event-Payloads oder Manifest-Feldern ein Breaking Change. Ein `apiVersion` im
   Manifest ab Tag eins kostet nichts und rettet später viel.
3. **Ob es überhaupt Nachfrage gibt.** Ein Plugin-System für null Plugins ist
   verlorene Zeit. D1 ist auch dann richtig, wenn die Antwort nein lautet — es ist
   ein Webhook, kein Ökosystem. Das ist der eigentliche Grund, damit anzufangen.
