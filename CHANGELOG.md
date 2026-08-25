# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases up to and including v0.9.2 are documented in the
[GitHub releases](https://github.com/ralksta/immich-folio/releases).

## [0.13.0] — 2026-08-25

### Added

- **Discoverability: site URL, `robots.txt`, `sitemap.xml` and JSON-LD**
  ([#472](https://github.com/ralksta/immich-folio/issues/472)). A portfolio that
  cannot be found is a portfolio nobody sees, and there was no way to write any
  of it because nothing knew the site's own address. `url:` in `settings.yaml`,
  editable under Settings › SEO, with `SITE_URL` as a fallback. Without one the
  sitemap stays empty and the JSON-LD is omitted rather than guessing a host: a
  wrong absolute URL is worse than a missing one.

  What may appear in a listing is decided by one pure function, so a sitemap
  cannot become the leak nobody notices — it excludes protected and hidden
  subpages, protected albums, journal drafts, and the case easiest to miss:
  public albums sitting under a protected or hidden subpage, which are not
  reachable and whose names would otherwise be published. A locked site yields
  nothing at all. Paths are percent-encoded, so an album named in a non-Latin
  script produces a valid URL rather than an IRI the sitemap protocol will not
  accept.

- **Slideshow mode in the lightbox**
  ([#473](https://github.com/ralksta/immich-folio/issues/473)). `s` cycles off →
  3s → 5s → 10s → off, so a gallery can run unattended at an exhibition, a fair
  booth or on a second screen. No configuration and no button: the speeds live
  in the key itself, and a permanent control in the corner of a photograph costs
  every visitor something. Any deliberate move — arrow key, nav button, swipe —
  stops it, since someone reaching for an arrow has taken over. Under
  `prefers-reduced-motion` the photograph appears instead of fading and scaling
  in, because a running slideshow is exactly the repeated motion that preference
  is about.

- **Download the original, opt-in per album**
  ([#475](https://github.com/ralksta/immich-folio/issues/475)). `download: true`
  on an album offers the file from the lightbox, on a button and on `d`. Off
  everywhere by default and opt-in per album on purpose: a public portfolio must
  not start handing out full-resolution originals because one client gallery
  needed to.

  The route re-checks rather than inheriting the image proxy's assumptions — the
  album must be on the allowlist, must have opted in, must have its password
  gate satisfied, and the asset must actually belong to it, which is what stops
  one enabled album's URL being edited into a download of anything in the Immich
  instance. The gate check follows the whole route to the album, so an album
  with no password of its own, reachable only through a subpage that has one,
  cannot be downloaded until that subpage is unlocked. Every refusal answers
  404, so the response never reveals which check failed.

- **Copy a link to the photo on screen**
  ([#478](https://github.com/ralksta/immich-folio/issues/478)). Positional
  permalinks already existed — the grid writes `#photo-N` and restores it on
  load — but nothing told a visitor they could share one. Now there is a button,
  and `c`.

  The clipboard is not assumed: `navigator.clipboard` is undefined outside a
  secure context, and a self-hosted portfolio reached over plain http on a LAN
  is exactly that, so the link appears in a selected field instead of the button
  appearing to do nothing. The link is positional, as `gallery.yaml.example`
  documents — reordering an album moves where a shared link lands.

- **Previous / next album at the foot of an album**
  ([#483](https://github.com/ralksta/immich-folio/issues/483)). An album detail
  page ended nowhere: a visitor reached the last photograph and had only the
  back link, so the sequence the photographer arranged stopped being a sequence.
  The order comes from whatever list the visitor just came through rather than
  an ordering of its own — a "next" that disagreed with the grid they were
  looking at a moment ago would be worse than no control at all. Neighbours do
  not wrap around, so reaching the end is visible as the end.

- **The Immich asset description becomes image alt text**
  ([#484](https://github.com/ralksta/immich-folio/issues/484)). Grid and
  lightbox images rendered `alt=""` throughout while the description was already
  flowing to the client as an editorial caption. It is gated on the `caption`
  EXIF group rather than served unconditionally: that switch exists because the
  description is the one field that can hold private notes, and an alt attribute
  publishes it to crawlers exactly as a visible caption would. An absent
  description leaves `alt=""` — the correct markup for a decorative image,
  rather than inventing filler text.

- **Location precision, per album or per subpage**
  ([#469](https://github.com/ralksta/immich-folio/issues/469)).
  `location: exact | city | country | hidden`. The map is the only public GPS
  surface, and a public album's marker sat at the mean of its photographs'
  coordinates — for an album shot in one place, a garden, a studio, a client's
  home, that mean _is_ that place. Nobody chose that; it followed from the
  camera writing GPS.

  Coordinates are quantised server-side against a fixed global grid — city to
  0.05°, country to 1° — rather than jittered per request, which could be
  averaged away by asking twice. The place _name_ is reduced with the position,
  so a marker rounded to a 1° cell is not still labelled with the town. The
  lightbox info panel follows the same setting: an album set to `hidden`, which
  asks to be absent from the map entirely, no longer tells anyone who clicks
  "Info" where the photograph was taken. Where one marker merges several albums,
  the strictest setting among them governs the whole marker.

- **The admin panel says when a newer release exists**
  ([#496](https://github.com/ralksta/immich-folio/issues/496)). Self-hosted
  software that never mentions a new release gets run for months on an old
  version, and there have already been security releases. The running version
  comes from `package.json`, the latest from the GitHub releases API, one
  request a day, riding on the status call the dashboard already makes.

  Discreet by design: a row in the status list, not a banner, which only turns
  into a link when there is something newer. It fails quietly in every direction
  — no network, a rate limit, a changed payload — and a tag that is not a
  version is rejected rather than read as one, so a date-style release tag
  cannot announce an update that does not exist.

- **A Help tab in the admin panel, starting with the image viewer.** The
  lightbox's keys are deliberately unadvertised to visitors, but that also left
  the site owner with no way to learn that the slideshow, the copy-link and the
  download exist at all — and a feature nobody can find is not shipped. Help
  lists the viewer's shortcuts, notes the ones that are conditionally absent,
  and explains the two that need it. The labels are read from the same
  dictionary the viewer uses, so what the help promises is what a visitor is
  shown.

- **A subpage's album covers get their own grid**
  ([#523](https://github.com/ralksta/immich-folio/issues/523)). `coverGrid`
  sizes the cover tiles and nothing else; `grid` keeps the
  `global < subpage < album` precedence for the photos. Until now a subpage had
  a single `grid` key that both consumers read, so a gap typed into the field
  labelled **Album Cover Grid** silently retuned every photo grid on the page
  and overrode Settings › Grid.

  A `gallery.yaml` written before the split has no `coverGrid`, so the covers
  fall back to `grid` and such a page renders exactly as it did. The page
  builder seeds the new cover fields from the old value, so the drawer reflects
  what the page really renders and the first save writes the two out separately.

### Fixed

- **Albums whose name is written in CJK are reachable again**
  ([#522](https://github.com/ralksta/immich-folio/issues/522)). The slug was
  built by dropping every character outside `[a-z0-9]`, so a Chinese, Japanese,
  Korean, Cyrillic or Greek name was reduced to nothing at all. The album's link
  then pointed at `/`, clicking it went nowhere, and because no album lookup was
  ever attempted there was nothing in the log to explain it. Slugs now keep any
  letter or digit, whatever the script, and fold Latin diacritics as before
  (`Café` still becomes `cafe`). An album whose name has no letters at all — one
  written purely in emoji — falls back to its id, so it stays reachable and two
  of them no longer collide.

  Generating a usable slug was only half of it: Next hands a catch-all route
  segment to the page still percent-encoded, so `/家族相册` arrived as
  `%E5%AE%B6...` and matched no album even once the slug was right — the album
  link rendered, and opening it produced an empty page. Incoming slugs are now
  decoded once at the route boundary, and matched in both their composed and
  decomposed Unicode form, so a slug typed or pasted into the address bar
  resolves too.

- **The lightbox controls are one bar instead of five anchors.** Reported
  against studio-modern: the link, favourite and info controls sat on top of the
  photo counter, and pressing Info made its label grow into the favourite button
  beside it. Both followed from the same cause — each control positioned itself
  with a hard-coded offset, so a button that changed width walked into its
  neighbour and a conditionally absent one left a hole. They now sit in one flex
  row, which cannot collide with itself.

## [0.12.0] — 2026-08-23

### Added

- **The setup wizard seeds the home page with photographs**
  ([#518](https://github.com/ralksta/immich-folio/issues/518)). It always wrote
  `hero: []`, so a finished portfolio opened with a title and a list of album
  names and no image — on the one page that most needs to show a photograph.
  The covers of the albums just chosen are used, up to five, changeable in the
  admin panel afterwards. Best effort: if the lookup fails the install proceeds
  with an empty hero, as before.

- **The album picker marks albums Immich does not consider shared**
  ([#515](https://github.com/ralksta/immich-folio/issues/515)). Not a warning
  and not a barrier — publishing them has always worked, because Immich ignores
  the `?shared=true` the list is fetched with. It is there so nobody publishes a
  private album unaware. The same appears in the config doctor as a warning.

- **`mode:` sets the colour mode visitors land on**
  ([#512](https://github.com/ralksta/immich-folio/issues/512)). `dark` (the
  existing default), `light`, or `auto` to follow the visitor's operating
  system — in `settings.yaml` or under Settings › Theme. It is rendered onto
  `<html>` server-side, so the first paint is already right. The admin panel's
  own light/dark switch previews your view and never decided what visitors saw,
  which is what made this necessary; a visitor's choice from the header toggle
  is still remembered on their device and still wins.

- **`exif:` decides which EXIF groups a site publishes**
  ([#506](https://github.com/ralksta/immich-folio/issues/506)). Four switches —
  `camera`, `settings`, `location`, `caption` — in `settings.yaml` or under
  Settings › Portfolio Features. They govern all three places the data appears
  (grid hover, lightbox panel, album header), so those cannot disagree. Grouped
  rather than field-by-field on purpose: a list of individual field names is a
  small language of its own, for a choice people make in groups anyway.

  `exifOnHover` keeps its meaning and supplies the default for the three
  technical groups, so an existing `exifOnHover: false` still hides all of them.
  With every group off, the lightbox withdraws its info button and the `i` key
  instead of opening an empty panel.

- **The lightbox lists its keyboard shortcuts under `?` or `H`**
  ([#501](https://github.com/ralksta/immich-folio/pull/501)). The viewer has
  always had keys — arrows, `i`, `Esc` — with nothing that wrote them down.
  There is deliberately no button and no first-run hint: a permanent control in
  the corner of a photograph costs every visitor something, and whoever tries
  `?` or `h` finds the list. `Esc` now unwinds one layer at a time, closing the
  panel before the viewer.

- **`F` puts the lightbox into real fullscreen**
  ([#474](https://github.com/ralksta/immich-folio/issues/474)). The viewer
  covered the viewport but not the browser's own chrome, so every photo was
  shown inside a tab strip and a URL bar. `F` toggles it, the shortcut panel
  lists it, and `Esc` unwinds one layer at a time — shortcut panel, then
  fullscreen, then the viewer. Leaving the lightbox while fullscreen returns the
  page to normal instead of stranding the gallery there. Browsers without
  element fullscreen (iPhone Safari, which offers it for video only) do not
  advertise the key.

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

### Security

- **The admin session token is bounded before it is parsed**
  ([#505](https://github.com/ralksta/immich-folio/pull/505)). A cookie longer
  than 512 characters is rejected outright. Reported as a memory-exhaustion DoS;
  the decode it named is only reached after the HMAC matches, which needs the
  signing key, so this is hygiene at the boundary rather than a fix for a
  reachable exhaustion — but a bound on untrusted input costs nothing.

### Fixed

- **The setup wizard runs on a container with no environment variables**
  ([#519](https://github.com/ralksta/immich-folio/issues/519)). Its own API
  answered 500, because rate limiting resolved the client IP through
  `getConfig()`, which resolves `AUTH_SECRET`, which throws in production when
  none is set — and the secret the wizard is meant to _generate_ therefore had
  to exist before the wizard could run. That is the deployment
  `docs/deployment.md` recommends. `getClientIp()` reads the one value it needs
  straight from the environment now.

- **A container with a broken `gallery.yaml` no longer restarts in a loop**
  ([#519](https://github.com/ralksta/immich-folio/issues/519)). `/api/health` is
  the Dockerfile's health probe and reported 503 when the config could not be
  parsed. Restarting cannot fix a YAML typo, and the app is still serving the
  setup screen and `/admin`, which is where the fix happens. It answers 200 with
  `status: "setup"` instead. An unreachable Immich keeps its 503.

- **An ID that is not a UUID is dropped instead of becoming the zero UUID**
  ([#517](https://github.com/ralksta/immich-folio/issues/517)). `validateUuid()`
  logged "(Ignored for build/setup)" and returned
  `00000000-0000-0000-0000-000000000000`, which then travelled on as a real
  asset ID and came back 400 from Immich — so a leftover placeholder turned the
  home page into "Something went wrong" while the log claimed it had been
  ignored. Now it is: one fewer hero image, one album not published, an album
  falling back to its Immich cover — each with a warning naming the entry.

  **A copied `gallery.yaml.example` therefore yields page structure and no
  albums**, since its IDs are placeholders. That is the honest outcome; replace
  them with real album IDs.

- **A malformed `gallery.yaml` shows the setup screen instead of a 500**
  ([#516](https://github.com/ralksta/immich-folio/issues/516)). The site gate
  resolves the password through `getConfig()`, which throws on a config it
  cannot parse — inside `proxy.ts`, before `app/layout.tsx` could fall back to
  `getConfigOrNull()`. One typo became a bare "Internal Server Error" on every
  route, with nothing naming the file.

- **The About link no longer points at an empty page**
  ([#518](https://github.com/ralksta/immich-folio/issues/518)). `about.enabled`
  defaults to on, but `content/about.md` does not exist until someone writes it,
  so a fresh install shipped a navigation entry leading nowhere. The link now
  needs the file as well.

- **A gallery finished through the setup wizard is no longer empty until the
  next restart.** While the install was unfinished the album list was fetched,
  filtered against the still-empty allowlist, and the resulting `[]` was cached
  — and the wizard's cache invalidation runs in the install route's own module
  instance, so it never reached the one the page render used. The list is not
  cached while setup is unfinished.

- **`content/gallery.yaml.example` is valid YAML again.** It carried two
  `subpages:` keys, so js-yaml refused the file — and README, CONTRIBUTING and
  the setup screen all tell a new user to copy exactly that file, which meant a
  fresh installation answered HTTP 500 on every route. The two blocks are now
  one list, and a test loads both shipped examples through the config pipeline
  so this cannot come back.

- **Corrected three claims in `.env.local.example`.** It advertised Zod
  validation (Zod is not a dependency), described a fallback from `AUTH_SECRET`
  to `IMMICH_API_KEY` that does not exist, and left `AUTH_SECRET` commented out
  — which in production stops the server from starting and in development
  regenerates a random secret on every restart, invalidating every image URL.
  It is now set, with a command to generate one.

- **The README's command for reading the setup token works.**
  `docker compose logs immich-folio` names the container, not the service, and
  fails with "no such service".

- **Long values in the lightbox info panel no longer run into their label**
  ([#514](https://github.com/ralksta/immich-folio/issues/514)). The rows are
  `space-between` with no gap, so a value that left no free space simply touched
  its label — `CAMERALEICA CAMERA AG LEICA Q3`. The rows carry a gap now, and
  the camera name drops a maker the model already spells out, so a Leica reads
  `LEICA Q3` and a Nikon `NIKON Z 6` instead of saying the brand twice.

- **The lightbox info panel is readable in light mode**
  ([#511](https://github.com/ralksta/immich-folio/issues/511)). The EXIF panel
  and the shortcut list paint their own dark surface but took their text and
  border colours from the site theme, so in light mode they rendered dark text
  on a dark panel. Both now carry their own light-on-dark colours, as the
  caption line always did. The rest of the lightbox chrome still follows the
  theme, because the overlay behind it does too.

- **`grid.gap` reaches every theme**
  ([#513](https://github.com/ralksta/immich-folio/issues/513)). `minimal`,
  `editorial` and `monograph` hardcoded the column spacing on `.photo-grid`, so
  the Gap Spacing control did nothing in those presets — while the row spacing
  followed it, leaving columns and rows visibly out of step. Each preset now
  declares its spacing as a default that an explicit `grid.gap` overrides.

  **An unset `gap` is now the preset's own spacing rather than a flat 12px.**
  That is what those three presets already rendered horizontally, so the visible
  change is that their rows finally match their columns. Sites that set `gap`
  are unaffected, and `classic` and `studio-modern` keep the 12px they had.

- **The Immich description can be switched off**
  ([#506](https://github.com/ralksta/immich-folio/issues/506)). It was served
  regardless of `exifOnHover`, on the grounds that a caption is editorial rather
  than metadata — which made it the one field an operator could not hide, while
  Immich descriptions are exactly where people keep private notes and whatever a
  decade of cataloguing software left behind. It is now a group like any other.

- **The album header no longer picks a camera at random**
  ([#509](https://github.com/ralksta/immich-folio/issues/509)). The date and the
  camera/lens line were read off the first asset that happened to carry EXIF, so
  an album shot on three bodies advertised whichever one sorted first — and
  changing the album's sort mode changed the claim. The line now appears only
  when the whole album agrees on one body and one lens, and the date spans a
  range when the photos do.

- **The lightbox watermark honours the configured opacity**
  ([#508](https://github.com/ralksta/immich-folio/issues/508)). The docs and the
  admin slider express it as a fraction (`opacity: 0.5`), but the lightbox
  divided by 100 anyway — so a configured `0.9` rendered as `0.009` and was
  invisible, and the workaround of writing `90` came back as "9000%" in the
  admin panel. The fraction is now used as written; a value above 1 is still
  read as a percentage so those workarounds keep working, and the panel writes
  the fraction back on the next save. Its slider reaches 100% instead of
  stopping at 80%.

- **A deployment with credentials but no `gallery.yaml` no longer reports
  "System Degraded"** ([#507](https://github.com/ralksta/immich-folio/issues/507)).
  A missing `gallery.yaml` and missing Immich credentials were one and the same
  `needsSetup` flag, and the Immich client returned `null` on that flag before
  ever reaching the network. The admin panel showed the server as disconnected,
  the album pickers refused with "Immich not configured" — so the panel could
  not create the very file it was waiting for — and nothing at all appeared in
  the log. The two faults are now separate: with credentials present, Immich is
  contacted and the admin pickers work, the badge reads "Setup Incomplete" and
  names what is missing, and an unreachable Immich is logged instead of being
  swallowed.

- **The first-run setup token is printed at startup**, not on the first visit to
  `/install`. An operator who set `ADMIN_PASSWORD` and went straight to `/admin`
  never triggered it and found nothing in `docker logs`. The setup screen now
  points at the wizard as well.

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
