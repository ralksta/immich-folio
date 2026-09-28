/**
 * Resolves which Immich rendition the image proxy should fetch.
 *
 * Two query parameters can influence it:
 *   ?size=  written by lib/urls.ts — the ceiling the server intends
 *   ?w=     appended by lib/immichLoader.ts — the width next/image will display
 *
 * Lives here rather than in the route so it can be unit-tested: vitest.config.ts
 * only collects lib/__tests__.
 */

import type { ImageSize } from './immich';

export const VALID_SIZES: ImageSize[] = ['thumbnail', 'preview', 'original'];

/** Smallest to largest — index order is the comparison. */
const SIZE_ORDER: ImageSize[] = ['thumbnail', 'preview', 'original'];

/** Map a requested pixel width to the best Immich size tier. */
export function widthToSize(w: number): ImageSize {
  if (w <= 250) return 'thumbnail';
  if (w <= 1440) return 'preview';
  return 'original';
}

function smaller(a: ImageSize, b: ImageSize): ImageSize {
  return SIZE_ORDER.indexOf(a) <= SIZE_ORDER.indexOf(b) ? a : b;
}

/**
 * When both parameters are present, take the **smaller** tier.
 *
 * `?size=` is a ceiling, not a demand: a width may lower the tier but must never
 * raise it. Letting width win outright would be actively harmful — next/image
 * emits widths up to 3840, and widthToSize(1920) is 'original', so every large
 * display would download full-size originals instead of previews.
 *
 * Previously `?size=` won unconditionally, which made this function unreachable
 * for any URL the app generates, since lib/urls.ts always writes `?size=`.
 */
/**
 * Ceiling this function will ever return, regardless of what the client asks
 * for. `/api/image` treats the opaque token as the whole capability check —
 * holding one means you saw the page it was rendered on — which is right for
 * a preview but not for the un-downsampled file. Only `/api/download`
 * verifies the album allowlist, `download: true` and every password gate
 * before handing out an original; nothing this route does replaces that.
 * `?size=original` or a large enough `?w=` alone used to reach `original`
 * unopposed, since the pairwise `smaller()` check below only ever ran when
 * *both* parameters were present.
 */
const MAX_SIZE: ImageSize = 'preview';

export function resolveImageSize(sizeParam: string | null, widthParam: string | null): ImageSize {
  const explicit =
    sizeParam && VALID_SIZES.includes(sizeParam as ImageSize) ? (sizeParam as ImageSize) : null;

  const w = widthParam ? parseInt(widthParam, 10) : NaN;
  const fromWidth = !isNaN(w) && w > 0 ? widthToSize(w) : null;

  const resolved =
    explicit && fromWidth ? smaller(explicit, fromWidth) : (explicit ?? fromWidth ?? 'preview');
  return smaller(resolved, MAX_SIZE);
}

/**
 * The `?w=` written for each tier: the widest value that still resolves to it.
 * `resolveImageSize(size, String(TIER_WIDTH[t]))` is `t` for every tier the
 * ceiling allows, so the canonical URL fetches exactly the rendition the
 * original width did.
 */
const TIER_WIDTH: Record<ImageSize, number> = { thumbnail: 250, preview: 1440, original: 3840 };

/**
 * One URL per asset and tier, whatever width is asked for.
 *
 * The proxy answers every width inside a tier with the same bytes — Immich
 * has one thumbnail and one preview per asset, and `MAX_SIZE` caps the rest —
 * but each distinct `?w=` is a separate `immutable` cache entry. next/image
 * writes eight or more widths into every srcset and the lightbox asked for the
 * bare URL, so a grid tile and the same photo in the lightbox, or one tile
 * before and after a rotation, downloaded the identical preview twice.
 * Collapsing the width to its tier makes all of them one cache entry. `q` is
 * dropped for the same reason: the proxy never read it.
 *
 * `width` defaults to "as large as the ceiling allows" — the lightbox's case.
 */
export function canonicalImageUrl(src: string, width: number = Number.MAX_SAFE_INTEGER): string {
  const queryAt = src.indexOf('?');
  const sizeParam = queryAt === -1 ? null : new URLSearchParams(src.slice(queryAt + 1)).get('size');
  const tier = resolveImageSize(sizeParam, String(Math.max(1, Math.round(width))));
  return `${src}${queryAt === -1 ? '?' : '&'}w=${TIER_WIDTH[tier]}`;
}
