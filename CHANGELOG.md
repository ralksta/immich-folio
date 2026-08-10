# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases up to and including v0.9.2 are documented in the
[GitHub releases](https://github.com/ralksta/immich-folio/releases).

## [Unreleased]

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
