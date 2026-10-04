# System & Security

**Contents:**

- [Rate Limiting](#rate-limiting)
- [Trusted Proxies](#trusted-proxies)
- [Image Token Revocation](#image-token-revocation)

Advanced system settings are configured via environment variables in your `.env` or `.env.local` file.

## Rate Limiting

To protect against brute-force attacks and resource exhaustion, Immich Folio includes an in-memory rate limiter. Each endpoint has its own bucket, so heavy image traffic cannot exhaust the budget for the password endpoints.

- `RATE_LIMIT_RPM`: requests per minute per IP for image, video, EXIF and health requests (default: `1500`).

The endpoints where a high limit would be the wrong default are fixed and not configurable:

| Endpoint               | Limit (req/min/IP) |
| ---------------------- | ------------------ |
| `POST /api/admin/auth` | 5                  |
| `POST /api/auth`       | 10                 |
| `/api/install`         | 10                 |
| `/api/zoom`            | 20                 |
| `/api/og`              | 30                 |
| `/api/install/albums`  | 30                 |
| `/api/webhook`         | 60                 |
| `/api/map`             | 120                |

> [!IMPORTANT]
> The limiter lives in the process memory of a single instance. It does not
> coordinate across replicas, and it starts empty after a restart.

## Trusted Proxies

If you run Immich Folio behind a reverse proxy (nginx, Traefik, Caddy, Cloudflare), tell it how many proxies sit in front. Without this, the rate limiter reads a client-supplied header and an attacker can pick their own bucket — defeating brute-force protection on the password endpoints.

- `TRUSTED_PROXY_HOPS`: Number of reverse proxies in front of the app (default: `0`).

```bash
# nginx / Traefik / Caddy directly in front of the app
TRUSTED_PROXY_HOPS=1

# Cloudflare in front of nginx
TRUSTED_PROXY_HOPS=2
```

The client IP is taken that many entries from the **right** of `X-Forwarded-For`. Proxies append the address they actually observed, so everything to the left is client-supplied and ignored — a visitor sending `X-Forwarded-For: 1.1.1.1` cannot influence which bucket they land in.

> ⚠️ **The app must be reachable only through the proxy.** Bind it to localhost (`127.0.0.1:3000`) or keep it on an internal Docker network. If clients can connect directly they control the entire header, and no setting can recover the real IP.

Matching nginx config:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`$proxy_add_x_forwarded_for` is the important one: it _appends_ the real peer address rather than overwriting the header.

#### Migrating from `TRUSTED_PROXIES`

`TRUSTED_PROXIES` has been removed. It matched proxy IPs against the socket peer address, which a self-hosted Next.js server never exposes — so the check never passed. Setting it silently put **every visitor into one shared rate-limit bucket**, letting a single client trip the limit for the entire site. If it is still set, the app assumes `TRUSTED_PROXY_HOPS=1` and logs a warning; replace it with an explicit value.

## Image Token Revocation

Asset tokens are deterministic — the same photo always yields the same token, which is what lets browsers cache images for a year. The image proxy validates the token but does not re-check album membership on every request.

Removing an album from `gallery.yaml` hides it from the site, but any image URL already handed out (bookmarked, embedded, cached by a browser) keeps working. To invalidate previously issued links, rotate `AUTH_SECRET` — this also signs out every password-protected gallery and admin session.

---

See also: [Gallery structure](gallery-config.md), [Site settings](site-settings.md), [Gallery features](gallery-features.md), [Journal & photo essays](journal.md).
