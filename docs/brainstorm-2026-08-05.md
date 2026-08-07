# Feature-Brainstorm: Verbreitung & Robustheit

_Stand: 2026-08-05 · Basis: v0.9.1 · Fokus: Open-Source-Verbreitung + Betrieb & Robustheit_

Dieses Dokument ergänzt [`ideas.md`](ideas.md) (Präsentations-Features) und
[`brainstorm.md`](brainstorm.md) (Stand Mai 2026). Es wiederholt deren Ideen nicht,
sondern nimmt eine andere Perspektive ein: **Was hindert andere Fotografen daran,
Folio einzusetzen — und was geht im Betrieb kaputt?**

Alle Ideen sind gegen den tatsächlichen Code-Stand geprüft. Aufwand: XS (Stunden),
S (1 Tag), M (2–5 Tage), L (Wochen).

---

## Kontext: Was seit Mai dazugekommen ist

Aus `brainstorm.md` bereits erledigt: **Map-View** (`app/map/page.tsx`,
`components/MapView.tsx`), Video-Support, Webhook-Invalidierung, Album-Beschreibungen.

Weiterhin offen aus den alten Listen (hier bewusst _nicht_ nochmal ausgeführt):
RSS-Feed, Slideshow, Download-Button, Share-Link, Fullscreen, Timeline-View,
Immich Smart Search, Photo Stories, PWA, Watermarking, Client-Proofing, EXIF-Analytics.

---

## A. Betrieb & Robustheit

### A1. Fehler-, Lade- und 404-Boundaries — **XS, hoher Impact**

**Befund:** Im gesamten `app/`-Verzeichnis existiert keine einzige `error.tsx`,
`global-error.tsx`, `loading.tsx` oder `not-found.tsx`.

Weil alle Seiten `dynamic = 'force-dynamic'` sind und live gegen Immich laufen,
heißt das: Immich neu gestartet, API-Key rotiert, Netzwerk kurz weg → der Besucher
bekommt die generische Next.js-Fehlerseite. Ein Tippfehler in der URL → ebenfalls
ungestylt. Für ein Produkt, dessen Verkaufsargument „schön" ist, ist das der
peinlichste mögliche Zustand.

**Umsetzung:** `app/error.tsx` und `app/global-error.tsx` im Theme-Look mit
Retry-Button; `app/not-found.tsx`; `loading.tsx` pro Route-Segment mit
ThumbHash-Skeletons (`lib/thumbhash.ts` liefert die Bausteine schon).

**Warum zuerst:** Billigste Maßnahme mit der größten Wirkung auf den
wahrgenommenen Reifegrad.

---

### A2. Stale-while-error — Galerie bleibt online, wenn Immich weg ist — **M, hoher Impact**

**Befund:** `lib/cache.ts` ist ein 200-Einträge-LRU mit harter TTL (`CACHE_TTL`,
Default 300s). Läuft ein Eintrag ab und Immich antwortet nicht, gibt es keinen
Fallback — die Seite ist tot.

**Idee:** Abgelaufene Einträge nicht wegwerfen, sondern als *stale* markieren.
Bei Upstream-Fehler den veralteten Eintrag trotzdem ausliefern, im Hintergrund
erneut versuchen, und (optional konfigurierbar) einen dezenten Hinweis
einblenden. Das öffentliche Portfolio überlebt damit ein Immich-Update,
ein Backup-Fenster oder einen NAS-Reboot.

**Warum das zieht:** Genau das ist die Angst des Self-Hosters — „meine
öffentliche Seite geht offline, weil mein privater Server hustet". Folio als
_Puffer_ vor Immich zu positionieren statt als bloßen Proxy ist ein echtes
Argument.

**Anker:** `lib/cache.ts`, `lib/immich.ts` (Request-Coalescing ist schon da und
passt gut dazu).

---

### A3. Persistenter Bild-Cache auf Platte — **M, hoher Impact auf schwacher Hardware**

**Befund:** `streamAsset()` proxied jedes Bild bei jedem Kaltstart erneut von
Immich. Der LRU-Cache hält nur Metadaten, keine Bytes.

**Idee:** Optionales Cache-Volume (`CACHE_DIR`), in dem proxied Thumbnails und
Previews pro Größen-Tier landen. Die Asset-Tokens sind bereits deterministisch
(`lib/tokens.ts`: gleiche UUID → gleicher Token), also ist der Cache-Key
geschenkt. Mit LRU-Eviction und konfigurierbarem Größenlimit.

