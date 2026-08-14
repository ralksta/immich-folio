# Design-Spezifikation: Journal Studio (Foto-Essays & Stories)

_Status: Entwurf genehmigt (Brainstorming abgeschlossen) · Datum: 2026-08-14_

---

## 1. Understanding Summary

- **Ziel & Vision:** Bereitstellung eines intuitiven, erstklassigen **Journal Studios** für Fotografen, um Bild-Text-Reportagen, Reisetagebücher und Ausstellungsberichte (im Stil von Leica Journal / National Geographic) zu verfassen und zu veröffentlichen.
- **Zielgruppe:** 
  - **Besucher:** Immersives, typografisch elegantes Leseerlebnis mit progressiv ladenden Bildern (ThumbHash), responsiven Layouts und Lightbox-Interaktion.
  - **Fotograf:** Mühelose Redaktion im Admin-Panel mit Live-Split-Screen-Vorschau und universeller Immich-Bildauswahl.
- **Konzept:** Reines Markdown mit Frontmatter im Content-Volume (`content/journal/*.md`), verwaltet über eine dedizierte Admin-UI und ausgeliefert über saubere Next.js Server Components.
- **Kern-Vorteile:** 
  - Trennung von Galerie-Konfiguration (`gallery.yaml`) und redaktionellen Inhalten.
  - Volle Git- & Backup-Kompatibilität durch Standard-Markdown.
  - Schnelle Erstellung ohne manuelle UUID-Eingabe.

---

## 2. Annahmen (Assumptions)

1. **Storage-Pfad:** Journal-Einträge werden standardmäßig unter `content/journal/[slug].md` gespeichert.
2. **Bild-Referenzierung:** Bilder verweisen über `![Alt Text](asset:IMMICH_UUID)` auf Immich-Assets und werden über den internen Image-Proxy mit Cache und ThumbHash ausgeliefert.
3. **Theming:** Die Leseansicht (`/journal/[slug]`) bindet sich nahtlos an das global konfigurierte Design-Theme an (CSS-Variablen, Fonts, Margins).
4. **Resilienz:** Nicht auffindbare Bilder führen nicht zu einem Seitenabsturz, sondern werden durch neutrale Platzhalter ersetzt.

---

## 3. Decision Log

| # | Entscheidung | Alternativen | Begründung |
|---|---|---|---|
| 1 | **Nomenklatur "Journal"** | Stories, Photo Essays, Magazin | "Stories" wirkt wie flüchtige Social-Media-Inhalte. "Journal" spiegelt zeitlose, fotografische Wertigkeit (wie Leica Journal) wider. |
| 2 | **Architektur-Ansatz 1 (Eigenständiges Studio)** | Subpage-Drawer, Quick-Fix | Maximale Schreib- und Layout-Ergonomie durch echten Split-Screen und Entkopplung von `gallery.yaml`. |
| 3 | **Persistenz als `.md`-Dateien** | Strings in `gallery.yaml`, SQLite/DB | Behält das dateibasierte, zustandsarme Self-Hosting-Paradigma bei; einfache Versionierung via Git. |
| 4 | **Bidirektionaler Editor (Blöcke ↔ Markdown)** | Nur WYSIWYG, Nur Markdown | Fotografen können visuell Blöcke anordnen oder direkt mit Markdown-Code arbeiten, ohne Datenverlust. |
| 5 | **Sicherheit via Slug-Sanitisierung** | Ungeprüfte Dateinamen | Verhindert Path Traversal (`../`) im Docker-Container/Dateisystem. |

---

## 4. Technische Architektur & Komponenten

### A. Dateisystem & Datenmodell
Jeder Eintrag ist eine `.md`-Datei mit folgendem Schema:

