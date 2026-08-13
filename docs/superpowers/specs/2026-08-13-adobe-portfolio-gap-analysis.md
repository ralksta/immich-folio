# Adobe Portfolio — Feature-Gap-Analyse (Seiten & Struktur, Galerien)

**Datum:** 2026-08-13
**Status:** Analyse — keine Implementierung, keine Entscheidung getroffen
**Scope:** Nur die beiden Bereiche „Seiten & Struktur" und „Galerien". Branding/Theming, SEO,
Kontaktformular, Domain-Handling und Analytics sind bewusst ausgeklammert.

## Zweck

Immich Folio und Adobe Portfolio lösen dasselbe Problem — Fotoalben aus einem
Katalog als kuratierte Website ausspielen. Adobe Portfolio zieht aus Lightroom-Alben,
Immich Folio aus Immich-Alben. Dieses Dokument hält fest, welche Funktionen der
beiden Bereiche bereits existieren und wo echte Lücken sind, als Grundlage für die
Priorisierung.

Alle „vorhanden"-Aussagen sind am Code des Branches `claude/adobe-portfolio-features-1d1a47`
verifiziert, nicht aus der Dokumentation übernommen.

---

## 1. Seiten & Struktur

### Vorhanden

| Funktion                | Umsetzung                                                                   |
| ----------------------- | --------------------------------------------------------------------------- |
| Subpages mit Slug       | `gallery.yaml` → `subpages`, Slug via `slugify()` (`lib/config/schema.ts:222`) |
| Sections innerhalb Seite | `SubpageSectionConfig`, rendert typografisches Inhaltsverzeichnis            |
| Titel/Untertitel je Seite | `title`, `subtitle` pro Subpage                                            |
| Passwortschutz je Seite  | `password`, HMAC-Cookie `lb_auth_<slug>` (`lib/auth.ts`)                     |
| Passwortschutz je Album  | `lb_auth_album_<slug>`                                                      |
| Seite deaktivieren       | `enabled: false` — Seite verschwindet vollständig (`lib/immich.ts:461`)      |
| Grid-Override je Seite   | `grid` pro Subpage überschreibt globales Grid                               |
| Essay-/Storytelling-Seiten | `essayFile` / `essayText`, Layout `essay` (`app/[...path]/EssayView.tsx`)  |
| About-Seite              | `content/about.md` mit Frontmatter (`app/about/page.tsx`)                   |
| Impressum                | `/impressum`, gesteuert über `legal.enabled`                                |
| Kartenansicht            | `/map`, gesteuert über `map: true`                                          |
| Routing                  | Ein Catch-all (`app/[...path]/page.tsx`) für alle drei Seitenformen         |

Die Struktur ist damit **zweistufig**: Subpage → Album, plus Sections als
Gruppierung *innerhalb* einer Subpage.

### Lücken

**L1 — Cover-/Splash-Page.**
Adobe Portfolio bietet als Alternative zur Startseite mit Navigation eine
Welcome-Page: ein einzelnes formatfüllendes Bild mit Titel und einem Eintritts-Link,
Navigation ausgeblendet. Immich Folio hat sechs Hero-Stile, aber keinen Modus, der
die Navigation unterdrückt und einen expliziten Eintritt erzwingt.
*Berührt:* `app/page.tsx`, `layout.tsx`, `ThemeConfig.heroStyle` oder ein neues
Settings-Feld.

**L2 — Externe Links in der Navigation.**
`SubpageNav` rendert ausschließlich Subpages und Standalone-Alben als interne
`Link`s (`components/SubpageNav.tsx`). Ein Menüeintrag, der auf Instagram, einen
Shop oder ein Behance-Profil zeigt, ist nicht abbildbar.
*Berührt:* `SubpageNav`, `GalleryYaml`-Schema.

**L3 — Navigationsreihenfolge und -sichtbarkeit.**
Die Reihenfolge ergibt sich implizit aus der YAML-Reihenfolge, und Subpages stehen
immer vor Standalone-Alben. Es gibt kein „im Menü verstecken, per Direktlink
erreichbar" — `enabled: false` entfernt die Seite komplett (404), was für
Client-Vorschauen oder unveröffentlichte Arbeiten das falsche Verhalten ist.
*Berührt:* `SubpageConfig` (neues Feld, z. B. `hidden`), `SubpageNav`, `lib/immich.ts:663`.

