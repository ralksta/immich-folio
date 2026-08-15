# Gallery Configuration

Configuration is split across two files in `content/`:

| File            | Contains                                                                     |
| --------------- | ---------------------------------------------------------------------------- |
| `gallery.yaml`  | **Structure** — hero assets, albums, subpages, sections, per-album settings  |
| `settings.yaml` | **Behaviour and identity** — title, theme, grid defaults, footer, legal, SEO |

Copy the examples to get started:

```bash
cp content/gallery.yaml.example content/gallery.yaml
cp content/settings.yaml.example content/settings.yaml
```

`settings.yaml` is optional — without it, everything falls back to defaults.

> [!TIP]
> Prefer a visual interface? Enable the **[Admin Panel](admin-panel.md)** by setting `ADMIN_PASSWORD` in your environment. It provides a drag-and-drop page builder that writes to these same YAML files automatically.

**Contents:**

`gallery.yaml`

- [Hero Images](#hero-images)
- [Standalone Albums](#standalone-albums)
- [Subpages & Categories](#subpages)
- [Per-Album Options](#per-album-options)
- [Photo Order Within an Album](#photo-order-within-an-album)

`settings.yaml`

- [Grid Layout](#grid-layout)
- [Site Behaviour](#site-behaviour)
- [Navigation Links](#navigation-links)
- [Client Proofing](#client-proofing)
- [Image Protection & Watermark](#image-protection--watermark)
- [SEO](#seo)
- [Footer](#footer)

Other

- [About Page](#about-page)
- [Journal & Photo Essays](journal.md)
- [Finding UUIDs](#finding-uuids)
- [System & Security](#system--security)

## Hero Images

Single image or crossfade carousel on the homepage:

```yaml
# Single hero image
hero: 00000000-0000-0000-0000-000000000000

# Carousel (crossfade between multiple images)
hero:
  - 00000000-0000-0000-0000-000000000000
  - 11111111-1111-1111-1111-111111111111
  - 22222222-2222-2222-2222-222222222222
```

## Standalone Albums

Albums shown directly on the homepage as cards.

> [!NOTE]
> The thumbnail image for each album grid card is automatically synced with the explicit **\"Cover Image\"** you select for that album inside the Immich Web UI.

```yaml
albums:
  - 11111111-1111-1111-1111-111111111111
  - 22222222-2222-2222-2222-222222222222
```

## Subpages

Group multiple albums into named collections. URLs are auto-generated from the name.
The overall **Subpage Cover Image** shown on the homepage is automatically inherited from the Cover Image of the **first album** inside its list.

```yaml
subpages:
  - name: Japan # → /japan
    title: 'Trip to Japan' # Optional: overrides the page heading
    subtitle: '2024 adventures' # Optional: adds a subline under the heading
    albums:
      - 33333333-3333-3333-3333-333333333333 # Tokyo
      - 44444444-4444-4444-4444-444444444444 # Kyoto

  - name: Wedding – Smith # → /wedding-smith
    password: clientpass123 # Optional: subpage-level protection
    albums:
      - 55555555-5555-5555-5555-555555555555
      - 66666666-6666-6666-6666-666666666666:
          title: 'Private Highlights'
          password: 'album-secret-123' # Optional: album-level protection
```

Alternatively, you can use the object notation (recommended):

```yaml
subpages:
  'Japan':
    title: 'Trip to Japan'
    subtitle: '2024 adventures'
    albums:
      - 33333333-3333-3333-3333-333333333333
```

### Subpage Options

| Key         | Type    | Description                                                                          |
| ----------- | ------- | ------------------------------------------------------------------------------------ |
| `name`      | string  | Navigation label; the URL slug is derived from it                                    |
| `title`     | string  | Page heading, defaults to `name`                                                     |
| `subtitle`  | string  | Subline under the heading                                                            |
| `password`  | string  | Gates the whole subpage — see [Password Protection](#password-protection)            |
| `albums`    | list    | Album UUIDs, optionally with [per-album options](#per-album-options)                 |
| `sections`  | list    | Named groups of albums — see [Sections](#sections)                                   |
| `grid`      | object  | Grid override for this page — see [Grid Layout](#grid-layout)                        |
| `proofing`  | boolean | Enables [client proofing](#client-proofing) on this page                             |
| `essayFile` | string  | Render a Markdown essay instead of a grid — see [Journal & Photo Essays](journal.md) |
| `essayText` | string  | Essay Markdown inline; written by the admin block editor                             |
| `enabled`   | boolean | `false` takes the page offline without deleting it                                   |
| `hidden`    | boolean | **Experimental.** Reachable by direct link, but hidden from the navigation           |

```yaml
subpages:
  - name: Client Preview
    hidden: true # unlisted: not in the nav, still reachable at /client-preview
    proofing: true # visitors can mark favourites and export the selection
    password: 'clientpass123'
    albums:
      - 55555555-5555-5555-5555-555555555555

  - name: Old Series
    enabled: false # offline, keeps its configuration
    albums:
      - 66666666-6666-6666-6666-666666666666
```

> [!NOTE]
> `hidden` is unlisting, not access control. The URL is guessable — a slug is
> derived from the name — and nothing stops a visitor who has it. Combine it
> with `password` for anything that must stay private.

### Sections

When a subpage contains many albums you can split them into **named sections**. A typographic table of contents with anchor links is automatically rendered above the albums. Sections are fully optional — omit them and you get the standard flat grid.

Each section can have:

| Field         | Type   | Required | Description                                 |
| ------------- | ------ | -------- | ------------------------------------------- |
| `title`       | string | ✅       | Section heading + anchor name               |
| `description` | string | ➖       | Optional subline under the heading          |
| `albums`      | list   | ✅       | Album UUIDs (same format as regular albums) |

Within the `albums` list you can use a plain UUID, a simple title override, or an object — see [Per-Album Options](#per-album-options).

**Full example:**

```yaml
subpages:
  - name: Japan
    title: Japan
    subtitle: 'Travel through a land full of contrasts.'
    sections:
      - title: Tokyo
        description: 'Megacity, neon lights, silence in the noise.'
        albums:
          - '33333333-3333-3333-3333-333333333333'
          - '44444444-4444-4444-4444-444444444444': Shinjuku at night

      - title: Kyoto
        description: 'Temples and bamboo forests.'
        albums:
          - '55555555-5555-5555-5555-555555555555': Fushimi Inari
          - '66666666-6666-6666-6666-666666666666'

      - title: Osaka
        albums: # description is optional
          - '77777777-7777-7777-7777-777777777777'
```

> [!NOTE]
> Each section title is automatically converted to a URL-safe anchor (`#tokyo`, `#kyoto`, …). The TOC appearance (separator character, numbering style, section rule) is fully controlled by the active theme.

## Per-Album Options

Every album entry — standalone, on a subpage, or inside a section — accepts the
same three notations:

```yaml
albums:
  - 'album-uuid' # → uses the Immich album name
  - 'album-uuid': My Title # → displays "My Title" instead
  - 'album-uuid':
      title: My Private Title
      description: 'Shot on 35mm film in Vienna, spring 2025.'
      password: 'secure-password'
      heroImage: 'asset-uuid'
      sort: filename
```

| Key             | Description                                                                   |
| --------------- | ----------------------------------------------------------------------------- |
| `title`         | Display name instead of the Immich album name                                 |
| `description`   | Shown below the album title                                                   |
| `password`      | Gates this album alone — see [Password Protection](#password-protection)      |
| `heroImage`     | Asset UUID overriding the album cover                                         |
| `sort`          | Photo order — see [Photo Order Within an Album](#photo-order-within-an-album) |
| `assetOrder`    | Pinned asset UUIDs for `sort: manual`                                         |
| `grid`          | **Experimental.** Grid override for this album only                           |
| `coverPosition` | **Experimental.** Focal point for the cover crop                              |

### Per-album grid (experimental)

An album can override the grid it is shown in. It is merged over the subpage
grid, which is merged over the global default — so an album only has to state
what differs:

```yaml
albums:
  - 'album-uuid':
      title: Panoramas
      grid:
        layout: justified
        columns: 2
```

### Cover focal point (experimental)

Album covers are cropped to the card. `coverPosition` decides which part
survives the crop — the same values CSS `object-position` takes:

```yaml
albums:
  - 'album-uuid':
      coverPosition: '50% 25%' # or: "top", "center bottom", "left"
```

Useful when the automatic centre crop cuts off a horizon or a face.

## Password Protection

A password can be set on a subpage, on a single album, and on a
[journal entry](journal.md#password-protected-entries). Unlocking sets an
`HttpOnly` cookie that is valid for 24 hours; nothing is stored server-side.

Three storage formats are accepted:

| Format             | Status                                                                |
| ------------------ | --------------------------------------------------------------------- |
| `scrypt:salt:hash` | **Recommended.** The password is not recoverable from `gallery.yaml`. |
| Plaintext          | Works, but deprecated — logs a warning naming the recommended hash.   |
| bcrypt (`$2a$…`)   | Rejected.                                                             |

To get the hash for an existing plaintext password, unlock the gallery once and
read the server log: the successful unlock prints the matching `scrypt:…` line
to paste back into `gallery.yaml`. The admin panel writes the hashed form
directly.

> [!NOTE]
> Album and subpage gates protect the **page**. Image URLs handed out while a
> gallery was unlocked keep working — see
> [Image Token Revocation](#image-token-revocation).

## Photo Order Within an Album

By default a Folio album mirrors the Immich timeline. That is usually right, but a curated series has a narrative order that has nothing to do with capture time — and changing the sort on the Immich album would change it for the archive too. The optional `sort` key decouples the two.

| Mode       | Order                                                                                   |
| ---------- | --------------------------------------------------------------------------------------- |
| `immich`   | Default. Inherits the album's own `asc`/`desc` setting in Immich.                       |
| `newest`   | Capture time, newest first, regardless of the Immich setting.                           |
| `oldest`   | Capture time, oldest first.                                                             |
| `filename` | `originalFileName` in natural order — `IMG_2` before `IMG_10`.                          |
| `manual`   | Pinned photos first, in the order you set; everything else follows in the Immich order. |

```yaml
albums:
  - 'album-uuid' # no sort key → Immich order, exactly as before
  - 'album-uuid':
      sort: filename # an entry may carry only a sort, with no title override
  - 'album-uuid':
      title: Hokkaido, in sequence
      sort: manual
      assetOrder: # pinned, in this order
        - 'asset-uuid-opening-frame'
        - 'asset-uuid-second-frame'
```

`sort` works the same on standalone, subpage and section albums.

### About `manual`

`manual` is a pinned **prefix**, not a full permutation: `assetOrder` lists only the photos you placed by hand, and everything else follows in the album's Immich order. Curating an opening sequence therefore costs a handful of UUIDs rather than one per photo in the album.

This also makes the album resilient to changes in Immich. Photos removed from the album are ignored, and photos added later appear at the end rather than being hidden — so `gallery.yaml` never has to be kept in sync by hand.

The `/admin` page builder has a drag & drop editor for this (album → **Photo order** → **Manual** → **Reorder photos**), which is considerably easier than writing asset UUIDs by hand. It only writes a cleaned-up `assetOrder` when you explicitly apply it.

> [!NOTE]
> Two consequences worth knowing. On a subpage with several albums, `sort` orders photos _within_ each album — the albums themselves stay in the order they are listed in. And lightbox permalinks (`#photo-3`) are positional, so changing an album's sort moves where a previously shared link lands.

> [!TIP]
> `immich` means "inherit the album's sort setting from Immich", which is capture-time order in one direction or the other. It is not the manual drag order from the Immich web UI — Immich does not expose that order through its API, so Folio cannot reproduce it. Use `manual` for a hand-picked sequence.

## Grid Layout

The global default lives in `settings.yaml`; subpages and individual albums can
override it in `gallery.yaml`. The three levels merge, most specific winning:

**global (`settings.yaml`) → subpage → album**

```yaml
# settings.yaml — global defaults
grid:
  columns: 3 # number of columns (default: 3)
  gap: 12 # gap in pixels (default: 12)
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

## Site Behaviour

Feature toggles in `settings.yaml`:

```yaml
title: 'My Portfolio'
subtitle: 'A visual journal'
lang: 'en'

exifOnHover: true # camera/lens/settings on photo grid hover
map: true # the interactive world map at /map
transitions: true # smooth page transitions between routes
scrollToTop: true # floating back-to-top arrow on long pages
analytics: true # cookieless view counts, see below

about:
  enabled: true # the /about page, rendered from content/about.md
```

| Key             | Default | Notes                                       |
| --------------- | ------- | ------------------------------------------- |
| `lang`          | `en`    | `<html lang>` and date formatting           |
| `exifOnHover`   | on      |                                             |
| `map`           | **off** | Opt-in: must be set to `true` explicitly    |
| `transitions`   | on      |                                             |
| `scrollToTop`   | on      |                                             |
| `analytics`     | on      |                                             |
| `about.enabled` | on      | Needs a `content/about.md` to show anything |

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

## Client Proofing

Lets a visitor mark favourites and export the selection — for handing a client a
gallery and getting their picks back. A heart button sits on every photo in the
grid; once something is picked, a bar appears with a filter and an export
dialog.

The selection is encoded into the URL as a compact bitmask and mirrored into
`localStorage`, so **nothing is stored server-side** and a set of picks can be
shared, bookmarked, or sent back as a plain link.

Configured in `settings.yaml`:

```yaml
proofing:
  enabled: true # hearts, selection bar and export modal (default: true)
  allowMailto: true # offer "send by email" alongside the copyable list (default: true)
```

A subpage overrides `enabled` in either direction — useful to keep proofing off
across a public portfolio and switch it on for a single client handover:

```yaml
# gallery.yaml
subpages:
  - name: Wedding – Smith
    password: clientpass123
    proofing: true # or `false` to disable it on this subpage only
    albums:
      - ...
```

Precedence is **subpage → global**: a subpage's own `proofing:` wins, and an
album reached without a subpage follows `proofing.enabled`.

> [!NOTE]
> Photo essays are the exception. A published story is not an album handover,
> so an essay (`layout: essay`, `essayFile`, `essayText`) shows the proofing
> controls only when its subpage sets `proofing: true` **explicitly** — the
> global default does not reach into essays. Journal entries never show them.

## Image Protection & Watermark

```yaml
protection:
  disableRightClick: true # suppress the context menu on images
  disableImageDrag: true # block drag-to-desktop

watermark:
  enabled: true
  text: '© Your Name'
  opacity: 0.5
  position: 'bottom-right' # bottom-right | bottom-left | center
```

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

## Journal & Photo Essays

Long-form storytelling with fullbleed photos, side-by-side pairs, quotes and
captions lives in `content/journal/`, served at `/journal`. A subpage can also
be turned into a single photo essay.

→ **[Journal & Photo Essays](journal.md)**

## Finding UUIDs

- **Album UUIDs**: In Immich, go to Albums → click an album → the UUID is in the URL bar
- **Asset UUIDs**: Click any photo → the UUID is in the URL bar

## System & Security

Advanced system settings are configured via environment variables in your `.env` or `.env.local` file.

### Rate Limiting

To protect against brute-force attacks and resource exhaustion, Immich Folio includes an in-memory rate limiter. Each endpoint has its own bucket, so heavy image traffic cannot exhaust the budget for the password endpoints.

- `RATE_LIMIT_RPM`: requests per minute per IP for image, video, EXIF and health requests (default: `1500`).

The endpoints where a high limit would be the wrong default are fixed and not configurable:

| Endpoint               | Limit (req/min/IP) |
| ---------------------- | ------------------ |
| `POST /api/admin/auth` | 5                  |
| `POST /api/auth`       | 10                 |
| `/api/install`         | 10                 |
| `/api/og`              | 30                 |
| `/api/install/albums`  | 30                 |
| `/api/webhook`         | 60                 |
| `/api/map`             | 120                |

> [!IMPORTANT]
> The limiter lives in the process memory of a single instance. It does not
> coordinate across replicas, and it starts empty after a restart.

### Trusted Proxies

If you run Immich Folio behind a reverse proxy (nginx, Traefik, Caddy, Cloudflare), tell it how many proxies sit in front. Without this, the rate limiter reads a client-supplied header and an attacker can pick their own bucket — defeating brute-force protection on the password endpoints.

- `TRUSTED_PROXY_HOPS`: Number of reverse proxies in front of the app (default: `0`).

```bash
# nginx / Traefik / Caddy directly in front of the app
TRUSTED_PROXY_HOPS=1

# Cloudflare in front of nginx
TRUSTED_PROXY_HOPS=2
```

The client IP is taken that many entries from the **right** of `X-Forwarded-For`. Proxies append the address they actually observed, so everything to the left is client-supplied and ignored — a visitor sending `X-Forwarded-For: 1.1.1.1` cannot influence which bucket they land in.

> ⚠️ **The app must be reachable only through the proxy.** Bind it to localhost (`127.0.0.1:3000`) or keep it on an internal Docker network. If clients can connect directly they control the entire header, and no setting can recover the real IP.

Matching nginx config:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`$proxy_add_x_forwarded_for` is the important one: it _appends_ the real peer address rather than overwriting the header.

#### Migrating from `TRUSTED_PROXIES`

`TRUSTED_PROXIES` has been removed. It matched proxy IPs against the socket peer address, which a self-hosted Next.js server never exposes — so the check never passed. Setting it silently put **every visitor into one shared rate-limit bucket**, letting a single client trip the limit for the entire site. If it is still set, the app assumes `TRUSTED_PROXY_HOPS=1` and logs a warning; replace it with an explicit value.

### Image Token Revocation

Asset tokens are deterministic — the same photo always yields the same token, which is what lets browsers cache images for a year. The image proxy validates the token but does not re-check album membership on every request.

Removing an album from `gallery.yaml` hides it from the site, but any image URL already handed out (bookmarked, embedded, cached by a browser) keeps working. To invalidate previously issued links, rotate `AUTH_SECRET` — this also signs out every password-protected gallery and admin session.
