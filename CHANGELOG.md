# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases up to and including v0.9.2 are documented in the
[GitHub releases](https://github.com/ralksta/immich-folio/releases).

## [Unreleased]

### Added

- **The album covers on a subpage follow the grid setting**
  ([#460](https://github.com/ralksta/immich-folio/pull/460)). They were tiled
  two-up by a hardcoded CSS rule, so the site-wide `grid.columns` only ever
  reached the photo grids inside an album and the covers stayed enormous on wide
  screens. A subpage can also override the count and the spacing on its own,
  under Pages › _subpage_ › **Album Cover Grid**. Tablet widths show at most two
  covers per row, phones one, as before.

  `gap` deliberately does **not** follow the global setting: each theme preset
  picks its cover spacing as part of its look (1px `monograph`, 20px
  `studio-modern`), so only an explicit per-subpage `gap` overrides it. See
  [docs/gallery-config.md](docs/gallery-config.md#album-covers-on-a-subpage).

  **A site whose `settings.yaml` sets `grid.columns` to anything other than 2
  will see its subpage cover grids change on upgrade.** That is the point of the
  change; to keep two-up covers, set `grid.columns: 2` on the subpage.

### Fixed

- **A failing site no longer renders a blank page.** `app/error.tsx` is rendered
  _inside_ the root layout, so it could never catch the layout itself throwing —
  and the layout is what reads the configuration and the request headers. The
  new `app/global-error.tsx` replaces the whole document with a readable
  message and a retry, self-contained so it works without the stylesheet or the
  theme variables.

### Changed

- The package is named `immich-folio` instead of `immich-lightbox`, which it had
  kept from before the rename. Only visible when working on the source.

## [0.11.0] — 2026-08-15

### Added

- **Journal** ([#432](https://github.com/ralksta/immich-folio/pull/432)). A
  section for photo essays and travel stories at `/journal`, with its own index,
  cover images, reading times and drafts. Entries are plain Markdown in
  `content/journal/`, written either by hand or in the new **Journal Studio** —
  a split-screen block editor with a resizable divider and a live preview of the
  real page. Photos are inserted through the asset picker rather than by typing
  UUIDs. A `/journal` link appears in the navigation as soon as one published
  entry exists; drafts stay visible to a logged-in admin only. Entries can carry
  their own password. See [docs/journal.md](docs/journal.md).
- **About page editor and toggle**
  ([#446](https://github.com/ralksta/immich-folio/pull/446)). Portrait, name,
  location, gear list and biography are edited under admin Settings › About,
  which writes `content/about.md`. `about.enabled: false` in `settings.yaml`
  takes the page offline without deleting it.
- **Per-album photo order, independent of Immich**
  ([#414](https://github.com/ralksta/immich-folio/pull/414)). A `sort` key per
  album — `immich`, `newest`, `oldest`, `filename` or `manual` — so a curated
  series can have a narrative order without changing the archive. `manual` is a
  pinned prefix: only the photos you place by hand are listed, everything else
  follows in the Immich order, and the admin panel has a drag & drop editor
  for it.
- **Experimental portfolio features**
  ([#431](https://github.com/ralksta/immich-folio/pull/431)). Marked
  experimental in the schema and the UI:
  - `justified` grid layout — every row fills the width at one shared height,
    aspect ratios intact
  - `cover` hero style — a fullscreen splash with the site title and a single
    **Enter** link
  - `hidden: true` subpages — reachable by direct link, absent from the
    navigation (unlisting, not access control)
  - per-album `grid` overrides, merged over the subpage and global grid
  - per-album `coverPosition` — the focal point for the cover crop
  - `navLinks` — external `http(s)` links appended to the header navigation
- **First-run setup wizard at `/install`**
  ([#419](https://github.com/ralksta/immich-folio/pull/419)). A fresh deployment
  can now be configured from the browser: connect to Immich, optionally pick
  albums, name the site. Credentials are verified against the Immich server
  before anything is written, so a typo cannot produce an "installed" site that
  loads no photos. The wizard is gated by a one-time token printed to the server
  log — a deployment is reachable before it has any configuration, and without
  the gate whoever found the URL first could configure it. Credentials land in
  `content/install.json` (mode `0600`, admin password stored as an scrypt hash);
  environment variables continue to take precedence, so rotation still works by
  setting a variable. Configuring everything by hand remains fully supported.
- **Custom favicon upload** in admin Settings › General
  ([#422](https://github.com/ralksta/immich-folio/pull/422)). SVG, PNG, ICO or
  JPEG, stored in the writable `content/` volume and served through
  `/api/favicon` with a policy that stops an uploaded SVG executing script. A
  Reset button restores the bundled default.

### Changed

- **`studio-modern` is the default theme preset**, replacing `studio`. It is
  now listed first in the docs, the setup wizard and the admin preset cards,
  and it is what a site renders with when no preset is configured.

  **This changes the appearance of an existing site only if it never picked a
  theme** — that is, no `content/settings.yaml`, or one without a
  `theme.preset` key. Anything with an explicit preset is untouched. To keep
  the previous look, set it explicitly:

  ```yaml
  # content/settings.yaml
  theme:
    preset: studio
  ```

  Three code paths fell back to a hard-coded `'studio'` (no settings file at
  all, a settings file without a `theme` key, and a `theme` object that
  overrides properties without naming a preset). They now share one
  `DEFAULT_PRESET` constant, with a test covering all three so they cannot
  drift apart again.

- **Every admin area has its own URL**
  ([#432](https://github.com/ralksta/immich-folio/pull/432)) — `/admin/pages`,
  `/admin/journal`, `/admin/settings/<section>`, `/admin/analytics` — so a
  section can be bookmarked and the back button behaves. The auth gate and the
  panel chrome moved into the layout, and no longer re-run on every tab switch.
  A floating save bar keeps Save reachable without scrolling
  ([#426](https://github.com/ralksta/immich-folio/pull/426)).
- **Design system gaps in the admin panel are closed**
  ([#432](https://github.com/ralksta/immich-folio/pull/432)). Several classes
  were referenced but never defined — every input used a class no stylesheet
  had, the Analytics bars had no fill, and all grid previews collapsed to the
  same height. The album sort dropdown is now a themed listbox rendered in a
  portal, so it no longer clips inside modals.
- **The last emojis in the public frontend are SVG icons**
  ([#445](https://github.com/ralksta/immich-folio/pull/445)), matching the admin
  panel ([#415](https://github.com/ralksta/immich-folio/pull/415),
  [#416](https://github.com/ralksta/immich-folio/pull/416),
  [#418](https://github.com/ralksta/immich-folio/pull/418)).
- **The sample journal story ships as a template, not a live entry**
  ([#443](https://github.com/ralksta/immich-folio/pull/443)). It is
  `content/journal/sample-story.md.example`, so a fresh install does not publish
  someone else's story — and since the asset IDs in it belong to no server, the
  template ships without any.
- **A gallery with no albums is now a valid, rendered state**
  ([#421](https://github.com/ralksta/immich-folio/pull/421)) instead of an error
  — the setup wizard can finish without picking one, and albums can be added
  later in `/admin`.
- **The Immich URL may end in `/api`** without breaking every request
  ([#421](https://github.com/ralksta/immich-folio/pull/421)). The suffix was
  appended unconditionally, producing `.../api/api`.

### Documentation

- **README documents the setup wizard**, what it writes, and that
  `content/install.json` holds credentials — so a backup of `content/` is
  understood to include your Immich API key. The Docker examples no longer mount
  `content/` read-only: the wizard, the admin panel and the backup rotation all
  write into it, and `:ro` silently breaks all three.
- **Contributors are credited in the README.**
- **The documentation was brought back in line with `dev`**
  ([#452](https://github.com/ralksta/immich-folio/pull/452),
  [#453](https://github.com/ralksta/immich-folio/pull/453)). The README is
  restructured and `studio-modern` is documented as the default preset, which it
  had already become in the code.
- **The journal guide has screenshots**
  ([#455](https://github.com/ralksta/immich-folio/pull/455),
  [#456](https://github.com/ralksta/immich-folio/pull/456),
  [#457](https://github.com/ralksta/immich-folio/pull/457)). The one guide
  describing a visual editor had no picture of it. `scripts/screenshots.ts`
  gained a `journal` section that writes throwaway entries from real albums,
  shoots the index, a rendered entry, the entry list and the studio — including
  its draft and password states and the Story Settings form — and deletes them
  again, so a run never leaves a demo story on a live site.

### Fixed

- **Client proofing ignored its own configuration**
  ([#454](https://github.com/ralksta/immich-folio/pull/454)). The photo grid
  mounted the proofing provider unconditionally, so the favourite hearts, the
  selection bar and the export modal appeared on every album on every site.
  `proofing.enabled` in `settings.yaml`, a subpage's own `proofing:` flag and
  `allowMailto` were all parsed, validated — and never read.

  They are honoured now, with precedence subpage → global: a subpage's flag
  wins in either direction, and a page reached without one follows
  `proofing.enabled`.

  **What changes for an existing site.** `proofing.enabled` defaults to `true`,
  so albums keep their proofing controls and most sites see no difference. Two
  cases do change: a site that set `proofing.enabled: false` finally gets what
  it asked for, and **photo essays no longer show the controls unless their
  subpage sets `proofing: true` explicitly** — a published story is not an
  album handover, so the global default deliberately does not reach into
  essays. Journal entries never show them.

- **Journal photos did not render**
  ([#432](https://github.com/ralksta/immich-folio/pull/432)). Photo blocks
  resolved to nothing, headings sat further left than the body text, fullbleed
  photos bled only to the left, photo pairs forced both images to equal width
  regardless of their real shapes, the preview claimed 3:2 for every photo, and
  the lightbox had neither keyboard control nor navigation inside a journal
  entry.

### Security

- **Journal author markdown is escaped, not filtered**
  ([#432](https://github.com/ralksta/immich-folio/pull/432)). The previous pass
  stripped `<script>` tags, `on*="…"` handlers and the literal `javascript:` —
  a denylist, and trivially bypassable: an unquoted `onerror=`, single-quoted
  handlers, `<svg onload=…>` and `javasjavascript:cript:` (the replacement
  recombines) all reached `dangerouslySetInnerHTML`. With escaping there is
  nothing left to enumerate.
- **Journal file paths are contained**
  ([#432](https://github.com/ralksta/immich-folio/pull/432)), frontmatter
  escaping is fixed, and two regexes with polynomial backtracking were replaced
  by linear scans.
- **The admin session signing key is derived with scrypt**
  ([#432](https://github.com/ralksta/immich-folio/pull/432)) rather than a plain
  digest, and the key cache is keyed on its inputs instead of on a digest of
  them.
- **Asset tokens are length-capped before decoding**
  ([#423](https://github.com/ralksta/immich-folio/pull/423)). `decodeAssetId()`
  passed arbitrary-length URL input straight to `Buffer.from(…, 'base64url')`,
  so a huge crafted token could exhaust memory or throw `RangeError` despite the
  surrounding `try`/`catch`. A real v2 token is ~110 characters; anything over
  256 is now rejected outright.
- **Next.js 16.3.0** — picks up the fix for CVE-2025-13465 in Next's vendored
  lodash ([#402](https://github.com/ralksta/immich-folio/pull/402)).

### Internal

Nothing user-facing; recorded so the next release notes are complete.

- **CI annotates unformatted files in a PR without blocking it**
  ([#424](https://github.com/ralksta/immich-folio/pull/424)). Prettier is
  configured as an eslint error but had never run in CI, so part of the tree
  predates it. Failing on that would make a PR red for merely touching an old
  file; reformatting the tree in one commit would bury every future diff in
  churn. The check runs over the files a PR changes and warns.

- **Dependency PRs now target `dev`**, and CI runs on pull requests to `dev` as
  well ([#411](https://github.com/ralksta/immich-folio/pull/411)). The workflow
  previously triggered on `main` only, so a PR against `dev` carried no checks
  at all. `CONTRIBUTING.md` and the PR template now state the target branch
  ([#412](https://github.com/ralksta/immich-folio/pull/412)) — it was nowhere
  documented before.
- **`scripts/screenshots.ts` type-checks against sharp 0.34 and 0.35**
  ([#410](https://github.com/ralksta/immich-folio/pull/410)). sharp arrives
  transitively through Next, and 0.35 moved from `export =` to ESM: the module
  namespace stopped being callable and the factory moved to `.default`. The
  Next bump above would otherwise have broken `npx tsc --noEmit`.
- **Prettier was run across the tree**
  ([#450](https://github.com/ralksta/immich-folio/pull/450)), and the eslint
  errors that pass uncovered were cleared
  ([#451](https://github.com/ralksta/immich-folio/pull/451)). The formatting
  churn is in one commit of its own, so it does not sit inside a feature diff.
- Dev-dependency bumps: prettier 3.9.6, eslint 9.39.5, `@types/leaflet` 1.9.22,
  and `github/codeql-action` v4.

## [0.10.0] — 2026-08-10

### Added

- **Photo Essay mode** — storytelling pages with an RSC markdown parser and
  fullbleed/pair layouts, plus a visual essay block builder in the admin panel.
- **Client proofing** — favorite selection with compact URL bitmasking and an
  export modal.
- **Subpage enable toggle** — deactivate a subpage without deleting it.
- **SEO** — configurable subpage title template, metadata descriptions, and
  `generateMetadata` on the about page.
- **New theme preset `studio-modern`.** The Leica language of `studio` rebuilt
  around the precision grotesque Archivo, with IBM Plex Mono for every piece of
  photographic metadata. Hairline rules, zero radius, an indexed hero navigation
  with album counts, an always-visible caption bar under album covers, and a
  film-edge EXIF strip in the lightbox. Selectable in the admin panel, the dev
  toolbar, and `content/settings.yaml`. See [docs/theming.md](docs/theming.md).

### Security

- `GET /api/admin/analytics` now requires an admin session.
- Docker images are scanned with Trivy on every publish; results land in the
  GitHub Security tab.

### Changed

- **Album sort order now mirrors the Immich timeline** ([#350](https://github.com/ralksta/immich-folio/issues/350)). Albums were
  sorted by `fileCreatedAt`, the capture instant in UTC. Immich sorts its
  timeline primarily by `localDateTime` — the capture time in the
  photographer's local zone — and uses `fileCreatedAt` only as a tie-breaker.
  The two keys are identical for the vast majority of albums; they diverge for
  albums spanning time zones, where the order shown in Immich Folio no longer
  matched the Immich UI. The sort keys were changed accordingly, and
  unparseable dates now fall back to `0` instead of `NaN` (a `NaN` comparator
  makes `sort()` free to return any permutation).

### Fixed

- **Cache staleness** — `?fresh=1` bypass, an admin diagnostic banner for albums
  Immich returns empty, and revalidation after admin saves.
- **Admin status panel reported two faults that were not faults** ([#341](https://github.com/ralksta/immich-folio/issues/341)).
  `settings.yaml` was treated as mandatory although `getConfig()` falls back to
  defaults without it, so anyone running with only a `gallery.yaml` saw a
  permanent "Config Integrity: Degraded". Only a file that exists and cannot be
  parsed counts as degraded now. A failed status request was also rendered as if
  it were a result — an expired admin session looked identical to a real
  outage — so there is now a third state for "the check did not run".
- **Lightbox showed its photo counter twice.** The counter renders a
  screen-reader label ("Photo 3 of 53") alongside the compact display
  ("3 / 53"), but `.sr-only` was not defined in any stylesheet, so both strings
  were visible on top of each other.
- **Docker** — health check targets `127.0.0.1` instead of `localhost`, base
  image moved to `node:22-alpine`.
- **The Trivy scan never ran.** The publish workflow referenced
  `aquasecurity/trivy-action@0.29.0`, but that repository's tags carry a
  leading `v`, so the job failed during action setup — before the image was
  built. No image was published for the first v0.10.0 attempt, and no scan had
  run since the step was introduced. The action is now pinned to a commit SHA
  ([#409](https://github.com/ralksta/immich-folio/pull/409)).
- **Docs** — the "nature / travel journal" example in `docs/theming.md` used a
  preset named `botanica` that does not exist; copying it produced an
  `Unknown theme preset` error. It now uses `editorial`.
- **Map page ignored the theme.** `app/map/map.css` referenced custom properties
  that never existed (`--font-heading`, `--font-body`, `--border-color`,
  `--radius`), so the map title, popups, and container fell back to browser
  defaults instead of the configured fonts, borders, and radius. This affects
  every preset — the map now picks up the theme like the rest of the site.

### Upgrade notes

**No migration is required.** No configuration schema changed, and the six
existing presets render exactly as before. Pull the new image, restart, done.

**Rolling back after switching presets needs one edit.** If you select
"Studio Modern" and later downgrade to a version that predates it, the
`theme.preset: studio-modern` left in `content/settings.yaml` is a preset the
older version does not know, and config loading fails with:

```
Unknown theme preset "studio-modern". Valid presets: studio, minimal, editorial, classic, noir, monograph
```

Set `theme.preset` back to one of the listed presets in `content/settings.yaml`
before downgrading. `/admin` stays reachable if you hit this, so the change can
also be made after the fact.

**If you copied `docker-compose.override.yml.example`, update your health
check by hand.** The example now uses `wget -O /dev/null` instead of
`--spider`, but your own `docker-compose.override.yml` is not tracked by git,
so pulling the new version does not touch it — and a health check defined
there overrides the one baked into the image. `--spider` does not read the
response body and disconnects mid-RSC-stream; when that abort coincides with a
slow render after `CACHE_TTL` expiry, Node tears down the `TransformStream`
controller while Next.js is still writing into it:

```
TypeError: controller[kState].transformAlgorithm is not a function
```

Replace `"--spider"` with `"-O", "/dev/null"` in your override file:

```yaml
healthcheck:
  test: ['CMD', 'wget', '--no-verbose', '--tries=1', '-O', '/dev/null', 'http://127.0.0.1:7211/']
```

A full GET checks the same thing without the race. Installations without an
own health check need no action — the image ships the fixed one.