**Warum:** Die typische Zielgruppe hostet auf Synology, RasPi oder einem alten
NUC. Dort ist wiederholtes Proxying der Flaschenhals — und es hält gleichzeitig
den Immich-Server unter Last.

---

### A4. ISR statt `force-dynamic`, getrieben vom vorhandenen Webhook — **M**

**Befund:** Alle Seiten sind `force-dynamic`. Gleichzeitig existiert bereits
`POST /api/webhook` mit HMAC-Signatur und gezielter Cache-Invalidierung.

**Idee:** Seiten auf Next.js-Cache-Tags umstellen (`albums`, `album-<id>`) und
den Webhook `revalidateTag()` aufrufen lassen statt nur den internen LRU zu
leeren. Ergebnis: statisch schnelle Auslieferung, trotzdem sofort aktuell,
sobald sich in Immich etwas ändert.

**Achtung:** Passwortgeschützte Subpages/Alben müssen dynamisch bleiben —
die Cookie-Prüfung in `lib/auth.ts` darf nicht wegcachen. Das ist die eigentliche
Arbeit an dieser Idee, nicht das Umstellen selbst.

_Stand in `ideas.md` schon als Einzeiler; hier mit dem Webhook als Auslöser
konkretisiert._

---

### A5. Config-Doctor — **S, hoher Impact auf Support-Aufwand**

**Befund:** `GET /api/admin/status` existiert bereits als Ansatzpunkt. Es gibt
aber keine Stelle, die typische Fehlkonfigurationen aktiv meldet.

**Idee:** Ein Diagnose-Panel im Admin (plus `npm run doctor` fürs Terminal), das
prüft:

- `AUTH_SECRET` gesetzt und ausreichend lang?
- `TRUSTED_PROXY_HOPS` plausibel? — tatsächlich eingehende `X-Forwarded-For`-Kette
  messen und mit dem konfigurierten Wert vergleichen. Ein falscher Wert legt das
  Rate-Limiting still oder macht es spoofbar; heute merkt das niemand.
- Existieren alle Album-IDs aus `gallery.yaml` noch in Immich?
- Reichen die Permissions des API-Keys?
- Liegen Passwörter im Klartext statt als `scrypt:`-Hash? (`lib/auth.ts` warnt
  bislang nur in die Logs, wo es keiner liest.)
- Ist `content/` beschreibbar? (war real ein Bug — siehe Commit-History)

**Warum:** Fast jedes „geht bei mir nicht"-Issue eines Self-Hosting-Projekts ist
eine dieser Zeilen. Der Doctor beantwortet sie, bevor das Issue aufgemacht wird.

---

### A6. `AUTH_SECRET` automatisch bereitstellen — **XS**

**Befund:** `lib/secret.ts` wirft in Production hart, wenn `AUTH_SECRET` fehlt.
Korrekt gedacht (nicht auf eine ratbare Konstante zurückfallen), aber es
bedeutet: `docker run` ohne gesetztes Secret → App startet nicht, mit einem
Fehler, den Einsteiger nicht sofort einordnen.

**Idee:** Fehlt die Env-Variable, beim ersten Start ein Zufalls-Secret erzeugen
und nach `content/.secret` (Mode 0600) persistieren. Weiterhin warnen, aber
nicht blockieren. Env-Variable behält Vorrang.

**Trade-off, der dokumentiert gehört:** Das Secret liegt dann im Content-Volume
statt in der Umgebung. Für ein Self-Hosted-Portfolio ist das der richtige
Kompromiss — das Volume enthält ohnehin die Galerie-Passwörter.

---

### A7. Strukturierte Logs + optionale Metriken — **S bis M**

Heute: `console.warn`-Prosa. Vorschlag: JSON-Logzeilen hinter `LOG_LEVEL`, plus
optionales `GET /api/metrics` im Prometheus-Textformat mit Cache-Hit-Rate,
Immich-Latenz-Histogramm, Rate-Limit-Treffern und Bytes durch den Bild-Proxy.

**Warum es sich lohnt:** Die Self-Hosting-Community betreibt Grafana. Ein
Projekt, das ein fertiges Dashboard-JSON mitliefert, wirkt sofort erwachsen —
und es ist wenig Arbeit, weil die Zählpunkte (`lib/cache.ts`, `lib/immich.ts`,
`lib/rate-limit.ts`) schon zentralisiert sind.

