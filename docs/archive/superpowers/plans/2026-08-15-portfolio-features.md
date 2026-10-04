# Portfolio-Features: Auffindbarkeit, Zoom, Sequenzierung, Ortsauflösung

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Die vier Tasks sind
> **voneinander unabhängig** und können einzeln umgesetzt, getestet und gemerged werden.

**Goal:** Vier Vorschläge aus [`brainstorm-2026-08-15.md`](../../brainstorm-2026-08-15.md) umsetzen —
E (Auffindbarkeit), B2 (1:1-Zoom), B1 (Sequenzierung), C1 (Ortsauflösung). Reihenfolge nach
steigendem Risiko: erst zwei abgeschlossene Kleinigkeiten, dann der größte Eingriff, dann ein
Datenschutz-Feature mit klarer Angriffsfläche.

**Architecture:** Vier getrennte Eingriffe ohne gemeinsame Dateien — bis auf `lib/config/schema.ts`
und `lib/config/index.ts`, die von B1 und C1 beide angefasst werden (verschiedene Felder, kein
inhaltlicher Konflikt). Jede neue Per-Album-Option folgt dem etablierten Muster: ein
`Record<albumId, X>` in `AppConfig`, befüllt in `deriveGallery()`, genau wie `albumGrids` und
`albumCoverPositions` es seit #431 vormachen.

**Tech Stack:** Next.js 16 (App Router, React 19), TypeScript strict, Vitest 4 (node environment),
Playwright, Vanilla CSS, keine neuen Laufzeit-Dependencies.

---

## Global Constraints

