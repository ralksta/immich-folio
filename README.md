# Immich Folio

A self-hosted photography portfolio powered by [Immich](https://immich.app). Turns your Immich albums into a beautiful, public-facing gallery — without ever exposing your Immich server to the internet.

Immich Folio acts as a **secure reverse proxy** between your visitors and your private Immich instance. Your Immich server stays on your local network, completely invisible to the outside world.

<p align="center">
  <img src="docs/screenshots/theme-editorial-home.png" width="49%" alt="Homepage — Editorial theme" />
  <img src="docs/screenshots/theme-editorial-grid.png" width="49%" alt="Photo grid — Editorial theme" />
</p>

## Features

### Gallery & Layout

- **Configurable hero layouts** — split, fullbleed, minimal, stacked (image + thumbnail strip), typographic (text-only), or mosaic (multi-image grid)
- **Hero image carousel** — single image or crossfade carousel of multiple Immich assets
- **Masonry photo grid** — responsive layout with natural aspect ratios and configurable columns, gap, and aspect ratio
- **Uniform grid mode** — switch to a fixed-aspect uniform grid per-subpage or globally
- **Showcase / filmstrip / editorial-flow layouts** — featured hero + grid, horizontal scroll strips, or alternating full-width and paired images
- **Per-subpage grid overrides** — each subpage can define its own columns, gap, aspect ratio, and layout mode
- **Fullscreen lightbox** — keyboard and swipe navigation, EXIF panel, adjacent image preloading
- **EXIF metadata on hover** — camera body, lens, focal length, aperture, shutter speed, ISO shown directly on the grid
- **ThumbHash placeholders** — instant blurred previews while full images load

### Content & Organization

- **Subpage grouping** — organize albums into named collections (e.g. `/japan/tokyo-2023`)
- **Auto-generated slugs** — URL slugs derived from album names automatically
- **YAML gallery config** — all gallery structure defined in a single `content/gallery.yaml` file
- **Markdown about page** — `content/about.md` with frontmatter for portrait, name, location, and gear list
- **Dynamic OG images** — auto-generated social preview images per album

### Admin Panel

- **Visual page builder** — drag & drop interface to manage hero images, standalone albums, subpages, and sections
- **Album picker** — browse all shared Immich albums with search, see photo counts, and add them with one click
- **Settings editor** — configure theme, grid layout, footer, legal/impressum, and SEO from a visual UI
- **Live YAML sync** — changes are written directly to `gallery.yaml` and `settings.yaml` with automatic backups
- **Password protected** — secured with its own admin password, separate from album passwords

<details>
<summary><strong>Security &amp; Infrastructure</strong></summary>

<br>

| Concern                 | Protection                                                            |
| ----------------------- | --------------------------------------------------------------------- |
| **Server exposure**     | Immich URL never leaves your network — all requests proxy server-side |
| **API key**             | Stored only in `.env.local`, never in client code                     |
| **Asset IDs**           | Immich UUIDs encrypted (AES-256) into opaque tokens                   |
| **Album scope**         | Only albums in `gallery.yaml` are accessible                          |
| **Password protection** | Per-subpage password support                                          |
| **Rate limiting**       | Per-IP sliding-window rate limiter (configurable RPM)                 |

- Health check endpoint at `GET /api/health`
- In-memory caching with configurable TTL
- Standalone Docker image — multi-stage, non-root, ~150 MB

</details>

## Requirements

- **Immich 3.0 or newer.** Immich 3.0 changed how album assets are retrieved; earlier versions are not supported as of v0.9.0. On an older server, albums render with the correct title but no photos, and the map stays empty — the app logs a warning naming this as the likely cause.
- Node.js 20+ (or just use the Docker image)

## Quick Start

```bash
# Clone and install
git clone https://github.com/ralksta/immich-folio.git
cd immich-folio
npm install

# Configure
cp .env.local.example .env.local
# Edit .env.local with your Immich server URL and API key

cp content/gallery.yaml.example content/gallery.yaml
# Edit gallery.yaml with your album UUIDs

# Run
npm run dev
```

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
IMMICH_TIMEOUT_MS=15000                # Immich response wait, default: 15000
IMAGE_CACHE_VERSION=1                  # bump to bust browser image caches, default: off
RATE_LIMIT_RPM=1500                    # requests/min/IP, default: 1500
AUTH_SECRET=long-random-string        # required in production
TRUSTED_PROXY_HOPS=1                   # reverse proxies in front, default: 0
ADMIN_PASSWORD=your-secure-password   # enables /admin panel
```

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

### Theming

Six built-in presets with distinct visual identities — or mix and match with fine-grained control over colors, fonts, corners, photo frames, hero layout, and grid style.

```yaml
theme: studio # or: minimal, editorial, classic, noir, monograph
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
      - ./content:/app/content:ro
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
  -v ./content:/app/content:ro \
  immich-folio
```

> **Note:** The `content/` volume mount lets you update `gallery.yaml` and `about.md` without rebuilding the image.

### Health Check

The container includes a built-in health check at `/api/health`:

```bash
curl http://localhost:7211/api/health
```

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

Then navigate to `http://your-site/admin` and log in.

→ **[Admin Panel Guide](docs/admin-panel.md)**

## Tech Stack

- **Next.js 16** (App Router, standalone output)
- **React 19**
- **TypeScript**
- **Vanilla CSS** (no framework)

## License

MIT License — free to use and modify for the Immich community.
