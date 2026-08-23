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
