/**
 * The site's own absolute URL (#472).
 *
 * Sitemaps and feeds need absolute URLs, and `app/sitemap.ts` runs without a
 * request context — so the host cannot be read off a header the way the rest of
 * the app does it. It has to be configured.
 *
 * Two sources: `url:` in settings.yaml, editable in the admin panel, and
 * `SITE_URL` in the environment as a fallback for anyone who would rather
 * configure it there and never open the panel.
 *
 * settings.yaml wins. #472 proposed the opposite, on the grounds that
 * `SITE_TITLE`/`SITE_SUBTITLE` already work that way — but they do not:
 * lib/config/index.ts resolves them as `settings.title ?? env.SITE_TITLE`, so
 * the file already takes precedence. Following that convention means the admin
 * field always does what it appears to do, which is what the issue actually
 * wanted; the alternative was to introduce a field that silently has no effect
 * and then build a mechanism to explain it.
 */

/**
 * Normalise a configured site URL, or return null if it cannot be used.
 *
 * Rejects anything that is not absolute http(s): a bare host, a `javascript:`
 * URL or a typo would otherwise be emitted into a sitemap, a feed and a
 * JSON-LD block, where a wrong value is worse than a missing one.
 *
 * Keeps a path (a portfolio may live under a sub-path) but drops the trailing
 * slash, query and fragment, so callers can join with `/` without producing
 * `//` or carrying a stray `?`.
 */
export function normaliseSiteUrl(raw: string | undefined | null): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (!parsed.hostname) return null;

  const path = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${path}`;
}

/**
 * The effective site URL, and where it came from. The origin is reported so
 * the admin panel can tell the operator that the value it shows came from the
 * environment rather than from the field they are looking at.
 */
export function resolveSiteUrl(
  settingsUrl: string | undefined,
  envUrl: string | undefined,
): { url: string | null; source: 'env' | 'settings' | 'none' } {
  const fromSettings = normaliseSiteUrl(settingsUrl);
  if (fromSettings) return { url: fromSettings, source: 'settings' };

  const fromEnv = normaliseSiteUrl(envUrl);
  if (fromEnv) return { url: fromEnv, source: 'env' };

  return { url: null, source: 'none' };
}

/**
 * Join the site URL with a path, for a sitemap entry or a feed link.
 *
 * Returns null without a site URL: a relative link in a sitemap is invalid and
 * a relative link in a feed points at the reader, so there is nothing sensible
 * to fall back to.
 */
export function absoluteUrl(siteUrl: string | null, path: string): string | null {
  if (!siteUrl) return null;
  const raw = path.startsWith('/') ? path : `/${path}`;
  const suffix = raw === '/' ? '/' : raw.replace(/\/+$/, '');
  return `${siteUrl}${encodePathBytes(suffix)}`;
}

/**
 * Percent-encode exactly what a URI may not carry: anything outside printable
 * ASCII. Album slugs keep their own script since #522, so a path can now hold
 * characters a sitemap, a canonical link or a JSON-LD block must not.
 *
 * Deliberately not `encodeURI()`, which would also re-encode the `%` of an
 * already-encoded path and corrupt it, and deliberately not `new URL(path,
 * siteUrl)`, which would drop the sub-path a portfolio may be published under
 * — the one thing `normaliseSiteUrl()` goes out of its way to keep.
 */
function encodePathBytes(path: string): string {
  return path.replace(/[^\x20-\x7E]/g, (character) => encodeURIComponent(character));
}
