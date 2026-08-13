# Adobe-Portfolio-Features (experimental) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sieben Adobe-Portfolio-Lücken (L7, L3, L10, L8, L11, L2, L1) als klar gekennzeichnete experimentelle Features auf `dev` schließen.

**Architecture:** Alle Features erweitern die bestehende YAML→`AppConfig`-Pipeline (`lib/config/`), werden in den bestehenden Views gerendert und im Admin-Panel editierbar gemacht. Kein neues Routing, keine neue Persistenz. Jedes Feature ist ein eigener Commit mit Scope `feat(experimental): …` auf Branch `experimental/adobe-portfolio`.

**Tech Stack:** Next.js 16, TypeScript strict, Vanilla CSS, Vitest.

## Global Constraints

- Basis: `origin/dev`, Branch `experimental/adobe-portfolio`, Commits `feat(experimental): …`
- Justified ist **zusätzliches** Layout, ersetzt nichts (Nutzer-Entscheidung Q1)
- Jede neue Option muss im Admin-Panel editierbar sein (Nutzer-Entscheidung Q2)
- Struktur bleibt zweistufig — keine verschachtelte Navigation (Q3 vertagt)
- Vor jedem Commit: `npx tsc --noEmit` = 0 Fehler; betroffene Tests grün
- Neue YAML-Optionen in den `.example`-Dateien mit `# EXPERIMENTAL`-Kommentar dokumentieren
- Keine rohen Asset-UUIDs im Client-HTML (bestehende Sicherheitsregel)

---

### Task 1: Justified-Rows-Layout (L7)

**Files:**
- Modify: `lib/config/schema.ts` (layout-Union, 3 Stellen)
- Modify: `lib/config/theme.ts:85` (`VALID_LAYOUTS`)
- Modify: `app/[...path]/PhotoGrid.tsx` (Props-Union, Item-Styles)
- Modify: `app/globals.css` (`.photo-grid--justified`)
- Modify: `app/admin/components/SettingsEditor.tsx:72` (`LAYOUTS`) + Layout-Karte
- Modify: `content/settings.yaml.example`
- Test: `lib/__tests__/config.test.ts` (Layout-Validierung)