**L4 — Verschachtelte Navigation.**
Adobe Portfolio erlaubt Dropdown-Menüs (Seite mit Untereinträgen). Immich Folio
ist strikt flach; Sections gruppieren nur innerhalb einer Seite und tauchen im
Menü nicht auf.
*Bewertung:* Die geringste Dringlichkeit der vier — Sections decken den Großteil
des Bedarfs ab, und eine dritte Ebene verkompliziert Routing und Breadcrumbs
erheblich.

**L5 — Redirects.**
Keine Möglichkeit, alte URLs auf neue Slugs zu mappen. Relevant, sobald jemand
eine bestehende Site migriert oder eine Seite umbenennt — beim Umbenennen ändert
sich der Slug still, und alle geteilten Links brechen.
*Berührt:* `proxy.ts` oder `next.config` Redirects aus Settings.

**L6 — Freie Inhaltsseiten.**
`about.md` und Essays decken zwei feste Formen ab. Eine beliebig anlegbare
Textseite („Kontakt", „Preise", „Prints") gibt es nicht.
*Bewertung:* Essays sind funktional bereits sehr nah dran — dies ist eher eine
Verallgemeinerung des Bestehenden als ein neues Feature.

---

## 2. Galerien

### Vorhanden

| Funktion                    | Umsetzung                                                          |
| --------------------------- | ------------------------------------------------------------------ |
| 6 Layouts                   | `masonry`, `uniform`, `showcase`, `filmstrip`, `editorial-flow`, `essay` (`GridConfig.layout`) |
| Spalten, Gap, Seitenverhältnis | `grid.columns`, `grid.gap`, `grid.aspectRatio`                   |
| Cover-Bild je Album         | `heroImage` in `AlbumEntryObject`                                  |
| Titel-Override je Album     | `albumOverrides`                                                   |
| Beschreibung je Album       | `albumDescriptions`                                                |
| Sortierung                  | `album.order` (`asc`/`desc`) aus Immich, explizit nachsortiert über `fileCreatedAt` (`lib/immich.ts:608`) |
| Lightbox                    | Tastatur-Navigation, EXIF-Panel (`i`), Favoriten (`components/Lightbox.tsx`) |
| EXIF beim Hover             | `exifOnHover`                                                      |
| Bildschutz                  | `protection.disableRightClick`, `disableImageDrag`                 |
| Wasserzeichen               | `watermark.text`, `opacity`, `position`                            |
| Client-Proofing             | `proofing.enabled` — Favoritenauswahl, in Adobe Portfolio gar nicht enthalten |
| Blur-Platzhalter            | `lib/thumbhash.ts`                                                 |

### Lücken

**L7 — Justified-Rows-Layout.**
Adobes charakteristisches Galerie-Layout: Bilder werden zeilenweise so skaliert,
dass jede Zeile exakt die Containerbreite füllt und alle Bilder einer Zeile
dieselbe Höhe haben. Das Seitenverhältnis bleibt dabei unangetastet. `masonry`
löst dasselbe Problem spaltenweise und erzeugt ein deutlich anderes, weniger
„redaktionelles" Bild. Die vorhandenen `aspectRatio`-Daten pro Asset
(`PhotoGrid.tsx:31`) sind die Voraussetzung dafür und bereits da.
*Bewertung:* Die inhaltlich größte und sichtbarste Lücke der gesamten Analyse.
*Berührt:* `GridConfig.layout` (neuer Wert), `PhotoGrid.tsx`, `app/globals.css`.
*Offene Frage:* CSS-only mit `flex-grow`-Trick oder berechnete Zeilenumbrüche —
CSS-only bricht bei der letzten Zeile und ohne bekannte Bildhöhen serverseitig.

**L8 — Grid-Override auf Album-Ebene.**
`grid` lässt sich global und pro Subpage setzen, aber nicht pro Album. Ein Album
mit Panoramen braucht andere Spaltenzahl als eines mit Porträts.
*Berührt:* `AlbumEntryObject`, Merge-Logik in `lib/config/index.ts`.

**L9 — Konfigurierbare Hover-Effekte.**
Der Hover-Zustand ist fest verdrahtet (plus optionales EXIF-Overlay). Adobe
Portfolio bietet Zoom, Fade, Titel-Overlay und „kein Effekt" zur Auswahl.
*Bewertung:* Rein kosmetisch, aber billig — im Wesentlichen ein
`data`-Attribut plus CSS je Variante.

**L10 — Bildunterschriften.**
Das Lightbox-Panel zeigt EXIF-Technikdaten (Kamera, Objektiv, ISO), aber keine
redaktionelle Bildunterschrift. Immich pflegt pro Asset eine `description` — die
wird derzeit nicht ausgespielt.
Der EXIF-Endpunkt gibt nur neun feste Felder zurück (`make` … `country`,
`app/api/exif/[id]/route.ts:68`) — `description` ist nicht dabei.
*Berührt:* `app/api/exif/[id]/route.ts`, `components/Lightbox.tsx`.
*Architektonischer Stolperstein:* die Route ist komplett hinter `exifOnHover`
gesperrt (403, Zeile 19). Eine Bildunterschrift ist aber kein Technikdatum —
wer EXIF ausschaltet, will trotzdem Bildunterschriften. Die Kopplung muss also
aufgetrennt werden, statt die Description einfach in dieselbe Antwort zu legen.

**L11 — Fokuspunkt fürs Cover-Cropping.**
Cover-Bilder werden mittig beschnitten. Bei Porträts im Querformat schneidet das
regelmäßig Köpfe ab. Ein Fokuspunkt je Album (`object-position`) löst das.
*Berührt:* `AlbumEntryObject`, Cover-Rendering.

**L12 — Sortierung in der YAML steuerbar.**
Die Reihenfolge kommt aus dem Immich-Album (`order`). Wer die Website anders
sortieren will als den Katalog, muss den Katalog ändern.
*Bewertung:* Bewusster Trade-off der bestehenden Architektur, nicht zwingend ein
Defekt. Nur relevant, wenn sich das als echter Schmerzpunkt zeigt.

---

## 3. Was Immich Folio hat und Adobe Portfolio nicht

Zur Einordnung — der Rückstand ist einseitig kleiner, als die Listen suggerieren:
Client-Proofing mit Favoritenauswahl, Kartenansicht mit GPS-Aggregation,
Wasserzeichen, Essay-Layouts, sieben Theme-Presets mit freier Anpassung,
Passwortschutz auf Album-*und*-Seitenebene, sowie Self-Hosting ohne Abo.

---

## 4. Priorisierungsvorschlag

Nach Verhältnis von sichtbarer Wirkung zu Aufwand:

**Erste Gruppe — hohe Wirkung, klar abgegrenzt**

- L7 Justified-Rows-Layout — der prägendste optische Unterschied
- L3 Navigations-Sichtbarkeit (`hidden`) — kleines Feld, löst einen realen Anwendungsfall
- L10 Bildunterschriften — Daten liegen in Immich bereits vor

**Zweite Gruppe — nützlich, moderater Aufwand**

- L1 Cover-/Splash-Page
- L8 Grid-Override je Album
- L2 Externe Nav-Links
- L11 Cover-Fokuspunkt

**Dritte Gruppe — später oder gar nicht**

- L9 Hover-Effekte (kosmetisch)
- L5 Redirects (erst bei Migrationsbedarf)
- L6 Freie Inhaltsseiten (Essays decken viel ab)
- L12 Sortierung in YAML (architektonischer Trade-off)
- L4 Verschachtelte Navigation (hoher Aufwand, geringer Nutzen)

## 5. Offene Fragen

1. Soll das Justified-Layout `masonry` ersetzen oder als siebte Option danebenstehen?
2. Muss jede neue Option auch im Admin-Panel (`app/admin/components/SettingsEditor.tsx`,
   `PageBuilder.tsx`) editierbar sein, oder reicht zunächst YAML?
3. Bleibt die Struktur bewusst zweistufig (L4 dauerhaft abgelehnt) oder nur vertagt?
