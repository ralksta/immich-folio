/**
 * ThumbHash utilities for generating blur placeholders and dominant colors.
 * Uses the thumbhash package to decode Immich's base64-encoded ThumbHash strings
 * into data URLs and hex color values.
 */

import { thumbHashToRGBA, thumbHashToDataURL } from 'thumbhash';

// Bounded caches for expensive ThumbHash decoding operations
const CACHE_LIMIT = 1000;
const blurDataUrlCache = new Map<string, string>();
const dominantHexCache = new Map<string, string>();

function setCache<K, V>(map: Map<K, V>, key: K, value: V) {
  if (map.size >= CACHE_LIMIT) {
    const firstKey = map.keys().next().value;
    // Evict the first key using length check to avoid falsy string issue
    if (firstKey !== undefined) map.delete(firstKey);
  }
  map.set(key, value);
}

/**
 * Fast base64 to Uint8Array decoder.
 * Uses native Buffer in Node.js/Edge environments (~10x faster)
 * and falls back to atob for browser client.
 */
function decodeBase64(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    // ⚡ Bolt: Return Buffer directly instead of wrapping in new Uint8Array.
    // Buffer inherits from Uint8Array, so returning it directly prevents
    // unnecessary memory allocation and copying.
    return Buffer.from(base64, 'base64');
  }
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/**
 * Convert an Immich base64-encoded ThumbHash into a tiny data URL
 * suitable for next/image's blurDataURL prop.
 */
export function thumbHashToBlurDataUrl(base64: string): string {
  const cached = blurDataUrlCache.get(base64);
  if (cached) return cached;

  const bytes = decodeBase64(base64);
  const url = thumbHashToDataURL(bytes);
  setCache(blurDataUrlCache, base64, url);
  return url;
}

/**
 * Extract the dominant/average color from a ThumbHash as a hex string.
 * Computes the weighted average of all non-transparent pixels.
 */
export function thumbHashToDominantHex(base64: string): string {
  const cached = dominantHexCache.get(base64);
  if (cached) return cached;

  const bytes = decodeBase64(base64);
  const { w, h, rgba } = thumbHashToRGBA(bytes);

  let r = 0,
    g = 0,
    b = 0,
    total = 0;
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3];
    if (a > 0) {
      const weight = a / 255;
      r += rgba[i * 4] * weight;
      g += rgba[i * 4 + 1] * weight;
      b += rgba[i * 4 + 2] * weight;
      total += weight;
    }
  }

  if (total === 0) {
    setCache(dominantHexCache, base64, '#888888');
    return '#888888';
  }

  const avg = (v: number) =>
    Math.round(v / total)
      .toString(16)
      .padStart(2, '0');
  const hex = `#${avg(r)}${avg(g)}${avg(b)}`;
  setCache(dominantHexCache, base64, hex);
  return hex;
}