---

### A8. Redis-Backend, aber nur optional — **M, niedrige Priorität**

Rate-Limiter und Cache sind ausdrücklich In-Memory und skalieren nicht über
mehrere Instanzen. Ein optionales Backend hinter `REDIS_URL` würde das lösen.

**Ehrliche Einschätzung:** Die Zielgruppe fährt einen Container. Das ist
Dokumentation eines bekannten Limits, kein dringendes Feature. Nur angehen, wenn
konkret danach gefragt wird.

---

## B. Open-Source-Verbreitung

### B1. Setup-Assistent im Browser statt Anleitung — **M, größter Adoption-Hebel**

**Befund:** `components/SetupScreen.tsx` erklärt dem Nutzer, welche Dateien er
per Hand kopieren und ausfüllen soll. Gleichzeitig kann das Admin-Panel bereits
YAML atomar schreiben (`lib/admin/yaml-service.ts`) und alle Immich-Alben
durchsuchen (`/api/admin/albums`) — die Bausteine für einen echten Assistenten
liegen also schon da.

**Idee:** Aus dem Setup-Screen einen geführten Ablauf machen:

1. Immich-URL + API-Key eingeben → Verbindung sofort testen, Permissions prüfen
2. Aus den gefundenen Shared Albums auswählen (visuelle Auswahl, keine UUIDs)
3. Theme-Preset aus Vorschaukarten wählen (die Screenshots existieren in `docs/screenshots/`)
4. Titel/Untertitel eintragen → fertig, Galerie steht

Schreibt `gallery.yaml`, `settings.yaml` und die Credentials. Absicherung: nur
erreichbar, solange `needsSetup` gilt — danach dicht.

**Warum das die wichtigste Einzelmaßnahme ist:** Der Unterschied zwischen
„funktioniert nach fünf Minuten" und „ich muss erst UUIDs aus der Immich-API
kopieren" entscheidet, ob jemand dabei bleibt. Immich selbst hat diesen
Onboarding-Standard gesetzt; Folio wird daran gemessen.

---

### B2. Demo-Modus ohne Immich-Instanz — **S bis M**

**Befund:** Ohne laufenden Immich lässt sich Folio überhaupt nicht ansehen.
Auch die E2E-Tests (`e2e/`) hängen deshalb an einer echten Instanz.

**Idee:** `DEMO_MODE=true` schaltet `lib/immich.ts` auf einen Fixture-Adapter mit
mitgelieferten, frei lizenzierten Bildern um. Drei Effekte auf einen Schlag:

- Eine öffentliche Live-Demo, die man im README verlinken kann
- E2E-Tests laufen deterministisch in CI, ohne Immich
- Interessenten können `docker run` machen und sofort etwas sehen

**Warum:** Bei Self-Hosted-Software ist die Live-Demo der Konversionspunkt.
Screenshots im README reichen nicht — Leute wollen durchklicken.

---

### B3. Deploy-Templates für die Kanäle, wo die Zielgruppe sucht — **S**

Docker-Compose ist vorhanden. Was fehlt, sind die Verzeichnisse, in denen
Immich-Nutzer tatsächlich stöbern: unRAID Community Applications, CasaOS- und
Umbrel-App-Store, Portainer-Stack, Coolify-/Dokploy-Template.

Wenig Code, überwiegend Metadaten und PRs an fremde Repos. Aber es ist der
Unterschied zwischen „muss man kennen" und „findet man".

---

### B4. Internationalisierung (DE/EN) — **M**

Steht in der alten Liste, hier aber mit anderer Begründung: nicht als
Besucher-Komfort, sondern als Verbreitungs-Voraussetzung. Das Projekt hat
deutsche Wurzeln (`app/impressum/page.tsx`, das `legal:`-Feld ist auf § 18 MStV
gemünzt), die Oberfläche ist Englisch, und deutsche Nutzer stolpern über den
Mix. Umgekehrt schreckt ein „Impressum" im Footer internationale Nutzer ab,
solange nicht klar ist, dass es abschaltbar ist.

**Reihenfolge:** Erst die Besucher-Oberfläche, dann das Admin-Panel. Ohne
Framework — ein einfacher Wörterbuch-Lookup gegen `settings.yaml: locale`
genügt und passt zur Vanilla-CSS-/Kein-Framework-Linie des Projekts.

---

### B5. Update-Hinweis im Admin-Dashboard — **XS bis S**

