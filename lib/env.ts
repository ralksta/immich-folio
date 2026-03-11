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
    rateLimitStr && !isNaN(parseInt(rateLimitStr, 10)) ? parseInt(rateLimitStr, 10) : 600;

  return {
    IMMICH_API_URL: apiUrl,
    IMMICH_API_KEY: apiKey as string,
    SITE_TITLE: process.env.SITE_TITLE || 'Gallery',
    SITE_SUBTITLE: process.env.SITE_SUBTITLE || '',
    CACHE_TTL: Math.max(0, cacheTtl),
    RATE_LIMIT_RPM: Math.max(1, rateLimit),
    AUTH_SECRET: process.env.AUTH_SECRET,
  };
}

/** Validated, typed environment variables. */
export const env = parseEnv();
