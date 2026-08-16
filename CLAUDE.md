# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Immich Folio is a self-hosted photography portfolio that acts as a secure reverse proxy between visitors and a private Immich instance. It serves albums via an image proxy so the Immich server and API key are never exposed to the public internet. Asset UUIDs are AES-256 encrypted into opaque URL tokens.

## Commands

```bash
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build (must pass before any PR)
npm run lint         # ESLint
npm run format       # Prettier (write)
npm run format:check # Prettier (check only)
npx tsc --noEmit     # TypeScript type-check (must be 0 errors before any PR)

# Unit tests (Vitest, lib/__tests__/ only)
npm run test         # Watch mode
npm run test:unit    # Single run
npm run test:coverage

# E2E tests (Playwright, requires dev server running or starts it automatically)
npm run test:e2e
```

**Formatting caution:** Running `npm run format` at the repo root applies changes to the entire codebase and pollutes diffs. Prefer formatting only modified files.

## Architecture

### Configuration loading (`lib/config/`)

Configuration is loaded once at startup (cached in a module-level singleton, re-read in dev mode per request).

- `lib/env.ts` — parses and validates all environment variables into a typed `Env` object. All env access in the codebase must go through this module.
- `lib/config/schema.ts` — TypeScript types for `AppConfig`, `GalleryYaml`, `SettingsYaml`, `SubpageConfig`, `GridConfig`, `ThemeConfig`, etc., plus the `slugify()` utility.
- `lib/config/index.ts` — `getConfig()`: reads `content/gallery.yaml` and `content/settings.yaml`, merges them into a single `AppConfig`. Also exports `buildSubpageGrid()` and re-exports from schema/theme.
- `lib/config/theme.ts` — seven built-in theme presets (`studio-modern`, `studio`, `minimal`, `editorial`, `classic`, `noir`, `monograph`) and `resolveTheme()` which merges partial overrides over a preset. `DEFAULT_PRESET` (`studio-modern`) is the single source for every "no preset configured" fallback — import it rather than writing the literal, and note the client components (`InstallWizard`, `SettingsEditor`) import it from `lib/config/theme` directly, since `lib/config/index.ts` pulls in `fs`.

`getConfig()` returns a `needsSetup: true` dummy config (instead of throwing) when `gallery.yaml` or credentials are missing — this lets the app render a `SetupScreen` instead of crashing.

### Content files (`content/`)

- `content/gallery.yaml` — gallery structure: hero asset IDs, standalone albums, subpages (with optional sections, passwords, per-subpage grid overrides). Use `gallery.yaml.example` as reference.
- `content/settings.yaml` — site-wide settings: title, subtitle, theme, grid defaults, footer, legal, map, transitions, SEO. Use `settings.yaml.example` as reference.
- `content/about.md` — Markdown with frontmatter for the about page (portrait, name, location, gear).
- `content/journal/*.md` — journal entries, one file per entry (`<slug>.md` → `/journal/<slug>`). `content/essays/` is the legacy location, still resolved.
- `content/install.json` — written by the setup wizard: Immich URL, API key, generated site secret, scrypt-hashed admin password. Mode `0600`; env vars override every field.
- `content/analytics.json` — cookieless view counters.
- `content/favicon.svg` — uploaded favicon (whatever the source format), served via `/api/favicon`.
- `content/.setup-token` — one-time `/install` gate token (mode `0600`), deleted once setup completes.
- `content/.backups/`, `content/journal/.backups/` — rotating backups (10 per file) written before every admin save.

The whole `content/` directory must be writable: the wizard, admin panel, journal, favicon upload, analytics and backup rotation all write into it.

### Immich client (`lib/immich.ts`)

Singleton `ImmichClient` class exported as `immich`. All Immich API calls are server-side only. Key design points:

- **Album allowlist** — `getAlbums()` fetches `?shared=true` albums but only returns IDs listed in `config.albums`. Requests for unlisted albums are silently rejected.
- **Request coalescing** — pending promises are stored in `Map<id, Promise>` fields to deduplicate concurrent requests for the same album/asset (important for `Promise.all` calls in grids).
- **In-memory LRU cache** (`lib/cache.ts`) — 200-entry LRU. Entries carry two deadlines: `staleAt` (the `CACHE_TTL` window, after which `get()` reports a miss) and `hardExpiresAt` (`STALE_MAX_AGE`, after which the entry is dropped). Between the two, `getStale()` still returns the data — `lib/immich.ts` falls back to it when a request fails with `ImmichUnavailableError`, so the gallery keeps serving the last known albums during an Immich outage instead of erroring. Definitive 404s are cached as a `MISSING` sentinel under the normal TTL and are deliberately excluded from the stale window. Cache keys: `albums-list`, `album-<id>`, `asset-<id>`.
- **Image streaming** — `streamAsset()` proxies binary responses; never loads the full image into memory.

### Asset token security (`lib/tokens.ts`)

`encodeAssetId(uuid)` / `decodeAssetId(token)` — AES-256-GCM with a deterministic IV derived from the asset ID (same UUID → same token, enabling browser caching). Token format: `v2:<base64url(iv+authTag+ciphertext)>`. The encryption key is derived from `AUTH_SECRET` via SHA-256. Legacy CBC tokens are still decoded for backward compatibility.

### API routes (`app/api/`)

Public:

| Route                                          | Purpose                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /api/image/[id]`                          | Image proxy — decodes token, rate-limits, streams from Immich                    |
| `GET /api/video/[id]`                          | Video proxy, range requests included                                             |
| `GET /api/exif/[id]`                           | EXIF data for lightbox panel                                                     |
| `POST /api/auth`                               | Password submission (`subpage` \| `album` \| `journal`) → sets `HttpOnly` cookie |
| `GET /api/og`                                  | Dynamic OG image generation (rate-limited)                                       |
| `GET /api/map`                                 | Aggregated GPS coordinates for map view                                          |
| `GET /api/favicon`                             | Uploaded favicon from `content/`, with an SVG-safe content policy                |
| `POST /api/analytics/track`                    | Cookieless view counter; refuses when `analytics: false`                         |
| `POST /api/webhook`                            | Immich cache invalidation, HMAC-verified; `501` unless `WEBHOOK_SECRET` is set   |
| `GET /api/health`                              | Health check                                                                     |
| `POST /api/install`, `GET /api/install/albums` | First-run wizard; refuse to run once setup completed                             |

Admin (every route re-checks `isAdminEnabled()` + `isAdminAuthenticated()`):

| Route                                      | Purpose                                              |
| ------------------------------------------ | ---------------------------------------------------- |
| `GET/POST/DELETE /api/admin/auth`          | Admin login, session check, logout                   |
| `GET/PUT /api/admin/gallery`               | Read/write `gallery.yaml`                            |
| `GET/PUT /api/admin/settings`              | Read/write `settings.yaml`                           |
| `GET/PUT /api/admin/about`                 | Read/write `content/about.md`                        |
| `GET/POST /api/admin/journal`              | List / create journal entries                        |
| `GET/PUT/DELETE /api/admin/journal/[slug]` | Read, write, delete one entry                        |
| `GET /api/admin/albums`                    | Browse all shared Immich albums (bypasses allowlist) |
| `GET /api/admin/albums/[albumId]/assets`   | Assets of one album, for the manual-order editor     |
| `GET /api/admin/assets`                    | Library search (`POST /search/metadata`) for pickers |
| `GET /api/admin/thumbnail/[id]`            | Raw-UUID thumbnails for the admin UI                 |
| `GET/POST /api/admin/backups`              | List and restore backups                             |
| `POST/DELETE /api/admin/favicon`           | Favicon upload and reset                             |
| `GET /api/admin/analytics`                 | Aggregated view counts                               |
| `GET /api/admin/status`                    | Immich reachability, config validity, cache, backups |
| `POST /api/admin/reload`                   | Invalidate config + Immich cache                     |

The image proxy maps requested pixel widths (`?w=`) to Immich size tiers: `≤250px→thumbnail`, `≤1440px→preview`, `>1440px→original` (`lib/imageSize.ts`).

`?size=` (written by `lib/urls.ts`) acts as a **ceiling**, not an override. When both parameters are present the smaller tier wins, so `?w=` can narrow the request but never widen it — `next/image` emits widths up to 3840, so letting width win outright would serve full-size originals to every large display.

### Routing (`app/[...path]/page.tsx`)

Single catch-all route handles three cases:

1. `/[subpage-slug]/[album-slug]` — renders album detail with back-link to subpage
2. `/[subpage-slug]` — if subpage has >1 album, renders `SubpageGridView`; if exactly 1 album, renders `AlbumDetailView` directly
3. `/[album-slug]` — standalone album detail

The album-cover grid of case 2 (`SubpageGridView`) is sized by two CSS custom properties set inline on `.subpage-grid`: `--subpage-columns` follows the resolved grid config (global `settings.yaml` < per-subpage `grid.columns`), while `--subpage-gap` is a **preset** decision — the theme files set it and only an explicit per-subpage `grid.gap` overrides it, so the global `grid.gap` never flattens a preset's cover spacing. A third variable, `--subpage-columns-tablet`, carries `min(columns, 2)` for the 641–1024px breakpoint; it is computed in `buildCoverGridVars()` (`lib/config/schema.ts`, alongside the clamping bounds shared with the admin inputs) because `repeat()` does not reliably accept `min()`. This is all separate from `--grid-columns`/`--grid-gap`, which size the photo grids inside an album.

A subpage renders as an essay instead when any of `grid.layout === 'essay'`, `essayFile`, or `essayText` is set. With `layout: essay` and no markdown, the essay is generated from the albums (heading per album + its photos).

Fixed routes outside the catch-all: `/about`, `/map`, `/impressum`, `/journal`, `/journal/[slug]`, `/install`, `/admin/*`.

### Journal & essays (`lib/journal.ts`, `lib/essay.ts`, `lib/admin/journal-service.ts`)

- `lib/journal.ts` — **client-safe**, no `fs`. Parses and serializes the block markdown (`parseJournalMarkdown` / `serializeJournalMarkdown`), and owns `sanitizeHtml`, `isValidSlug`, reading time and excerpts. Photo blocks are `![<assetId>:fullbleed|wide](caption)` and `![<id>, <id>](caption)`.
- `lib/admin/journal-service.ts` — **server only**: reads/writes `content/journal/`, falls back to the legacy `content/essays/`, rotates backups. The client/server split is load-bearing — importing the service from a client component breaks the build.
- `essayFile` is a **slug**, not a path: `isValidSlug` rejects dots and slashes, so `content/essays/x.md` cannot resolve.
- Author markdown is escaped, never filtered — `sanitizeHtml` runs first and the renderer only emits tags it builds itself.
- Drafts (`draft: true`) are hidden from the index and the nav check, but remain visible to an authenticated admin. Entry passwords use the `lb_auth_journal_<slug>` cookie.

### Internationalisation (`lib/i18n/`)

Visitor-facing strings are read off a dictionary picked by `settings.yaml: lang`. No framework, no route prefixes — a self-hosted portfolio serves one language.

- `lib/i18n/locales/en.ts` is the reference locale; `Dictionary = typeof en`, so `de.ts` (typed as `Dictionary`) fails the type-check when a key is added and not translated. Values are plain strings, or functions when a count or name is interpolated — pluralisation belongs to the locale ("Alben", not "Albums").
- `lib/i18n/index.ts` — **client-safe** (no `fs`): `resolveLocale()` (drops the region subtag, falls back to `en`), `getDictionary()`, `SUPPORTED_LOCALES`.
- `lib/i18n/server.ts` — server only; reaches into `lib/config` and therefore `fs`. Same split as `lib/journal.ts` vs `lib/admin/journal-service.ts`: importing it from a client component breaks the build.
- Server components call `getServerDictionary()`. Client components take the locale from `components/I18nProvider.tsx` (mounted in the root layout) and call `useDictionary()` — only the locale string crosses the boundary, since dictionaries hold functions and would not serialise.

`<html lang>` keeps the raw configured value, so a `lang: fr` deployment is marked French and shows the English interface rather than lying about its language. The admin panel is deliberately untranslated, and `app/global-error.tsx` stays English because it replaces the root layout and therefore has no provider.

`/impressum` is no longer hardcoded German: the headings come from the dictionary and the footer link reads "Impressum" only under `lang: de`.

`lib/__tests__/i18n.test.ts` walks both dictionaries and fails on a key that was copied but never translated — the type system only catches missing ones.

### Lightbox keyboard shortcuts (`components/Lightbox.tsx`)

The lightbox owns its key bindings (`Esc`, `←`/`→`, `i`, `?`/`h`, `f`) — callers must not install their own, which is how `EssayView` ended up with no keyboard navigation at all.

`?` or `h` toggles a panel listing them, built from the `shortcutRows` array. **Adding a key means adding a row** — the panel is the only place a binding is written down. Rows can be conditional: `i` only appears when `showExifToggle` is on, since journal entries hide the EXIF panel. The `?` case matches the produced character, not the physical key, so it works on a German layout (Shift+ß) as well as a US one; `h` is the fallback for layouts where `?` is awkward.

`Esc` unwinds one layer at a time — shortcut panel, then fullscreen, then the viewer.

`f` calls `requestFullscreen()` on the overlay. The `isFullscreen` state is derived from the `fullscreenchange` event rather than set on the click, because F11, the browser's own Esc and the window manager all leave fullscreen without telling the component; the same event is why the Esc branch above is mostly unreachable in Chrome, which swallows that keypress. An unmount cleanup exits fullscreen when the overlay is still the fullscreen element, so closing the viewer cannot strand the gallery page in fullscreen. `document.fullscreenEnabled` gates both the key and its shortcut row — iPhone Safari implements the API for `<video>` only.

**The panel has no trigger and is not advertised.** There is no `?` button and no first-run nudge: a permanent control in the corner of a photograph costs every visitor something, and a visitor who never presses a key loses nothing by not knowing. Whoever tries `?` or `h` finds it. The panel is `display: none` under `@media (hover: none)`, and `studio-modern` opens it from the top because that preset's EXIF strip owns the bottom edge.

### Proofing (`lib/proofing.ts`, `components/ProofingContext.tsx`)

Client-side favourite selection encoded as a bitmask in the URL and mirrored to `localStorage`; nothing is stored server-side.

Whether it is offered is resolved server-side: `resolveProofing()` (`lib/config/index.ts`) treats `proofing.enabled` in `settings.yaml` as the default and lets a subpage's own `proofing:` flag override it in either direction; albums reached without a subpage follow the global setting (`lib/__tests__/proofing-resolution.test.ts`). The resolved boolean is passed down as a prop — `PhotoGrid` only mounts `ProofingProvider` when it is true, and without the provider `useProofing()` returns null and every proofing control disappears. `EssayView` takes the same prop but defaults it to **off**: proofing is a delivery workflow for album handovers, and hearts interrupt a story.

### Analytics

`POST /api/analytics/track` appends to `content/analytics.json` and short-circuits when `config.analytics === false`. `GET /api/admin/analytics` is admin-only. No cookies, no third party.

### First-run setup (`lib/install.ts`, `app/install/`)

A deployment with no `gallery.yaml` and no credentials serves `SetupScreen`, and `/install` runs the wizard. It is gated by a one-time token printed to the server log and stored in `content/.setup-token` — a fresh deployment is reachable before it is configured. Credentials are verified against Immich before anything is written, then land in `content/install.json`. Environment variables always take precedence over that file, so rotation works without touching it. Once `isInstalled()` is true the wizard routes return `403`.

All pages are `dynamic = 'force-dynamic'` (no SSG; requires live Immich).

### Password protection (`lib/auth.ts`)

Per-subpage, per-album and per-journal-entry password gating using HMAC tokens in `HttpOnly` cookies (no database). Cookie names: `lb_auth_<slug>` (subpage), `lb_auth_album_<slug>` (album) and `lb_auth_journal_<slug>` (journal entry). Password storage supports plaintext (deprecated, logs a warning with recommended scrypt hash), `scrypt:salt:hash` format (`lib/password.ts`), and rejects legacy bcrypt. Token expiry: 24 hours.

### Rate limiting (`lib/rate-limit.ts`)

In-memory sliding-window rate limiter. Important: **in-memory only** — does not work across multiple Node.js instances. Uses FIFO eviction (not reject-on-full) to prevent DoS via store flooding. `TRUSTED_PROXY_HOPS` must be set to the number of reverse proxies in front of the app (nginx = 1); the client IP is then read that many entries from the right of `X-Forwarded-For`, which proxies append to. Without it the IP comes from a spoofable header. Bucket keys are namespaced per endpoint (`image:`, `map:`, `auth:`, …) so limits don't collide.

`RATE_LIMIT_RPM` (default 1500) covers image, video, EXIF and health. Endpoints where a high ceiling would be wrong carry a fixed constant in the route: `admin-auth` 5, `auth` 10, `install` 10, `og` 30, `install-albums` 30, `webhook` 60, `map` 120.

### Theming system

Theme is applied via CSS custom properties on the `<html>` element (`data-preset`, `data-grain`, `data-photo-frame`, etc.) and inline `style` vars (`--accent`, `--font-serif`, etc.). Theme preset CSS files live in `app/themes/`. Base tokens are in `app/tokens.css`. Vanilla CSS throughout — no Tailwind, no CSS-in-JS.

### `next/image` loader

A custom loader (`lib/immichLoader.ts`) maps `next/image` requests to `/api/image/[token]?w=<width>`, keeping all image traffic through the proxy.

### Admin Panel (`app/admin/`, `lib/admin/`, `app/api/admin/`)

Visual page builder, journal studio, settings editor and analytics at `/admin`. Enabled by setting `ADMIN_PASSWORD` env var, or via the setup wizard (scrypt hash in `install.json`).

Each area is a real route — `/admin/pages`, `/admin/journal`, `/admin/journal/[slug]`, `/admin/settings/[section]`, `/admin/analytics`. `app/admin/AdminShell.tsx` lives in the layout and holds the auth gate and chrome, so switching tabs does not re-run the session check.

- `lib/admin/auth.ts` — HMAC-signed session tokens (HttpOnly cookie `folio_admin_session`), 24h expiry. The signing key is derived from `ADMIN_PASSWORD` + `AUTH_SECRET` with scrypt and cached keyed on its inputs.
- `lib/admin/yaml-service.ts` — Atomic YAML read/write with automatic backups to `content/.backups/` (max 10 per file). Writes use temp-file + rename pattern.
- `lib/admin/journal-service.ts` — the same pattern for `content/journal/*.md`.
- `lib/admin/paths.ts` — `containedPath()`; every admin file path goes through it so a slug cannot escape its directory.
- `app/admin/components/PageBuilder.tsx` — Tree editor for hero, standalone albums, subpages, and sections, with a slide-over drawer per item.
- `app/admin/components/JournalStudio.tsx` — Split-screen block editor with live preview.
- `app/admin/components/SettingsEditor.tsx` — Sidebar-nav settings form (general, theme, grid, footer, legal, SEO, security & protection, about).
- `app/admin/components/AlbumPicker.tsx` / `AssetPicker.tsx` / `AssetOrderEditor.tsx` — album browser, library search, manual photo ordering.
- `app/admin/components/BackupManagerModal.tsx` — list and restore backups.

Every `/api/admin/*` route must check `isAdminEnabled()` **and** `isAdminAuthenticated()` itself — there is no shared middleware guard. `app/api/admin/__tests__/admin-guards.test.ts` enforces this across all of them.

After saving, `invalidateConfigCache()` is called so the next request picks up the new YAML without restart.

### Proxy (`proxy.ts`)

Applies CSP (with per-request nonce), HSTS, and other security headers on all non-API, non-static routes. The nonce is passed to pages via the `x-nonce` request header.

Next.js 16 renamed the `middleware` file convention to `proxy`: the file is `proxy.ts` and it exports `proxy()` (not `middleware()`). The `config.matcher` export is unchanged.

## Code conventions

- **TypeScript strict mode** — no untyped `any`; use `@ts-expect-error` (not `@ts-ignore`) with a comment when suppressing type errors.
- **Server Components by default** — add `'use client'` only when browser APIs or React state/effects are needed.
- **All Immich data flows server-side** — raw asset UUIDs must never appear in client-rendered HTML or JS. Always use `encodeAssetId()` / `imageUrl()` / `exifUrl()` from `lib/urls.ts` before passing IDs to components.
- **Rate-limit all expensive endpoints** — apply `checkRateLimit` from `lib/rate-limit.ts` to any route doing heavy computation or upstream API calls.
- **Commit style** — Conventional Commits: `feat:`, `fix:`, `security:`, `docs:`, `chore:`.
- **Route handlers are testable** — `vitest.config.ts` includes `app/**/__tests__/**/*.test.ts`. Logic that lives in a route (auth guards, header sanitisation) belongs in a route-level test; do not extract it into `lib/` purely to make it reachable by the test runner.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
