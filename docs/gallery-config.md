# Gallery Configuration

All gallery structure is defined in `content/gallery.yaml`. Copy the example to get started:

```bash
cp content/gallery.yaml.example content/gallery.yaml
```

> [!TIP]
> Prefer a visual interface? Enable the **[Admin Panel](admin-panel.md)** by setting `ADMIN_PASSWORD` in your environment. It provides a drag-and-drop page builder that writes to these same YAML files automatically.

**Contents:**

- [Hero Images](#hero-images)
- [Standalone Albums](#standalone-albums)
- [Subpages & Categories](#subpages)
- [Grid Layout](#grid-layout)
- [EXIF on Hover](#exif-on-hover)
- [Footer](#footer)
- [About Page](#about-page)
- [Finding UUIDs](#finding-uuids)

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

### Sections

When a subpage contains many albums you can split them into **named sections**. A typographic table of contents with anchor links is automatically rendered above the albums. Sections are fully optional — omit them and you get the standard flat grid.

Each section can have:

| Field         | Type   | Required | Description                                 |
| ------------- | ------ | -------- | ------------------------------------------- |
| `title`       | string | ✅       | Section heading + anchor name               |
| `description` | string | ➖       | Optional subline under the heading          |
| `albums`      | list   | ✅       | Album UUIDs (same format as regular albums) |

Within the `albums` list you can use a plain UUID, a simple title override, or an object with any of `title`, `description`, `password`, `heroImage`, `sort` and `assetOrder`:

```yaml
albums:
  - 'album-uuid' # → uses the Immich album name
  - 'album-uuid': My Title # → displays "My Title" instead
  - 'album-uuid':
      title: My Private Title
      password: 'secure-password' # → adds a password gate to this specific album
      heroImage: 'asset-uuid' # → overrides the album cover
      sort: filename # → see "Photo Order Within an Album" below
```

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

Configure the photo grid globally or per-subpage:

```yaml
# Global defaults
grid:
  columns: 3 # number of columns (default: 3)
  gap: 12 # gap in pixels (default: 12)
  aspectRatio: '1' # "1", "3/2", "auto", etc. (default: "1")
  layout: masonry # "masonry" | "uniform" | "showcase" | "filmstrip" | "editorial-flow"

subpages:
  - name: Japan
    grid: # per-subpage override
      columns: 4
      layout: uniform
      aspectRatio: '3/2'
    albums:
      - ...
```

## EXIF on Hover

Show camera/lens/settings when hovering over photos (enabled by default):

```yaml
exifOnHover: false # set to false to disable
```

## Footer

Optional minimal footer with social links:

```yaml
footer:
  name: John Doe
  instagram: johndoe
  email: hello@example.com
  website: https://example.com
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

## Finding UUIDs

- **Album UUIDs**: In Immich, go to Albums → click an album → the UUID is in the URL bar
- **Asset UUIDs**: Click any photo → the UUID is in the URL bar

## System & Security

Advanced system settings are configured via environment variables in your `.env` or `.env.local` file.

### Rate Limiting

To protect against brute-force attacks and resource exhaustion, Immich Folio includes an in-memory rate limiter.

- `RATE_LIMIT_RPM`: Maximum requests per minute per IP (default: `1500` for general API, `120` for map data).

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
