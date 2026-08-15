# Admin Panel

Immich Folio includes a built-in visual admin panel at `/admin` that lets you manage your gallery structure, journal entries and site settings without editing YAML files by hand.

**Contents:**

- [Enabling the Admin Panel](#enabling-the-admin-panel)
- [Layout](#layout)
- [Pages](#pages)
- [Journal](#journal)
- [Settings](#settings)
- [Analytics](#analytics)
- [Album & Asset Pickers](#album--asset-pickers)
- [Security](#security)
- [Backups](#backups)
- [Docker Usage](#docker-usage)

## Enabling the Admin Panel

Set `ADMIN_PASSWORD` in your `.env.local` (or Docker environment):

```env
ADMIN_PASSWORD=your-secure-admin-password
```

Then navigate to `http://your-site/admin`. The panel is completely disabled if no password is set — it won't even render the login page.

The [setup wizard](../README.md#first-run-setup) can set the password instead, storing it as an scrypt hash in `content/install.json`. An `ADMIN_PASSWORD` environment variable takes precedence if both are present.

> [!IMPORTANT]
> The admin password is separate from any album or subpage passwords. It controls access to the entire gallery configuration.

## Layout

Each area has its own URL, so a section can be bookmarked and the browser's back button works as expected:

| Tab           | URL                | Writes to                                   |
| ------------- | ------------------ | ------------------------------------------- |
| **Pages**     | `/admin/pages`     | `content/gallery.yaml`                      |
| **Journal**   | `/admin/journal`   | `content/journal/<slug>.md`                 |
| **Settings**  | `/admin/settings`  | `content/settings.yaml`, `content/about.md` |
| **Analytics** | `/admin/analytics` | nothing — read-only                         |

Unsaved changes raise a save bar pinned to the bottom of the viewport, so the Save button is reachable without scrolling back up. Saving applies immediately — no server restart.

## Pages

A visual tree of your gallery structure. Each item opens a slide-over drawer with its settings.

### Hero Images

Immich asset UUIDs for the homepage hero. One image, or several that crossfade as a carousel. Pick them from your library with the [asset picker](#album--asset-pickers) instead of typing UUIDs.

### Standalone Albums

Albums displayed directly on the homepage. **+ Add Album** opens the [Album Picker](#album--asset-pickers).

Each album supports:

- **Title override** — a display name instead of the Immich album name
- **Description** — shown below the album title
- **Password** — protect a single album (written as an scrypt hash)
- **Cover image** — override the album cover with any asset
- **Photo order** — Immich order, newest, oldest, filename, or **Manual** with a drag & drop editor
- **Grid override** _(experimental)_ — a different grid layout for this album alone (the panel exposes the layout; columns, gap and aspect ratio can be set in `gallery.yaml`)
- **Cover focal point** _(experimental)_ — which part of the cover survives the crop

### Subpages

Group albums under custom URL paths (e.g. `/japan`, `/wedding-smith`).

- **Name** — navigation label; the URL slug is derived from it
- **Title / Subtitle** — page heading and subline
- **Password** — protect the whole subpage
- **Grid override** — layout settings for the photos on this page
- **Album Cover Grid** — how the album covers are tiled: columns (empty = the site-wide grid setting) and gap in px (empty = the theme's own cover spacing). Hidden in essay mode
- **Enabled** — take the page offline without deleting it
- **Hidden** _(experimental)_ — unlisted: reachable by direct link, absent from the navigation
- **Essay** — turn the page into a photo essay, with a block editor for the text

A live preview shows the page as visitors will see it.

### Sections

Within a subpage, albums can be grouped into named sections, which renders a table of contents with anchor links.

### Reordering

Subpages, albums and sections are reordered in place; the order in the panel is the order on the site.

## Journal

The **Journal Studio** — a split-screen editor with the blocks on the left and a live preview of the real page on the right, separated by a divider you can drag with mouse, keyboard or touch.

Blocks are added from a menu (heading, text, quote, photo, photo pair), reordered, and deleted; each carries a type chip so long entries stay scannable. Photos are inserted through the asset picker, which fills in the Immich asset UUID for you. The frontmatter — cover image, title, subtitle, author, date, draft flag, password — is edited as form fields.

Saving writes plain Markdown to `content/journal/<slug>.md`, which can equally be edited by hand.

→ **[Journal & Photo Essays](journal.md)** for the file format.

## Settings

Eight sections, each at its own URL (`/admin/settings/theme`, …):

| Section                   | Controls                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **General**               | Site title, subtitle, language, favicon upload, and the feature toggles (EXIF on hover, map, transitions, scroll-to-top, analytics) |
| **Theme**                 | Preset, colour mode, accent, photo frame, hero style, grain, header dot                                                             |
| **Grid**                  | Layout algorithm, columns, gap, aspect ratio                                                                                        |
| **Footer**                | Name, Instagram, email, website, and the header navigation links                                                                    |
| **Legal**                 | Impressum toggle and all legal fields                                                                                               |
| **SEO**                   | Meta title, subpage title template, description, noindex, nofollow                                                                  |
| **Security & Protection** | Right-click and image-drag deterrents, lightbox watermark (text, position, opacity)                                                 |
| **About**                 | Portrait asset, name, location, gear list, and the biography — written to `content/about.md`                                        |

Theme presets, grid layouts, photo frames, hero styles and the Google search snippet are picked from **preview cards** rather than text fields, so the effect of a choice is visible before saving. A light/dark toggle previews both variants of a preset.

### Favicon

**General → Favicon** accepts an SVG, PNG, ICO or JPEG. It is stored in the writable `content/` volume and served through `/api/favicon` under a policy that stops an uploaded SVG from executing script. **Reset** restores the bundled default.

## Analytics

View counts per page and album, read from `content/analytics.json`. No cookies, no third party, nothing leaving your server. Switch the collection off entirely in **Settings → General**; the tracking endpoint then refuses to record.

## Album & Asset Pickers

**Album Picker** — a modal listing **all shared albums** from your Immich instance, not just the configured ones:

- **Search** by album name or UUID
- **Photo count** per album
- **"In use" badge** for albums already assigned somewhere
- Sorted configured-first, then alphabetically

**Asset Picker** — browses your full Immich library for hero images, album covers, journal photos and the about-page portrait. It uses `POST /search/metadata`, which is covered by the `asset.read` permission your API key already needs.

## Security

| Aspect         | Implementation                                                        |
| -------------- | --------------------------------------------------------------------- |
| Authentication | HMAC-signed session token in an `HttpOnly` cookie                     |
| Signing key    | Derived from `AUTH_SECRET` with scrypt                                |
| Session expiry | 24 hours (automatic logout)                                           |
| Password check | Constant-time comparison to prevent timing attacks                    |
| Cookie flags   | `HttpOnly`, `Secure` (in production), `SameSite=Strict`               |
| Rate limiting  | `POST /api/admin/auth` is capped at 5 attempts per minute per IP      |
| Authorization  | Every `/api/admin/*` route re-checks the session, including analytics |
| Robots         | `/admin` is marked `noindex, nofollow` in metadata                    |

> [!NOTE]
> The admin panel uses its own session management, completely separate from album password protection. Rotating `AUTH_SECRET` invalidates every admin session along with every unlocked gallery.

## Backups

Every time you save, the previous file is backed up automatically:

```
content/.backups/
├── gallery.yaml.2026-05-29T14-30-00-000Z.bak
├── settings.yaml.2026-05-29T14-30-00-000Z.bak
└── ...
content/journal/.backups/
└── my-story.md.2026-05-29T14-30-00-000Z.bak
```

- Up to **10 backups** per file are retained (oldest are pruned)
- The **Backup Manager** lists them and restores any one with a single click
- Before a restore, a `*.pre-restore.bak` snapshot is created
- All writes are **atomic** (write to temp file, then rename) — no risk of a half-written YAML

## Docker Usage

The admin panel works seamlessly with Docker deployments since the `content/` directory is typically a volume mount:

```yaml
services:
  lightbox:
    image: immich-folio
    environment:
      - ADMIN_PASSWORD=your-secure-password
    volumes:
      - ./content:/app/content # Must be writable for admin panel
```

> [!IMPORTANT]
> The content volume must be **read-write** (not `:ro`). The admin panel, the journal, the favicon upload, the setup wizard and the backup rotation all write into it.

### Reload Button

The admin header includes a **↻ Reload** button that:

1. Invalidates the in-memory config cache
2. Clears the Immich album/asset cache
3. Forces the next request to re-read all YAML files

This is useful after making external changes to config files or when Immich data has changed.

### Diagnostics

The panel reports the health of the installation: whether Immich answers, whether `gallery.yaml` and `settings.yaml` parse, the number of cached entries, and the backup count with the timestamp of the most recent one. `settings.yaml` is optional, so its absence is not a fault — only a file that exists and cannot be parsed counts as invalid. A check that could not run (an expired session, for example) is reported as such rather than as an outage.

Separately, while you are logged in, the public site shows a diagnostic banner on any album Immich returns empty — the case that otherwise looks like a broken page to you and to nobody else.
