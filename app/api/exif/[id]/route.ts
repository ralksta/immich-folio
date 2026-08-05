/**
 * EXIF metadata API route — returns camera/lens/settings info for an asset.
 * Called on-demand by the lightbox when the user clicks "Info".
 *
 * The :token is an encoded asset ID (not a raw UUID).
 */

import { NextRequest, NextResponse } from 'next/server';
import { immich, ImmichUnavailableError } from '@/lib/immich';
import { decodeAssetId } from '@/lib/tokens';
import { getConfig } from '@/lib/config';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const config = getConfig();

  // Security: If EXIF is globally disabled, do not serve it via API either
  if (!config.exifOnHover) {
    return NextResponse.json({ error: 'EXIF metadata is disabled' }, { status: 403 });
  }

  // ── Rate limiting ──────────────────────────────────
  const ip = getClientIp(request);
  const { success, resetAt } = checkRateLimit(`exif:${ip}`, config.rateLimitRpm);

  if (!success) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    console.warn(`[EXIF API] ⚠️ Rate limit exceeded for IP: ${ip}. Retry after ${retryAfter}s`);
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id: token } = await params;

  // Decode the opaque token back to an Immich asset ID
  const assetId = decodeAssetId(token);
  if (!assetId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  let asset;
  try {
    asset = await immich.getAssetInfo(assetId);
  } catch (error) {
    // Immich is down, not "this asset has no EXIF" — say so, so the lightbox
    // can retry rather than caching a 404 for a photo that does have data.
    if (error instanceof ImmichUnavailableError) {
      console.error(`[EXIF API] Immich unavailable for ${assetId}:`, error.message);
      return NextResponse.json(
        { error: 'Immich is currently unavailable' },
        { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
      );
    }
    throw error;
  }

  if (!asset?.exifInfo) {
    return NextResponse.json({ error: 'No EXIF data' }, { status: 404 });
  }

  const exif = asset.exifInfo;
  return NextResponse.json(
    {
      make: exif.make,
      model: exif.model,
      lensModel: exif.lensModel,
      focalLength: exif.focalLength,
      fNumber: exif.fNumber,
      exposureTime: exif.exposureTime,
      iso: exif.iso,
      city: exif.city,
      country: exif.country,
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=86400, stale-while-revalidate=3600',
      },
    },
  );
}