- **Keine neuen Runtime-Dependencies.** Das Projekt hat sieben; das bleibt so.
- **TypeScript strict** — kein untypisiertes `any`; Suppressions nur als `@ts-expect-error` mit Begründung.
- **Rohe Immich-UUIDs dürfen nie im Client-HTML/JS landen.** Immer `imageUrl()` / `encodeAssetId()`.
- **Vanilla CSS**, Tokens aus `app/tokens.css`.
- **Formatierung:** nur geänderte Dateien (`npx prettier --write <datei>`), nie `npm run format` im Root.
- **Vor jedem Commit grün:** `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- **Baseline vor Beginn:** 443 Tests in 35 Dateien. Jede Task nennt die erwartete neue Summe.
- **Commit-Stil:** Conventional Commits. Experimentelle Optionen als `EXPERIMENTAL` in YAML-Kommentar
  und Admin-Label markieren, so wie #431 es gemacht hat.
- **Neue Env-Variablen** gehören in `lib/env.ts` **und** `.env.local.example`.
- **Vitest läuft im `node`-Environment** — es gibt kein jsdom. Komponentenlogik ist deshalb nur
  testbar, wenn die _reine_ Berechnung in einem eigenen Modul liegt; die DOM-Verdrahtung deckt
  Playwright ab. Das ist bei B1 und B2 jeweils eingeplant und ausdrücklich **kein** Verstoß gegen
  die CLAUDE.md-Regel (die verbietet, _Route_-Logik nur der Testbarkeit wegen nach `lib/` zu ziehen —
  hier geht es um echte, wiederverwendbare Geometrie- bzw. Gruppierungsfunktionen).

---

## Task E — Auffindbarkeit: Site-URL, `robots.txt`, `sitemap.xml`, JSON-LD

**Aufwand:** S (die Vorbedingung E1 und die Admin-UI machen daraus mehr als das im Brainstorm
geschätzte XS.)

### Befund vorab: es fehlt eine Site-URL

`lib/env.ts` kennt keine `SITE_URL`, `settings.yaml` keine `url:`, und `app/layout.tsx` setzt
**keine `metadataBase`**. OG-Bilder werden heute als relativer Pfad angegeben
(`app/layout.tsx:57`). Für `sitemap.xml` ist das ein hartes Hindernis: Der Sitemap-Standard
verlangt absolute URLs, und `app/sitemap.ts` läuft ohne Request-Kontext — der Host lässt sich also
nicht aus Headern ableiten.

**Entscheidung:** `url` in `settings.yaml`, überschreibbar durch `SITE_URL`. Env gewinnt — dasselbe
Präzedenzmuster wie bei Titel und Credentials. In `settings.yaml`, **weil der Wert im Admin-Panel
setzbar sein muss**: Wer per `docker run` startet, soll die Site-URL nicht in einer Env-Variable
nachtragen und neu starten müssen, sondern sie dort eingeben, wo er ohnehin Titel und SEO pflegt.

### Die Falle dabei — und warum E1b im Plan steht

Env gewinnt über YAML. Setzt jemand `SITE_URL` **und** trägt im Admin etwas anderes ein, speichert
das Panel brav, ändert aber nichts — der Wert wird stillschweigend überstimmt. Genau dieser Zustand
existiert heute schon unbemerkt bei `SITE_TITLE`/`SITE_SUBTITLE`: `lib/env.ts:98-99` schlägt
`settings.yaml` und **das Admin-Panel sagt es nirgends**. Eine repo-weite Suche findet in
`SettingsEditor.tsx`, `AdminDashboard.tsx` und `/api/admin/status` keinen einzigen Hinweis auf
Env-Überschreibungen.

Weil dieses Feld nun ausdrücklich über die UI bedienbar sein soll, wird die Anzeige mitgebaut —
klein, generisch und für die bestehenden Felder gleich mitverwendet.

### Schritte

- [ ] **E1 — Site-URL einführen**
  - `SITE_URL` in `lib/env.ts` (`interface Env` + `parseEnv()`), validiert über `new URL()`,
    trailing Slash entfernt — analog zur bestehenden Behandlung von `IMMICH_API_URL:26-32`.
  - `url?: string` in `SettingsYaml` (`lib/config/schema.ts`) und `siteUrl: string` in `AppConfig`.
  - Auflösung in `lib/config/index.ts`: `env.SITE_URL || settings.url || ''`.
  - `metadataBase` in `app/layout.tsx` setzen, wenn `siteUrl` nicht leer ist.
  - In `settings.yaml.example` dokumentieren, inklusive des Hinweises, dass ohne diesen Wert
    Sitemap und JSON-LD entfallen.
- [ ] **E1a — Feld im Admin-Panel** (`app/admin/components/SettingsEditor.tsx`, Sektion `seo`,
      `SETTINGS_SECTIONS:197`)
  - Textfeld **„Site URL"** als erstes Feld der SEO-Sektion, über „SEO Title" — es ist die
    Voraussetzung für alles andere dort. Anbindung wie die Nachbarfelder: `update('url', …)`.
    (Achtung: `url` liegt auf oberster Ebene, nicht unter `seo.` — sonst landet es beim Auflösen
    an der falschen Stelle.)
  - Placeholder `https://folio.example.com`, Hilfetext: wofür der Wert gebraucht wird (Sitemap,
    `robots.txt`, JSON-LD, absolute OG-Bild-URLs).
  - **Validierung im Feld, nicht erst beim Speichern:** muss mit `http://` oder `https://`
    beginnen und über `new URL()` parsebar sein; trailing Slash beim Speichern abschneiden, damit
    aus Nutzersicht egal ist, ob er einen setzt. Ungültige Eingabe blockiert das Speichern mit
    einer Meldung am Feld — eine kaputte Site-URL erzeugt sonst eine Sitemap voller kaputter Links.
  - Leeres Feld ist ein gültiger Zustand (= Funktionen aus, wie heute), keine Fehlermeldung.
  - Ein Hinweis in der SEO-Sektion, solange das Feld leer ist: „Ohne Site URL werden `sitemap.xml`
    und JSON-LD nicht ausgeliefert." Sonst sucht jemand den Fehler an der falschen Stelle.
