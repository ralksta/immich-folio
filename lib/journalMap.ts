/**
 * Pins for a journal map block.
 *
 * The map page is the only public GPS surface and it publishes positions
 * quantised per album (`location: exact | city | country | hidden`, #469).
 * A map inside a story must not become a second, sloppier surface, so the
 * pins are derived here — on the server, from photos the page has already
 * fetched — under the same per-photo precision the EXIF route applies.
 * Nothing about a pin reaches the browser except the quantised position and
 * the place name that precision allows.
 */

import type { ImmichAsset } from './immich';
import type { MapPin } from './journal';
import { applyPrecision, placeLabel, snapToGrid, type LocationPrecision } from './mapPrecision';
import { assetLocationPrecision } from './assetLocation';

type GeoAsset = Pick<ImmichAsset, 'id' | 'exifInfo'>;

/**
 * `exact` on the map page means the mean of an album's photos in a city —
 * never a single photo's coordinates. A journal pin is one photo, so `exact`
 * here is snapped to a 0.01° grid (~1 km): a hike or a trip stays a route,
 * a house does not become a marker. Decided 2026-09-22.
 */
const EXACT_STEP = 0.01;
const EXACT_DECIMALS = 2;

/**
 * Pure: assets, the authoring order of their ids, and a precision per id.
 *
 * `country` produces no pin: it snaps to a 1° cell, a hundred kilometres, and
 * on a story-sized map that is not a place. `exact` and `city` do. Two photos
 * at one (quantised) position become one pin, and the order of first
 * appearance is the order of the line drawn between them.
 */
export function pinsForEntry(
  assets: readonly GeoAsset[],
  order: readonly string[],
  precisionOf: (assetId: string) => LocationPrecision,
): MapPin[] {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const pins: MapPin[] = [];

  for (const id of order) {
    const exif = byId.get(id)?.exifInfo;
    // `== null`, not a falsiness check: 0 is the equator or the prime meridian (#635).
    if (!exif || exif.latitude == null || exif.longitude == null) continue;

    const level = precisionOf(id);
    if (level === 'hidden' || level === 'country') continue;

    const quantised = applyPrecision({ lat: exif.latitude, lng: exif.longitude }, level);
    if (!quantised) continue;
    const pos =
      level === 'exact'
        ? {
            lat: snapToGrid(quantised.lat, EXACT_STEP, EXACT_DECIMALS),
            lng: snapToGrid(quantised.lng, EXACT_STEP, EXACT_DECIMALS),
          }
        : quantised;

    const key = `${pos.lat},${pos.lng}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const place = placeLabel(level, { city: exif.city ?? '', country: exif.country ?? '' });
    const label = [place.city, place.country].filter(Boolean).join(', ');
    pins.push(label ? { lat: pos.lat, lng: pos.lng, label } : { lat: pos.lat, lng: pos.lng });
  }

  return pins;
}

/** Server wrapper: each photo's precision resolved the way the EXIF route does. */
export async function entryMapPins(
  assets: readonly GeoAsset[],
  order: readonly string[],
): Promise<MapPin[]> {
  const ids = Array.from(new Set(order));
  const levels = await Promise.all(ids.map((id) => assetLocationPrecision(id)));
  const byId = new Map(ids.map((id, i) => [id, levels[i]]));
  return pinsForEntry(assets, order, (id) => byId.get(id) ?? 'exact');
}
