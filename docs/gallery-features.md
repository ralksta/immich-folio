# Gallery Features

Passwords, client proofing, photo zoom and original downloads: what visitors and clients can do, and how to switch each on. Most can be set for the site in `settings.yaml` and overridden per page or album in `gallery.yaml`.

**Contents:**

- [Password Protection](#password-protection)
- [Client Proofing](#client-proofing)
- [Client Proofing Links](#client-proofing-links)
- [Photo Zoom](#photo-zoom)
- [Originals download](#originals-download)

## Password Protection

A password can be set on the whole site, on a subpage, on a single album, and on
a [journal entry](journal.md#password-protected-entries). Unlocking sets an
`HttpOnly` cookie that is valid for 24 hours; nothing is stored server-side.

Three storage formats are accepted:

| Format             | Status                                                                |
| ------------------ | --------------------------------------------------------------------- |
| `scrypt:salt:hash` | **Recommended.** The password is not recoverable from `gallery.yaml`. |
| Plaintext          | Works, but deprecated — logs a warning naming the recommended hash.   |
| bcrypt (`$2a$…`)   | Rejected.                                                             |

To get the hash for an existing plaintext password, unlock the gallery once and
read the server log: the successful unlock prints the matching `scrypt:…` line
to paste back into `gallery.yaml`. Simpler: open the page or album in the
admin panel and save it once. Every password saved there is stored as a
`scrypt:…` hash, and the field then reads **Protected** with **Change** and
**Remove** instead of showing the stored value.

> [!NOTE]
> Album and subpage gates protect the **page**. Image URLs handed out while a
> gallery was unlocked keep working — see
> [Image Token Revocation](security.md#image-token-revocation).

### Locking the whole site

`sitePassword` in `settings.yaml` puts everything public behind one password —
useful while a portfolio is still being built, or for a folio that is only ever
shown to clients.

```yaml
# settings.yaml
sitePassword: 'scrypt:...'
```

`SITE_PASSWORD` in the environment overrides the file, so the password can be
rotated without editing (or backing up) `settings.yaml`. It accepts the same
three storage formats as every other gate.

Unlike the per-page gates, this one is enforced in `proxy.ts`, before the
requested page renders at all. That matters: a gate that merely swapped the page
for a login form would still have let the page produce its payload, album names
and image tokens included. The public API routes carry the same check
themselves, since route handlers do not pass through the proxy.

These stay reachable on a locked site:

| Path                       | Why                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/health`              | A health probe runs without cookies; gating it takes the container down.                                                              |
| `/admin`                   | It has its own password, and it is where `sitePassword` is set.                                                                       |
| `/install`                 | A fresh deployment has to be configurable before it can be locked.                                                                    |
| `/impressum`, `/privacy`   | The password page is public and links them; a German Impressum must be reachable directly. Neither shows an album or the site's menu. |
| `/contact`, `/api/contact` | The Impressum links the form as its second contact channel. Honeypot, fill-time check and rate limit apply as on an open site.        |

A legal or contact page that is switched off is still a 404 on a locked site.

A locked site also serves `noindex, nofollow` regardless of the SEO settings —
there is nothing there for a crawler.

## Client Proofing

Lets a visitor mark favourites and export the selection — for handing a client a
gallery and getting their picks back. A heart button sits on every photo in the
grid; once something is picked, a bar appears with a filter and an export
dialog.

The selection is encoded into the URL as a compact bitmask and mirrored into
`localStorage`, so **nothing is stored server-side** and a set of picks can be
shared, bookmarked, or sent back as a plain link.

When an album also opts into [originals download](#originals-download), the
export dialog gains a **Download selected (.zip)** action, and the album header
a **Download album** link.

Configured in `settings.yaml`:

```yaml
proofing:
  enabled: true # hearts, selection bar and export modal (default: true)
  allowMailto: true # offer "send by email" alongside the copyable list (default: true)
  email: proofs@example.com # recipient of that email (default: footer.email)
```

The email draft goes to `proofing.email`, or to the footer contact email
(`footer.email`) when that is unset. With neither configured the dialog hides
the email button rather than opening a draft with an empty **To:**. The address
is set in the admin panel under **Settings → General → Proofing email**, and it
reaches the page encoded like the footer address, so it does not appear in the
HTML in plain text.

A subpage overrides `enabled` in either direction — useful to keep proofing off
across a public portfolio and switch it on for a single client handover:

```yaml
# gallery.yaml
subpages:
  - name: Wedding – Smith
    password: clientpass123
    proofing: true # or `false` to disable it on this subpage only
    albums:
      - ...
```

Precedence is **subpage → global**: a subpage's own `proofing:` wins, and an
album reached without a subpage follows `proofing.enabled`.

> [!NOTE]
> Photo essays are the exception. A published story is not an album handover,
> so an essay (`layout: essay`, `essayFile`, `essayText`) shows the proofing
> controls only when its subpage sets `proofing: true` **explicitly** — the
> global default does not reach into essays. Journal entries never show them.

## Client Proofing Links

The proofing above is anonymous: picks live in the visitor's browser and come
back to you as a link or an email, if they come back at all. A **client
proofing link** is the handover version. Create one per client in
**Admin → Proofing**:

- **Client** — a name for your overview and the greeting on the page.
- **Album** — any Immich album. It does not have to be in `gallery.yaml`; the
  link itself is what grants access to it.
- **Valid until** — optional. From the day after, the link shows "This link has
  expired" and every action on it is refused.
- **Downloads** — none, the client's selection as a ZIP, or the whole album as
  a ZIP, with an optional limit on how many ZIPs the link may start.

The client opens `https://your-site/proof/<token>` and hearts photos as usual.
Every change is **saved on the server** within a second, so they can stop and
come back later, from another device too. **Submit selection** locks it and
notifies you. Until then, you can watch the picks come in under
**Admin → Proofing**. **Reopen for changes** unlocks a submitted selection.

**Export.** Each link offers:

- **Copy file names (Lightroom)** — the selected file names without extension,
  comma-separated. Pasted into Lightroom's or Capture One's filename filter,
  `IMG_0412` finds the RAW as well as the JPEG the client saw.
- **CSV** — position in the album, file name and capture time.
- **TXT** — full file names, one per line.

**Notification.** Set `PROOFING_WEBHOOK_URL` and every first submit POSTs JSON
to it. The body carries `content` (Discord), `text` (Slack, Mattermost),
`title` and `message` (Gotify) and a structured `proofing` object (n8n, Home
Assistant, your own script), so most receivers work without an adapter. With
`SITE_URL` set, the message links straight to the selection in the admin panel.
A failing webhook never fails the client's submit.

```env
PROOFING_WEBHOOK_URL=https://discord.com/api/webhooks/…
```

**Security notes.**

- The token in the link is the only credential: 192 random bits, never shown
  in the admin panel's own URLs. Treat the link like a password; delete it in
  the admin panel to revoke it at once.
- Links are stored in `content/proofing.json` (mode `0600`), next to
  `analytics.json`, and are not part of the YAML backups.
- A site-wide password still applies: on a locked site, the client needs it
  too.
- Proofing pages are `noindex`, left out of the sitemap, and send no
  `Referer`.
- A subpage slugged `proof` would be hidden behind this route.

## Photo Zoom

Visitors can zoom into a photo in the lightbox to full resolution — one image
pixel per screen pixel, which is what judging sharpness takes. Off by default:
it hands out the full-resolution file, so it is switched on deliberately.

```yaml
# settings.yaml — the site-wide default
zoom: true
```

A subpage and an album can each override it, in either direction. The most
specific setting wins: **album → subpage → site**. An album's `zoom:` belongs to
the entry it is written on: an album listed on two pages can have zoom on one
and off on the other, and each page keeps its own choice. Listed twice on the
same page (in two sections), `false` wins.

```yaml
# gallery.yaml
subpages:
  - name: Clients
    zoom: true # every album on this page, unless it says otherwise
    albums:
      - 'album-uuid':
          zoom: false # not this one
```

In the admin panel the switch is under **Settings › General › Portfolio
Features**, and the page and album drawers in the page builder have an
_Inherit / On / Off_ choice.

**Using it.** A click on the photo zooms in by half (1.5× the fit size)
around the point clicked, and a second click goes back to fit. Double-tap on a
touch screen, or the magnifier button in the lightbox bar, zooms straight to
1:1 and back. Pinch, or Ctrl + scroll wheel / trackpad pinch, zooms
continuously between fit and 1:1 — never further, since enlarging past 1:1
only interpolates pixels and makes good focus look soft. Drag (or one finger)
pans; `+` / `-` step, `0` and `Esc` go back to fit (a second `Esc` closes the
viewer). Swiping to the next photo is off while zoomed, and changing photos
resets the zoom.

**What is shown.** The full-resolution file is requested only when a visitor
zooms — never on opening the viewer, and never for the neighbouring photos.
Until it arrives the preview is shown enlarged, with a small spinner on the
zoom button.

| Original                           | Zoom shows                                     |
| ---------------------------------- | ---------------------------------------------- |
| JPEG, AVIF                         | The original, with its location removed        |
| HEIC/HEIF, RAW/DNG, TIFF, JPEG XL… | Immich's full-size rendition, location removed |
| PNG, WebP, GIF                     | Not zoomable — their metadata is not scrubbed  |
| Edited in Immich (crop, rotate)    | Immich's edited full-size rendition            |
| Video                              | Not zoomable                                   |

Location is removed the same way as for [originals download](#originals-download):
GPS coordinates and place names below city level are overwritten in place;
camera data and colour profile stay. A file whose metadata cannot be read is
refused rather than sent.

Zoom into a JPEG or AVIF streams the original from Immich, so the API key
needs the `asset.download` permission (_Account Settings › API Keys_). With
only `asset.read` and `asset.view`, Immich answers `403` and the lightbox says
full resolution is unavailable; the Folio log shows
`Failed to stream … 403`. The same permission covers
[originals download](#originals-download).

Formats a browser cannot display need Immich's **full-size preview**
(_Administration › Settings › Image Settings › Full-size image_, JPEG format).
Immich generates it only while that setting is on, so turn it on and run the
_Generate Thumbnails_ job for existing photos. Without it, those photos show
the zoom button but answer "Full resolution is not available for this photo",
and the viewer stays on the preview. Immich does not say whether a rendition
exists until it is asked, so Folio cannot hide the button in advance.

AVIF originals tagged only with a BT.2020 colour tag (typical of Lightroom AVIF
exports) can look more saturated at 1:1 than in the preview: Immich's preview
ignores that tag and comes out desaturated (#827), while the browser shows the
original as tagged. The original is the accurate one.

A photo edited in Immich's own editor zooms into the edit, never into its
original: Immich keeps the edit apart from the file, so the original is the
unedited photo and whatever a crop removed would come back at 1:1. Immich has
a full-resolution rendition of every edit, whether or not full-size previews
are switched on, so edited photos do not depend on that setting.

On touch devices, photos above **50 megapixels** get no zoom control. Showing a
photo at 1:1 means decoding all of it — 200 MB of memory at 50 MP, 240 MB for a
60 MP frame — which phones and tablets do not reliably survive. With a mouse or
trackpad there is no limit.

Zoom is offered on album pages, including the album pages under a photo-essay
subpage (`/<page>/<album>`). The essay itself, journal entries and client
proofing links do not have it.

The zoom route re-checks the album allowlist, every password gate on a route to
the album, the zoom setting for that route, and that the photo is published and
belongs to the album. Answers are `Cache-Control: private` (browser only, one
hour, never a CDN), and each visitor can open 20 full-resolution files a minute.

**Bandwidth.** Every zoom sends a full-resolution file from Immich through
Folio to the visitor — commonly 5–25 MB per photo (a 60 MP JPEG is about
20 MB). At the rate limit of 20 a minute, one visitor can pull several hundred
megabytes a minute, and none of it is cached at a CDN. That is why zoom is off
by default; on a metered or slow uplink, switch it on only for the pages that
need it.

## Originals download

Opt in per album with `download: true`. Off everywhere by default, and opt-in
on purpose: a public portfolio should not start handing out full-resolution
originals because one client gallery needed to.

```yaml
albums:
  - 'album-uuid':
      download: true
```

The API key needs the `asset.download` permission in Immich, since originals
are streamed from `/assets/:id/original`.

Once enabled, visitors get a **Download album** link in the album header (every
original as a ZIP), and — where [client proofing](#client-proofing) is on — a
**Download selected (.zip)** action in the export dialog that zips just the
favourited photos.

The download route re-checks the allowlist, the `download` flag, every password
gate on a route to the album, and that each asset really belongs to that album,
so an edited URL cannot reach anything else. The ZIP keeps the original
filenames (deduplicated on collision) and is streamed, so album size does not
drive memory use.

Originals keep their metadata except their location. JPEG, HEIC/HEIF and AVIF
files are delivered with camera, lens, exposure, copyright/IPTC and colour
profile intact, but with GPS coordinates removed from EXIF and XMP; the image
data itself is not touched. Other formats (RAW, DNG, PNG, TIFF, WebP, video) are
delivered exactly as Immich stores them, including any GPS. The diagnostics page
warns when a download album contains such files.

A photo edited in Immich's own editor (crop, rotate) is downloaded as edited,
not as the camera file. Immich renders the edit as a full-resolution JPEG
without EXIF, so that file has no camera data either, and its name gets a
`.jpg` extension (`IMG_0001.HEIC` arrives as `IMG_0001.jpg`). It passes the
same location scrubber.

One visitor (by client IP, see `TRUSTED_PROXY_HOPS`) can have at most two ZIPs
downloading at once, album and proofing downloads counted together; a third
gets a "too many requests" page until one finishes. A ZIP whose download stops
reading for 60 seconds is closed, so an abandoned or stalled download does not
hold its connection to Immich open.

---

See also: [Gallery structure](gallery-config.md), [Site settings](site-settings.md), [System & security](security.md), [Journal & photo essays](journal.md).
