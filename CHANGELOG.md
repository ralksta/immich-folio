# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases up to and including v0.9.2 are documented in the
[GitHub releases](https://github.com/ralksta/immich-folio/releases).

## [0.19.1] — 2026-10-01

### Security

- **Next.js 16.3.6** ([#743](https://github.com/ralksta/immich-folio/pull/743)).
  Next.js 16.2.0 to 16.3.5 carry
  [GHSA-vcvr-r3jv-pc5j](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j)
  (critical): the Node.js `ImageResponse` from `next/og` can execute code when
  attacker-controlled values reach the SVG it renders. Folio renders its share
  cards with it in `/api/og`. The title and subtitle there are HMAC-signed by
  the site since v0.19.0 ([#767](https://github.com/ralksta/immich-folio/pull/767)),
  and an unsigned request falls back to the site title, so a visitor could not
  put text of their choosing on the card. Upgrade anyway: the signed values
  include album names from Immich.

### Changed

- Prettier 3.9.9 ([#744](https://github.com/ralksta/immich-folio/pull/744)),
  development only.

## [0.19.0] — 2026-09-29

### Security

- **Photo and video URLs stop working once the photo is no longer on the
  site** ([#737](https://github.com/ralksta/immich-folio/pull/737),
  [#787](https://github.com/ralksta/immich-folio/pull/787),
  [GHSA-gfh4-6275-9gqv](https://github.com/ralksta/immich-folio/security/advisories/GHSA-gfh4-6275-9gqv),
  low). Asset tokens are deterministic and never expire, so a media URL that
  was ever served kept working after its album was unpublished or a client
  proofing link was revoked or expired. `/api/image`, `/api/video` and
  `/api/exif` now answer `404` (`no-store`) for any asset the site does not
  currently show; signed-in admins still pass. The check follows content-file
  changes on the next request, and the first views of a newly published album
  wait for its rebuild instead of being refused. Copies already held by a
  browser or CDN are not recalled.

- **Subpages taken offline with `enabled: false` are unpublished everywhere**
  ([#755](https://github.com/ralksta/immich-folio/pull/755),
  [GHSA-w3wp-6qff-q96p](https://github.com/ralksta/immich-folio/security/advisories/GHSA-w3wp-6qff-q96p),
  medium). An offline subpage keeps its configuration, so its albums stayed on
  the album allowlist: the map still showed them, and the media and download
  routes still served their photos and ZIPs, while the page itself answered 404. The map, the published-asset check and the download checks now consider
  only albums that are standalone or on an enabled subpage. `hidden: true`
  subpages are unchanged: reachable by link, their photos still load.

- **The sitemap no longer lists password-protected journal entries**
  ([#759](https://github.com/ralksta/immich-folio/pull/759),
  [GHSA-7c42-5pgh-xppr](https://github.com/ralksta/immich-folio/security/advisories/GHSA-7c42-5pgh-xppr),
  low). It already left out protected subpages, albums and content pages, but
  filtered journal entries on `draft` alone. It now matches what the journal
  index shows a visitor who has not unlocked the entry.

- **Share cards and page titles carry only text the site wrote**
  ([#767](https://github.com/ralksta/immich-folio/pull/767),
  [#783](https://github.com/ralksta/immich-folio/pull/783)). `/api/og`
  rendered any `title` and `subtitle` from its query string, on the site's
  domain and in its accent colour. Card URLs are now signed with the site
  secret; an unsigned or altered one gets the plain site-title card, so
  previews already cached by social networks keep working. Page metadata no
  longer falls back to the requested path: unknown paths get the not-found
  title and no card of their own, and locked albums and subpages the generic
  protected title with `noindex`.

- **A locked journal entry's title stays off its password gate**
  ([#765](https://github.com/ralksta/immich-folio/pull/765)). The index and
  the page metadata already hid it; the gate itself printed it. It now shows
  the generic journal title, and a subpage that embeds a locked entry through
  `essayFile` shows its own title.

- **Password attempts no longer reveal which pages have a password**
  ([#769](https://github.com/ralksta/immich-folio/pull/769),
  [#785](https://github.com/ralksta/immich-folio/pull/785)). `POST /api/auth`
  answered a key without a password with a different status and message than a
  wrong password, and much faster than a key with an scrypt hash. That gave
  away drafts and offline subpages, which otherwise answer 404. Both cases now
  get the same `401` and run exactly one scrypt verification. Input validation
  and the rate limit are unchanged.

- **ZIP downloads are capped per visitor, and stalled ones are closed**
  ([#774](https://github.com/ralksta/immich-folio/pull/774)). The album and
  proofing ZIP routes limited how often an archive starts, not how long one
  stays open, so a client that read slowly or stopped reading held an Immich
  connection and its buffers for as long as it liked. At most two archives per
  client IP may be open at once, shared between both routes (a third gets
  `429` with `Retry-After: 30`), and an archive whose client takes nothing for
  60 seconds is torn down. A download that keeps reading is never cut off,
  however slowly it reads. See the upgrade notes.

- **The Immich webhook caps its request body before checking the signature**
  ([#780](https://github.com/ralksta/immich-folio/pull/780)). The body was
  read in full, at any size, before the HMAC check. It is now limited to 64
  KiB (`413` above), the signature is computed over the raw bytes, and the
  signature header must be exactly 64 hex characters; a valid digest followed
  by junk was accepted before.

- **The ZIP refusal page's back link stays on the site**
  ([#786](https://github.com/ralksta/immich-folio/pull/786)). A `Referer`
  whose path started with `//` became a protocol-relative link to another
  host; such paths are now rejected. The link compares the `Referer` with the
  `Host` header (and `X-Forwarded-Host` only when `TRUSTED_PROXY_HOPS` is
  set), so behind a reverse proxy it now leads back to the album instead of
  always to `/`.

- **Client proofing tokens are never written to the view statistics**
  ([#748](https://github.com/ralksta/immich-folio/pull/748)). The cookieless
  counter stored every path as visited, and in `/proof/<token>` the token is
  the link's only credential. Those visits are counted as `/proof`.

### Added

- **Client proofing links**
  ([#683](https://github.com/ralksta/immich-folio/pull/683),
  [#758](https://github.com/ralksta/immich-folio/pull/758)). Under the new
  _Proofing_ tab the admin creates a private link, `/proof/<token>`, per
  client and album — any Immich album, published on the site or not — with an
  optional expiry date, an optional ZIP download (the selection or the whole
  album) and an optional download limit. The client hearts photos as on a
  public album; the selection is saved on the server as they go, so they can
  stop and continue later or on another device, and _Submit selection_ locks
  it. The photographer watches the picks come in, reopens a submitted
  selection, resets the download counter or revokes the link, and exports the
  picks as a Lightroom or Capture One filename filter (which finds the RAW as
  well as the JPEG), CSV or TXT. `PROOFING_WEBHOOK_URL` gets one JSON POST on
  the first submit, shaped for Discord, Slack, Gotify and generic receivers.
  Links are stored in `content/proofing.json` (mode `0600`); proof pages are
  `noindex`, send no `Referer` and stay out of the sitemap, and a site
  password still applies. The selection ZIP waits until pending hearts are
  saved, so it never misses the last pick. The anonymous proofing on public
  albums is unchanged. See `docs/gallery-config.md#client-proofing-links`.

- **Custom content pages**
  ([#738](https://github.com/ralksta/immich-folio/pull/738),
  [#760](https://github.com/ralksta/immich-folio/pull/760),
  [#764](https://github.com/ralksta/immich-folio/pull/764), closes
  [#722](https://github.com/ralksta/immich-folio/issues/722)).
  `content/pages/<slug>.md` — frontmatter plus the journal's block markdown —
  is served at `/<slug>` and rendered like a journal entry without date or
  reading time. A `- page: <slug>` line among the subpages in `gallery.yaml`
  puts it in the menu at that position; a page without one is reachable by
  link but not listed. Pages can be drafts (visible to signed-in admins only)
  and can carry a password (cookie `lb_auth_page_<slug>`); public pages appear
  in the sitemap. In the page builder, pages sit in one _Menu_ group with the
  subpages, _+ New page_ derives the slug from the title with a collision
  check, and the content is edited in the journal studio. Renaming or deleting
  a page updates its menu entry, with a backup first; page backups rotate in
  `content/pages/.backups/`. A new doctor check, `content-pages`, reports slug
  collisions and menu entries without a file. A missing or draft page is still
  a soft 404 (status `200`), like other slugs on this route.

- **The asset picker searches the library and picks several photos at once**
  ([#740](https://github.com/ralksta/immich-folio/pull/740),
  [#752](https://github.com/ralksta/immich-folio/pull/752), closes
  [#602](https://github.com/ralksta/immich-folio/issues/602)). A date (`2024`,
  `2024-05`, `2024-05-17`) searches by capture date, any other text by file
  name and Immich description. Tiles are buttons with a numbered badge in pick
  order, and a bar at the bottom offers _Add N photos_. The homepage hero
  takes several at once, _+ Photos_ in the journal and page editor adds one
  photo block per pick, and pairs and grids fill their slots. The search stays
  read-only against Immich.

- **Admin editors detect concurrent edits**
  ([#742](https://github.com/ralksta/immich-folio/pull/742),
  [#757](https://github.com/ralksta/immich-folio/pull/757), closes
  [#601](https://github.com/ralksta/immich-folio/issues/601)). Every editor
  that saves a content file — gallery, settings, About, privacy, journal
  entries and content pages — notices when the file changed since it was
  loaded, in another tab or on another device, by hand or through a backup
  restore. Instead of overwriting it silently, it offers _Reload (discard
  mine)_, _Overwrite anyway_ or _Keep editing_. A save from a tab opened
  before the upgrade still goes through as before. Deletes are not
  version-checked.

- **Settings set by the environment are shown as locked**
  ([#739](https://github.com/ralksta/immich-folio/pull/739), closes
  [#605](https://github.com/ralksta/immich-folio/issues/605)). `sitePassword`
  (overridden by `SITE_PASSWORD`) and `contact.notifyUrl`
  (`CONTACT_NOTIFY_URL`) are disabled in the settings editor with a note
  naming the variable, and a save keeps what `settings.yaml` holds for them.
  `SITE_TITLE`, `SITE_SUBTITLE` and `SITE_URL` are fallbacks, not overrides,
  and stay editable.

- **An accessibility baseline**
  ([#741](https://github.com/ralksta/immich-folio/pull/741), closes
  [#696](https://github.com/ralksta/immich-folio/issues/696)). The hero
  carousel stops auto-advancing under `prefers-reduced-motion` and has a pause
  button, and one reduced-motion rule covers the site, the admin and
  `/install`. Theme toggle, menu button and scroll-to-top are 44×44 px
  targets; EXIF and cover overlays also show on keyboard focus, and always on
  touch screens. The lightbox keeps Tab inside and returns focus to the photo
  shown last, the mobile menu moves focus in and back out, and the admin and
  `/install` have skip links. Photo counts in descriptions and share cards,
  the lightbox position and the _Gallery_ fallback title are translated.
  Header and hero navigation now share one order — Home, subpages and content
  pages in `gallery.yaml` order, standalone albums, Journal, About, Map — with
  external `navLinks` last.

### Changed

- **Less work per request**
  ([#753](https://github.com/ralksta/immich-folio/pull/753),
  [#756](https://github.com/ralksta/immich-folio/pull/756),
  [#749](https://github.com/ralksta/immich-folio/pull/749),
  [#761](https://github.com/ralksta/immich-folio/pull/761),
  [#775](https://github.com/ralksta/immich-folio/pull/775)). The configuration
  is derived once per content-file change instead of on every read (one
  `/api/image` request did it seven times), and the Immich client reads it
  once per operation. Album blocks in journal entries, content pages and
  essays go through the album cache with request coalescing, and a page's
  blocks load in parallel instead of one after another. Parsed journal and
  page listings are kept while their files are unchanged, and the journal and
  site navigation are read once per request. Content edits still show on the
  next request; album blocks now follow `CACHE_TTL` like every other album.

- **One image URL per photo and size tier**
  ([#762](https://github.com/ralksta/immich-folio/pull/762)). The proxy
  answers every width within a tier with the same bytes, but `next/image`
  wrote ten widths into each `srcset` and the lightbox asked for an eleventh
  spelling, so opening a grid photo downloaded the same preview again, and so
  did rotating a phone. Grid, hero, essay and lightbox now request one URL per
  tier, and the unused `q` parameter is gone. An album viewed in full in the
  lightbox transfers each preview once instead of twice, and a CDN sees at
  most one miss per photo and tier. The URLs change once; see the upgrade
  notes.

- **Pages ship less code they do not use**
  ([#770](https://github.com/ralksta/immich-folio/pull/770),
  [#766](https://github.com/ralksta/immich-folio/pull/766)). The proofing UI
  loads only on pages where proofing is on, and Leaflet's stylesheet and map
  wrapper only when an essay contains a map block. Album, subpage and journal
  pages drop 3–5 KB of gzipped JavaScript and 14% of their render-blocking
  CSS.

- **Settings the site would ignore are refused on save**
  ([#795](https://github.com/ralksta/immich-folio/pull/795)). A site URL
  without a scheme, an accent that is not hex, or grid columns and gap outside
  their bounds were saved with a success message and then silently replaced
  when the site rendered. The settings form now marks such fields as you type,
  the save answers `400` naming them and writes nothing, and a new doctor
  check, `settings-values`, reports values already in `settings.yaml` that the
  site ignores.

- **Admin colours: blue accent, amber warnings, readable muted text**
  ([#795](https://github.com/ralksta/immich-folio/pull/795)). Outside Studio
  Modern the admin accent was the same amber as its warnings, so every active
  marker and focus ring read as a warning; it is now blue. The unsaved-changes
  bar and the order editor's drift notice use the warning colour instead of
  the accent (red under Studio Modern), the status badge has its own amber
  tone for doctor warnings, and muted text reaches 4.5:1 on every admin
  surface in every preset.

### Fixed

- **Public pages follow admin saves on the next request**
  ([#790](https://github.com/ralksta/immich-folio/pull/790)). After a save,
  changed album titles, descriptions and slugs, and newly published albums,
  could take up to `CACHE_TTL` (five minutes by default) to appear, and a new
  album answered 404 meanwhile: the save cleared a copy of the Immich cache
  that the public pages never read. The cache now holds only Immich's data and
  applies `gallery.yaml` on the way out, and it is one store per process, so
  _Clear cache_ in Diagnostics, the webhook and the status panel act on the
  cache the pages use. A subpage's cover grid and its albums' previous/next
  links follow the order from `gallery.yaml` and the page builder instead of
  Immich's. See the upgrade notes.

- **Photo captions with parentheses no longer break journal entries**
  ([#788](https://github.com/ralksta/immich-folio/pull/788)). A caption like
  `Summit (560 m)`, or one with a link, ended the photo block at the first
  `)`: the public page rendered the line as a paragraph showing raw asset IDs,
  and the editor turned it into a text block, dropping the photo on the next
  save. Captions now run to the block's last `)`, with no change to the file
  format, and existing entries parse as before. Photo lines without a blank
  line between them or directly under a heading are recognised too, and a link
  URL may hold one level of parentheses.

- **Journal and essay text fields show Markdown, not stored HTML**
  ([#789](https://github.com/ralksta/immich-folio/pull/789)). After a reload,
  text blocks, quotes, captions and fact values showed raw `<strong>` and
  `<a>` tags, and text typed inside a tag could be lost on save. The fields
  now show and take inline Markdown, the live preview renders bold, italics
  and links while you type, and an untouched block saves byte for byte as
  before.

- **Contact messages from devices with a wrong clock are no longer dropped**
  ([#771](https://github.com/ralksta/immich-folio/pull/771)). The fill-time
  check compared the visitor's clock with the server's. A device ten minutes
  fast, or a day slow, made a genuine message look like spam, which is
  discarded silently while the sender sees the thank-you page. The form is now
  stamped with the server's time.

- **Missing pages answer a real 404**
  ([#781](https://github.com/ralksta/immich-folio/pull/781),
  [#772](https://github.com/ralksta/immich-folio/pull/772)). Since 0.18.0, a
  switched-off `/contact`, `/impressum`, `/privacy` or `/map`, or an unknown
  `/journal/<slug>`, could hang for about 30 seconds and fail with `500` when
  the server was bound to `127.0.0.1`, because the proxy's rewrite looped back
  through `localhost`. They now get `404` at once. Paths deeper than two
  segments, such as `/travel/iceland/anything`, rendered the parent subpage or
  album with `200` and its title; they answer `404` as well.

- **_Email to photographer_ addresses the photographer**
  ([#746](https://github.com/ralksta/immich-folio/pull/746) by
  [@lancetm714](https://github.com/lancetm714), follow-up
  [#747](https://github.com/ralksta/immich-folio/pull/747); reported in
  [#736](https://github.com/ralksta/immich-folio/issues/736) by
  [@RichKidsDev](https://github.com/RichKidsDev)). The proofing dialog opened a
  mail with an empty _To:_ line. The recipient is now the footer contact
  email, or the new optional `proofing.email` (Settings → General → _Proofing
  email_); with neither set, the button is hidden. The address stays out of
  the served HTML, as the footer's does.

- **Proofing on public albums counts and filters correctly**
  ([#763](https://github.com/ralksta/immich-folio/pull/763),
  [#773](https://github.com/ralksta/immich-folio/pull/773),
  [#787](https://github.com/ralksta/immich-folio/pull/787)). The selection
  count included favourites stored under the same album key but not in the
  grid — removed photos, or another album with the same name — so the bar
  could read "3 selected" over one heart; only this album's photos count now.
  With the favourites filter on, un-hearting the photo open in the lightbox
  crashed the page when it was the last in the list, and un-hearting the last
  favourite left an empty grid with no way back. The viewer now steps to the
  previous favourite or closes, and an empty filter shows _Show all_.

- **Hidden subpages stay off the map**
  ([#782](https://github.com/ralksta/immich-folio/pull/782)). `hidden: true`
  subpages are reachable by link only and were already left out of the
  sitemap, but `/map` showed markers for albums only they carry — name, link
  and thumbnail — and counted them in its header. Their photos still load for
  anyone with the link. The map header also no longer counts an album on two
  subpages twice.

- **Edits made while an admin save is in flight are kept**
  ([#768](https://github.com/ralksta/immich-folio/pull/768)). Editors marked
  themselves clean when the save answered, so edits typed meanwhile showed as
  saved, were missing from the draft and were lost on leaving; the journal
  editor and the page builder even replaced them with the written copy.
  Editors now compare with what they sent and stay unsaved when there is more
  to save. This covers the journal and page editor, the page builder,
  Settings, About and the privacy policy.

- **Slug fields take hyphens and keep accented letters**
  ([#751](https://github.com/ralksta/immich-folio/pull/751)). The new-page,
  page-URL and new-journal-entry fields stripped a trailing hyphen on every
  keystroke, so `about-us` could only be pasted. Accented letters became
  hyphens (`Über mich` → `ber-mich`); they now fold to the base letter and `ß`
  to `ss`, as subpage slugs already did. Existing slugs do not change.

- **Journal dates show the written day everywhere**
  ([#776](https://github.com/ralksta/immich-folio/pull/776)). On a server west
  of Greenwich a date-only `2026-03-15` showed as 14 March on the index,
  hand-typed dates showed "Invalid Date", and the entry page printed the raw
  frontmatter. Index and entry now format dates the same way, in the site's
  language and without a timezone shift; `YYYY-MM` shows month and year,
  anything else is shown as written. Entries with the same date are ordered by
  slug, so the index and previous/next links no longer depend on the
  filesystem.

- **Password gates and refusal pages**
  ([#786](https://github.com/ralksta/immich-folio/pull/786)). Once the rate
  limit kicked in, the gate said "wrong password" even for the right one and
  cleared the field; it now says how many seconds to wait and keeps the input.
  A locked journal entry has its own gate subtitle instead of the gallery's.
  The ZIP refusal page uses the preset's colours in the site's colour mode
  instead of plain white, and an expired proofing link is titled as expired
  rather than "not found".

- **The lightbox and error messages are readable in light mode**
  ([#792](https://github.com/ralksta/immich-folio/pull/792)). The lightbox
  overlay is dark in both modes, but its close button, arrows, counter and
  focus ring used the page's near-black light-mode text colours, down to
  1.1:1. They now have their own tokens, the round controls get a dark
  translucent fill that stays visible over a white sky, and the favourite
  toggle keeps its colour on hover. A new per-mode `--error` colour brings
  form and gate errors to 4.5:1, and text on accent-filled buttons in the
  proofing dialogs and on Studio Modern's 404 page follows `--on-accent`.

- **No sideways scrolling on phones and tablets**
  ([#791](https://github.com/ralksta/immich-folio/pull/791),
  [#797](https://github.com/ralksta/immich-folio/pull/797)). The footer's name
  and legal links made every Studio Modern page 441px wide on a 390px phone,
  which also pushed the lightbox's close and next buttons off-screen. The
  footer wraps, the header switches to the menu whenever its links do not fit
  in one row (not only below 641px), the map loses a second side gutter and
  its grey bands, and Studio Modern's smaller phone and tablet gutters take
  effect. Long hero, subpage, privacy and album titles wrap or hyphenate
  instead of widening the page, and phone content no longer starts under the
  header.

- **The admin on phones, keyboards and screen readers**
  ([#793](https://github.com/ralksta/immich-folio/pull/793),
  [#794](https://github.com/ralksta/immich-folio/pull/794),
  [#795](https://github.com/ralksta/immich-folio/pull/795)). On a phone the
  subpage sheet was clipped after one screen, hiding its albums and _Delete_;
  it now grows with its content and scrolls into view on tap, and the journal
  list, status dropdown and Story Settings password field fit. The album
  drawer, order editor, Story Settings and new-entry dialog are modal dialogs
  with Escape and a focus trap, Escape closes only the innermost of two open
  dialogs, and album picker rows are buttons reachable from the keyboard. An
  unsaved privacy policy survives switching settings sections, like About. The
  admin is marked `lang="en"`, so a screen reader on a German site no longer
  reads it with a German voice, and the analytics chart shows the last 14
  calendar days, empty ones included.

- **The admin overview no longer crashes on the older map form of
  `subpages:`** in `gallery.yaml`
  ([#754](https://github.com/ralksta/immich-folio/pull/754)).

- **Translations** ([#784](https://github.com/ralksta/immich-folio/pull/784),
  [#777](https://github.com/ralksta/immich-folio/pull/777)). Navigation, next
  and back links and the subpage password gate name a subpage by its `title`
  instead of its `gallery.yaml` key (`south-korea`). The map's zoom buttons
  and Leaflet credit are translated, the share card no longer lowercases its
  subtitle ("25 fotos"), German says "Diashow" throughout, French uses the
  singular for 0, and the proofing mail subject no longer reads "1 items".

### Internal

- **The unit tests no longer write into the checkout's `content/`**
  ([#778](https://github.com/ralksta/immich-folio/pull/778)).
  `journal.test.ts` created and deleted a real journal entry there, which in a
  self-hosted checkout briefly published it and left a
  `test-journey-nordkap.md.<timestamp>.deleted.bak` in
  `content/journal/.backups/`; remove any such file by hand. A setup file now
  fails every test that writes under `content/`.
- **Every public API route must declare whether the site password gates it**
  ([#750](https://github.com/ralksta/immich-folio/pull/750)); a test fails on
  a route that is in neither list.
- **The standalone build no longer traces the whole project**
  ([#796](https://github.com/ralksta/immich-folio/pull/796)), which the config
  memo of [#753](https://github.com/ralksta/immich-folio/pull/753) had caused
  before release.
- Admin screenshots in the README and `docs/journal.md` show the redesigned
  panel ([#735](https://github.com/ralksta/immich-folio/pull/735)).

### Upgrade notes

**Image URLs change once.** Each photo now has one URL per size tier, and the
`q` parameter is gone
([#762](https://github.com/ralksta/immich-folio/pull/762)). Browsers and a CDN
fetch every photo once more after the upgrade, as after an
`IMAGE_CACHE_VERSION` bump. No `IMAGE_CACHE_VERSION` bump is needed this time.

**At most two ZIP downloads run at once per client IP**
([#774](https://github.com/ralksta/immich-folio/pull/774)). Behind a reverse
proxy, `TRUSTED_PROXY_HOPS` must be set correctly; otherwise every visitor has
the proxy's address and all of them share the same two slots.

**Admin saves no longer clear the Immich album cache**
([#790](https://github.com/ralksta/immich-folio/pull/790)). Changes to
`gallery.yaml` and settings show on the next request as before. Changes made
inside Immich — new photos in an album, a renamed album — appear after
`CACHE_TTL`, after _Clear cache_ under Diagnostics, or at once when the Immich
webhook is set up.

**Every password attempt costs one scrypt verification** (about 40 ms),
including attempts on keys that have no password
([#785](https://github.com/ralksta/immich-folio/pull/785)). The auth rate
limit keeps the total small.

**The admin's default accent is blue**
([#795](https://github.com/ralksta/immich-folio/pull/795)); warnings stay
amber. Studio Modern keeps its red accent.

**Paths deeper than two segments answer `404`**
([#781](https://github.com/ralksta/immich-folio/pull/781)), where they used to
render the parent subpage or album. Links of that shape were never generated
by the site.

**Header and hero navigation share one order**
([#741](https://github.com/ralksta/immich-folio/pull/741)): external
`navLinks` from `settings.yaml` now come after About and Map.

**`content/` gains `proofing.json` and `pages/`**, both created on demand, so
a writable `content/` is enough, as before. `/proof` is a fixed route now: a
subpage slugged `proof` is hidden behind it.

**New, optional settings:** `proofing.email` and the `PROOFING_WEBHOOK_URL`
environment variable. See `content/settings.yaml.example`,
`.env.local.example` and `docs/gallery-config.md#client-proofing-links`.

## [0.18.1] — 2026-09-27

### Fixed

- **The admin fits a phone**
  ([#733](https://github.com/ralksta/immich-folio/pull/733), reported in
  [#732](https://github.com/ralksta/immich-folio/issues/732) by
  [@RichKidsDev](https://github.com/RichKidsDev)). Below 860px the sidebar
  unfolded above the content — navigation, status and four actions — and
  filled most of an iPhone screen. It is now a header row with the brand and
  a menu button; the menu opens as one column of full-width rows and closes
  again on navigation, and an unread message shows as a dot on the button.
  Desktop is unchanged.

- **The settings editor refuses prototype keys in a setting's path**
  ([#731](https://github.com/ralksta/immich-folio/pull/731)). All paths are
  written in the code, so this was not reachable; CodeQL flagged the setter
  after the v0.18.0 release.

## [0.18.0] — 2026-09-27

### Security

- **Journal drafts and password-protected entries no longer render publicly
  as a subpage essay**
  ([#684](https://github.com/ralksta/immich-folio/pull/684),
  [GHSA-987w-cpwm-c9g9](https://github.com/ralksta/immich-folio/security/advisories/GHSA-987w-cpwm-c9g9),
  medium). A subpage's `essayFile` read the journal entry straight from disk,
  skipping the draft and password rules `/journal/<slug>` applies. It now
  resolves through the same rules: a draft reads as missing for visitors, and
  a protected entry shows its password gate, sharing the
  `lb_auth_journal_<slug>` cookie.

- **Immich descriptions are escaped in generated subpage essays**
  ([#684](https://github.com/ralksta/immich-folio/pull/684),
  [GHSA-8ppx-39jv-q5xm](https://github.com/ralksta/immich-folio/security/advisories/GHSA-8ppx-39jv-q5xm),
  low). The essay built from a subpage's albums (`layout: essay` without
  markdown) put each asset's Immich description into the page as raw HTML.
  Captions are now HTML-escaped, and they go through `assetCaption()`, so
  `exif.caption: false` is respected there as well. Tracked in
  [#689](https://github.com/ralksta/immich-folio/issues/689).

- **Admin drafts no longer keep a typed password, and the contact form's
  email check runs in linear time**
  ([#727](https://github.com/ralksta/immich-folio/pull/727)). The admin's
  session drafts wrote a password as typed to `sessionStorage`; a draft
  holding a plaintext password is now not kept (the unsaved-changes guard
  still warns). The email pattern could backtrack polynomially on a crafted
  domain; its labels now exclude the dot and the length is checked first.
  Both found by CodeQL before release.

### Added

- **A built-in contact form with an inbox in the admin**
  ([#703](https://github.com/ralksta/immich-folio/pull/703), closes
  [#702](https://github.com/ralksta/immich-folio/issues/702)). `/contact`
  needs neither SMTP nor a form service: each message is one file in
  `content/messages/` (mode `0600`), read under the new _Messages_ tab, where
  _Reply by email_ opens the owner's mail client with the message quoted.
  Messages older than `contact.retentionDays` (default 90) are deleted. An
  optional ntfy push goes to `contact.notifyUrl` or `CONTACT_NOTIFY_URL`, and
  since [#709](https://github.com/ralksta/immich-folio/pull/709) it carries a
  fixed "new message" line and nothing about the sender — no name, no
  address, no text. Spam is kept out without a captcha: an off-screen
  honeypot, a minimum fill time, three submissions a minute per IP and a cap
  of 500 stored messages. With the Impressum on and no `legal.contactUrl`,
  the Impressum links the form as its second contact channel. A new doctor
  check warns when the form is on but nobody is notified.

- **A privacy policy page, next to a list of what the site processes**
  ([#708](https://github.com/ralksta/immich-folio/pull/708)). `/privacy`
  renders `content/privacy.md`, edited under Settings → Legal, and the footer
  links it once the file has text; `privacy.enabled: false` hides it. Folio
  writes no legal text. Beside the editor it lists what _this_ installation
  does, read off the configuration — the map, statistics, contact form,
  password cookies, CDN — and marks every entry that involves a third party.
  _Insert headings_ adds the matching section headings and nothing else. The
  doctor warns while the Impressum is on and there is no policy.

- **French, Spanish, Italian and Dutch interface translations**
  ([#681](https://github.com/ralksta/immich-folio/pull/681)), selected with
  `settings.yaml: lang` as before. The admin panel stays English.

- **CDN mode for photos and videos**
  ([#681](https://github.com/ralksta/immich-folio/pull/681)). With `CDN_URL`
  set, image and video URLs point at a pull CDN whose origin is this server,
  so repeat views reach neither the server nor Immich. A site password
  switches the mode off, since a CDN would hand out cached photos without
  checking the unlock cookie. The CDN origin is added to the CSP, and a
  doctor check covers the password and `TRUSTED_PROXY_HOPS` cases. See
  `docs/deployment.md#cdn-mode`.

- **A reworked admin panel**
  ([#712](https://github.com/ralksta/immich-folio/pull/712),
  [#713](https://github.com/ralksta/immich-folio/pull/713),
  [#714](https://github.com/ralksta/immich-folio/pull/714),
  [#716](https://github.com/ralksta/immich-folio/pull/716),
  [#717](https://github.com/ralksta/immich-folio/pull/717),
  [#718](https://github.com/ralksta/immich-folio/pull/718),
  [#719](https://github.com/ralksta/immich-folio/pull/719),
  [#721](https://github.com/ralksta/immich-folio/pull/721)):
  - **A sidebar instead of the header row**, grouped by task, with an unread
    count on Messages and a dot on Diagnostics while Immich is down. It
    collapses to an icon rail, with names shown on hover and focus, and
    remembers that per browser.
  - **`/admin` is an overview**: what needs attention (unread messages,
    doctor warnings), published pages, journal entries and recent views.
  - **The site's own visual language** — the preset's fonts, hairline
    borders, the square marker — and one page header on every screen. The
    accent is kept for the current place and the primary action; switches
    are now pills reading ON or OFF, in green rather than the accent, so
    Studio Modern's red no longer makes an enabled setting look like an
    error.
  - **The page builder is a structure list and a panel.** Hero, subpages and
    standalone albums sit in one list on the left, subpages drag-sorted in
    place; the selected entry is edited on the right instead of in an
    overlay.
  - **Dialogs only where a change is permanent.** Deleting a message or a
    journal entry, and resetting the favicon (which used to delete the file
    without asking), go through one confirm dialog in the admin's own look.
    Removals in the page builder, which only touch unsaved state, happen at
    once and offer _Undo_. No `window.confirm()` is left.
  - **Feature switches are grouped by meaning** as one-line rows under
    Settings → General; page transitions and scroll-to-top moved to Theme →
    Look & motion. No setting keys changed.

### Changed

- **Fonts and the Leaflet stylesheet are served from the site itself**
  ([#700](https://github.com/ralksta/immich-folio/pull/700)). Every page used
  to link `fonts.googleapis.com`, which sends each visitor's IP address to
  Google. The server now fetches a theme's Google fonts once, rewrites the
  stylesheet and caches the files in `content/.fonts/`; custom fonts in
  `theme.fonts` keep working. If Google cannot be reached before a font is
  cached, the page falls back to the theme's system fonts. `leaflet.css`
  comes from the npm package instead of unpkg. The CSP drops
  `fonts.googleapis.com`, `fonts.gstatic.com` and `unpkg.com`.

- **Email addresses are kept out of the served HTML**
  ([#705](https://github.com/ralksta/immich-folio/pull/705)). The Impressum
  and footer render the address only after hydration, from an encoded form,
  so harvesters reading raw HTML find nothing. Without JavaScript the
  Impressum shows `name [at] example [dot] de`. This defeats bulk harvesting,
  not a person with a browser.

- **The Impressum cites § 5 DDG and links its contacts**
  ([#698](https://github.com/ralksta/immich-folio/pull/698), reported in
  [#697](https://github.com/ralksta/immich-folio/issues/697) by
  [@RichKidsDev](https://github.com/RichKidsDev)). The TMG was replaced by the
  DDG in May 2024; `legal.heading` replaces the line for other laws (e.g.
  § 5 ECG in Austria). `legal.contactUrl` and `legal.contactLabel` add a
  contact form as the second channel, so a phone number stays optional.
  Email, phone and contact URL are now links, and the "Created with the
  Impressum generator by eRecht24" line, shown on every site whether true or
  not, is gone. Settings → Legal gains fields for heading, contact URL, VAT
  ID and tax number, and a doctor check flags missing details.

- **Missing pages answer `404`**
  ([#704](https://github.com/ralksta/immich-folio/pull/704)). Every missing
  page used to answer `200`, because streaming had started before
  `notFound()` ran. `/contact`, `/impressum`, `/map` and `/privacy` while
  switched off, and `/journal/<slug>` without an entry, now return a real
  404 with the same not-found page. Album and subpage slugs still depend on
  Immich and stay soft 404s.

- **Passwords set in the admin are stored as scrypt hashes**
  ([#706](https://github.com/ralksta/immich-folio/pull/706), closes
  [#690](https://github.com/ralksta/immich-folio/issues/690)). Subpage,
  album, journal-entry and site passwords were written as typed. The save
  routes now hash them; a stored hash reads _Protected_ with _Change_ and
  _Remove_ and is never put into an input. Visitors who unlocked a page stay
  signed in across unrelated saves. Existing plaintext passwords are hashed
  the next time their file is saved in the admin.

- **One notification surface in the admin**
  ([#707](https://github.com/ralksta/immich-folio/pull/707)) replaces every
  `alert()`: errors stay until dismissed, successes clear themselves, and
  screen readers announce both.

### Fixed

- **Map tiles load again**
  ([#701](https://github.com/ralksta/immich-folio/pull/701)). CARTO started
  answering every tile with an "API KEY REQUIRED" image, leaving `/map` and
  journal map blocks as a grey grid. Tiles now come from OpenStreetMap; the
  dark look is a CSS filter, so the map now follows the colour mode.

- **The page builder no longer drops a subpage's `proofing:` flag on save**
  ([#711](https://github.com/ralksta/immich-folio/pull/711)). A page switched
  off for proofing by hand reverted after any unrelated edit.

- **Unsaved edits in Settings and About survive switching admin tabs, and a
  backup restore is no longer overwritten by the next save**
  ([#687](https://github.com/ralksta/immich-folio/pull/687)). Editors that
  were open during a restore now reload and offer unsaved edits back as a
  conflict. Also: "Restore my changes" after a conflict found nothing,
  removing an album left its drawer showing the next album, and the journal
  saved (rotating a backup) without changes.

- **Accent-backed buttons stay readable with a light or malformed accent**
  ([#724](https://github.com/ralksta/immich-folio/pull/724), supersedes
  [#680](https://github.com/ralksta/immich-folio/pull/680)) — contributed by
  [@lancetm714](https://github.com/lancetm714). A white accent made the
  proofing dialog's _Download selected (.zip)_ button white on white.
  `theme.accent` is now accepted as hex only and normalised to `#rrggbb`,
  anything else falls back to the preset, and the proofing dialog and filter
  pills use the mode-aware `--on-accent` text colour from #688.

- **Every preset's accent is visible in both colour modes**
  ([#688](https://github.com/ralksta/immich-folio/pull/688)). Presets had one
  accent for both modes; minimal's dark mode drew black buttons on black.
  Presets now carry a light and a dark accent, and text on accent-filled
  buttons picks black or white for contrast. A custom accent stays the
  owner's choice in both modes.

- **Visitor-side inconsistencies**
  ([#685](https://github.com/ralksta/immich-folio/pull/685)): after visiting
  `/impressum`, every subpage header turned centred and uppercase; back links
  announced "Back to Back to …"; the hero EXIF chip ignored
  `exif.location`/`camera`/`settings`; videos in journal entries opened as
  stills; the setup screen named a non-existent `.env.example`.

- **An essay's lightbox walks only the photos the story shows**
  ([#686](https://github.com/ralksta/immich-folio/pull/686)), not every photo
  of the subpage's albums, and the proofing bar in essays shows the selection
  count instead of a filter button that did nothing.

- **The page panel scrolls with the mouse wheel**
  ([#720](https://github.com/ralksta/immich-folio/pull/720)).

- **The journal editor's top bar wraps on phones**
  ([#723](https://github.com/ralksta/immich-folio/pull/723), closes
  [#675](https://github.com/ralksta/immich-folio/issues/675)), so the title
  stays editable and Save stays on screen.

- **Every admin form field has a name for assistive technology**
  ([#715](https://github.com/ralksta/immich-folio/pull/715)). Only two inputs
  had a linked label; 47 are linked now, and clicking a label focuses its
  field.

### Internal

- **`SettingsEditor` and `PageBuilder` are split up**
  ([#710](https://github.com/ralksta/immich-folio/pull/710),
  [#711](https://github.com/ralksta/immich-folio/pull/711)). The 2,200-line
  settings editor is a shell with one file per section; the page builder's
  YAML handling and edits are pure functions under test. Both were checked
  side by side against `dev` for identical output.
- **`useAdminFetch()`** ([#707](https://github.com/ralksta/immich-folio/pull/707))
  gives Analytics, Messages, Backups and the journal list one loading and
  error pattern.
- README brought up to v0.17.0
  ([#678](https://github.com/ralksta/immich-folio/pull/678),
  [#679](https://github.com/ralksta/immich-folio/pull/679)).

### Upgrade notes

**`content/` gains two directories the app writes to:** `content/.fonts/`
for the cached fonts and `content/messages/` for contact-form messages. Both
are created on demand, so a writable `content/` is enough, as before.

**The server needs outbound HTTPS to Google once per font** to fill the font
cache. Until then pages fall back to the theme's system fonts. Visitors'
browsers no longer contact Google.

**A custom CSP or reverse-proxy allowlist** must now allow
`tile.openstreetmap.org` for images instead of `*.basemaps.cartocdn.com`,
and no longer needs `fonts.googleapis.com`, `fonts.gstatic.com` or
`unpkg.com`. The built-in CSP is updated.

**`theme.accent` must be hex** (`#rgb`, `#rrggbb` or `#rrggbbaa`). Anything
else, including a value without `#`, falls back to the preset's accent.

**Plaintext passwords in `gallery.yaml`, `settings.yaml` or journal entries**
are hashed the next time that file is saved in the admin; one save clears the
doctor's warning.

**New, optional settings:** `contact.*` (the form is off by default),
`privacy.enabled`, `legal.heading`, `legal.contactUrl`, `legal.contactLabel`,
and the `CDN_URL` and `CONTACT_NOTIFY_URL` environment variables. See
`content/settings.yaml.example` and `.env.local.example`. In the example file,
`vatId` and `taxId` had swapped sample values; check yours if you copied
them.

No `IMAGE_CACHE_VERSION` bump is needed this time.

## [0.17.0] — 2026-09-23

### Added

- **Download an album, or a proofing selection, as a ZIP of the originals**
  ([#561](https://github.com/ralksta/immich-folio/pull/561),
  [#665](https://github.com/ralksta/immich-folio/pull/665)) — contributed by
  [@lancetm714](https://github.com/lancetm714). An album with
  `download: true` — now also a switch in the admin album editor, _Allow
  original downloads_ — shows a _Download album_ link in its header, and the
  proofing dialog gains _Download selected (.zip)_. The archive streams one
  original at a time, uncompressed, so memory stays flat however large the
  album is, and a cancelled download stops pulling from Immich. The route
  re-checks everything the single-file download does — the allowlist, the
  `download` opt-in, every password gate on the way to the album — and a
  selection may name only assets of that album, each once, at most 1,000.
  Downloads are limited to five a minute per visitor; a refusal answers a
  browser with a short page in the site's language that links back to the
  album, instead of raw JSON.

- **Journal entries can start from a template**
  ([#662](https://github.com/ralksta/immich-folio/pull/662)). Besides a blank
  entry, the _New Journal Entry_ dialog offers eight structures: Wedding,
  Hiking / Outdoor, Travel, Birthday / Family, Portrait Session, Behind the
  Scenes, Pets and New Series.

- **Four new journal blocks, and drag-and-drop ordering**
  ([#663](https://github.com/ralksta/immich-folio/pull/663)):
  - **Photo grid** — three or more photos in rows of three, at their real
    proportions. A third photo used to be dropped silently on the next save.
  - **Facts** — label/value pairs, rendered as a definition list.
  - **Map** — the pins the author lists: typed coordinates, a photo placed by
    its GPS, or every geotagged photo of the entry, optionally joined by a
    line. Photo pins follow the album's location precision, and `exact` is
    rounded to a 1 km grid. Only the pins reach the browser, never asset ids.
  - **Album** — a slice of an album (`count`, `skip`, laid out as a grid, in
    pairs or one per row), expanded into ordinary photos before rendering.

  The Journal Studio and the page builder's essay editor both get the new
  blocks, and every block card can be dragged by its grip; the arrow buttons
  stay for the keyboard. The templates use the new blocks.

### Fixed

- **Admin login and gallery passwords work over plain HTTP**
  ([#666](https://github.com/ralksta/immich-folio/pull/666), reported in
  [#664](https://github.com/ralksta/immich-folio/issues/664) by
  [@majandres](https://github.com/majandres)). Login cookies were marked
  `Secure` whenever the app ran in production mode, which the Docker image
  always does, and a browser silently drops a `Secure` cookie set over
  `http://`. An instance opened at `http://host:7211` accepted the password
  and answered every following request with 401. The flag now follows the
  request: HTTPS, or `X-Forwarded-Proto: https` from a reverse proxy.

- **Unsaved edits in the page builder and the journal editor survive leaving
  the page** ([#668](https://github.com/ralksta/immich-folio/pull/668)).
  Switching admin tabs, pressing back, reloading or logging out used to
  discard them without a word. Each editor now keeps a draft for the browser
  tab and restores it on return, with a notice and a _Discard changes_
  button. If the file was saved elsewhere in the meantime, the draft is held
  back and the editor asks before restoring it over the newer version.

- **Favourites are kept per album**
  ([#561](https://github.com/ralksta/immich-folio/pull/561)). Every album
  shared one selection, so hearts set in one album showed up in the next.
  See the upgrade notes.

- **The proofing dialog's copy buttons work without a clipboard**
  ([#672](https://github.com/ralksta/immich-folio/pull/672)). Browsers offer
  the clipboard only on HTTPS, so on a site reached over plain HTTP _Copy
  shareable link_ and _Copy text list_ did nothing. They now show the link or
  the list, selected, in a field to copy by hand — as the image viewer
  already did for its photo link.

- **English leftovers on translated sites**
  ([#673](https://github.com/ralksta/immich-folio/pull/673),
  [#674](https://github.com/ralksta/immich-folio/pull/674)): the back link of
  an album inside a subpage read "Back to …", and screen readers heard
  English labels on photo tiles and footer links.

### Internal

- **The journal editor is split up**
  ([#669](https://github.com/ralksta/immich-folio/pull/669),
  [#670](https://github.com/ralksta/immich-folio/pull/670)). The 2,000-line
  `JournalStudio.tsx` is now the entry list and an editor of about 600
  lines, with the block forms, story settings, live preview, split pane and
  block operations in files of their own and the extracted logic under test.
  Screenshots before and after are pixel-identical.
- **`next dev` over the LAN**
  ([#671](https://github.com/ralksta/immich-folio/pull/671)): the hostnames
  allowed to load dev assets come from `ALLOWED_DEV_ORIGINS` in `.env.local`
  instead of the config file.
- Prettier 3.9.8 ([#625](https://github.com/ralksta/immich-folio/pull/625),
  [#667](https://github.com/ralksta/immich-folio/pull/667)).

### Upgrade notes

**Visitors' favourites from before this release are not carried over.** They
were stored under one key shared by every album; each album now has its own,
and the old key is no longer read. A selection in progress has to be made
again. A shared proofing link still restores the selection it carries.

**Behind a reverse proxy, make sure it sends `X-Forwarded-Proto`**, so login
cookies stay `Secure` on HTTPS. Caddy and Traefik send it on their own; nginx
needs `proxy_set_header X-Forwarded-Proto $scheme;`, as in the documented
config. Plain-HTTP setups need nothing — logins simply work now.

**Running from source:** run `npm install` after pulling — the ZIP download
adds the `archiver` dependency. Docker images include it.

No `IMAGE_CACHE_VERSION` bump is needed this time.

## [0.16.0] — 2026-09-22

### Security

- **The image proxy no longer serves un-downsampled originals**
  ([#653](https://github.com/ralksta/immich-folio/pull/653),
  [GHSA-36m4-p39x-9wx8](https://github.com/ralksta/immich-folio/security/advisories/GHSA-36m4-p39x-9wx8)).
  `resolveImageSize()` could resolve to the original tier from a single
  request parameter. `/api/image` treats the opaque asset token as its whole
  capability check — holding one means you saw the page it was rendered on,
  which is the right bar for a preview but not for the un-downsampled file.
  `resolveImageSize()` now caps its result at `preview` regardless of what
  `?size=` or `?w=` ask for; a small width still narrows to `thumbnail` as
  before. Originals remain available only through `/api/download`, which
  verifies the album allowlist, the album's `download: true` opt-in, and
  every password gate on the way. **See the upgrade notes: this needs an
  `IMAGE_CACHE_VERSION` bump to reach browsers that already cached an
  original under the old response.**

- **Password-protected journal entries and albums no longer leak outside
  their own gate**
  ([#654](https://github.com/ralksta/immich-folio/pull/654),
  [GHSA-fvgv-97g3-wjr7](https://github.com/ralksta/immich-folio/security/advisories/GHSA-fvgv-97g3-wjr7)).
  A journal entry's `password:` only ever gated the body of
  `/journal/<slug>`. Three other surfaces handed out its content regardless,
  and the same class of bug reached album and subpage metadata: the public
  journal index listed a protected entry's title, subtitle, cover image and
  excerpt to everyone; `generateMetadata` for a journal entry, album or
  subpage ran ahead of the page's own gate, so a locked page's real title,
  photo count and cover image reached `<head>` of a 200 response nobody had
  authenticated for — including a shared `?photo=` link's Open Graph image,
  which named the exact photo; and the journal detail page spread an entry's
  whole frontmatter into the essay renderer's props, so the stored password
  (plaintext or a scrypt hash) rode along in the RSC payload of anyone who
  had unlocked the entry once. All three now run the same
  `isProtected`/`isAuthenticated` checks the page body already used.

- **Every route to an album now enforces its subpage's and its own
  password**
  ([#638](https://github.com/ralksta/immich-folio/pull/638),
  [GHSA-g85g-xcqc-f59h](https://github.com/ralksta/immich-folio/security/advisories/GHSA-g85g-xcqc-f59h),
  [GHSA-jhmx-5j9c-qg42](https://github.com/ralksta/immich-folio/security/advisories/GHSA-jhmx-5j9c-qg42)).
  Two related fixes from the v0.16.0 audit. `getAlbumBySlug()` now searches
  only the albums reachable from the route the slug arrived on — standalone
  albums for a top-level slug, a subpage's own albums otherwise, nothing for
  a disabled subpage — so an album listed only inside a subpage no longer
  answers at the bare `/<album-slug>`, bypassing that subpage's gate.
  Separately, every exclusion in the proxy's route matcher now ends on a
  segment boundary, closing a gap where a path merely _starting with_ an
  excluded name skipped the site password and CSP entirely.

- **Hardening: cache-bypass, analytics, rate limiting, file permissions**
  ([#655](https://github.com/ralksta/immich-folio/pull/655),
  [GHSA-w293-x8pc-j4cv](https://github.com/ralksta/immich-folio/security/advisories/GHSA-w293-x8pc-j4cv)).
  Four lower-severity findings from the same audit:
  - The unauthenticated `?fresh=1`/`?preview=true` cache-bypass flags are now
    gated to `isAdminAuthenticated()`, and a forced refresh no longer evicts
    the existing cache entry before the refetch succeeds — a request timed
    during an Immich outage could otherwise wipe out the stale fallback that
    was keeping the page up for everyone else.
  - `POST /api/analytics/track` gained a rate limit (60 rpm per IP), a cap on
    distinct page keys tracked per day, and writes through the same atomic
    writer as everything else — it previously used a plain `fs.writeFile`
    with an unbounded, request-supplied key space.
  - The rate limiter was a fixed window, not the sliding window it
    documented: a burst timed around the window boundary could clear close
    to double the configured limit. It is now a weighted two-bucket window,
    shared by every rate-limited route.
  - `install.json`, which holds the Immich API key and `authSecret`, was
    briefly world-readable between being written and a follow-up `chmod`.
    `atomicWrite` now accepts a file mode applied before the rename, so the
    file is never created with the wrong permissions.

- **Journal backup paths hardened against a CodeQL path-injection alert**
  ([#586](https://github.com/ralksta/immich-folio/pull/586)). Not
  exploitable — the slug reaching `snapshotEntry` had already passed
  `isValidSlug` or the anchored backup-name pattern in every caller — but
  CodeQL could not follow that validation across modules. The backup path
  is now built through the same `containedPath()` guard every other path in
  the file already used, so a path that would escape `.backups/` throws
  instead of being trusted.

### Added

- **Diagnostics is a tab in the admin header, and its duplicate entry
  points are gone**
  ([#621](https://github.com/ralksta/immich-folio/pull/621),
  [#656](https://github.com/ralksta/immich-folio/pull/656)). `/admin` and
  `/admin/pages` used to render the same page builder under two addresses;
  `/admin` now redirects to the one the Pages tab actually links to.
  Diagnostics, a real page since v0.15.0, was reachable only from the
  status dropdown and the Help page — it is now a tab of its own, and the
  now-redundant Backups/Diagnostics buttons in the status dropdown are
  gone (Backups keeps its header button).

- **Journal entries get previous/next navigation, subpages get a "next
  subpage" link, and both — plus `/about` — get a way back**
  ([#658](https://github.com/ralksta/immich-folio/pull/658)). At the end of
  a journal entry, at the bottom of a subpage's album grid, and on the About
  page, there was previously no way onward or back except the browser's own
  button. Journal prev/next mirrors the existing album navigation: neighbours
  come from the same publication-order list the journal index renders, with
  no wrap-around, and a draft or a password-protected entry the visitor
  hasn't unlocked never appears here even by name. The "next subpage" link
  follows the same order the header navigation and homepage already use, so
  it never points somewhere hidden or disabled.

- **A proper mobile menu for the public header**
  ([#659](https://github.com/ralksta/immich-folio/pull/659)). The header
  used to be one flat row that scrolled sideways on narrow viewports with
  the scrollbar hidden — nothing indicated that more sections existed
  off-screen, so the site appeared to have fewer than it does. Below a new
  640px breakpoint, a hamburger button opens the same links (never
  duplicated in the markup) as a full-width vertical panel; above it, the
  layout is pixel-identical to before.

- **`settings.yaml` is validated before it is written**
  ([#623](https://github.com/ralksta/immich-folio/pull/623)).
  `PUT /api/admin/settings` used to cast the request body and write it
  straight through — the only admin save path with no shape check at all,
  and one that is read by every public page. A zod schema now checks
  structure (a scalar where a section belongs, a list where a record
  belongs), while value narrowing stays where the resolvers already do it,
  since only they also see hand-edited YAML.

### Fixed

- **Config values reach the page they render on, no longer silently
  discarded**
  ([#645](https://github.com/ralksta/immich-folio/pull/645),
  [#618](https://github.com/ralksta/immich-folio/pull/618)). The admin
  panel rewrites `gallery.yaml`/`settings.yaml` wholesale on every save, so
  a field the panel doesn't know about isn't merely ignored — it's deleted.
  This hit an album's `location` precision and `download` opt-in (any
  unrelated save in the panel silently reset both to their defaults) and,
  separately, unclamped `grid.columns`/`theme.radius` values that could
  reach CSS as an invalid `repeat()` or a concatenated `8pxpx`.

- **The Immich client no longer serves a cached "not found" as real data
  during an outage**
  ([#624](https://github.com/ralksta/immich-folio/pull/624)). Splitting
  transport and cache-policy concerns out of the 835-line client surfaced a
  real bug in the process: once a definitive-404 cache entry's TTL passed
  during an Immich outage, it came back as a truthy sentinel object with no
  fields, every `if (!asset)` guard passed on it, and the page answered 500
  for the length of the outage instead of falling back to the last known
  album. A stale "missing" now resolves to `null` — the answer every caller
  already handled — while every other stale-cache path still throws and
  lets the outage propagate correctly.

- **A never-checked expired admin session no longer fails silently**
  ([#650](https://github.com/ralksta/immich-folio/pull/650)). Admin
  sessions last 24 hours, but nothing re-checked one after the initial page
  load — a tab left open overnight looked logged in while every save quietly
  answered 401. A 401 from any admin save or reload now drops back to the
  login screen with a notice instead of a confusing generic error or, for
  the reload button, no feedback at all.

- **Saving no longer overwrites a configuration that failed to load**
  ([#619](https://github.com/ralksta/immich-folio/pull/619)). Each admin
  editor holds the whole file in memory and writes all of it back — so a
  load that quietly failed left an empty form indistinguishable from a
  freshly-configured site, and saving replaced the real file with that
  emptiness. A failed load now replaces the form with a notice and refuses
  to save, including against the keyboard shortcut, until a fresh load
  succeeds.

- **Removing an album, hero image or section entry now asks first**
  ([#649](https://github.com/ralksta/immich-folio/pull/649)). Removing a
  subpage already asked for confirmation; removing an album — which also
  discards its grid overrides, cover asset and manual photo order — did
  not, with no undo besides reloading the page and losing every other
  unsaved edit.

- **The active nav link actually shows which page you're on**
  ([#620](https://github.com/ralksta/immich-folio/pull/620)). The
  `.active` styling and its underline existed in the CSS since the header
  was written, but nothing ever applied the class, and `aria-current` was
  missing outright. Both the public header and the admin panel's own tabs
  now derive and announce the active section.

- **Pre-restore backups no longer crowd out ordinary ones**
  ([#617](https://github.com/ralksta/immich-folio/pull/617)). Pre-restore
  snapshots were exempt from the ten-backup cap entirely, so after a dozen
  restores the backup manager showed almost nothing else. Each kind is now
  counted and capped separately, and pruning also runs on restore rather
  than waiting for the next save.

- **A failed backup now aborts the save instead of continuing without
  one**
  ([#641](https://github.com/ralksta/immich-folio/pull/641)). Restoring a
  backup used a plain `fs.copyFile`, which truncates the live file before
  writing, and its own pre-restore safety copy swallowed every error as "the
  file probably doesn't exist yet." On a full content volume this could
  truncate `gallery.yaml` to zero bytes with no snapshot to recover from.
  Restores now write through the same atomic (temp-file-plus-rename)
  primitive as every other save, and only `ENOENT` is treated as "nothing to
  back up" — any other failure aborts before the live file is touched. The
  same swallow-everything shape existed in the ordinary save path for
  `gallery.yaml`, `settings.yaml`, journal entries and `about.md`, and got
  the same fix.

- **Editing a journal entry that came from the legacy `essays/` folder no
  longer resurrects its old version**
  ([#639](https://github.com/ralksta/immich-folio/pull/639)). Saving always
  wrote to `content/journal/`, but a legacy entry kept its original copy in
  `content/essays/` too, and deleting only ever removed the new copy — so a
  "deleted" entry reappeared with its pre-edit text and frontmatter on the
  next request. Saving a legacy-origin entry now retires its old copy, and
  deletion checks both locations directly.

- **The journal serializer no longer mangles what it just parsed**
  ([#640](https://github.com/ralksta/immich-folio/pull/640)). Re-saving an
  entry — including a bare frontmatter edit, which re-serializes the whole
  document — dropped every link in a paragraph, left literal HTML tags in
  quotes and photo captions, doubled HTML-entity-encoded apostrophes in
  photo-pair captions, and turned `my_photo_2024.jpg` into
  `my*photo*2024.jpg`. The serializer now walks the exact markup the
  renderer produces instead of stripping tags with a flat regex, and
  emphasis markers now require CommonMark's non-word boundary on both
  sides.

- **The setup wizard no longer overwrites an existing `gallery.yaml`**
  ([#642](https://github.com/ralksta/immich-folio/pull/642)). The wizard
  already protected `settings.yaml` from being silently replaced, five
  lines above the identical unconditional overwrite of `gallery.yaml` — and
  unlike the admin panel's own writes, this path kept no backup. A site
  could reach the wizard again through a resolvable-but-wrong Immich URL or
  a corrupted `install.json`, at which point every subpage, password and
  per-album override was gone with nothing recoverable on disk. Both files
  now get the same "keep if it already exists" treatment; the wizard tells
  the operator when that happened.

- **`npm run doctor` no longer passes two broken deployments**
  ([#643](https://github.com/ralksta/immich-folio/pull/643)). A
  `TRUSTED_PROXY_HOPS` value lower than the observed proxy chain (but above
  zero) fell through to the "matches the observed chain" success case
  instead of warning. Separately, the album-configuration check only ran
  when Immich's response was non-empty — so an API key pointed at the wrong
  Immich account, answering `200 []`, passed every check while every
  configured album page was actually empty.

- **Two subpages, or two albums on the same page, can no longer share a
  slug silently**
  ([#644](https://github.com/ralksta/immich-folio/pull/644)). Subpage and
  album slugs are derived from their names with no uniqueness check, and
  `slugify` folds diacritics and punctuation readily enough that distinct
  names collide (`Portfolio 2024` and `Portfolio-2024` both become
  `portfolio-2024`). The second entry became unreachable, and its password
  and other settings silently resolved from the first. Colliding subpage
  names, and colliding album title overrides on the same page, are now
  rejected at save time with both names in the error; a collision that only
  becomes visible once Immich's own album names are known surfaces as a new
  diagnostics finding instead.

- **A trailing slash on the Immich URL no longer breaks every request
  after setup**
  ([#646](https://github.com/ralksta/immich-folio/pull/646)). The install
  wizard's connection test normalised the URL before pinging it, but stored
  the raw input — so `https://immich.example.com/api/` passed the wizard
  and then sent every later request to a doubled `/api/api/` path. The
  stored value is now normalised the same way at both write and read time,
  so an `install.json` written before this fix heals without re-running the
  wizard.

- **Coordinates of exactly 0 no longer vanish from the map, and error
  responses no longer leak sockets**
  ([#647](https://github.com/ralksta/immich-folio/pull/647)). The map's
  coordinate check used plain falsiness, so a photo on the equator or the
  prime meridian was treated as having no location at all. Separately,
  several Immich-facing error paths never read or cancelled the upstream
  response body before returning — under a sustained upstream fault this
  slowly exhausts the connection pool.

- **A shared photo link survives reordering or deleting other photos in
  the album**
  ([#651](https://github.com/ralksta/immich-folio/pull/651)). The lightbox
  addressed a photo by its position in the album (`#photo-N`); reordering or
  deleting a photo silently repointed every previously shared link at a
  different image. Links now address the photo by its stable asset id via
  `?photo=<token>`, which also means a shared link's Open Graph preview can
  show the actual photo instead of a generic card. Links shared before this
  change keep working — the old `#photo-N` format is still read as a
  fallback.

### Internal

- **One `withAdmin()` wrapper instead of the same guard copied into 24
  route handlers**
  ([#615](https://github.com/ralksta/immich-folio/pull/615)). The
  enabled-check-plus-auth-check pattern was hand-copied across 16 admin
  route files; a new route protected by nobody used to be a diff that
  looked completely ordinary. A structural test now rejects any admin
  handler exported outside the wrapper.
- **One atomic-write primitive instead of six independently-drifted
  copies**
  ([#616](https://github.com/ralksta/immich-folio/pull/616)). The
  temp-file-then-rename pattern existed six times across the admin, journal,
  install and favicon code, each with its own (and by now different) temp
  filename scheme.
- **Component testing is set up**
  ([#622](https://github.com/ralksta/immich-folio/pull/622)). `jsdom` and
  `@testing-library/react` land as dev dependencies, opt-in per file via a
  `// @vitest-environment jsdom` pragma; extracting logic out of a
  component is still preferred over rendering it wherever that's possible.

### Upgrade notes

**Bump `IMAGE_CACHE_VERSION` when you deploy this release**, the same
variable v0.15.0 introduced. Image URLs are served `immutable` with a
one-year cache; a browser (or an edge cache) that already has an `original`
response cached under a still-valid image URL keeps serving that original
after the upgrade unless the URL itself changes. Increment the value if it
is already set; set it to anything if it is not.

No configuration schema changed beyond what `settings.yaml` validation
already accepts; there is nothing else to migrate.

## [0.15.0] — 2026-09-19

### Security

- **Full-size originals no longer carry their GPS position to anonymous
  visitors** ([#558](https://github.com/ralksta/immich-folio/pull/558)). The
  image proxy streamed `?size=original` straight from Immich. An asset token
  authorises the _image_, not the size, so a thumbnail token read from the
  public HTML plus `?size=original` returned the untouched file — GPS
  coordinates and camera model included — to anyone. That went around two
  deliberate protections: `/api/exif` only ever hands out city and country,
  and `/api/map` quantises coordinates on the server.

  The metadata is now overwritten with zeros rather than cut out: JPEG APP1
  (EXIF/XMP), APP13 (IPTC) and comments, and the `Exif` and `mime` items of
  AVIF/HEIC/HEIF containers. The pixel data stays bit-identical — re-encoding
  would cost quality — and the file length stays constant, which keeps
  `Content-Length` valid and every absolute offset in an AVIF `iloc` box
  correct. The JFIF header and the ICC colour profile are kept on purpose:
  dropping the profile would shift colours, which is a rendering change, not a
  privacy one. A format that cannot be parsed safely falls back to the preview
  instead of being passed through, because silently passing it through was the
  bug. The per-album download route is unchanged — it is an explicit opt-in and
  gated on its own. **See the upgrade notes: this needs an
  `IMAGE_CACHE_VERSION` bump to reach browsers that already cached an
  original.**

- **Next.js 16.3.1 → 16.3.5**
  ([#571](https://github.com/ralksta/immich-folio/pull/571),
  [#566](https://github.com/ralksta/immich-folio/pull/566)). `npm audit`
  reported 16.3.1 as critical (GHSA-p293-qw3h-jr36, unauthenticated RCE on
  Windows-hosted servers). The shipped image runs on Linux and was not exposed,
  but the move stays within the minor. A high-severity advisory for `js-yaml`,
  which parses `gallery.yaml` at runtime, landed in the same week and is
  resolved in the lockfile. `npm audit` is clean.

### Added

- **Diagnostics is a page: `/admin/diagnostics`**, with an alt-text report
  ([#579](https://github.com/ralksta/immich-folio/pull/579)). The doctor used to
  be a modal. It is now a page that lists the findings that want a look first,
  groups the passed checks into connection, security and content, and gathers
  backups and cache clearing that were spread over two other places. **Every
  finding links to its fix** — an admin route where the fix lives in the panel,
  a docs section where it is an environment variable or the volume — instead of
  a severity pill that looked like a button and did nothing. A finding about a
  single album opens the page it is published on and marks its tile.

  The new **alt-text report** answers a question nothing answered before.
  Folio's alt text is the Immich description, used only while _Photo
  Description_ is on; a photo without one rendered with an empty `alt`,
  silently. The report lists the published photos without a description, by
  album, with links into Immich. It is deliberately kept out of the status
  badge: most libraries have gaps, and a badge that never turns green stops
  being read.

- **Markdown links in journal quote attributions**
  ([#563](https://github.com/ralksta/immich-folio/pull/563), by
  [@lancetm714](https://github.com/lancetm714)).
  `Quote text -- [Source](https://…)` now renders a link, like the quote body
  and captions already did. It reuses the same renderer, so the URL scheme
  allowlist applies unchanged.

- **The Backup Manager restores journal entries and the About page, including
  deleted journal entries**
  ([#581](https://github.com/ralksta/immich-folio/pull/581)). Deleting a
  journal entry was a bare file delete — the one irreversible action in the
  journal was the one without a way back — and the Backup Manager only knew
  `gallery.yaml` and `settings.yaml`, so the journal and About backups that
  saves did write could not be restored from the panel at all. A delete now
  keeps a copy first and is refused if that copy cannot be written; the manager
  gains About and Journal tabs, and a deleted entry comes back under its old
  slug. Deleted and pre-restore snapshots are exempt from the ten-backup
  rotation.

### Fixed

- **Settings no longer discard unsaved edits when you switch sections**
  ([#582](https://github.com/ralksta/immich-folio/pull/582)). Each settings
  section is its own route, and the editor was rendered by the section page, so
  it remounted on every switch: change the site title, open another section,
  and the edit was gone — no warning, the save bar simply vanished. The editor
  now lives in the settings layout, which stays mounted. There is one "Save
  Changes" bar for all sections, saving `settings.yaml` and `about.md`
  together, and the leave-page warning now covers About edits too, which it
  never did.

- **The subpage Live Preview shows the page the site renders**
  ([#583](https://github.com/ralksta/immich-folio/pull/583)). The drawer drew
  its own banner and tiles in admin styling and knew nothing of the theme
  preset, the cover grid columns, the caption bar or the header kicker. It now
  renders the public page's own markup, styled by the preset, sized by the same
  cover-grid calculation, laid out at desktop width and scaled into the drawer.

- **Portrait photos render as portrait tiles**
  ([#565](https://github.com/ralksta/immich-folio/issues/565),
  [#572](https://github.com/ralksta/immich-folio/pull/572), by
  [@ImScheinox](https://github.com/ImScheinox)). Most cameras store a portrait
  frame in landscape pixels plus an EXIF orientation flag, and Immich's API
  reports the unrotated dimensions. The aspect ratio ignored the flag, so in
  `masonry`, `justified` and `editorial-flow` every portrait frame got a
  landscape tile and the masonry grid lost its stagger. Orientations 5–8 now
  swap width and height. (The same bug was fixed again independently in #576;
  that was reverted in #577 so the fix lands under the person who found it
  first.)

- **Text meets WCAG AA contrast in every preset**
  ([#571](https://github.com/ralksta/immich-folio/pull/571),
  [#580](https://github.com/ralksta/immich-folio/pull/580)). `--text-muted`,
  which carries hero subtitles, section labels, album metadata and footer
  links, was below 4.5:1 in all fourteen theme blocks — as low as 2.33:1 in
  monograph. It was recomputed against both background tokens with hue and
  saturation untouched, so the warm greys stay warm. A follow-up replaced the
  `opacity` dimming that sat on top of those tuned tokens (footer Impressum
  link, `/impressum` headings, the editorial hero subtitle). An axe audit across
  all seven presets went from 129 failures to 0 in light mode.
  `npm run audit:contrast` runs that audit against a running site.

- **The admin panel works from the keyboard**
  ([#571](https://github.com/ralksta/immich-folio/pull/571)). The focus signal
  was a 1px border change at 2.37:1; there is now a real focus ring on
  `:focus-visible`. The asset picker, album picker, backup manager and proofing
  modal were mouse-only — no Escape, focus left behind, Tab walking out into
  the page — and now share one dialog hook with focus trapping and restoration.
  Eight admin selects gained an accessible name.

- **Light mode no longer paints dark text on dark surfaces**
  ([#562](https://github.com/ralksta/immich-folio/pull/562), by
  [@lancetm714](https://github.com/lancetm714);
  [#571](https://github.com/ralksta/immich-folio/pull/571)). Nine CSS tokens
  were read but never defined, so they fell back to dark-theme defaults. The
  proofing bar and its Share & Export modal were about 1.05:1 in light mode;
  journal cards had no visible edge; essays fell back to the browser's generic
  fonts instead of the theme's.

- **The proofing bar floats again with page transitions on**
  ([#560](https://github.com/ralksta/immich-folio/pull/560), by
  [@lancetm714](https://github.com/lancetm714)). The page fade-in animated a
  `transform`, and `animation-fill-mode: forwards` kept it applied forever. Any
  transform — even the identity — makes an element the containing block for
  `position: fixed` descendants, so the selection bar and its modal scrolled
  away with the page. The fade is opacity only now.

- **Album titles on `studio-modern` cover cards are readable in light mode**
  ([#578](https://github.com/ralksta/immich-folio/pull/578)). The cover's
  dominant colour — its loading placeholder — was set on the whole card, so
  `studio-modern`'s caption bar took the photo's colour under dark text. It now
  sits on the image box only.

### Internal

- Dependency updates: React 19.3.0, `@playwright/test` 1.63.0,
  `actions/upload-artifact` 7
  ([#574](https://github.com/ralksta/immich-folio/pull/574),
  [#573](https://github.com/ralksta/immich-folio/pull/573),
  [#567](https://github.com/ralksta/immich-folio/pull/567)). `axe-core` is a
  direct devDependency for the contrast audit.

### Upgrade notes

**Bump `IMAGE_CACHE_VERSION` when you deploy this release.** Image URLs are
served `immutable` with a one-year cache, so an original a browser already
fetched keeps its metadata in that cache after the upgrade. Changing
`IMAGE_CACHE_VERSION` changes every image URL and is the only thing that
reaches those caches. If it is not set yet, set it to anything:

```bash
IMAGE_CACHE_VERSION=2
```

No configuration schema changed; there is nothing else to migrate. An original
that already left your server cannot be recalled.

## [0.14.0] — 2026-08-30

### Added

- **`npm run doctor` — the config doctor in the terminal**
  ([#521](https://github.com/ralksta/immich-folio/issues/521)). The doctor
  shipped in v0.12.0 as a panel in `/admin`. That is the wrong place for the
  case it is best at: a deployment that will not come up, where there is no
  panel to open and no admin password to get past. The same checks now run from
  a terminal — `AUTH_SECRET`, whether the YAML parses, whether Immich answers
  the three calls Folio depends on, whether every published album still exists
  and is shared, whether a password is still plaintext or an unusable bcrypt
  hash, and whether `content/` can be written.

  It runs in the shipped image too, which is where it matters:

  ```bash
  docker compose exec folio npm run doctor
  ```

  The exit code is the worst thing it found — `0` clean, `1` warnings, `2`
  errors, `3` the doctor itself could not run — so it can gate a deployment
  script. No secret is ever printed, only whether something is set.

  Two findings are reported rather than judged, and say so under their own
  **NOTES** heading instead of being counted as passed checks:
  `TRUSTED_PROXY_HOPS`, which can only be measured against a real request, and
  `content/` writability, which is tested as whoever typed the command — on a
  Docker deployment that is not the user the app writes as, so the report names
  both and points back at `docker compose exec`. An unwritable path stays a
  plain error when the CLI does run as the owner.

  No check was reimplemented: the CLI calls the same functions as the panel and
  only gathers their inputs differently. It needs no new dependency either —
  Node strips the types itself, which works because those checks import nothing.

- **CI loads the admin panel in a real browser.** A Playwright spec walks all
  fourteen admin routes against a production build and fails on an error
  boundary, a missing page body, or anything thrown during hydration. It exists
  because of [#542](https://github.com/ralksta/immich-folio/issues/542): a
  temporal-dead-zone error at module evaluation took the whole panel down while
  the type check, the build and the unit tests all stayed green — none of them
  evaluates a client module in a browser, which is the only place that bug is
  visible. The spec was checked against the bug: with it reintroduced, the run
  names every broken route and reports the original
  `Cannot access 'THEME_INFO' before initialization`.

### Changed

- **The admin panel has a form-field layer**
  ([#533](https://github.com/ralksta/immich-folio/issues/533)). Nothing changes
  on screen; this is about what the panel costs to change. It had grown 171% in
  thirty days, and three files were two thirds of it. Every field was
  hand-written markup: the toggle card existed as fourteen copies, the five card
  pickers as five hand-rolled grids, and the grid editor as two 58-line blocks
  differing only in which config key they wrote. A new setting cost twenty lines
  of copied markup, and changing how a field looks meant editing it fourteen
  times.

  `ToggleCard`, `OptionGrid` and `GridOverrideFields` replace those copies; the
  subpage and album drawers moved out of `PageBuilder.tsx`, which went from
  2,290 lines and 46 characters of indentation to 1,153 and 22; and `admin.css`
  — 4,855 lines in one file — became a load order over twenty sheets named
  after what they style. The CSS class names are untouched throughout, which is
  what kept the appearance out of it.

  Two things were deliberately left undone rather than half-done: adopting or
  deleting the custom `Listbox` (a product decision about a keyboard model, not
  a mechanical one), and a `Field` wrapper that would generate an id and wire
  `htmlFor` — no admin label does today, so clicking one does not focus its
  input. Both are written down on the issue.

### Fixed

- **`grid.gap` moves both axes, and two presets get their spacing back**
  ([#513](https://github.com/ralksta/immich-folio/issues/513)). The earlier fix
  changed the hardcoded `column-gap` in `editorial`, `minimal` and `monograph`
  into a `--grid-gap` default, but left the hardcoded `margin-bottom` sitting a
  few lines below it in the same three files. In the masonry layout that margin
  _is_ the row spacing — a `column-count` layout has no `row-gap` — so the
  setting moved the columns and left the rows pinned. It now derives from
  `--grid-gap` like everything else. `monograph` keeps its rows deliberately
  looser than its columns, so it derives the ratio instead of the value.

  The same change also declared `--grid-gap: 12px` on the base grid, which
  meant `classic` and `studio-modern` — which asked for `var(--grid-gap, 20px)`
  — never reached their fallback and silently rendered at 12px from v0.12.0 on.
  Both declare their 20px outright now, as the other presets do.

  Verified in a browser rather than by reading the cascade: for all seven
  presets, an explicit gap of 50px produces 50px on both axes (60px rows for
  `monograph`), and with no gap set each preset renders its own intended
  default.

- **The dashboard status badge's colour and words agree**
  ([#539](https://github.com/ralksta/immich-folio/issues/539)). The badge decided
  its colour and its label through two separately-ordered nested ternaries over
  the same four inputs, and they disagreed in two states: with Immich
  unreachable _and_ the config doctor warning, the colour matched the warning
  first and stayed neutral while the words read "System Degraded"; and a refresh
  that followed an earlier error left the badge red under "Checking...". Both
  are now decided together, most serious first, so a condition cannot be added
  to one and forgotten in the other.

- **The journal editor warns before you close it with unsaved work**
  ([#538](https://github.com/ralksta/immich-folio/issues/538)). It tracked
  unsaved changes and used them to drive its save button, but registered no
  `beforeunload` handler — so closing the tab mid-entry discarded the work
  silently, while the same action in the page builder or the settings editor
  asked first. Those two carried the guard as a copy each; all three now share
  one, so a fourth editor cannot quietly be the next to forget it.

- **Editing an essay paragraph no longer strips its italics and links**
  ([#537](https://github.com/ralksta/immich-folio/issues/537)). The essay block
  editor rendered its textarea from a stripped copy of the paragraph — it turned
  `<strong>` into `**` and replaced every other tag, `<em>` and `<a>` included,
  with nothing — and then wrote that stripped text straight back on the next
  keystroke. Touching a paragraph destroyed its markup. The transform was a
  partial re-implementation of the serializer, which converts the HTML back to
  markdown on save and handles `<em>` correctly, so there was nothing to convert
  in the editor at all. It now shows the value raw, as the journal editor
  already did for the same data.

- **The admin panel's switches and pickers announce their state.** The toggle
  cards and the five card pickers — theme preset, photo frame, hero style,
  layout, aspect ratio — showed which option was active by colour alone, with
  no `aria-pressed`, so a screen reader read a row of buttons without saying
  which one was on. `SettingRow` already announced itself; the cards beside it
  did not. Fixed while giving the panel a form-field layer
  ([#533](https://github.com/ralksta/immich-folio/issues/533)), which is what
  made it one change instead of nineteen.

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

  > **Correction.** Two claims above were wrong: the row spacing did _not_
  > follow the setting in those three presets, and `classic` and
  > `studio-modern` did not keep what they had — they dropped from 20px to
  > 12px. Both were fixed later; see the entry under Unreleased.

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
