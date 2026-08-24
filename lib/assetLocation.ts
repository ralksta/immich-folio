/**
 * The location precision that applies to a single photograph (#469).
 *
 * `location:` was written for the map, and the map was the only surface that
 * honoured it. The lightbox info panel names the city and country of every
 * photo from its own EXIF, gated on the global `exifDisplay` group — so an
 * album set to `location: hidden`, which asks to be absent from the map
 * entirely, still told anyone who clicked "Info" exactly where it was taken.
 * Two settings with almost the same name disagreeing about the same fact.
 *
 * An asset has no album in its own right: the info request carries only an
 * asset token. So the question is turned around — of the albums the operator
 * deliberately restricted, which ones carry this asset?
 *
 * That keeps the common case free. Nobody using `location:` means nothing to
 * check and no album fetched; the cost is bounded by how many albums were
 * restricted, not by how many exist.
 */

import { getConfig } from './config';
import { immich } from './immich';
import { strictestPrecision, type LocationPrecision } from './mapPrecision';

/**
 * The strictest `location:` among the albums carrying this asset, or `exact`
 * when none of them restricts anything.
 *
 * An album that cannot be read counts as `hidden`. Membership is then unknown,
 * and guessing that the asset is not in it would publish the position the
 * setting exists to withhold — so this fails closed, at the cost of the info
 * panel dropping its location line site-wide until the album is readable
 * again. A configured album that Immich no longer has is already a warning in
 * the config doctor.
 */
export async function assetLocationPrecision(assetId: string): Promise<LocationPrecision> {
  const restricted = Object.entries(getConfig().albumLocationPrecision).filter(
    ([, level]) => level !== 'exact',
  );
  if (restricted.length === 0) return 'exact';

  const levels = await Promise.all(
    restricted.map(async ([albumId, level]): Promise<LocationPrecision | null> => {
      try {
        const album = await immich.getAlbum(albumId);
        if (!album) return 'hidden';
        return album.assets.some((asset) => asset.id === assetId) ? level : null;
      } catch {
        return 'hidden';
      }
    }),
  );

  const applicable = levels.filter((level): level is LocationPrecision => level !== null);
  // strictestPrecision() reads an empty list as `hidden` — correct for a map
  // marker nothing contributed to, wrong here, where it means no restricted
  // album carries this photograph.
  return applicable.length === 0 ? 'exact' : strictestPrecision(applicable);
}
