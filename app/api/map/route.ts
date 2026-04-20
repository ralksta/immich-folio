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

export async function GET(request: NextRequest) {
  // Rate limit: 120 requests/minute per IP (map data is cached client-side; this guards against abuse)
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, 120);
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

  // Filter locations and albums based on auth
  const publicLocations = locations
    .map((loc) => {
      // Only keep albums the user is allowed to see
      const allowedAlbums = loc.albums.filter((a) => {
        if (!a.subpageSlug) return true; // Standalone albums are public
        return isAuthenticated(a.subpageSlug, getCookie);
      });

      if (allowedAlbums.length === 0) return null;

      return {
        city: loc.city,
        country: loc.country,
        lat: loc.lat,
        lng: loc.lng,
        photoCount: loc.photoCount, // Note: This count might be slightly off if some photos are in hidden albums
        coverUrl: imageUrl(loc.coverAssetId, 'thumbnail'),
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