- [ ] **E1b — Env-Überschreibungen im Panel sichtbar machen** (klein, generisch)
  - `GET /api/admin/settings` (`app/api/admin/settings/route.ts:18-19`) gibt zusätzlich
    `envLocked: string[]` zurück — die Namen der Felder, die gerade aus der Umgebung kommen.
    Anfangs: `url` (wenn `SITE_URL` gesetzt), `title` (`SITE_TITLE`), `subtitle` (`SITE_SUBTITLE`).
    **Nur Feldnamen, keine Werte** — die Route soll keine Env-Inhalte spiegeln, die sonst nirgends
    im Panel stehen.
  - `SettingsEditor` rendert betroffene Felder deaktiviert mit dem Zusatz „Von der Umgebungsvariable
    `SITE_URL` gesetzt" statt eines editierbaren Eingabefelds. Damit ist der stille Fehlschlag
    weg — beim neuen Feld und bei Titel/Untertitel gleich mit.
  - Das ist die erste Stelle dieser Art im Projekt; entsprechend klein halten (eine Liste, ein
    `disabled`, ein Hinweistext) und nicht zu einem Mechanismus ausbauen.
- [ ] **E2 — `app/robots.ts`**
  - `Disallow` für `/admin`, `/install`, `/api`.
  - `seo.noIndex: true` → `Disallow: /` für alle Agents.
  - `sitemap:`-Verweis nur, wenn `siteUrl` gesetzt ist.
- [ ] **E3 — `app/sitemap.ts`**
  - Gibt `[]` zurück, wenn `siteUrl` leer ist oder `seo.noIndex` gilt — kein halber Zustand.
  - Enthalten: `/`, `/about` (nur wenn `aboutEnabled`), `/map` (nur wenn `config.map`),
    `/journal` und je Eintrag `/journal/<slug>`, Subpages und Alben.
  - **Ausschlussliste — der eigentliche Inhalt dieser Task:**
    | Ausgeschlossen                                        | Quelle                                                        |
    | ----------------------------------------------------- | ------------------------------------------------------------- |
    | Subpage mit `password`                                | `SubpageConfig.password`                                      |
    | Subpage mit `hidden: true`                            | `SubpageConfig.hidden`                                        |
    | Subpage mit `enabled: false`                          | `SubpageConfig.enabled`                                       |
    | Album mit eigenem Passwort                            | `config.albumPasswords`                                       |
    | Album unterhalb einer geschützten/versteckten Subpage | Vererbung, siehe unten                                        |
    | Journal-Draft                                         | `frontmatter.draft`                                           |
    | Journal-Eintrag mit Passwort                          | Frontmatter                                                   |
    | `/impressum`                                          | trägt bereits `robots: noindex` (`app/impressum/page.tsx:14`) |
  - **Vererbung nicht vergessen:** Ein öffentliches Album unter einer passwortgeschützten Subpage
    ist über `/<subpage>/<album>` nicht erreichbar. Die Prüfung muss den Pfad entlanglaufen, nicht
    nur das Album ansehen.
  - `lastModified` aus `album.updatedAt` bzw. dem Journal-Datum.
- [ ] **E4 — JSON-LD**
  - `Person` bzw. `ProfilePage` auf `/about`, gespeist aus dem Frontmatter von `content/about.md`.
  - `ImageObject` mit `creator` und optional `license` auf Album-Detailseiten.
  - **CSP-Falle:** `proxy.ts` setzt eine CSP mit Per-Request-Nonce und reicht sie über den
    `x-nonce`-Header an die Seiten. Ein `<script type="application/ld+json">` **muss** diese Nonce
    tragen, sonst blockt der Browser es still. Im Browser mit gesetzter CSP verifizieren, nicht nur
    im Markup nachsehen.
  - `license` als optionales Feld in `settings.yaml` (`seo.license`), leer = weglassen.
