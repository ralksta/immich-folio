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
    RATE_LIMIT_RPM: Math.max(1, rateLimit),
    AUTH_SECRET: process.env.AUTH_SECRET,
    TRUSTED_PROXY_HOPS: trustedProxyHops,
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || undefined,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || undefined,
  };
}

/** Validated, typed environment variables. */
export const env = parseEnv();
