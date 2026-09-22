/**
 * Pins for a journal map block.
 *
 * The block's items say what goes on the map, in order. A typed point is the
 * author's content and is published as typed. A photo item is derived from
 * EXIF the author may not have thought about, so it is placed under the same
 * per-photo precision the EXIF route applies (album `location:`, #469): the
 * map page is the only other public GPS surface and publishes positions
 * quantised per album, and a map inside a story must not become a sloppier
 * one. Everything here runs on the server, from photos the page has already
 * fetched; only quantised positions and allowed place names reach the client.
 */

import type { ImmichAsset } from './immich';
import type { MapItem, MapPin } from './journal';
import { applyPrecision, placeLabel, snapToGrid, type LocationPrecision } from './mapPrecision';
import { assetLocationPrecision } from './assetLocation';

type GeoAsset = Pick<ImmichAsset, 'id' | 'exifInfo'>;

/**
 * `exact` on the map page means the mean of an album's photos in a city —
 * never a single photo's coordinates. A journal photo pin is one photo, so
 * `exact` here is snapped to a 0.01° grid (~1 km): a hike or a trip stays a
 * route, a house does not become a marker. Decided 2026-09-22.
 */
const EXACT_STEP = 0.01;
const EXACT_DECIMALS = 2;

/**
 * Pure. `entryPhotoIds` are the photos the story shows, in order — what
 * `photos: all` expands to, minus the ids listed as explicit photo items.
 * `country` produces no pin: it snaps to a 1° cell, a hundred kilometres,
 * and on a story-sized map that is not a place. Two items at one (quantised)
 * position become one pin; first appearance wins the order.
 */
export function pinsForEntry(
  items: readonly MapItem[],
  assets: readonly GeoAsset[],
  entryPhotoIds: readonly string[],
  precisionOf: (assetId: string) => LocationPrecision,
): MapPin[] {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const explicitPhotoIds = new Set(
    items.flatMap((item) => (item.kind === 'photo' ? [item.assetId] : [])),
  );
  const seen = new Set<string>();
  const pins: MapPin[] = [];

  const push = (pin: MapPin) => {
    const key = `${pin.lat},${pin.lng}`;
    if (seen.has(key)) return;
    seen.add(key);
    pins.push(pin);
  };

  const photoPin = (id: string): MapPin | null => {
    const exif = byId.get(id)?.exifInfo;
    // `== null`, not a falsiness check: 0 is the equator or the prime meridian (#635).
    if (!exif || exif.latitude == null || exif.longitude == null) return null;

    const level = precisionOf(id);
    if (level === 'hidden' || level === 'country') return null;

    const quantised = applyPrecision({ lat: exif.latitude, lng: exif.longitude }, level);
    if (!quantised) return null;
    const pos =
      level === 'exact'
        ? {
            lat: snapToGrid(quantised.lat, EXACT_STEP, EXACT_DECIMALS),
            lng: snapToGrid(quantised.lng, EXACT_STEP, EXACT_DECIMALS),
          }
        : quantised;

    const place = placeLabel(level, { city: exif.city ?? '', country: exif.country ?? '' });
    const label = [place.city, place.country].filter(Boolean).join(', ');
    return label ? { lat: pos.lat, lng: pos.lng, label } : { lat: pos.lat, lng: pos.lng };
  };

  for (const item of items) {
    if (item.kind === 'point') {
      push(
        item.label
          ? { lat: item.lat, lng: item.lng, label: item.label }
          : { lat: item.lat, lng: item.lng },
      );
    } else if (item.kind === 'photo') {
      const pin = photoPin(item.assetId);
      if (pin) push(pin);
    } else {
      for (const id of entryPhotoIds) {
        if (explicitPhotoIds.has(id)) continue;
        const pin = photoPin(id);
        if (pin) push(pin);
      }
    }
  }

  return pins;
}

/** Server wrapper: each photo's precision resolved the way the EXIF route does. */
export async function entryMapPins(
  items: readonly MapItem[],
  assets: readonly GeoAsset[],
  entryPhotoIds: readonly string[],
): Promise<MapPin[]> {
  const wanted = new Set<string>();
  for (const item of items) {
    if (item.kind === 'photo') wanted.add(item.assetId);
    else if (item.kind === 'all-photos') for (const id of entryPhotoIds) wanted.add(id);
  }
  const ids = Array.from(wanted);
  const levels = await Promise.all(ids.map((id) => assetLocationPrecision(id)));
  const byId = new Map(ids.map((id, i) => [id, levels[i]]));
  return pinsForEntry(items, assets, entryPhotoIds, (id) => byId.get(id) ?? 'exact');
}
