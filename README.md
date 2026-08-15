# Immich Folio

A self-hosted photography portfolio powered by [Immich](https://immich.app). Turns your Immich albums into a beautiful, public-facing gallery — without ever exposing your Immich server to the internet.

Immich Folio acts as a **secure reverse proxy** between your visitors and your private Immich instance. Your Immich server stays on your local network, completely invisible to the outside world.

<p align="center">
  <img src="docs/screenshots/theme-studio-modern-home.png" width="98%" alt="Homepage — Studio Modern theme" />
</p>
<p align="center">
  <img src="docs/screenshots/theme-studio-modern-grid.png" width="49%" alt="Album photo grid" />
  <img src="docs/screenshots/page-collection.png" width="49%" alt="Collection overview grouping several albums" />
</p>
<p align="center">
  <img src="docs/screenshots/lightbox-exif.png" width="98%" alt="Fullscreen lightbox with the EXIF panel open" />
</p>

## What's New

### Unreleased

Since v0.10.0 — a first-run wizard, a journal, and a set of experimental
portfolio features.

- **First-run setup wizard at `/install`** — configure a fresh deployment from the browser instead of writing config files: connect to Immich, pick albums, name the site. Credentials are verified before anything is written → [First-Run Setup](#first-run-setup)
- **Journal** — a section for photo essays and travel stories at `/journal`, with a split-screen block editor in the admin panel, drafts, per-entry passwords, cover images and reading times → [Journal guide](docs/journal.md)
- **About page editor** — portrait, name, location, gear and bio edited in the admin panel, plus a toggle to take the page offline
- **Custom favicon upload** — SVG, PNG, ICO or JPEG, stored in the content volume
- **Experimental portfolio features** — justified grid layout, `cover` hero splash screen, unlisted subpages, per-album grid overrides, cover focal points, and external navigation links
- **Admin panel** — every area has its own URL, a floating save bar, and a manual photo-order editor with drag & drop

**Upgrading:** no migration, no configuration change.

### v0.10.0

Two new ways to present work, a seventh theme preset, and an admin panel rebuilt around visual controls.

- **New theme preset: Studio Modern** — the Leica language of `studio` rebuilt around the Archivo grotesque, with IBM Plex Mono for all photographic metadata, an indexed hero navigation with album counts, caption bars under album covers, and a film-edge EXIF strip in the lightbox → [Theming guide](docs/theming.md)

<p align="center">
  <img src="docs/screenshots/theme-studio-modern-home-light.png" width="49%" alt="Studio Modern in light mode" />
  <img src="docs/screenshots/theme-studio-modern-grid-light.png" width="49%" alt="Studio Modern album grid in light mode" />
</p>
<p align="center"><em>Studio Modern in light mode — every preset ships a light and a dark variant.</em></p>

- **Photo Essay mode** — storytelling pages that alternate text with fullbleed and paired image layouts, written in Markdown or assembled in the new visual block editor
- **Client proofing** — let clients pick favorites and export the selection; the picks live in the URL as a compact bitmask, so nothing is stored server-side and a selection can be shared as a link
- **Lightbox watermark** — configurable overlay on fullscreen images
- **Privacy-friendly analytics** — page and album view counts without cookies or third parties, switchable off entirely
- **Subpage on/off toggle** — take a page offline without deleting it
- **Admin panel overhaul** — slide-over page-builder drawer with search, visual preview cards for grid, theme, photo frame and hero style, a Google SEO snippet preview, light/dark toggle, subpage live preview, and a backup manager with one-click restore

<p align="center">
  <img src="docs/screenshots/admin-page-builder.png" width="49%" alt="Visual page builder" />
  <img src="docs/screenshots/admin-settings.png" width="49%" alt="Settings editor with visual preview cards" />
</p>

- **SEO** — configurable subpage title template and metadata descriptions, plus proper metadata on the about page
- **Resilience** — the gallery keeps serving the last known albums during an Immich outage instead of erroring, with loading skeletons while the round-trip is in flight
- **Fixed:** the map page ignored the configured theme fonts and borders (all presets), album order now mirrors the Immich timeline across time zones, the admin status panel no longer reports faults that are not faults, and the Docker health check no longer fails on IPv6-first `localhost` resolution

**Upgrading to v0.10.0:** no migration, no configuration change — pull the new image and restart. One exception: if you copied `docker-compose.override.yml.example` in the past, its health check needs a one-line edit. See the [upgrade notes](CHANGELOG.md#upgrade-notes) for that and for the rollback caveat when switching presets.

### Security releases

Security fixes ship in normal releases, so **running the latest release is the recommended baseline**:

- **v0.10.0** — `GET /api/admin/analytics` now requires an admin session; Docker images are scanned with Trivy on every publish
- **v0.9.2** — closed a timing side channel that leaked the admin password length ([#395](https://github.com/ralksta/immich-folio/pull/395))
- **v0.9.0** — fixed pre-auth bypasses and restored Immich 3.x compatibility ([#378](https://github.com/ralksta/immich-folio/pull/378))

Full history in the [GitHub releases](https://github.com/ralksta/immich-folio/releases) and [CHANGELOG.md](CHANGELOG.md).

## Features

### Gallery & Layout

- **Configurable hero layouts** — split, fullbleed, minimal, stacked (image + thumbnail strip), typographic (text-only), or mosaic (multi-image grid)
- **Hero image carousel** — single image or crossfade carousel of multiple Immich assets
- **Masonry photo grid** — responsive layout with natural aspect ratios and configurable columns, gap, and aspect ratio
- **Uniform grid mode** — switch to a fixed-aspect uniform grid per-subpage or globally
- **Showcase / filmstrip / editorial-flow layouts** — featured hero + grid, horizontal scroll strips, or alternating full-width and paired images
- **Justified rows** _(experimental)_ — every row fills the width at one shared height, aspect ratios intact, nothing cropped
- **Per-subpage grid overrides** — each subpage can define its own columns, gap, aspect ratio, and layout mode, and individual albums can override that again _(experimental)_
- **Cover focal points** _(experimental)_ — decide which part of a cover survives the crop
- **Fullscreen lightbox** — keyboard and swipe navigation, EXIF panel, adjacent image preloading
- **EXIF metadata on hover** — camera body, lens, focal length, aperture, shutter speed, ISO shown directly on the grid
- **ThumbHash placeholders** — instant blurred previews while full images load

### Content & Organization

- **Subpage grouping** — organize albums into named collections (e.g. `/japan/tokyo-2023`)
- **Auto-generated slugs** — URL slugs derived from album names automatically
- **YAML gallery config** — all gallery structure defined in a single `content/gallery.yaml` file
- **Markdown about page** — `content/about.md` with frontmatter for portrait, name, location, and gear list, editable from the admin panel
- **Journal** — photo essays and travel stories at `/journal`, with drafts, per-entry passwords, cover images and reading times
- **Photo Essay mode** — long-form storytelling pages alternating text with fullbleed and paired image layouts
- **Unlisted subpages** _(experimental)_ — reachable by direct link, absent from the navigation
- **Subpage on/off toggle** — take a page offline without deleting it
- **External navigation links** _(experimental)_ — point the header at a shop, a blog, or a social profile
- **Client proofing** — clients favorite photos and export the selection; picks are encoded in the URL, nothing is stored server-side
- **Lightbox watermark** — configurable overlay on fullscreen images
- **Privacy-friendly analytics** — cookieless view counts, no third parties, can be switched off
- **Dynamic OG images** — auto-generated social preview images per album

<p align="center">
  <img src="docs/screenshots/page-about.png" width="49%" alt="About page rendered from content/about.md" />
  <img src="docs/screenshots/page-map.png" width="49%" alt="Map page clustering photo locations worldwide" />
</p>
<p align="center"><em>The Markdown about page and the GPS map, both generated from your Immich data.</em></p>

### Admin Panel

- **Visual page builder** — drag & drop interface to manage hero images, standalone albums, subpages, and sections
- **Album picker** — browse all shared Immich albums with search, see photo counts, and add them with one click
- **Settings editor** — configure theme, grid layout, footer, legal/impressum, SEO, image protection and the about page from a visual UI
- **Visual previews everywhere** — grid layout, theme, photo frame, hero style and the Google search snippet are picked from preview cards instead of text fields
- **Journal Studio** — split-screen block editor with a live preview of the real page
- **Essay block editor** — assemble photo essays block by block without touching Markdown
- **Photo order editor** — drag & drop a hand-picked opening sequence for any album
- **Favicon upload** — give the site its own icon in the browser tab
- **Backup manager** — every save is backed up automatically; restore any of them with one click
- **Live YAML sync** — changes are written directly to `gallery.yaml` and `settings.yaml` with automatic backups
- **Password protected** — secured with its own admin password, separate from album passwords

<details>
<summary><strong>Security &amp; Infrastructure</strong></summary>

<br>

| Concern                    | Protection                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------ |
| **Server exposure**        | Immich URL never leaves your network — all requests proxy server-side                |
| **API key**                | Stored only in `.env.local`, never in client code                                    |
| **Asset IDs**              | Immich UUIDs encrypted (AES-256) into opaque tokens                                  |
| **Album scope**            | Only albums in `gallery.yaml` are accessible                                         |
| **Password protection**    | Per-subpage password support                                                         |
| **Rate limiting**          | Per-IP sliding-window rate limiter (configurable RPM)                                |
| **Vulnerability scanning** | Docker image scanned with Trivy on every release, results in the GitHub Security tab |

- Health check endpoint at `GET /api/health`
- In-memory caching with configurable TTL
- Standalone Docker image — multi-stage, non-root, ~150 MB
- Dependencies kept current via Dependabot (npm + GitHub Actions, weekly)

</details>

## Requirements

- **Immich 3.0 or newer.** Immich 3.0 changed how album assets are retrieved; earlier versions are not supported as of v0.9.0. On an older server, albums render with the correct title but no photos, and the map stays empty — the app logs a warning naming this as the likely cause.
- Node.js 20+ (or just use the Docker image)

## Quick Start

```bash
git clone https://github.com/ralksta/immich-folio.git
cd immich-folio
npm install
npm run dev
```

Then open `http://localhost:3000/install` and let the setup wizard connect you to
Immich — see [First-Run Setup](#first-run-setup) below. It needs a token from the
server log, which is printed on first access.

<details>
<summary><strong>Prefer to configure by hand?</strong></summary>

The wizard writes the same files you would write yourself, so the manual route
remains fully supported:

```bash
cp .env.local.example .env.local
# Edit .env.local with your Immich server URL and API key

cp content/gallery.yaml.example content/gallery.yaml
# Edit gallery.yaml with your album UUIDs

npm run dev
```

</details>

## First-Run Setup

A deployment with no `gallery.yaml` and no Immich credentials serves a setup
screen. The wizard at **`/install`** fills both in from the browser: it connects
to Immich, lets you pick albums (optional — you can add them later in `/admin`),
and names the site. Nothing is written until your credentials have been verified
against your Immich server, so a typo cannot leave you with an "installed" site
that loads no photos.

**The wizard is gated by a one-time token** printed to the server log on first
access, because a fresh deployment is reachable before it has any configuration —
and without the gate, whoever finds the URL first could configure it:

```
══════════════════════════════════════════════════════
  Immich Folio — First-run setup token
══════════════════════════════════════════════════════
  Token:  PTmUKFIdce2DwuqBG71RAExH7tVxceXX
```

Read it from your container logs (`docker compose logs immich-folio`) and append
it to the URL:

```
http://your-site/install?token=PTmUKFIdce2DwuqBG71RAExH7tVxceXX
```

The token is stored in `content/.setup-token` (mode `0600`) so it survives a
restart, and is deleted once setup completes. From then on `/install` redirects
to the gallery and its API routes refuse to run again.

### What the wizard writes

| File                    | Contents                                                             |
| ----------------------- | -------------------------------------------------------------------- |
| `content/gallery.yaml`  | The albums you picked                                                |
| `content/settings.yaml` | Site title, subtitle, theme — only if it does not exist yet          |
| `content/install.json`  | Immich URL and API key, a generated site secret, admin password hash |

> **`content/install.json` holds credentials.** It is written with mode `0600`,
> and it is the reason a backup of your `content/` directory is now a backup of
> your Immich API key as well — treat it accordingly. The admin password is
> stored as an scrypt hash, not as you typed it; the API key and site secret have
> to stay readable to be usable.

**Environment variables always win.** `IMMICH_API_URL`, `IMMICH_API_KEY`,
`AUTH_SECRET` and `ADMIN_PASSWORD` override anything in `install.json`, so you
can rotate any of them by setting the variable — no need to touch the file. Set
all of them up front and the wizard never appears, which is the usual choice for
an infrastructure-as-code deployment.

## Configuration

### Environment Variables (`.env.local`)

```env
# Required
IMMICH_API_URL=http://your-immich-server:2283
IMMICH_API_KEY=your-api-key

# Optional
SITE_TITLE=My Photography            # default: "Gallery"
SITE_SUBTITLE=A visual journal        # default: empty
CACHE_TTL=300                          # seconds, default: 300
STALE_MAX_AGE=86400                    # seconds an expired cache entry survives during an outage, default: 86400 (24h), 0 disables
IMMICH_TIMEOUT_MS=15000                # Immich response wait, default: 15000
IMAGE_CACHE_VERSION=1                  # bump to bust browser image caches, default: off
RATE_LIMIT_RPM=1500                    # requests/min/IP for images, default: 1500
AUTH_SECRET=long-random-string        # required in production
TRUSTED_PROXY_HOPS=1                   # reverse proxies in front, default: 0
ADMIN_PASSWORD=your-secure-password   # enables /admin panel
WEBHOOK_SECRET=long-random-string     # enables POST /api/webhook cache invalidation
```

> Login and setup endpoints have their own, much lower limits that `RATE_LIMIT_RPM` does not raise — see [Rate Limiting](docs/gallery-config.md#rate-limiting).

> Behind a reverse proxy, set `TRUSTED_PROXY_HOPS` to the number of proxies in front of the app (nginx/Traefik/Caddy = 1; Cloudflare in front of nginx = 2). Without it the client IP is read from a header the client itself can set, which defeats the brute-force limits on the password endpoints. See [Trusted Proxies](docs/gallery-config.md#trusted-proxies).

### Immich API Key Permissions

Create a dedicated API key in Immich under **Account Settings → API Keys**. Immich Folio only needs **read access** — it never modifies your library.

| Permission   | Required | Used for                                                             |
| ------------ | -------- | -------------------------------------------------------------------- |
| `album.read` | ✅ Yes   | List and fetch album metadata & photo lists                          |
| `asset.read` | ✅ Yes   | Fetch asset metadata, EXIF data, thumbnails, previews, and originals |
| `asset.view` | ✅ Yes   | Stream image/video files (thumbnail, preview, video playback)        |

> **No write permissions needed.** `album.create`, `asset.upload`, `asset.delete`, etc. can all be left **off**.

> **Tip (Admin Panel):** The Admin Panel also uses `POST /search/metadata` to browse your full library for the hero image picker. This is covered by `asset.read` — no additional permission required.

### Gallery Config

All gallery structure — hero images, albums, subpages, grid layout, footer — is defined in `content/gallery.yaml`.

→ **[Gallery Configuration Guide](docs/gallery-config.md)**

### Journal & Photo Essays

Long-form storytelling with fullbleed photos, side-by-side pairs, quotes and captions — as a standalone `/journal` section, or as a single essay on one subpage.

→ **[Journal & Photo Essays Guide](docs/journal.md)**

### Theming

Seven built-in presets with distinct visual identities — or mix and match with fine-grained control over colors, fonts, corners, photo frames, hero layout, and grid style.

```yaml
theme: studio # or: studio-modern, minimal, editorial, classic, noir, monograph
```

→ **[View all Themes & Configuration Guide](docs/theming.md)**

## Docker

### Docker Compose (recommended)

```yaml
services:
  lightbox:
    build: .
    container_name: immich-folio
    restart: unless-stopped
    ports:
      - '7211:7211'
    env_file:
      - .env.local
    volumes:
      - ./content:/app/content
```

Run with:

```bash
docker compose up -d
```

The gallery will be available at `http://localhost:7211`.

<details>
<summary><strong>Advanced Docker (Standalone, Health Check, Proxy)</strong></summary>

### Standalone Docker

```bash
# Build
docker build -t immich-folio .

# Run
docker run -d \
  --name immich-folio \
  --restart unless-stopped \
  -p 7211:7211 \
  --env-file .env.local \
  -v ./content:/app/content \
  immich-folio
```

> **Note:** The `content/` volume mount lets you update `gallery.yaml` and
> `about.md` without rebuilding the image. It must be **read-write**: the setup
> wizard, the admin panel and the backup rotation all write into it. A `:ro`
> mount leaves the wizard unable to complete and the admin panel unable to save.

### Health Check

The container includes a built-in health check at `/api/health`:

```bash
curl http://localhost:7211/api/health
```

### Behaviour when Immich is unreachable

Immich Folio buffers your gallery rather than merely proxying it:

- Album and asset pages keep serving the last known good data for up to `STALE_MAX_AGE`, so a restarting or briefly unreachable Immich does not take the public site down with it.
- Once nothing cached is left, they return `503`, never `404` — a `404` would tell search engines to drop a URL for content that still exists.
- Outages are never cached, so the gallery recovers as soon as Immich does.

The cache lives in the process, so it is empty right after a container restart.

### Reverse Proxy

Put Immich Folio behind nginx / Caddy / Traefik with TLS. Example Caddy config:

```
photos.example.com {
    reverse_proxy localhost:7211
}
```

</details>

## Admin Panel

A built-in visual editor at `/admin` lets you manage your gallery without editing YAML files manually.

**Enable it** by setting `ADMIN_PASSWORD` in your environment:

```env
ADMIN_PASSWORD=your-secure-admin-password
```

Or set the password in the [setup wizard](#first-run-setup), which stores it as
an scrypt hash rather than in your environment. An `ADMIN_PASSWORD` variable
takes precedence over the stored one if both are present.

Then navigate to `http://your-site/admin` and log in. The panel is protected by its
own password, separate from any album passwords, and writes straight to
`gallery.yaml` / `settings.yaml` with automatic backups.

<p align="center">
  <img src="docs/screenshots/admin-login.png" width="49%" alt="Admin panel login screen" />
  <img src="docs/screenshots/admin-page-builder.png" width="49%" alt="Visual page builder with hero images, standalone albums and subpages" />
</p>
<p align="center">
  <img src="docs/screenshots/admin-album-picker.png" width="49%" alt="Album picker listing shared Immich albums with photo counts" />
  <img src="docs/screenshots/admin-settings.png" width="49%" alt="Settings editor with site identity and feature toggles" />
</p>
<p align="center"><em>Login · page builder · album picker · settings editor</em></p>

→ **[Admin Panel Guide](docs/admin-panel.md)**

## Tech Stack

- **Next.js 16** (App Router, standalone output)
- **React 19**
- **TypeScript**
- **Vanilla CSS** (no framework)

## Contributors

Immich Folio is maintained by [@ralksta](https://github.com/ralksta) and made
better by the people below. Thank you — every one of these made the project
easier to live with.

- **[@lancetm714](https://github.com/lancetm714)** — built the setup wizard that
  turns a fresh install into a few clicks in the browser instead of hand-written
  config files. Also added custom favicons, so your portfolio gets its own icon
  in the browser tab, and made a gallery with no albums yet a perfectly valid
  starting point rather than an error.
- **[Jules](https://jules.google.com)** — an automated reviewer that has been
  quietly hardening the project in the background: better screen-reader support
  in the photo grid, and a series of fixes keeping the public endpoints from
  being overwhelmed by traffic.
- **[Dependabot](https://github.com/dependabot)** — keeps every dependency
  current, which is most of the reason security fixes land here quickly.

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) to get
started. Pull requests target the `dev` branch.

## License

MIT License — free to use and modify for the Immich community.
