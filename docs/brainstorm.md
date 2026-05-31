# Feature Brainstorm

_Stand: 2026-05-29 — generiert aus Projekt-Review + ideas.md_

---

## ✅ Bereits implementiert

| Feature | Datum | Notizen |
|---|---|---|
| **Album-Beschreibungen** | 2026-05-29 | `description:` in `gallery.yaml` (pro Album), eigenes `<p>` unter dem Titel in `AlbumDetailView` |
| **Webhook Cache-Invalidierung** | 2026-05-29 | `POST /api/webhook`, HMAC-SHA256, `WEBHOOK_SECRET` in `.env`, gezielte oder vollständige Cache-Invalidierung |
| **Video-Support** | 2026-05-29 | Proxy `GET /api/video/[token]` mit Range-Support, Play-Button im Grid, `<video controls>` in Lightbox |

---

## ⚡ Quick Wins (offen)

| Idee | Effort | Warum interessant |
|---|---|---|
| **Sequentielle Album-Navigation** | XS | „← Vorheriges / Nächstes Album →" am Ende einer Detailseite |
| **Alt-Text aus Immich-Description** | XS | Immich-Assets haben ein `description`-Feld → als `alt`-Text → bessere Accessibility & SEO |
| **RSS/Atom Feed** | S | `/feed.xml` mit neuen Alben — Follower können „neue Arbeit" abonnieren |
| **Globaler Passwortschutz** | S | Eine einzige `site_password` für die gesamte Site (jetzt: nur per Subpage/Album) |
| **Privacy-Analytics-Integration** | S | Plausible / Umami / GoatCounter via Script-Tag in `settings.yaml` konfigurieren (kein Tracking-Framework nötig) |

---

## 📅 Timeline-View

Chronologische Ansicht aller Fotos quer durch alle Alben — geordnet nach Aufnahmedatum (EXIF).

- Routing: `/timeline` oder als alternative Subpage-Layout-Option
- Gruppierung nach Monat/Jahr als visuelle Trennlinie
- Nutzt bereits vorhandene EXIF-Daten
- Guter Einstieg für Visitor, die sich treiben lassen wollen

---

## 🔍 Suche (Immich Smart Search)

Immich hat eine eigene Suche (inkl. semantischer KI-Suche). Folio könnte das exponieren:

- Suchfeld → `POST /api/search` → proxied an Immich `/api/search/smart`
- Ergebnisse nur aus Albums die im `gallery.yaml` erlaubt sind (Allowlist!)
- Simple Text-Suche oder Semantic Search togglebar
- Echter Differentiator gegenüber anderen Portfolio-Tools

---

## 🖼️ Client-Delivery-Portal

Kombination aus bestehenden Features (Passwortschutz + Download):

- Password-geschützte Alben + Download-Button im Lightbox (schon in ideas.md)
- **Neu:** Auswahl-Modus — Client kann Fotos markieren/favorisieren
- „Ich habe meine Auswahl getroffen" → E-Mail-Notification an Fotografen
- Alles ohne Datenbank: Auswahl als signiertes JSON-Cookie oder URL-Share-Link

_Konkretisiert die „Client proofing"-Idee aus `ideas.md`._

---

## 📡 PWA / Offline-Support

- `manifest.json` + Service Worker
- Letzte besuchte Galerie wird gecacht (für schlechte Verbindung)
- „Installierbar" auf iOS/Android
- Besonders interessant für Fotografen die das Folio auf Messen/Events zeigen

---

## 🗺️ Map-View (Vollausbau)

Die API `/api/map` existiert schon — der Frontend-Teil fehlt noch.

- Interaktive Karte (MapLibre + freie Tiles, z.B. OpenFreeMap)
- Clustered Dots → Klick öffnet Album-Vorschau
- Als eigene `/map`-Seite oder als optionaler Hero-Typ
- Filter nach Zeitraum

_Basis-Idee schon in `ideas.md`, hier konkretisiert._

---

## 📊 EXIF-Analytics (konkretisiert)

Schon in `ideas.md` — hier ein konkreter Ansatz:

- Eigene Seite `/stats` oder Einbettung in `about`
- Charts: Focal-Length-Distribution, Aperture vs. ISO-Heatmap, „meist genutzte Kamera/Objektiv"
- Datenquelle: aggregierte EXIF aller zugänglichen Alben
- Lightweight Charts (z.B. Chart.js oder reine SVG-Balken ohne Dependency)

---

## 🔗 Prioritäten-Übersicht

```
✅ Erledigt:
   → Video-Support              (2026-05-29)
   → Webhook Cache-Invalidierung (2026-05-29)
   → Album-Beschreibungen        (2026-05-29)

🔥 Als nächstes:
   → RSS Feed                    (0 Dependencies, großer Community-Nutzen)
   → Sequentielle Album-Navigation (XS Effort)
   → Map-View Vollausbau         (Backend ist schon da!)

🚀 Mittelfristig:
   → Client-Delivery-Portal      (echter Business-Case)
   → Privacy Analytics           (einfache Integration)
   → Globaler Passwortschutz

💡 Längerfristige Differenziator:
   → Immich Smart Search         (KI-Suche als Alleinstellungsmerkmal)
   → Photo Stories               (schon in ideas.md, gut ausgearbeitet)
   → PWA / Offline-Support
```