- [ ] **E5 — Tests**
  - `lib/__tests__/sitemap.test.ts`: **tabellengetrieben über die Ausschlusskategorien**, nicht als
    Einzelfälle — dann schlägt der Test auch bei einer künftig hinzugefügten Sichtbarkeitsregel an.
    Vorbild: `app/api/admin/__tests__/admin-guards.test.ts`. Zusätzlich: leere Sitemap bei fehlender
    `siteUrl`; `noIndex` unterdrückt alles.
  - `lib/__tests__/site-url.test.ts`: Präzedenz `SITE_URL` > `settings.url` > leer; trailing Slash
    wird entfernt; ungültige URL führt nicht zum Absturz, sondern zu „nicht gesetzt".
  - `app/api/admin/__tests__/settings-env-lock.test.ts`: `envLocked` enthält `url` genau dann, wenn
    `SITE_URL` gesetzt ist — und die Antwort enthält **nirgends den Env-Wert selbst**.
  - Erwartet: **+18 bis +24 Tests** (461–467 gesamt).

**Verifikation:**

1. **Ohne** `SITE_URL`: Im Admin unter SEO die Site URL eintragen, speichern, dann `/sitemap.xml`
   und `/robots.txt` abrufen — beide müssen ohne Neustart die neue Domain führen (`invalidateConfigCache()`
   läuft beim Speichern bereits). Feld leeren → Sitemap wird wieder leer, Hinweistext erscheint.
2. Ungültige Eingaben gegenprüfen: `folio.example.com` ohne Schema und `https://` allein müssen am
   Feld abgewiesen werden, nicht erst beim Rendern der Sitemap auffallen.
3. **Mit** gesetztem `SITE_URL`: Das Feld muss deaktiviert sein und die Herkunft nennen — dasselbe
   für Titel/Untertitel bei gesetztem `SITE_TITLE`.
4. Eine passwortgeschützte Subpage anlegen und prüfen, dass weder ihr Slug noch ihre Alben in der
   Sitemap auftauchen.
5. JSON-LD im Rich-Results-Test von Google gegenprüfen; Browser-Konsole auf CSP-Fehler ansehen.

**Commits:** `feat(seo): add a site URL setting, editable in the admin panel` ·
`feat(seo): add robots.txt, sitemap.xml and JSON-LD`

---

## Task B2 — 1:1-Zoom im Lightbox

**Aufwand:** S

### Befund

Der Lightbox rendert `current.previewUrl` (`components/Lightbox.tsx:237`), während sein Dateikopf
„Full-resolution image display" verspricht (`:5`). `imageUrl()` steht per Default auf `'preview'`
(`lib/urls.ts:29`), und **keine Stelle in `app/`, `components/` oder `lib/urls.ts` fordert
`'original'` an** — die oberste Stufe aus `lib/imageSize.ts` ist im Frontend unerreichbar.

Als Default ist das richtig. Für Schärfebeurteilung fehlt der Weg dorthin.

### Schritte

- [ ] **B2.1 — `originalUrl` durchreichen**
  - `originalUrl?: string` in `PhotoItem` (`app/[...path]/PhotoGrid.tsx:18-33`) — **optional**,
    damit `JournalStudio.tsx:616-617` (Admin-Thumbnails über eine andere Route) unverändert bleibt.
  - Befüllen an den zwei öffentlichen Stellen: `app/[...path]/page.tsx:117-118` und
    `app/journal/[slug]/page.tsx:179-180`, jeweils `imageUrl(a.id, 'original')`.
  - Fehlt `originalUrl`, wird der Zoom-Knopf nicht gerendert. Kein Fallback auf Preview — ein Zoom,
    der auf ein Preview zoomt, ist genau die Verwechslung, die es zu beheben gilt.
