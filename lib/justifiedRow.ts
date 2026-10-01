/**
 * Flex sizing for one tile of the justified photo layout.
 *
 * Every tile in a row has the same height (--grid-row-height). Its basis is
 * the width the photo needs at that height, and the leftover row width is
 * shared out by `flex-grow`, which is also the aspect ratio, so every photo in
 * the row widens by the same factor.
 *
 * A frame that puts a mat around the photo (passepartout) makes the tile
 * larger than the photo: --photo-mat-x across, --photo-mat-y down, both set
 * by the frame in globals.css and 0 without one. The basis therefore sizes
 * the photo inside the mat and adds the mat back; basing the whole tile on
 * the row height would give each photo the aspect ratio of its tile instead of
 * its own, cropping portraits hardest.
 *
 * Client-safe: no imports, used by PhotoGrid.
 */

/** Assumed for assets without dimensions (videos), ~3:2. */
export const JUSTIFIED_FALLBACK_RATIO = 1.5;

export interface JustifiedTileStyle {
  flexGrow: number;
  flexBasis: string;
}

export function justifiedTileStyle(aspectRatio?: number): JustifiedTileStyle {
  const ar =
    aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0
      ? aspectRatio
      : JUSTIFIED_FALLBACK_RATIO;
  return {
    flexGrow: ar,
    flexBasis: `calc((var(--grid-row-height, 300px) - var(--photo-mat-y, 0px)) * ${ar} + var(--photo-mat-x, 0px))`,
  };
}