Version aus `package.json` gegen die GitHub-Releases-API prüfen (gecacht,
täglich, abschaltbar) und im Admin-Dashboard dezent anzeigen. Standard bei
Self-Hosted-Tools; Nutzer laufen sonst monatelang auf alten Versionen —
insbesondere problematisch, weil es bereits Security-Releases gab (`37f7f62`).

---

### B6. Themes teilbar machen — **S**

Export/Import von `settings.yaml` als „Theme-Paket" plus ein
`themes/community/`-Verzeichnis im Repo, in das Nutzer per PR ihre Presets
beisteuern.

**Warum:** Es schafft einen Beitragsweg für Leute, die kein TypeScript
schreiben. Fotografen mit Gestaltungsanspruch sind genau die Zielgruppe — und
jeder eingereichte Look ist zugleich Werbematerial.

---

### B7. Tests für die API-Routen — **M**

`lib/__tests__/` deckt die Bibliotheken gut ab (Tokens, Auth, Rate-Limit,
Config), `e2e/` deckt fünf Seiten ab. Die Routen selbst — Bild-Proxy,
Auth-Endpoint, die sieben Admin-Routen — haben keine direkten Tests.

Das ist ausgerechnet die Schicht, an der die Sicherheitsgarantien des Projekts
hängen: Allowlist-Durchsetzung, Token-Decoding, Rate-Limit-Namespaces,
Admin-Session-Prüfung. Nach `37f7f62` („fix pre-auth bypasses") sollte hier eine
Regressions-Suite liegen. Sie ist außerdem das, was Contributors Sicherheit
gibt, überhaupt PRs zu stellen.

---

### B8. Kleinigkeit: Projektname in `package.json` — **XS**

`"name": "immich-lightbox"` bei einem Projekt namens Immich Folio. Fällt jedem
Contributor beim ersten `npm install` auf.

---

## C. Ein größerer Differenziator

### C1. Mehrere Galerien aus einer Instanz — **L**

Heute: ein Container, ein Portfolio. Denkbar: mehrere Sites aus einer Instanz,
je nach Host-Header, mit eigener `gallery.yaml`, eigenem Theme und eigener
Domain — bei geteiltem Immich-Backend und geteiltem Bild-Cache.

**Zielgruppen:** Fotografen-Kollektive; Leute, die für Kunden hosten; jemand,
der öffentliches Portfolio und private Familiengalerie trennen will.

**Ehrliche Einschätzung:** Deutlich mehr Aufwand als alles andere hier, weil
Config-Singleton (`lib/config/index.ts`), Cache-Keys und Auth-Cookie-Namen alle
mandantenfähig werden müssten. Nur sinnvoll, wenn tatsächlich Nachfrage
entsteht — aber es wäre etwas, das kein vergleichbares Tool bietet. Als
Beobachtungsposten notieren, nicht als Plan.

---

## Empfohlene Reihenfolge

**Erst (kleiner Aufwand, sofort sichtbar):**

1. A1 — Fehler-/Lade-/404-Boundaries · _XS_
2. A6 — `AUTH_SECRET` automatisch bereitstellen · _XS_
3. B8 — Projektname korrigieren · _XS_
4. B5 — Update-Hinweis im Admin · _XS–S_

**Dann (die zwei Hebel, die den Unterschied machen):**

5. B1 — Setup-Assistent im Browser · _M_
6. A2 — Stale-while-error · _M_

**Danach:**

7. A5 — Config-Doctor · _S_
8. B2 — Demo-Modus · _S–M_
9. B3 — Deploy-Templates · _S_
10. A3 — Persistenter Bild-Cache · _M_
11. B7 — API-Routen-Tests · _M_

**Später / nach Bedarf:** A4 (ISR), A7 (Logs & Metriken), B4 (i18n), B6 (Theme-Sharing),
A8 (Redis), C1 (Multi-Site).

---

## Roter Faden

Zwei Sätze, die die Auswahl zusammenhalten:

**Verbreitung** entscheidet sich in den ersten fünf Minuten — deshalb
Setup-Assistent (B1) und Demo-Modus (B2) vor allem anderen.

**Robustheit** heißt bei Folio nicht Uptime der eigenen App, sondern
Unabhängigkeit von der Verfügbarkeit des privaten Immich — deshalb ist
Stale-while-error (A2) das strategisch wichtigste Backend-Feature, nicht ISR.
