/**
 * Environment variables parser.
 * Parsed once at startup — all env access should go through this module.
 */

export interface Env {
  IMMICH_API_URL: string;
  IMMICH_API_KEY: string;
  SITE_TITLE: string;
  SITE_SUBTITLE: string;
  CACHE_TTL: number;
  STALE_MAX_AGE: number;
  IMAGE_CACHE_VERSION: string;
  IMMICH_TIMEOUT_MS: number;
  RATE_LIMIT_RPM: number;
  AUTH_SECRET?: string;
  TRUSTED_PROXY_HOPS: number;
  WEBHOOK_SECRET?: string;
  ADMIN_PASSWORD?: string;
}

function parseEnv(): Env {
  const errors: string[] = [];

  const urlRaw = process.env.IMMICH_API_URL;
  let apiUrl = '';
  if (urlRaw) {
    try {
      apiUrl = new URL(urlRaw).toString().replace(/\/+$/, '');
    } catch {
      console.warn('⚠️ IMMICH_API_URL is invalid, falling back to empty string for setup.');
    }
  }

  const apiKey = process.env.IMMICH_API_KEY || '';

  const cacheTtlStr = process.env.CACHE_TTL;
  const cacheTtl =
    cacheTtlStr && !isNaN(parseInt(cacheTtlStr, 10)) ? parseInt(cacheTtlStr, 10) : 300;

  // How long an expired cache entry may still be served while Immich is
  // unreachable. Keeps the public gallery online across an Immich restart
  // instead of showing an error page. 0 disables the fallback.
  const staleMaxAgeStr = process.env.STALE_MAX_AGE;
  const staleMaxAge =
    staleMaxAgeStr && !isNaN(parseInt(staleMaxAgeStr, 10)) ? parseInt(staleMaxAgeStr, 10) : 86400; // 24 hours

  // How long to wait on Immich before giving up. Without an explicit budget the
  // only ceiling is undici's built-in default (minutes), and since every page is
  // force-dynamic an Immich that accepts connections but never answers would
  // hold each visitor's render open for that entire window.
  //
  // This bounds the wait for a *response*, not the transfer of an image or video
  // body — those are legitimately slow and are not capped by this value.
  const timeoutStr = process.env.IMMICH_TIMEOUT_MS;
  const timeoutMs =
    timeoutStr && !isNaN(parseInt(timeoutStr, 10)) ? parseInt(timeoutStr, 10) : 15000;

  // Manual cache-buster for image and video URLs. Empty by default, so normal
  // operation is untouched.
  //
  // Image responses are served `immutable` for a year, which means the browser
  // does not revalidate at all — not even the ETag is consulted. That is the
  // right default (these URLs are content-addressed by an encrypted asset ID),
  // but it leaves no way to push a changed rendition: Immich regenerates
  // thumbnails and previews when a job is re-run or a photo is rotated, and the
  // asset ID — hence the token, hence the URL — stays the same. Bumping this
  // value changes every image URL at once and is the only escape hatch short of
  // rotating AUTH_SECRET.
  const imageCacheVersion = (process.env.IMAGE_CACHE_VERSION || '').trim();

  const rateLimitStr = process.env.RATE_LIMIT_RPM;
  const rateLimit =
    rateLimitStr && !isNaN(parseInt(rateLimitStr, 10)) ? parseInt(rateLimitStr, 10) : 1500;

  // Number of reverse proxies in front of the app. Determines how far from the
  // right of X-Forwarded-For the real client IP sits. nginx/Traefik/Caddy = 1;
  // add 1 for each additional layer (e.g. Cloudflare in front of nginx = 2).
  const hopsStr = process.env.TRUSTED_PROXY_HOPS;
  let trustedProxyHops = hopsStr && !isNaN(parseInt(hopsStr, 10)) ? parseInt(hopsStr, 10) : 0;

  // TRUSTED_PROXIES (removed) matched proxy IPs against the socket peer address,
  // which self-hosted Next.js never exposes — so it silently disabled per-client
  // rate limiting and lumped every visitor into one shared bucket. Migrate the
  // common single-proxy case rather than leaving those deploys broken.
  if (trustedProxyHops === 0 && process.env.TRUSTED_PROXIES) {
    trustedProxyHops = 1;
    console.warn(
      '\n⚠️  TRUSTED_PROXIES is deprecated and has no effect. Assuming TRUSTED_PROXY_HOPS=1.\n' +
        '   Set TRUSTED_PROXY_HOPS explicitly (nginx/Traefik/Caddy = 1) and remove TRUSTED_PROXIES.\n',
    );
  }

  if (trustedProxyHops < 0) trustedProxyHops = 0;

  return {
    IMMICH_API_URL: apiUrl,
    IMMICH_API_KEY: apiKey as string,
    SITE_TITLE: process.env.SITE_TITLE || 'Gallery',
    SITE_SUBTITLE: process.env.SITE_SUBTITLE || '',
    CACHE_TTL: Math.max(0, cacheTtl),
    STALE_MAX_AGE: Math.max(0, staleMaxAge),
    // Kept URL-safe: this value is appended to every image and video URL.
    IMAGE_CACHE_VERSION: encodeURIComponent(imageCacheVersion),
    // A sub-second budget would abort healthy requests; 0 must not mean "no timeout".
    IMMICH_TIMEOUT_MS: Math.max(1000, timeoutMs),
    RATE_LIMIT_RPM: Math.max(1, rateLimit),
    AUTH_SECRET: process.env.AUTH_SECRET,
    TRUSTED_PROXY_HOPS: trustedProxyHops,
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || undefined,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || undefined,
  };
}

/** Validated, typed environment variables. */
export const env = parseEnv();