- [ ] **B2.2 — Zoom-Geometrie als reines Modul** (`lib/zoom.ts`)
  - `clampPan(offset, scale, viewport, natural)` → begrenzt den Bildausschnitt auf die Bildkanten.
  - `zoomAt(point, scale, offset, factor)` → zoomt auf den Cursor/Pinch-Mittelpunkt statt auf die
    Bildmitte. Das ist der Unterschied zwischen brauchbar und ärgerlich.
  - Pure Funktionen, keine DOM-Abhängigkeit — direkt unit-testbar.
- [ ] **B2.3 — Verdrahtung im Lightbox**
  - Zustand: `zoomed` (bool), `scale`, `offset`. Auslöser: Doppelklick/Doppeltipp, Pinch, Taste `z`;
    zusätzlich ein sichtbarer Knopf neben dem Info-Toggle.
  - **Das Original wird erst bei dieser Geste geladen**, nie vorher. Die bestehende
    Nachbar-Vorladung (`Lightbox.tsx:96-105`) bleibt auf `previewUrl` und wird **nicht** angefasst —
    sonst zieht sich jeder Besucher unbemerkt Originale.
  - Ladeindikator, solange das Original unterwegs ist; das Preview bleibt so lange skaliert stehen.
  - Verlassen: `Esc` (erste Stufe verlässt den Zoom, nicht den Lightbox), Doppelklick, Knopf.
  - Zurücksetzen bei jedem Bildwechsel — sonst hängt der Zoomfaktor des vorherigen Bildes am nächsten.
  - **Konflikte prüfen:** `useSwipe` (Pinch/Pan darf nicht als Wisch durchgehen) und
    `AssetProtection` (`dragstart` ist global unterdrückt — Pan muss über Pointer-Events laufen,
    nicht über natives Dragging).
  - Tastatur: `+` / `-` / `0`, `aria-label` am Knopf, Zoomzustand über `aria-pressed`.
- [ ] **B2.4 — Kommentar korrigieren**
  - `components/Lightbox.tsx:5` beschreibt eine Absicht, kein Verhalten. Auf „Preview-tier image,
    with opt-in 1:1 zoom to the original" ändern.
- [ ] **B2.5 — Tests**
  - `lib/__tests__/zoom.test.ts`: Clamping an allen vier Kanten, Zoom auf Punkt, Rückkehr auf
    `scale: 1` zentriert das Bild wieder. Erwartet: **+10 bis +12 Tests**.
  - `e2e/lightbox-zoom.spec.ts`: Zoom öffnet, lädt eine `?size=original`-URL (Request abfangen),
    Pan bleibt in den Grenzen, Bildwechsel setzt zurück.

**Verifikation:** Netzwerk-Tab — beim Öffnen des Lightbox darf **keine** `size=original`-Anfrage
stehen, erst nach der Zoom-Geste. Auf einem Touchgerät gegenprüfen, dass Pinch nicht mehr als Wisch
zum nächsten Bild interpretiert wird.

**Commit:** `feat(lightbox): add opt-in 1:1 zoom against the original asset`

---

## Task B1 — Sequenzierung wie im Fotobuch

**Aufwand:** M — der größte Eingriff hier, und der einzige mit UI-Anteil im Admin.

### Befund

`PhotoGrid` bildet die Assets flach auf ein einziges `.photo-grid`-Element ab
(`app/[...path]/PhotoGrid.tsx:132-243`); das Layout gilt für alle gleich. `assetOrder`
(`lib/config/schema.ts:224`) bestimmt nur die Reihenfolge. Die Essay-Ansicht kennt `fullbleed`,
`wide` und Paare bereits (`lib/journal.ts`) — das Album nicht.

### Designentscheidung: Hinweise leben in `assetOrder`

Eine zweite, parallele Liste (`sequence:`) würde die Reihenfolge doppelt führen und damit
zwangsläufig auseinanderlaufen. Stattdessen wird `assetOrder` erweitert — Sequenzierung setzt
ohnehin `sort: manual` voraus:

