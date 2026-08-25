/**
 * The JSON-LD payload for an album page (#472).
 *
 * `ImageGallery` with an `ImageObject` for the cover is the annotation that
 * pays off for a photography portfolio: it is what a search result can show,
 * and it is where `creator` and `license` belong.
 *
 * Built as a pure function so the shape can be asserted without rendering, and
 * so the "no site URL, no structured data" rule is stated once.
 */

export interface AlbumStructuredDataInput {
  siteUrl: string | null;
  /** Absolute URL of the album page. */
  pageUrl: string | null;
  albumName: string;
  description?: string;
  /** Absolute URL of the cover image, if there is one. */
  coverUrl?: string | null;
  /** The photographer, for `creator`. */
  creator?: string;
  /** A licence URL or short identifier, e.g. a Creative Commons link. */
  license?: string;
  photoCount?: number;
}

export function albumStructuredData(
  input: AlbumStructuredDataInput,
): Record<string, unknown> | null {
  // Structured data is a set of claims about URLs. Without an absolute site URL
  // there is nothing truthful to claim, so nothing is emitted.
  if (!input.siteUrl || !input.pageUrl) return null;
  if (!input.albumName.trim()) return null;

  const creator = input.creator?.trim()
    ? { '@type': 'Person', name: input.creator.trim() }
    : undefined;
  const license = input.license?.trim() || undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: input.albumName.trim(),
    url: input.pageUrl,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ...(typeof input.photoCount === 'number' ? { numberOfItems: input.photoCount } : {}),
    ...(creator ? { creator } : {}),
    ...(license ? { license } : {}),
    ...(input.coverUrl
      ? {
          image: {
            '@type': 'ImageObject',
            contentUrl: input.coverUrl,
            ...(creator ? { creator } : {}),
            ...(license ? { license } : {}),
          },
        }
      : {}),
  };
}
