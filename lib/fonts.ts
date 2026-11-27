/**
 * Google Fonts, served from this origin (#699).
 *
 * Linking fonts.googleapis.com sends every visitor's IP address to Google
 * before they have agreed to anything, which LG München I (3 O 17493/20)
 * ruled unlawful. The server fetches the stylesheet and the font files
 * instead and hands them out itself, so the only address Google sees is the
 * server's.
 *
 * A theme may name any Google font (`theme.fonts` in settings.yaml), so the
 * fonts cannot be bundled at build time. They are fetched on first use and
 * kept in `content/.fonts/`, which also keeps a site's fonts working when
 * Google is unreachable later.
 *
 * - `/api/fonts/css?family=A&family=B` answers with Google's stylesheet, every
 *   `fonts.gstatic.com` URL rewritten to `/api/fonts/file/<hash>.woff2`.
 * - `/api/fonts/file/<hash>.woff2` serves a file only when some fetched
 *   stylesheet named it, so the route cannot be used to fetch arbitrary URLs.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const FONT_WEIGHTS = '300;400;500;600';

/**
 * Built-in preset families whose Google Fonts axis does not cover all of
 * `FONT_WEIGHTS`. Requesting a non-existent weight returns HTTP 400 from the
 * CSS2 API, so each built-in family asks only for weights it actually ships
 * (`null` = single-weight family, requested without an explicit `:wght@` axis).
 */
export const FAMILY_WEIGHTS: Readonly<Record<string, string | null>> = {
  'Playfair Display': '400;500;600',
  'EB Garamond': '400;500;600',
  'Bodoni Moda': '400;500;600',
  Cinzel: '400;500;600',
  'Libre Baskerville': '400;700',
  'Space Mono': '400;700',
  'Instrument Serif': null,
  'DM Mono': '300;400;500',
  Gloock: null,
};

/** Three slots in a theme; the dev toolbar asks for the same three. */
export const MAX_FAMILIES = 3;

const GOOGLE_CSS = 'https://fonts.googleapis.com/css2';
const GSTATIC = 'https://fonts.gstatic.com/';
const FETCH_TIMEOUT_MS = 5000;
/** How long a failed stylesheet fetch is not retried, so an outage costs one timeout, not one per page. */
const RETRY_AFTER_MS = 5 * 60 * 1000;

/**
 * Google picks the format by User-Agent. Without a current browser's it
 * answers with TTF, which is several times larger than WOFF2.
 */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Google Fonts family names: letters, digits and spaces ("IBM Plex Mono", "Source Sans 3"). */
const FAMILY_RE = /^[A-Za-z0-9 ]{1,64}$/;
const FILE_RE = /^([a-f0-9]{32})\.woff2$/;

export function fontsDir(): string {
  return path.join(process.cwd(), 'content', '.fonts');
}

/** Valid, de-duplicated family names, or null when any name is unusable. */
export function parseFamilies(raw: string[]): string[] | null {
  const families = [...new Set(raw.map((f) => f.trim()))].filter(Boolean);
  if (!families.length || families.length > MAX_FAMILIES) return null;
  return families.every((f) => FAMILY_RE.test(f)) ? families : null;
}

function googleFamilyCssUrl(family: string, weights: string | null): string {
  const encoded = family.replace(/ /g, '+');
  const spec = weights ? `${encoded}:wght@${weights}` : encoded;
  return `${GOOGLE_CSS}?family=${spec}&display=swap`;
}

/**
 * Fetch and locally cache a single Google Font family stylesheet.
 *
 * Fetching one family at a time ensures a custom font with unusual weights
 * cannot break the other font slots, and lets a 400 response on `:wght@…`
 * retry cleanly with an unparameterised `family=<Name>` query.
 */