```yaml
- 'album-uuid':
    sort: manual
    assetOrder:
      - 'asset-opening': fullbleed # allein, volle Breite
      - 'asset-a': pair # diese beiden nebeneinander,
      - 'asset-b': pair #   auf gleiche Höhe gebracht
      - 'asset-c' # unverändert im normalen Raster
      - break # bewusste Lücke
```

`deriveGallery()` erzeugt daraus **zwei** Strukturen: `albumManualOrders` bleibt exakt wie heute
eine reine UUID-Liste (`break` herausgefiltert), damit `lib/albumSort.ts` unverändert
weiterfunktioniert — und neu `albumSequences: Record<albumId, SequenceEntry[]>` mit den Hinweisen.

### Die Invariante, an der dieses Feature scheitern kann

Der Lightbox-Index und die Permalinks `#photo-N` sind **positional** über `displayedAssets`
(`app/[...path]/PhotoGrid.tsx:51-107`, `openLightbox(index)`). Blockbildung darf deshalb
**ausschließlich gruppieren, niemals umsortieren, nichts auslassen und nichts doppeln**. Wird das
verletzt, öffnet ein Klick das falsche Foto und jeder geteilte Permalink zeigt woanders hin — ein
Fehler, der beim Entwickeln kaum auffällt und beim Kunden sofort.

### Schritte

- [ ] **B1.1 — Schema & Parser**
  - `SequenceHint = 'fullbleed' | 'pair' | 'break'`; `assetOrder?: Array<string | Record<string, string> | 'break'>`
    in `AlbumEntryObject`.
  - In `deriveGallery()` (`lib/config/index.ts:162-236`, direkt neben der `coverPosition`-Validierung):
    unbekannte Hinweise **werfen** mit nennender Meldung — dieselbe Linie wie beim `sort`-Wert, wo
    ein Tippfehler bewusst nicht still durchgeht.
  - `albumManualOrders` bleibt unverändert UUID-only; `albumSequences` kommt dazu (beides in
    `AppConfig`, `GalleryDerivation` und den drei Rückgabestellen in `lib/config/index.ts`).
  - Ein einzelnes `pair` ohne Partner fällt auf normales Verhalten zurück, statt zu werfen —
    beim Umsortieren im Admin ist dieser Zustand ein normaler Zwischenschritt.
- [ ] **B1.2 — Blockbildung als reines Modul** (`lib/sequence.ts`)
  - `buildSequenceBlocks(assets, hints)` → `Array<{ kind: 'grid' | 'pair' | 'fullbleed' | 'break', items: Array<{ asset, index }> }>`.
  - **Jedes Item trägt seinen ursprünglichen Index mit.** Das ist die technische Absicherung der
    Invariante oben.
  - Aufeinanderfolgende Assets ohne Hinweis landen in einem gemeinsamen `grid`-Block, damit das
    bestehende Layout (Masonry, Justified …) darin unverändert greift.
- [ ] **B1.3 — Rendering**
  - `PhotoGrid` rendert Blöcke statt einer flachen Liste; `openLightbox(item.index)` statt
    `openLightbox(index)`.
  - CSS: `.photo-sequence__pair` (zwei Spalten, auf gleiche Höhe normiert über die vorhandenen
    Aspect-Ratios), `.photo-sequence__fullbleed`, `.photo-sequence__break`. Mobil kollabieren Paare
    auf eine Spalte.
  - Ohne Hinweise entsteht genau ein `grid`-Block — das Markup bleibt dann identisch zu heute.
    **Das ist die Rückfallgarantie und gehört als Test festgeschrieben.**
- [ ] **B1.4 — Admin**
  - `AssetOrderEditor.tsx` bekommt pro Foto eine Hinweis-Auswahl und einen Trenner-Einfügen-Knopf.
  - Eine Andeutung der Blöcke in der Sortierliste (Paare zusammengefasst, Trenner als Linie).
    **Ohne diese Vorschau ist das Feature im Admin unbenutzbar** — das ist die halbe Arbeit an der
    Task, nicht das YAML-Schema.
