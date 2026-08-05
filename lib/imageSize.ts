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
export function resolveImageSize(sizeParam: string | null, widthParam: string | null): ImageSize {
  const explicit =
    sizeParam && VALID_SIZES.includes(sizeParam as ImageSize) ? (sizeParam as ImageSize) : null;

  const w = widthParam ? parseInt(widthParam, 10) : NaN;
  const fromWidth = !isNaN(w) && w > 0 ? widthToSize(w) : null;

  if (explicit && fromWidth) return smaller(explicit, fromWidth);
  return explicit ?? fromWidth ?? 'preview';
}
