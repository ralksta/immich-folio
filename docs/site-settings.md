# Site Settings

`content/settings.yaml` holds site-wide **behaviour and identity**: grid defaults, colour mode, language, navigation, watermark, SEO, footer and the about page. The file is optional; without it everything falls back to defaults.

**Contents:**

- [Grid Layout](#grid-layout)
- [Site Behaviour](#site-behaviour)
- [Navigation Links](#navigation-links)
- [Image Protection & Watermark](#image-protection--watermark)
- [SEO](#seo)
- [Footer](#footer)
- [About Page](#about-page)

## Grid Layout

The global default lives in `settings.yaml`; subpages and individual albums can
override it in `gallery.yaml`. The three levels merge, most specific winning:

**global (`settings.yaml`) → subpage → album**

> [!NOTE]
> Leaving `gap` out is not the same as setting `12`. Each theme preset picks its
> own photo spacing (2px `minimal`, 32px `editorial`, 40px `monograph`), and an
> unset `gap` lets that stand. Setting one wins in every preset — which is what
> `minimal`, `editorial` and `monograph` used to ignore
> ([#513](https://github.com/ralksta/immich-folio/issues/513)).

```yaml
# settings.yaml — global defaults
grid:
  columns: 3 # number of columns (default: 3)
  gap: 12 # gap in pixels — unset means the theme preset decides
  aspectRatio: '1' # "1", "3/2", "2/3", "16/9", "auto" (default: "1")
  layout: masonry
```

```yaml
# gallery.yaml — per-subpage override
subpages:
  - name: Japan
    grid:
      columns: 4
      layout: uniform
      aspectRatio: '3/2'
    albums:
      - '33333333-3333-3333-3333-333333333333'
```

Available layouts: `masonry`, `uniform`, `showcase`, `filmstrip`,
`editorial-flow`, `justified` (experimental), and `essay`
(see [Journal & Photo Essays](journal.md)). Each is illustrated in the
**[Theming guide](theming.md#gridlayout)**.

### Album covers on a subpage

A subpage with more than one album shows a grid of album covers rather than
photos. That grid has its own key, `coverGrid`, which sizes the cover tiles and
nothing else. `grid` next to it stays what it always was: the photos inside
those albums.

An unset `columns` falls back to the site-wide `grid.columns`, so a page that
states nothing tiles its covers the way it tiles its photos. Valid range is 1–6;
below 1024px viewport width at most two covers share a row, and below 640px they
stack.

`gap` is the deliberate exception: it does **not** cascade from the global
setting to the covers. Every theme preset picks its own cover spacing as part of
its look — 1px in `monograph`, 2px in `minimal` and `editorial`, 20px in
`studio-modern` — and letting the site-wide photo gap through would flatten all
of them into one look. Only an explicit `coverGrid.gap` overrides the preset:

```yaml
# gallery.yaml — the two grids of one page, set independently
subpages:
  - name: Editorial
    coverGrid:
      columns: 3 # three covers per row (site-wide default otherwise)
      gap: 24 # overrides the theme's own cover spacing
    grid:
      columns: 4 # the photos inside each album
      gap: 6
    albums:
      - '33333333-3333-3333-3333-333333333333'
      - '44444444-4444-4444-4444-444444444444'
```

Both are editable per page in the admin panel, under **Pages › _subpage_ ›
Album Cover Grid** and **Photo Grid**; left empty they follow the site-wide
setting and the theme respectively.

> [!NOTE]
> The covers and the photos shared a single `grid` key until
> [#523](https://github.com/ralksta/immich-folio/issues/523), where a gap typed
> into the admin's cover field turned out to retune every photo grid on the page
> as well. A `gallery.yaml` that predates the split has no `coverGrid`, so the
> covers fall back to `grid` and the page renders exactly as before; the first
> save from the admin panel writes the two out separately.

## Site Behaviour

Feature toggles in `settings.yaml`:

```yaml
title: 'My Portfolio'
subtitle: 'A visual journal'
lang: 'en'

mode: dark # dark (default) | light | auto — what a first-time visitor sees
exifOnHover: true # the summary overlay on photo grid hover
exif: # which groups may be shown at all
  camera: true # body, lens, focal length
  settings: true # aperture, shutter speed, ISO
  location: true # city and country
  caption: true # the description written in Immich
map: true # the interactive world map at /map
transitions: true # smooth page transitions between routes
scrollToTop: true # floating back-to-top arrow on long pages
analytics: true # cookieless view counts, see below
zoom: false # 1:1 zoom in the lightbox, see Photo Zoom

about:
  enabled: true # the /about page, rendered from content/about.md
```

| Key             | Default | Notes                                                    |
| --------------- | ------- | -------------------------------------------------------- |
| `lang`          | `en`    | Interface language, `<html lang>`, dates                 |
| `mode`          | `dark`  | Visitor's starting colour mode, see below                |
| `exifOnHover`   | on      | The grid hover overlay only, see below                   |
| `exif.*`        | on      | Per-group EXIF visibility, see below                     |
| `map`           | **off** | Opt-in: must be set to `true` explicitly                 |
| `transitions`   | on      |                                                          |
| `scrollToTop`   | on      |                                                          |
| `analytics`     | on      |                                                          |
| `zoom`          | **off** | Opt-in, see [Photo Zoom](gallery-features.md#photo-zoom) |
| `about.enabled` | on      | Needs a `content/about.md` to show anything              |

### Colour mode

`mode` decides what a visitor sees before they touch anything: `dark` (the
default the site has always had), `light`, or `auto` to follow their operating
system. It is rendered onto `<html>` server-side, so the first paint is already
right rather than flipping after the page loads.

A visitor's own choice from the header toggle is kept in their browser and
always wins over this — `mode` only sets the starting point. The light/dark
switch in the admin panel previews _your_ view and does not change what
visitors get; that is what this setting is for
([#512](https://github.com/ralksta/immich-folio/issues/512)).

### EXIF visibility

`exif` decides what the site may publish about a photo. It governs all three
places the data appears — the grid hover overlay, the lightbox info panel, and
the camera line in the album header — so they cannot disagree.

`caption` is the description written in Immich. It used to be shown regardless
of any setting, on the grounds that a caption is editorial rather than
metadata — which left it as the one field nobody could switch off, and Immich
descriptions are also where people keep private notes and whatever a decade of
cataloguing software left behind ([#506](https://github.com/ralksta/immich-folio/issues/506)).
It is a group like any other now.

`exifOnHover` predates the block and stays: it decides whether the grid shows
its overlay at all, and it supplies the default for the three technical groups,
so an existing `exifOnHover: false` still means "no technical EXIF anywhere". An
explicit `exif` key always wins over it. Captions never followed that switch and
still do not — set `caption: false` to turn them off.

With every group off, the lightbox withdraws its info button and the `i` key
rather than opening an empty panel.

### Interface language

`lang` picks the language of the visitor-facing interface — navigation, the
lightbox, the password gate, the proofing dialog, the legal notice, error pages
— and is also emitted as `<html lang>` and used for date formatting.

| Value | Interface         |
| ----- | ----------------- |
| `en`  | English (default) |
| `de`  | German            |
| `fr`  | French            |
| `es`  | Spanish           |
| `it`  | Italian           |
| `nl`  | Dutch             |

Region subtags are accepted and dropped for the interface (`fr-CA` → French,
`nl-BE` → Dutch), while the full value still reaches `<html lang>`.

Any other value (`ja`, `pt`, …) still reaches `<html lang>` and
`toLocaleDateString`, but the interface stays English: there is no dictionary
for it yet. That is deliberate — claiming `lang="en"` on a French site would be
worse for screen readers than an English interface on a page correctly marked
as Japanese.

Two things stay in one language by design:

- **The admin panel** is always English, whatever `lang` says.
- **`/impressum`** keeps its German headings when `lang: de` and the § 5 DDG
  citation in every language, because that is what the statute names
  (`legal.heading` replaces it where another law applies). Under `lang: en`
  the footer link reads "Legal Notice" rather than "Impressum" — the page is
  optional (`legal.enabled`), and an unexplained German word in the footer of
  an English site is what drove this out of the backlog.

Adding a language means adding one file under `lib/i18n/locales/` and listing
it in `SUPPORTED_LOCALES` (`lib/i18n/index.ts`). The dictionary is typed
against the English one, so a missing key fails the type-check rather than
falling back silently, and `lib/__tests__/i18n.test.ts` additionally catches
keys that were copied over but never translated. Words a language genuinely
shares with English (`ISO`, `Info`, French "photos") go into that locale's
allowance list in the same test, which in turn fails if an entry stops being
identical. Add the language to the **Language** select in
`app/admin/components/SettingsEditor.tsx` so it can be picked from the admin
panel.

### Analytics

Page and album view counts, stored in `content/analytics.json` — no cookies, no
third party, nothing leaving your server. The numbers are shown in the admin
panel's **Analytics** tab.

```yaml
analytics: false # stop counting entirely
```

With `analytics: false` the tracking endpoint refuses to record, so no data is
collected regardless of what the browser sends.

## Navigation Links

**Experimental.** External links appended to the header navigation. Only
`http(s)` URLs are accepted, and they open in a new tab:

```yaml
navLinks:
  - label: 'Shop'
    url: 'https://shop.example.com'
  - label: 'Instagram'
    url: 'https://instagram.com/your-handle'
```

## Image Protection & Watermark

```yaml
protection:
  disableRightClick: true # suppress the context menu on images
  disableImageDrag: true # block drag-to-desktop

watermark:
  enabled: true
  text: '© Your Name'
  opacity: 0.5 # fraction, 0–1: 0.5 is 50%
  position: 'bottom-right' # bottom-right | bottom-left | center
```

`opacity` is a fraction between 0 and 1, the same unit the admin slider writes.
A value above 1 is read as a percentage (`90` means 0.9), so configs written
that way before the unit was fixed keep working.

> [!NOTE]
> Both are deterrents against casual copying, not protection. The image is in
> the browser, and anyone who wants it can take a screenshot. The watermark is
> an overlay on the lightbox, not burned into the file.

## SEO

```yaml
seo:
  title: 'My Portfolio | Photography'
  description: 'A curated selection of my best photography work.'
  titleTemplate: '%s | My Portfolio' # %s is the subpage or album title
  noIndex: false # true → ask search engines not to index the site
  noFollow: false # true → ask search engines not to follow links
```

`titleTemplate` shapes the browser and search-result title of every subpage and
album; the homepage uses `title` unchanged.

## Footer

Optional minimal footer with social links, in `settings.yaml`:

```yaml
footer:
  name: John Doe
  instagram: johndoe
  email: hello@example.com
  website: https://example.com
```

A `legal:` block with `enabled: true` adds an Impressum page at `/impressum` and
links it in the footer — see `content/settings.yaml.example` for every field.

Email, phone and `contactUrl` render as links. `contactUrl` is a second contact
channel such as a contact form, which case law accepts in place of a phone
number; it takes http(s) URLs only and is dropped with a warning otherwise.
`heading` replaces the "Angaben gemäß § 5 DDG" line, e.g. for § 5 ECG in Austria.

A privacy policy is written in the admin panel and stored in
`content/privacy.md`; `/privacy` shows it and the footer links it once the file
has text. `privacy: { enabled: false }` hides it without deleting the file. See
[Privacy Policy](admin-panel.md#privacy-policy).

A `contact:` block with `enabled: true` adds a contact form at `/contact` and
links it in the footer. Messages stay on the server (`content/messages/`) and
are read in the admin panel; see [Messages](admin-panel.md#messages). While the
Impressum has no `contactUrl`, it links this form as the second contact channel.

```yaml
contact:
  enabled: true
  notifyUrl: https://ntfy.sh/your-secret-topic # optional push for new messages
  retentionDays: 90 # delete messages after this many days
```

## About Page

Create `content/about.md` with YAML frontmatter:

```markdown
---
portrait: asset-uuid-for-your-portrait
name: Your Name
location: City, Country
gear:
  - Camera Body
  - Favorite Lens
---

Your bio text here. Supports full Markdown.
```

The page is served at `/about` and linked in the navigation. Turn it off in
`settings.yaml` without deleting the file:

```yaml
about:
  enabled: false
```

The admin panel's **Settings → About** section edits the same file — portrait,
name, location, gear list and bio — so `about.md` does not have to be written by
hand.

---

See also: [Gallery structure](gallery-config.md), [Gallery features](gallery-features.md), [System & security](security.md), [Journal & photo essays](journal.md).