- [ ] **B1.5 — Tests**
  - `lib/__tests__/sequence.test.ts`: Indizes bleiben lückenlos und in Reihenfolge (die Invariante,
    als expliziter Test über ein Album mit allen Hinweisarten); leere Hinweise → genau ein Block;
    verwaistes `pair`; `break` am Anfang und am Ende; Hinweis auf ein Asset, das gar nicht im Album
    ist.
  - `lib/__tests__/config-sequence.test.ts`: Parser akzeptiert die neue Form, wirft bei unbekanntem
    Hinweis, `albumManualOrders` bleibt UUID-only.
  - Erwartet: **+20 bis +25 Tests**.
  - `e2e/sequence.spec.ts`: Klick auf das dritte Foto in einem sequenzierten Album öffnet das dritte
    Foto; `#photo-3` landet auf demselben.

**Verifikation:** Ein Album mit `fullbleed`, einem Paar und einem `break` anlegen, im Browser
ansehen, jedes Foto anklicken und den Lightbox-Zähler gegen die visuelle Position prüfen. Ein Album
**ohne** Hinweise gegen `git stash` vergleichen: das Markup muss identisch sein.

**Commit:** `feat(album): sequence photos into pairs, spreads and breaks (EXPERIMENTAL)`

---

## Task C1 — Ortsauflösung pro Album

**Aufwand:** S

### Befund, präzise

Die Map ist besser gebaut als erwartet: Passwortgeschützte Alben werden **vor** der Aggregation
gefiltert (`app/api/map/route.ts:63-90`), und `lib/mapService.ts:5-11` hält Alben ausdrücklich
getrennt, damit genau das möglich ist. Die öffentliche EXIF-Route gibt Koordinaten gar nicht heraus
— die Map ist die einzige öffentliche GPS-Fläche.

Die Lücke betrifft **öffentliche** Alben: Die Marker-Position ist der Mittelwert der tatsächlichen
Koordinaten (`app/api/map/route.ts:97-104`). Bei einem Album von _einem_ Ort — Garten, Studio,
Wohnung eines Kunden, empfindlicher Naturstandort — ist dieser Mittelwert genau dieser Ort. Der
Marker heißt nach der Stadt und steht auf dem Grundstück.

### Zwei Entwurfsentscheidungen, die vorab feststehen müssen

**1. Keine Geodaten-Abhängigkeit.** Für „Stadtzentrum" bräuchte es einen Ortsdatensatz. Stattdessen
wird die Koordinate **gerastert**: `city` auf 0,05° (~5 km), `country` auf 1° (~110 km). Das ist
dependency-frei, erklärbar und ausreichend — 5 km trennen zuverlässig ein Grundstück von einem
Stadtgebiet.

**2. Marker fassen mehrere Alben zusammen.** Liegen an einer Stadt ein `exact`- und ein
`city`-Album, gibt es trotzdem nur einen Marker. Regel: **die strengste Stufe unter den
beitragenden Alben gewinnt.** Sicherheitsentscheidungen fallen in die vorsichtige Richtung, und die
Alternative — Marker aufspalten — würde über die Kartenansicht verraten, dass ein Album
zurückhaltender eingestellt ist.

### Schritte

- [ ] **C1.1 — Konfiguration**
  - `location?: 'exact' | 'city' | 'country' | 'hidden'` in `AlbumEntryObject` und in
    `SubpageObjectValue`/`SubpageConfig`.
  - `albumLocationModes: Record<string, LocationMode>` in `AppConfig`, befüllt in `deriveGallery()`
    neben `albumCoverPositions`; unbekannter Wert wirft.
  - Präzedenz wie beim Grid: global (neu: `map.locationDefault` in `settings.yaml`, Default
    `exact` = heutiges Verhalten) < Subpage < Album.