```markdown
---
title: "Expedition Nordkap"
subtitle: "Mit dem Bulli durch die Fjorde"
date: "2026-08-14"
author: "Ralf"
coverAssetId: "b8c2d111-0000-4000-8000-000000000000"
password: ""       # Optionaler Passwortschutz (scrypt)
draft: false       # Entwurf oder öffentlich
---

Hier beginnt der Text der Reportage...

![Fjord im Abendlicht](asset:93f812ab-1111-4000-8000-000000000000)
```

Unterstützte Block-Typen:
- **Heading:** `# H1`, `## H2`, `### H3`
- **Paragraph:** Fliesstext mit Inline-Markdown (`**fett**`, `*kursiv*`, `[Link](url)`)
- **Pullquote:** `> Zitattext` mit optionalem `— Autor`
- **Photo (Fullbleed / Wide / Contained):** `![Caption](asset:UUID)`
- **Photo-Pair (2-Spaltig):** Zwei aufeinanderfolgende `asset:`-Bilder

---

### B. Admin API Endpunkte (`/api/admin/journal`)

- **`GET /api/admin/journal`**: Liefert Liste aller Einträge (geparstes Frontmatter, Slug, Cover-Thumbnail, Word Count / Read Time).
- **`GET /api/admin/journal/[slug]`**: Liefert vollen Inhalt & Metadaten eines spezifischen Eintrags.
- **`PUT /api/admin/journal/[slug]`**: Speichert den Eintrag atomar (Write to `.tmp` ➔ Rename), legt `.bak`-Sicherungen an und validiert den Markdown-Baum.
- **`DELETE /api/admin/journal/[slug]`**: Löscht die `.md`-Datei nach Bestätigung.

---

### C. UI: Das Journal Studio (`/admin` ➔ Tab "Journal")

1. **Journal Dashboard:**
   - Übersicht aller Einträge als Karten mit Thumbnail, Status (*Draft*, *Live*, *Protected*), Erstellungsdatum.
   - Button `+ New Journal Entry`.
2. **Studio Split-Screen Editor:**
   - **Top Navigation:** Titel-Eingabe, Slug, Status-Schalter, Metadaten-Modal (Autor, Datum, Passwort, Cover-Foto) und Save-Button (`Cmd+S`).
   - **Linker Bereich (Authoring):**
     - Umschaltbar zwischen **[Visual Blocks]** (Karten mit Drag & Drop Griffleisten) und **[Raw Markdown]**.
     - Universeller Asset-Picker für Fotos aus allen Immich-Alben.
   - **Rechter Bereich (Live Preview):**
     - 1:1 Rendering via `EssayView` mit den CSS-Variablen des aktiven Themes.
     - Viewport-Umschalter (Desktop / Mobile).

---

### D. Frontend Routing & Rendering

- **`/journal`**: Übersicht aller veröffentlichten Journal-Einträge mit Cover-Bildern und Exzerpten.
- **`/journal/[slug]`**: Detailansicht der Reportage mit Passwort-Gate (`PasswordGate`) bei geschützten Einträgen.
- **Subpage-Integration:** Kompatibilität mit `gallery.yaml` (`essayFile: "nordkap.md"`) bleibt vollständig erhalten.

---

## 5. Test- & Absicherungsstrategie

1. **Unit-Tests (`lib/__tests__/journal.test.ts`):**
   - Frontmatter-Parsing & -Serialisierung.
   - XSS-Sanitisierung bei bösartigem Markdown-HTML.
   - Block-Transformation (Fullbleed, Pairs, Quotes).
2. **API-Tests (`app/api/admin/journal/__tests__/route.test.ts`):**
   - Auth-Schutz (401/403 bei nicht-angemeldeten Requests).
   - Path-Traversal-Abwehr (Rejection von `../`, `%2e%2e%2f`).
   - Atomare Speicherung und Fehlerbehandlung bei Disk-Fehlern.
3. **E2E / Integration:**
   - Aufruf von `/journal/[slug]` im Browser und Verifikation des Lightbox-Klicks auf eingebettete Fotos.
