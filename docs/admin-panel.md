# Admin Panel

Immich Folio includes a built-in visual admin panel at `/admin` that lets you manage your gallery structure and site settings without editing YAML files by hand.

**Contents:**

- [Enabling the Admin Panel](#enabling-the-admin-panel)
- [Page Builder](#page-builder)
- [Settings Editor](#settings-editor)
- [Album Picker](#album-picker)
- [Security](#security)
- [Backups](#backups)
- [Docker Usage](#docker-usage)

## Enabling the Admin Panel

Set `ADMIN_PASSWORD` in your `.env.local` (or Docker environment):

```env
ADMIN_PASSWORD=your-secure-admin-password
```

Then navigate to `http://your-site/admin`. The panel is completely disabled if no password is set — it won't even render the login page.

> [!IMPORTANT]
> The admin password is separate from any album or subpage passwords. It controls access to the entire gallery configuration.

## Page Builder

The **Pages** tab provides a visual tree view of your gallery structure:

### Hero Images

Add Immich asset UUIDs for the homepage hero carousel. Supports single or multiple images that crossfade automatically.

### Standalone Albums

Albums displayed directly on the homepage. Click **+ Add Album** to open the Album Picker and select from your Immich library.

Each album card supports:
- **Title override** — display a custom name instead of the Immich album name
- **Description** — shown below the album title on the subpage
- **Password** — protect individual albums with a password

### Subpages

Group albums under custom URL paths (e.g., `/japan`, `/wedding-smith`).

Each subpage has:
- **Name** — used for navigation and URL generation (auto-slugified)
- **Title** — optional display title (defaults to name)
- **Subtitle** — optional text shown below the page heading
- **Password** — optional protection for the entire subpage

### Sections

Within a subpage, you can organize albums into named sections. This generates a table of contents with anchor links. Add sections with **+ Add Section** and fill each with albums from the picker.

### Reordering

Use the **↑/↓** buttons on subpages to change their display order. The order in the admin panel matches the order on your site.

## Settings Editor

The **Settings** tab lets you configure global site behavior:

| Section   | Controls                                                         |
| --------- | ---------------------------------------------------------------- |
| General   | Site title, subtitle, language, EXIF on hover, map, transitions  |
| Theme     | Preset, accent color, photo frame, hero style, grain, header dot |
| Grid      | Layout mode, columns, gap, aspect ratio                          |
| Footer    | Name, Instagram, email, website                                  |
| Legal     | Impressum toggle and all legal fields                            |
| SEO       | Meta title, description, noindex, nofollow                       |

Changes are applied immediately after saving — no server restart required.

## Album Picker

When adding albums, a modal overlay shows **all shared albums** from your Immich instance (not just the ones already configured). Features:

- **Search** by album name or UUID
- **Photo count** shown for each album
- **"In use" badge** for albums already assigned somewhere
- Albums are sorted: configured first, then alphabetically

## Security

| Aspect         | Implementation                                              |
| -------------- | ----------------------------------------------------------- |
| Authentication | HMAC-signed session token in an `HttpOnly` cookie           |
| Session expiry | 24 hours (automatic logout)                                 |
| Password check | Constant-time comparison to prevent timing attacks          |
| Cookie flags   | `HttpOnly`, `Secure` (in production), `SameSite=Strict`    |
| Rate limiting  | Admin endpoints share the global rate limiter               |
| Robots         | `/admin` is marked `noindex, nofollow` in metadata          |

> [!NOTE]
> The admin panel uses its own session management, completely separate from album password protection. Admin sessions use `AUTH_SECRET` for token signing.

## Backups

Every time you save changes, the previous YAML file is automatically backed up to `content/.backups/`:

```
content/.backups/
├── gallery.yaml.2026-05-29T14-30-00-000Z.bak
├── gallery.yaml.2026-05-29T15-45-00-000Z.bak
├── settings.yaml.2026-05-29T14-30-00-000Z.bak
└── ...
```

- Up to **10 backups** per file are retained (oldest are pruned)
- Before a restore, a `*.pre-restore.bak` snapshot is created
- All writes are **atomic** (write to temp file, then rename) — no risk of corrupted YAML

## Docker Usage

The admin panel works seamlessly with Docker deployments since the `content/` directory is typically a volume mount:

```yaml
services:
  lightbox:
    image: immich-folio
    environment:
      - ADMIN_PASSWORD=your-secure-password
    volumes:
      - ./content:/app/content  # Must be writable for admin panel
```

> [!IMPORTANT]
> When using the admin panel, the content volume must be **read-write** (not `:ro`). Remove the `:ro` flag if you had it set previously.

### Reload Button

The admin header includes a **↻ Reload** button that:
1. Invalidates the in-memory config cache
2. Clears the Immich album/asset cache
3. Forces the next request to re-read all YAML files

This is useful after making external changes to config files or when Immich data has changed.
