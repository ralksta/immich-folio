/**
 * Signed URLs for the generated share card (`/api/og`).
 *
 * The card prints whatever title and subtitle its URL carries, on the site's
 * own domain and in its colours. Unsigned, anyone could have the site render
 * text of their choosing — a fake notice passed around as the site's own
 * image — and every new string cost a fresh satori render. The pages that
 * emit the URL sign the text they put in it; the route renders only text that
 * carries a valid signature and falls back to the plain site card otherwise.
 */

import crypto from 'crypto';
import { getConfig } from './config';

export const OG_TITLE_MAX = 200;
export const OG_SUBTITLE_MAX = 100;

/** Truncates by code point, so a cut never leaves half a surrogate pair. */
function clip(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max).join('') : text;
}

function sign(secret: string, title: string, subtitle: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`og-card\0${title}\0${subtitle}`)
    .digest('base64url')
    .slice(0, 22);
}

/** `/api/og` URL for a card showing `title` (and `subtitle`), signed. */
export function ogImageUrl(title: string, subtitle = ''): string {
  let secret: string;
  try {
    secret = getConfig().authSecret;
  } catch {
    // No secret to sign with — the route then shows the site title anyway.
    return '/api/og';
  }
  const t = clip(title, OG_TITLE_MAX);
  const s = clip(subtitle, OG_SUBTITLE_MAX);
  const params = new URLSearchParams({ title: t });
  if (s) params.set('subtitle', s);
  params.set('sig', sign(secret, t, s));
  return `/api/og?${params.toString()}`;
}

/**
 * The title and subtitle of a card URL, or null unless the URL was produced
 * by `ogImageUrl()` with this secret.
 */
export function verifiedOgText(
  params: URLSearchParams,
  secret: string,
): { title: string; subtitle: string } | null {
  const title = params.get('title');
  const subtitle = params.get('subtitle') ?? '';
  const sig = params.get('sig');
  if (!title || !sig || !secret) return null;

  const expected = Buffer.from(sign(secret, title, subtitle));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  return { title, subtitle };
}