async function getFamilyCss(family: string): Promise<string | null> {
  const weights = family in FAMILY_WEIGHTS ? FAMILY_WEIGHTS[family] : FONT_WEIGHTS;
  const cacheKey = weights ? `${family}:${weights}` : family;
  const name = `${sha(cacheKey)}.css`;
  const css = await coalesce(`css:${name}`, async () => {
    try {
      return await fs.readFile(path.join(fontsDir(), name), 'utf8');
    } catch {
      // Not cached yet.
    }
    if ((failedUntil.get(name) ?? 0) > Date.now()) return null;
    try {
      let res = await fetchWithTimeout(googleFamilyCssUrl(family, weights));
      // Custom fonts may not ship all weights in FONT_WEIGHTS; Google's CSS2
      // API answers 400 in that case, so fall back to the family's default set.
      if (res.status === 400 && weights !== null) {
        res = await fetchWithTimeout(googleFamilyCssUrl(family, null));
      }
      if (!res.ok) {
        console.warn(`[Folio] fonts: Google answered ${res.status} for ${family}`);
        failedUntil.set(name, Date.now() + RETRY_AFTER_MS);
        return null;
      }
      const text = await res.text();
      await store(name, text);
      return text;
    } catch (err) {
      console.warn(`[Folio] fonts: could not reach Google Fonts: ${(err as Error).message}`);
      failedUntil.set(name, Date.now() + RETRY_AFTER_MS);
      return null;
    }
  });
  if (css) for (const [file, url] of fileUrls(css)) knownFiles.set(file, url);
  return css;
}

const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 32);

/** Every gstatic URL in a stylesheet, keyed by the file name it is served under. */
function fileUrls(css: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const match of css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)\s'"]+)\)/g)) {
    files.set(`${sha(match[1])}.woff2`, match[1]);
  }
  return files;
}

/** Google's stylesheet with every font URL pointing at this server. */
export function rewriteCss(css: string): string {
  return css.replace(
    /url\((https:\/\/fonts\.gstatic\.com\/[^)\s'"]+)\)/g,
    (_, url: string) => `url(/api/fonts/file/${sha(url)}.woff2)`,
  );
}

/** file name → gstatic URL, for every stylesheet fetched so far. */
const knownFiles = new Map<string, string>();
/** stylesheet cache name → when to ask Google again. */
const failedUntil = new Map<string, number>();
const pending = new Map<string, Promise<unknown>>();

function coalesce<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const promise = run().finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': BROWSER_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

/** Write a cache file. A read-only content/ only costs the cache, not the response. */
async function store(name: string, data: string | Uint8Array): Promise<void> {
  try {
    await fs.mkdir(fontsDir(), { recursive: true });
    const target = path.join(fontsDir(), name);
    const tmp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, target);
  } catch (err) {
    console.warn(`[Folio] fonts: could not cache ${name}: ${(err as Error).message}`);
  }
}

/**
 * Google's original stylesheet for these families, from the cache or from
 * Google. Null when neither has it; the page then falls back to the system
 * fonts named after each family in the theme CSS.
 */
export async function getGoogleCss(families: string[]): Promise<string | null> {
  const parts = await Promise.all(families.map((family) => getFamilyCss(family)));
  const loaded = parts.filter((css): css is string => Boolean(css));
  return loaded.length ? loaded.join('\n') : null;
}

/**
 * After a restart the map is empty until a stylesheet is requested again, and
 * a browser holding a cached stylesheet asks for the files directly. The cached
 * stylesheets on disk name every file that may legitimately be asked for.
 */
async function rebuildKnownFiles(): Promise<void> {
  let names: string[];
  try {
    names = await fs.readdir(fontsDir());
  } catch {
    return;
  }
  for (const name of names.filter((n) => n.endsWith('.css'))) {
    try {
      const css = await fs.readFile(path.join(fontsDir(), name), 'utf8');
      for (const [file, url] of fileUrls(css)) knownFiles.set(file, url);
    } catch {
      // A file that vanished between readdir and read is not worth a warning.
    }
  }
}

/** A font file by the name the rewritten stylesheet gave it, or null. */
export async function getFontFile(name: string): Promise<Uint8Array | null> {
  if (!FILE_RE.test(name)) return null;

  try {
    return new Uint8Array(await fs.readFile(path.join(fontsDir(), name)));
  } catch {
    // Not cached yet.
  }

  return coalesce(`file:${name}`, async () => {
    if (!knownFiles.has(name)) await rebuildKnownFiles();
    const url = knownFiles.get(name);
    if (!url?.startsWith(GSTATIC)) return null;
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) return null;
      const data = new Uint8Array(await res.arrayBuffer());
      await store(name, data);
      return data;
    } catch (err) {
      console.warn(`[Folio] fonts: could not fetch ${name}: ${(err as Error).message}`);
      return null;
    }
  });
}

/** Test hook: forget what earlier tests fetched. */
export function __resetFontsForTests(): void {
  knownFiles.clear();
  failedUntil.clear();
  pending.clear();
}