- [ ] **C1.2 — `lib/mapService.ts`**
  - Alben mit `hidden` überspringen, bevor gebucketet wird — das ist die einzige Stufe, die gar
    nicht erst in den Cache soll.
  - `locationMode` auf `MapAlbumEntry` mitführen. **Nicht** hier schon runden: gerundete Werte
    aufsummieren und danach mitteln ergibt wieder ungerundete Koordinaten.
- [ ] **C1.3 — `app/api/map/route.ts`**
  - Strengste Stufe der sichtbaren Alben je Marker bestimmen.
  - Mittelwert bilden wie heute, **danach** rastern: `city` → 0,05°, `country` → 1°, `exact` → unverändert.
  - Bei `country` das Stadtlabel weglassen (die Popup-Überschrift wäre sonst genauer als die Position).
  - Ist ein Marker nach dem Ausschluss leer, entfällt er — der Pfad existiert bereits (`allowedAlbums.length === 0`).
- [ ] **C1.4 — Admin & Doku**
  - Auswahlfeld pro Album und pro Subpage im `PageBuilder`, Standard in `SettingsEditor`.
  - `gallery.yaml.example` und `settings.yaml.example` ergänzen, mit einem Satz dazu, **warum** es
    das gibt.
- [ ] **C1.5 — Tests** (`lib/__tests__/map-location.test.ts`)
  - Rasterung: eine Koordinate auf einem Grundstück landet bei `city` sichtbar daneben, bleibt aber
    in derselben Stadt; `exact` verändert nichts.
  - Strengste Stufe gewinnt (alle sechs Paarungen).
  - `hidden` erscheint in keiner Ausgabe — auch dann nicht, wenn ein anderes Album dieselbe Stadt beisteuert.
  - Präzedenz global < Subpage < Album.
  - Erwartet: **+14 bis +18 Tests**.

**Verifikation:** Ein Album mit GPS-Daten von einem einzigen Ort anlegen, `/api/map` einmal mit
`exact` und einmal mit `city` abrufen und die Koordinaten vergleichen; auf der Karte gegenprüfen,
dass der Marker die Stadt trifft, aber nicht mehr die Adresse. Zusätzlich sicherstellen, dass ein
`hidden`-Album auch nach einem Cache-Durchlauf nicht auftaucht (`POST /api/admin/reload`).

**Commit:** `feat(map): make location precision configurable per album`

---

## Reihenfolge und Zusammenhänge

```
E  (Auffindbarkeit) ── unabhängig, bringt die Site-URL, die später auch ein Feed bräuchte
B2 (Zoom)           ── unabhängig, erste Stelle die Originale ausliefert
B1 (Sequenzierung)  ── größter Eingriff, berührt die Lightbox-Index-Invariante
C1 (Ortsauflösung)  ── unabhängig, Datenschutz
                       ↑ B1 und C1 fassen beide lib/config/{schema,index}.ts an,
                         aber verschiedene Felder — nacheinander mergen, nicht parallel
```

Vier PRs, in dieser Reihenfolge. E und B2 sind jeweils an einem Tag abgeschlossen und liefern
sofort etwas Sichtbares; B1 braucht am meisten Sorgfalt und sollte nicht unter Zeitdruck; C1 ist
klein, aber sicherheitsrelevant und verdient einen eigenen, ruhigen Review.

**Erwartete Testsumme am Ende:** 443 → etwa **516**.

## Was dieser Plan bewusst nicht enthält

Aus dem Brainstorm bleiben offen und sind hier **nicht** eingeplant: A1 (Client-Links), A2
(Anfrage-Formular), A3 (Proofing-Notizen), B3 (Farbmanagement-Messung), C2 (terminierte
Veröffentlichung) und D (RSS-Feed). Falls C2 und D später kommen: Beide brauchen dieselbe
Sichtbarkeitsprüfung, die in **E3** entsteht. Sie sollte dort so geschnitten werden, dass ein
zweiter Aufrufer sie wiederverwenden kann, statt sie zu kopieren.
