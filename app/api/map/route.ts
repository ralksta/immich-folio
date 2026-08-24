/**
 * Map data API — returns location-level markers for the map view.
 * Each marker represents a unique city/country with averaged GPS coords.
 * Cover asset IDs are encrypted for security.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getConfig } from '@/lib/config';
import { imageUrl } from '@/lib/urls';
import { isAuthenticated, siteLockResponse } from '@/lib/auth';
import { getMapData } from '@/lib/mapService';
import { applyPrecision, strictestPrecision, type LocationPrecision } from '@/lib/mapPrecision';
import { ImmichUnavailableError } from '@/lib/immich';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Map data is cached client-side, so a low limit is plenty. */
const MAP_RPM = 120;

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`map:${ip}`, MAP_RPM);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds(rl.resetAt)),
          'X-RateLimit-Limit': '120',
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  // The page-level gate does not cover route handlers — without this a locked
  // site would still serve to anyone holding the URL.
  const locked = siteLockResponse(request);
  if (locked) return locked;

  const config = getConfig();

  if (!config.map) {
    return NextResponse.json({ error: 'Map is not enabled' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;

  let locations;
  try {
    locations = await getMapData();
  } catch (error) {
    // Without this the map would render as "no photos anywhere" during an
    // Immich outage, which is indistinguishable from a gallery with no GPS data.
    if (error instanceof ImmichUnavailableError) {
      console.error('[Map API] Immich unavailable:', error.message);
      return NextResponse.json(
        { error: 'Immich is currently unavailable' },
        { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
      );
    }
    throw error;
  }

  // Filter locations and albums based on auth.
  // An album is visible only if BOTH its subpage gate (if any) and its own
  // album-level password gate are satisfied. Standalone albums are NOT
  // implicitly public — they can carry their own password.
  const subpageAuthCache = new Map<string, boolean>();
  const albumAuthCache = new Map<string, boolean>();

  const isSubpageAllowed = (slug: string): boolean => {
    const cached = subpageAuthCache.get(slug);
    if (cached !== undefined) return cached;
    const result = isAuthenticated(slug, getCookie);
    subpageAuthCache.set(slug, result);
    return result;
  };

  const isAlbumAllowed = (albumId: string): boolean => {
    const cached = albumAuthCache.get(albumId);
    if (cached !== undefined) return cached;
    const result = isAuthenticated(albumId, getCookie, 'album');
    albumAuthCache.set(albumId, result);
    return result;
  };

  const precisionOf = (albumId: string): LocationPrecision =>
    config.albumLocationPrecision[albumId] ?? 'exact';

  const publicLocations = locations
    .map((loc) => {
      const allowedAlbums = loc.albums
        .filter((a) => (!a.subpageSlug || isSubpageAllowed(a.subpageSlug)) && isAlbumAllowed(a.id))
        // `location: hidden` drops the album from the map entirely, before it
        // can contribute. Withholding only its coordinates would still let the
        // photo count and the cover name a place it asked to be absent from.
        .filter((a) => precisionOf(a.id) !== 'hidden');

      if (allowedAlbums.length === 0) return null;

      // Aggregate over visible albums only, so neither the marker position,
      // the photo count, nor the cover asset reveals a protected album.
      const photoCount = allowedAlbums.reduce((sum, a) => sum + a.photoCount, 0);
      const latSum = allowedAlbums.reduce((sum, a) => sum + a.latSum, 0);
      const lngSum = allowedAlbums.reduce((sum, a) => sum + a.lngSum, 0);

      /*
       * One marker merges several albums, so the most cautious of them governs
       * the whole marker. Splitting it instead would itself announce that one
       * album is set more carefully — which is the thing being hidden.
       *
       * Quantised here, server-side: coordinates are never sent exact for the
       * client to round.
       */
      const position = applyPrecision(
        { lat: latSum / photoCount, lng: lngSum / photoCount },
        strictestPrecision(allowedAlbums.map((a) => precisionOf(a.id))),
      );
      if (!position) return null;

      return {
        city: loc.city,
        country: loc.country,
        lat: position.lat,
        lng: position.lng,
        photoCount,
        coverUrl: imageUrl(allowedAlbums[0].coverAssetId, 'thumbnail'),
        albums: allowedAlbums.map((a) => ({
          name: a.name,
          url: a.subpageSlug ? `/${a.subpageSlug}/${a.slug}` : `/${a.slug}`,
        })),
      };
    })
    .filter((loc) => loc !== null);

  return NextResponse.json(publicLocations, {
    headers: {
      // Private 5-minute browser cache: reduces re-fetches during a session
      // while still preventing shared/CDN caching of personalised data.
      'Cache-Control': 'private, max-age=300, must-revalidate',
    },
  });
}
