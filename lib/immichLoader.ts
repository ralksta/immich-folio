/**
 * Custom next/image loader for Immich proxy.
 *
 * Referenced by next.config.ts via images.loaderFile.
 * Generates URLs that point to our /api/image proxy route.
 *
 * The src passed to next/image should already be a full proxy URL
 * (e.g. /api/image/<token>?size=preview). This loader appends the width —
 * collapsed to the width of the Immich tier it resolves to, so every srcset
 * candidate of one tier is the same URL (see canonicalImageUrl).
 */

'use client';

import { canonicalImageUrl } from './imageSize';

interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

export default function immichLoader({ src, width }: ImageLoaderParams): string {
  return canonicalImageUrl(src, width);
}
