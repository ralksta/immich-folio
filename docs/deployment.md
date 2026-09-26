# Deployment

Operational detail for running Immich Folio: what the setup wizard writes, the
Docker options beyond the basic Compose recipe, and what happens when Immich
goes away.

For the quick path — clone, `npm run dev`, open `/install` — see the
[README](../README.md#quick-start).

**Contents:**

- [What the Setup Wizard Writes](#what-the-setup-wizard-writes)
- [Environment Variables Always Win](#environment-variables-always-win)
- [Docker Compose](#docker-compose)
- [Standalone Docker](#standalone-docker)
- [Health Check](#health-check)
- [Config Doctor](#config-doctor)
- [Behaviour when Immich is Unreachable](#behaviour-when-immich-is-unreachable)
- [Reverse Proxy](#reverse-proxy)
- [CDN Mode](#cdn-mode)

## What the Setup Wizard Writes

The wizard at `/install` writes three files into `content/`:

| File                    | Contents                                                             |
| ----------------------- | -------------------------------------------------------------------- |
| `content/gallery.yaml`  | The albums you picked                                                |
| `content/settings.yaml` | Site title, subtitle, theme — only if it does not exist yet          |
| `content/install.json`  | Immich URL and API key, a generated site secret, admin password hash |

> [!IMPORTANT]
> **`content/install.json` holds credentials.** It is written with mode `0600`,
> and it is the reason a backup of your `content/` directory is also a backup of
> your Immich API key — treat it accordingly. The admin password is stored as an
> scrypt hash, not as you typed it; the API key and site secret have to stay
> readable to be usable.

Nothing is written until your credentials have been verified against your Immich
server, so a typo cannot leave you with an "installed" site that loads no photos.

## Environment Variables Always Win

`IMMICH_API_URL`, `IMMICH_API_KEY`, `AUTH_SECRET` and `ADMIN_PASSWORD` override
anything in `install.json`, so any of them can be rotated by setting the variable
— no need to touch the file. `SITE_PASSWORD` works the same way over
`sitePassword` in `settings.yaml`.

Set all of them up front and the wizard never appears, which is the usual choice
for an infrastructure-as-code deployment.

## Docker Compose

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

```bash
docker compose up -d
```

The gallery will be available at `http://localhost:7211`.

## Standalone Docker

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

> [!IMPORTANT]
> The `content/` volume mount lets you update `gallery.yaml` and `about.md`
> without rebuilding the image. It must be **read-write**: the setup wizard, the
> admin panel, the journal, the favicon upload and the backup rotation all write
> into it. A `:ro` mount leaves the wizard unable to complete and the admin panel
> unable to save.

## Health Check

The container includes a built-in health check at `/api/health`:

```bash
curl http://localhost:7211/api/health
```

## Config Doctor

```bash
npm run doctor
```

Checks an installation from the terminal and prints what it finds: whether
`AUTH_SECRET` is set and long enough, whether `gallery.yaml` and
`settings.yaml` parse, whether Immich answers the three calls Folio depends on,
whether every published album ID still exists in Immich (and is shared there),
whether any password is still stored in plaintext or as an unusable bcrypt
hash, whether an enabled Impressum has a name, address, email and a second
contact channel, and whether `content/` can be written to.

This is the same set of checks as the **Diagnostics** page in `/admin`, but it
needs neither a running app nor an admin password — which is the point. It is
the tool for the case where the site will not come up at all. (The page adds
an alt-text report on top, which needs the albums loaded and has no CLI
counterpart.)

It runs in the shipped image too:

```bash
docker compose exec folio npm run doctor
```

No secret is ever printed — only whether something is set, and where to look.
The exit code is the worst thing it found, so it can gate a deployment script:

| Code | Meaning                         |
| ---- | ------------------------------- |
| `0`  | every check passed              |
| `1`  | warnings, no errors             |
| `2`  | at least one error              |
| `3`  | the doctor itself could not run |

Two findings are reported rather than judged. `content/` writability is tested
as the user who typed the command, and on a Docker deployment that is not the
user the app writes as — so when the paths belong to someone else, the CLI says
whose they are and leaves it at that. Run it through the container to have it
checked as the app itself:

```bash
docker compose exec folio npm run doctor
```

The other is `TRUSTED_PROXY_HOPS`, judged against the
`X-Forwarded-For` chain of a live request, and a CLI has none. It reports the
configured value and says so rather than guessing — use the Diagnostics page,
reached over your public URL, to have that one measured.

Both are printed under **NOTES** rather than among the passed checks, since
nothing was established, and counted separately in the summary line for the
same reason. Notes never affect the exit code. An unwritable path _does_ stay a
plain error when the CLI runs as the owner, which is the case that is really
about the app.

Run from a checkout, it reads `.env.local` and `.env` the way `npm run dev`
does; real environment variables and `content/install.json` are resolved in the
same order the app resolves them.

It needs **Node 22.18 or newer**, which is what runs the TypeScript directly
and is why the CLI adds no dependency of its own. The shipped image is already
on it; an older local Node is told so instead of crashing.

## Behaviour when Immich is Unreachable

Immich Folio buffers your gallery rather than merely proxying it:

- Album and asset pages keep serving the last known good data for up to `STALE_MAX_AGE`, so a restarting or briefly unreachable Immich does not take the public site down with it.
- Once nothing cached is left, they return `503`, never `404` — a `404` would tell search engines to drop a URL for content that still exists.
- Outages are never cached, so the gallery recovers as soon as Immich does.

The cache lives in the process, so it is empty right after a container restart.

## Reverse Proxy

Put Immich Folio behind nginx / Caddy / Traefik with TLS. Example Caddy config:

```
photos.example.com {
    reverse_proxy localhost:7211
}
```

> [!IMPORTANT]
> Set `TRUSTED_PROXY_HOPS` to the number of proxies in front of the app, and
> make sure they forward `X-Forwarded-For` correctly — otherwise the client IP
> comes from a header the client itself can set, which defeats the brute-force
> limits on the password endpoints. See
> [Trusted Proxies](gallery-config.md#trusted-proxies) for the setting and a
> matching nginx config.

Login cookies (admin session and gallery passwords) are marked `Secure` when the
request arrived over HTTPS, which the app learns from `X-Forwarded-Proto`. Caddy
and Traefik send it on their own; nginx needs the
`proxy_set_header X-Forwarded-Proto $scheme;` line from the config linked above.
Opening the app over plain HTTP, e.g. `http://server:7211` on a home network,
works too: the cookies are then set without `Secure`, since a browser would
discard them otherwise.

## CDN Mode

With `CDN_URL` set, every photo and video URL on the site points at a pull CDN
instead of this server:

```env
CDN_URL=https://cdn.example.com
```

```
https://cdn.example.com/api/image/v2:…?size=preview&w=1080&q=75
```

The CDN uses Immich Folio as its origin. The first request for a photo is a
cache miss and goes to `/api/image` as usual; every request after that is
answered by the CDN and never reaches your server or the Immich box behind it.
On a home connection with a slow uplink, that is the difference between a
gallery that crawls and one that does not.

**Setting up the CDN.** Create a pull zone (Bunny), a distribution
(CloudFront) or a CNAME'd subdomain (Cloudflare) whose origin is your public
Folio URL, then:

- **Cache `/api/image/*` and `/api/video/*`**, and nothing else. Pages are
  rendered per request, and other routes check cookies.
- **Include the full query string in the cache key.** `size`, `w`, `q` and the
  `IMAGE_CACHE_VERSION` buster `v` all select a different file.
- **Respect the origin's `Cache-Control`.** Photos come back
  `public, max-age=31536000, immutable`; errors (429, 503, 404) come back
  `no-store` and must not be cached.
- **Forward `Range` requests** for videos, so seeking works.

**Rate limiting.** A cache miss arrives from a CDN edge, not from the visitor.
Set `TRUSTED_PROXY_HOPS` to count the CDN as a proxy (Cloudflare → Caddy = 2)
so the limiter reads the visitor's IP from `X-Forwarded-For`; otherwise a
handful of edges share one bucket. The [Config Doctor](#config-doctor) warns
when CDN mode is on with `TRUSTED_PROXY_HOPS=0`.

**What stays on this server:** pages, `/_next` assets, EXIF, the map,
downloads, the admin panel and the Open Graph images. These are either small or
carry a cookie check a CDN would bypass.

**Site passwords switch it off.** On a password-protected site, the image
route checks the visitor's unlock cookie, and a CDN would answer from its cache
without asking. So while a site password is set, photos stay on this server
whatever `CDN_URL` says, and the diagnostics page says so. Gallery (per-page)
passwords are unaffected: they already protect the page that holds the photo
links, not the image URLs themselves.

**Changing a photo.** A CDN keeps immutable responses for as long as a browser
does. Bump `IMAGE_CACHE_VERSION` after regenerating thumbnails in Immich, which
changes every URL at once, or purge the CDN.

The Content-Security-Policy allows the CDN's origin for `img-src` and
`media-src` automatically.
