/**
 * Client-safe EXIF formatting. No `fs`, no crypto — `lib/urls.ts` cannot be
 * imported from a client component, and the lightbox needs this.
 */

/**
 * The camera as one readable name.
 *
 * EXIF carries maker and model separately, and most makers repeat themselves in
 * the model: Immich reports `make: "LEICA CAMERA AG"` with `model: "LEICA Q3"`,
 * Nikon `"NIKON CORPORATION"` with `"NIKON Z 6"`. Printing both gave
 * "LEICA CAMERA AG LEICA Q3", which is wrong twice over — it says the brand
 * twice, and it was long enough to collide with its own label in the info
 * panel (#514).
 *
 * Only the maker's first word is compared, and only against whole words of the
 * model, so "OM Digital Solutions" is dropped from "OM-1" without a stray "om"
 * inside another word passing for a brand. Makers the model does not name —
 * Sony's "ILCE-7M4", say — keep their prefix.
 */
export function formatCamera(make?: string | null, model?: string | null): string {
  const cleanModel = model?.trim() ?? '';
  const cleanMake = make?.trim() ?? '';

  if (!cleanModel) return cleanMake;
  if (!cleanMake) return cleanModel;

  const brand = cleanMake.split(/\s+/)[0].toLowerCase();
  const lowerModel = cleanModel.toLowerCase();
  const namesBrand = lowerModel.split(/[\s\-_]+/).includes(brand) || lowerModel.startsWith(brand);

  return namesBrand ? cleanModel : `${cleanMake} ${cleanModel}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The lens, without the camera it is built into.
 *
 * Phones report the whole device as the lens: an iPhone gives
 * `model: "iPhone 14 Pro"` and `lensModel: "iPhone 14 Pro back triple camera
 * 6.86mm f/1.78"`, so the tile and the lightbox strip read the model twice
 * ("IPHONE 14 PRO · IPHONE 14 PRO BACK TRIPLE CAMERA …"). When the camera is
 * shown next to it, the model is removed from the lens as a whole phrase
 * (case-insensitive, never inside another word). A lens that is nothing but
 * the model says nothing the camera does not, and becomes empty.
 */
export function formatLens(lens?: string | null, model?: string | null): string {
  const cleanLens = lens?.trim() ?? '';
  const cleanModel = model?.trim() ?? '';
  if (!cleanLens || !cleanModel) return cleanLens;

  const phrase = new RegExp(`(^|\\s)${escapeRegExp(cleanModel)}(?=\\s|$)`, 'i');
  if (!phrase.test(cleanLens)) return cleanLens;
  return cleanLens.replace(phrase, ' ').replace(/\s+/g, ' ').trim();
}

/** The aperture sign. `text-transform: uppercase` turns it into "Ƒ". */
export const APERTURE_SIGN = 'ƒ';
