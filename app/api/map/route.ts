/**
 * Map data API — returns location-level markers for the map view.
 * Each marker represents a unique city/country with averaged GPS coords.
 * Cover asset IDs are encrypted for security.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getConfig } from '@/lib/config';
import { imageUrl } from '@/lib/urls';
import { isAuthenticated } from '@/lib/auth';
import { getMapData } from '@/lib/mapService';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

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
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': '120',
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  const config = getConfig();

  if (!config.map) {
    return NextResponse.json({ error: 'Map is not enabled' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;

  const locations = await getMapData();

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

  const publicLocations = locations
    .map((loc) => {
      const allowedAlbums = loc.albums.filter(
        (a) => (!a.subpageSlug || isSubpageAllowed(a.subpageSlug)) && isAlbumAllowed(a.id),
      );

      if (allowedAlbums.length === 0) return null;

      // Aggregate over visible albums only, so neither the marker position,
      // the photo count, nor the cover asset reveals a protected album.
      const photoCount = allowedAlbums.reduce((sum, a) => sum + a.photoCount, 0);
      const latSum = allowedAlbums.reduce((sum, a) => sum + a.latSum, 0);
      const lngSum = allowedAlbums.reduce((sum, a) => sum + a.lngSum, 0);

      return {
        city: loc.city,
        country: loc.country,
        lat: latSum / photoCount,
        lng: lngSum / photoCount,
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