**Interfaces:**
- Produces: Layout-Wert `'justified'` in `GridConfig['layout']`; CSS-Klasse `photo-grid--justified`; nutzt `--grid-gap` und neue Var `--grid-row-height` (Default 300px, via `columns` skaliert: `calc(2000px / var(--grid-columns)))`.

**Technik:** Flexbox-Justified ohne JS-Messung: Container `display:flex; flex-wrap:wrap`. Jedes Item bekommt inline `flex-grow: aspectRatio` und `flex-basis: calc(var(--row-h) * AR)`, Höhe wächst mit. Letzte Zeile wird per `::after { content:''; flex-grow: 1e4 }` am Aufblähen gehindert.

- [ ] **Step 1: Failing test** — in `lib/__tests__/config.test.ts` (Muster der Datei übernehmen): settings mit `grid.layout: 'justified'` → `getConfig().grid.layout === 'justified'` (heute fällt es auf `'masonry'` zurück).
- [ ] **Step 2: Test läuft rot** — `npm run test:unit -- config`
- [ ] **Step 3: Implementierung**
  - `theme.ts`: `'justified'` in `VALID_LAYOUTS` aufnehmen.
  - `schema.ts`: Union an allen drei Stellen um `'justified'` erweitern (Zeilen 80, 179, 219 sind `layout`-Vorkommen).
  - `PhotoGrid.tsx`: Props-Union erweitern; im Item-Style-Block:
    ```tsx
    ...(layout === 'justified' && asset.aspectRatio
      ? {
          flexGrow: asset.aspectRatio,
          flexBasis: `calc(var(--grid-row-height, 300px) * ${asset.aspectRatio})`,
        }
      : {}),
    ```
    Achtung: `FadeIn` wrappt das Item — prüfen, ob FadeIn ein eigenes DOM-Element rendert; falls ja, müssen flex-Styles auf dem FadeIn-Wrapper landen (via `style`-Prop oder CSS `display:contents`).
  - `globals.css`:
    ```css
    .photo-grid--justified {
      display: flex;
      flex-wrap: wrap;
      gap: var(--grid-gap, 12px);
      --grid-row-height: calc(900px / var(--grid-columns, 3));
    }
    .photo-grid--justified .photo-grid__item {
      position: relative;
      height: var(--grid-row-height);
      min-width: 120px;
    }
    .photo-grid--justified::after { content: ''; flex-grow: 999999; }
    ```
    (Genaue Selektoren an FadeIn-Realität anpassen; Mobile-Breakpoints analog zu `--filmstrip` ergänzen.)
  - `SettingsEditor.tsx`: `'justified'` in `LAYOUTS` + Karte `{ label: 'Justified', desc: 'Row-based layout with equal heights (EXPERIMENTAL)' }` + Mini-Demo analog bestehender.
  - `settings.yaml.example`: Kommentar `# masonry, uniform, showcase, filmstrip, editorial-flow, justified (EXPERIMENTAL)`.
- [ ] **Step 4: Test grün + tsc** — `npm run test:unit -- config && npx tsc --noEmit`
- [ ] **Step 5: Visuelle Prüfung** — Dev-Server, Layout in settings.yaml auf justified, Screenshot.
- [ ] **Step 6: Commit** — `feat(experimental): add justified rows gallery layout`

### Task 2: Versteckte Subpages (L3)

**Files:**
- Modify: `lib/config/schema.ts` (`SubpageConfig.hidden`, `SubpageObjectValue.hidden`, `GalleryYaml`-Subpage)
- Modify: `lib/config/index.ts` (`deriveGallery`: beide Zweige `hidden: sp.hidden === true`)
- Modify: `components/SubpageNav.tsx` (Filter `!sp.hidden`)
- Modify: `app/page.tsx` (`heroNavEntries`/Homepage-Listen filtern)
- Modify: `app/admin/components/PageBuilder.tsx` (Toggle „Hidden from navigation" neben `enabled`, Round-Trip in Parse/Serialize ~Z. 470/533)
- Modify: `content/gallery.yaml.example`
- Test: `lib/__tests__/derive-gallery.test.ts`

**Interfaces:**
- Produces: `SubpageConfig.hidden?: boolean`. Semantik: `hidden` → nicht in Nav/Homepage/Hero-Listen, aber per Slug erreichbar (`isValidSubpage`/`getSubpage` unverändert). `enabled:false` bleibt 404.

- [ ] **Step 1: Failing test** — deriveGallery mit `{ name: 'X', hidden: true, albums: [uuid] }` → `subpages[0].hidden === true`; ohne Angabe → `undefined`/falsy.
- [ ] **Step 2: rot** — `npm run test:unit -- derive-gallery`
- [ ] **Step 3: Implementierung** — Schema + beide deriveGallery-Zweige + Nav/Homepage-Filter + PageBuilder-Toggle (Badge „hidden" analog zum bestehenden `enabled === false`-Badge ~Z. 322) + Beispiel-Kommentar `hidden: true # EXPERIMENTAL: reachable by direct link, not shown in navigation`.
- [ ] **Step 4: grün + tsc**
- [ ] **Step 5: Commit** — `feat(experimental): hide subpages from navigation while keeping them reachable`

### Task 3: Bildunterschriften in der Lightbox (L10)

**Files:**
- Modify: `app/api/exif/[id]/route.ts` (Description mitliefern; Gate auftrennen)
- Modify: `hooks/useExif.ts` (`description?: string | null`)
- Modify: `components/Lightbox.tsx` (Caption-Anzeige)
- Modify: `components/Lightbox.module.css`
- Test: `app/api/exif/__tests__/route.test.ts` (neu; Muster von bestehenden Route-Tests, z. B. admin-auth)

**Interfaces:**
- Consumes: `immich.getAssetInfo(id)` → Immich liefert `exifInfo.description`.
- Produces: Response-Feld `description`; bei `exifOnHover: false` NICHT mehr 403, sondern `{ description }` ohne Technikfelder (Kopplung Caption/EXIF aufgetrennt, siehe Gap-Analyse L10).

- [ ] **Step 1: Failing tests** — Route-Test: (a) exifOnHover=true → Response enthält `description`; (b) exifOnHover=false → 200 mit NUR `description`, keine `model`/`iso`-Felder.
- [ ] **Step 2: rot**
- [ ] **Step 3: Implementierung**
  - Route: 403-Gate ersetzen durch `const exifEnabled = config.exifOnHover;` Antwort:
    ```ts
    const caption = exif.description?.trim() || undefined;
    return NextResponse.json(
      exifEnabled
        ? { make: …, model: …, …, country: exif.country, description: caption }
        : { description: caption },
      { headers: { … } },
    );
    ```
    404-Fall (`!asset?.exifInfo`) bleibt.
  - Lightbox: unter dem Bild (oder im Panel oben) `{exifData?.description && <p className={styles.caption}>{exifData.description}</p>}` — Caption auch ohne offenes Panel sichtbar machen: separater Fetch-on-Navigate existiert schon (`fetchExif` bei Bildwechsel, Z. 67/77) — prüfen; falls Fetch nur bei offenem Panel läuft, Caption nur im Panel zeigen (YAGNI).
- [ ] **Step 4: grün + tsc**
- [ ] **Step 5: Commit** — `feat(experimental): show Immich asset descriptions as lightbox captions`

### Task 4: Grid-Override pro Album (L8)

**Files:**
- Modify: `lib/config/schema.ts` (`AlbumEntryObject.grid`, `AppConfig.albumGrids`)
- Modify: `lib/config/index.ts` (`processAlbumEntry` sammelt `albumGrids[uuid] = buildSubpageGrid(value.grid).grid`; Derivation + getConfig + Dummy-Config)
- Modify: `app/[...path]/page.tsx` (AlbumDetailView-Pfade: `buildGridStyle({ ...spGrid, ...albumGrid })`, Layout-Merge ebenso)
- Modify: `app/admin/components/PageBuilder.tsx` (Layout-Select im Album-Editor, wo title/description/password editiert werden)
- Modify: `content/gallery.yaml.example`
- Test: `lib/__tests__/derive-gallery.test.ts`

**Interfaces:**
- Produces: `AppConfig.albumGrids: Record<string, Partial<GridConfig>>`; Merge-Reihenfolge global < subpage < album.

- [ ] **Step 1: Failing test** — Album-Entry `{ uuid: { title: 'T', grid: { layout: 'filmstrip', columns: 2 } } }` → `albumGrids[uuid]` = `{ layout: 'filmstrip', columns: 2 }`.
- [ ] **Step 2: rot**
- [ ] **Step 3: Implementierung** — GalleryDerivation um `albumGrids` erweitern (alle Rückgaben inkl. Dummy in getConfig), page.tsx an den drei `buildGridStyle`-Aufrufstellen (Z. 228/344/415) Album-Override mergen wo ein konkretes Album gerendert wird, PageBuilder Select (Werte = `VALID_LAYOUTS` + leer für „inherit"), Beispiel mit `# EXPERIMENTAL`.
- [ ] **Step 4: grün + tsc**
- [ ] **Step 5: Commit** — `feat(experimental): per-album grid overrides`

### Task 5: Cover-Fokuspunkt pro Album (L11)

**Files:**
- Modify: `lib/config/schema.ts` (`AlbumEntryObject.coverPosition`, `AppConfig.albumCoverPositions`)
- Modify: `lib/config/index.ts` (validieren: Pattern `/^\d{1,3}% \d{1,3}%$/` oder Schlüsselwörter `center|top|bottom|left|right`-Kombis; bei Verstoß throw analog `sort`)
- Modify: `app/[...path]/SubpageGridView.tsx` + Homepage-Albumkarten (`style={{ objectPosition }}` aufs Cover-`<Image>`)
- Modify: `app/admin/components/PageBuilder.tsx` (Textfeld im Album-Editor)
- Modify: `content/gallery.yaml.example`
- Test: `lib/__tests__/derive-gallery.test.ts`

- [ ] **Step 1: Failing test** — `coverPosition: '50% 25%'` → `albumCoverPositions[uuid] === '50% 25%'`; `coverPosition: 'javascript:x'` → throw.
- [ ] **Step 2: rot**
- [ ] **Step 3: Implementierung** — Durchstich Schema→Derivation→beide Cover-Renderstellen→PageBuilder→Beispiel (`coverPosition: "50% 25%" # EXPERIMENTAL: focal point for cover crop`).
- [ ] **Step 4: grün + tsc**
- [ ] **Step 5: Commit** — `feat(experimental): per-album cover focal point`

### Task 6: Externe Navigations-Links (L2)

**Files:**
- Modify: `lib/config/schema.ts` (`SettingsYaml.navLinks`, `AppConfig.navLinks: Array<{ label: string; url: string }>`)
- Modify: `lib/config/index.ts` (übernehmen; nur `http(s)://`-URLs zulassen, sonst Eintrag verwerfen + `console.warn`; Dummy-Config: `[]`)
- Modify: `components/SubpageNav.tsx` oder `app/layout.tsx` (nach den internen Links: `<a href target="_blank" rel="noopener noreferrer" className="header__nav-link header__nav-link--external">`)
- Modify: `app/admin/components/SettingsEditor.tsx` (Liste label+url mit Add/Remove)
- Modify: `content/settings.yaml.example`
- Test: `lib/__tests__/config.test.ts`

- [ ] **Step 1: Failing test** — settings mit `navLinks: [{label: 'Shop', url: 'https://x.y'}, {label: 'Bad', url: 'javascript:alert(1)'}]` → config.navLinks enthält nur den Shop-Eintrag.
- [ ] **Step 2: rot**
- [ ] **Step 3: Implementierung** — inkl. `# EXPERIMENTAL`-Beispielblock.
- [ ] **Step 4: grün + tsc**
- [ ] **Step 5: Commit** — `feat(experimental): external links in header navigation`

### Task 7: Cover-/Splash-Hero (L1)

**Files:**
- Modify: `lib/config/schema.ts` (`ThemeConfig.heroStyle` Union + `'cover'`)
- Modify: `lib/config/theme.ts` (heroStyle-Validierung, falls vorhanden)
- Modify: `app/page.tsx` (Branch `heroStyle === 'cover'`: 100dvh-Fullbleed mit Titel, Untertitel, „Enter"-Anchor auf `#gallery`; bestehende Content-Sektion bekommt `id="gallery"`)
- Modify: `app/globals.css` (`.hero--cover`, Scroll-Hint-Pfeil, `scroll-behavior: smooth` falls nicht vorhanden)
- Modify: `app/admin/components/SettingsEditor.tsx` (heroStyle-Karte `cover`, ~Z. 659)
- Modify: `content/settings.yaml.example`

**Hinweis:** Bewusst KEINE Nav-Unterdrückung im Layout (Server-Layout kennt die Route nicht sauber) — der Cover füllt den Viewport unterhalb des Headers; das ist der YAGNI-Schnitt. Kein Test nötig (reines Rendering), aber visuelle Prüfung Pflicht.

- [ ] **Step 1: Implementierung** wie beschrieben, erste Hero-Grafik als Hintergrund (bestehender `heroData[0]`-Pfad mit `imageUrl`).
- [ ] **Step 2: tsc + Dev-Server-Screenshot**
- [ ] **Step 3: Commit** — `feat(experimental): cover splash hero style`

### Task 8: Abschluss

- [ ] `npm run test:unit` komplett, `npm run lint`, `npm run build`
- [ ] Beispieldateien-Konsistenz prüfen (alle neuen Optionen dokumentiert, alle mit EXPERIMENTAL markiert)
- [ ] PR gegen `dev` mit Label/Titel-Präfix „experimental", Verweis auf Gap-Analyse
