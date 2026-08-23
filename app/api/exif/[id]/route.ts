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
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';
import { siteLockResponse } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const config = getConfig();

  // Which groups this site publishes. The description used to be served
  // unconditionally as editorial caption, which made it the one field an
  // operator could not switch off — the problem behind #506. It is a group like
  // any other now.
  const show = config.exif;

  // ── Rate limiting ──────────────────────────────────
  const ip = getClientIp(request);
  const { success, resetAt } = checkRateLimit(`exif:${ip}`, config.rateLimitRpm);

  if (!success) {
    const retryAfter = retryAfterSeconds(resetAt);
    console.warn(`[EXIF API] ⚠️ Rate limit exceeded for IP: ${ip}. Retry after ${retryAfter}s`);
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' },
      },
    );
  }

  // The page-level gate does not cover route handlers — without this a locked
  // site would still serve to anyone holding the URL.
  const locked = siteLockResponse(request);
  if (locked) return locked;

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
  const caption = show.caption ? exif.description?.trim() || undefined : undefined;

  const payload = {
    ...(show.camera
      ? {
          make: exif.make,
          model: exif.model,
          lensModel: exif.lensModel,
          focalLength: exif.focalLength,
        }
      : {}),
    ...(show.settings
      ? {
          fNumber: exif.fNumber,
          exposureTime: exif.exposureTime,
          iso: exif.iso,
        }
      : {}),
    ...(show.location ? { city: exif.city, country: exif.country } : {}),
    ...(caption ? { description: caption } : {}),
  };

  // Every group is switched off, or this asset carries nothing from the ones
  // that are on. Say "no data" rather than answering with an empty object, which
  // the lightbox would render as a blank panel.
  if (Object.values(payload).every((value) => value === null || value === undefined)) {
    return NextResponse.json({ error: 'No EXIF data' }, { status: 404 });
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'private, max-age=86400, stale-while-revalidate=3600',
    },
  });
}
