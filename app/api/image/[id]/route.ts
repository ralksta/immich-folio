/**
 * Image proxy route — serves Immich assets to the browser
 * without exposing the Immich server or API key.
 *
 * Usage: GET /api/image/:token?size=thumbnail|preview|original
 *        GET /api/image/:token?w=640&q=75  (for next/image loader)
 * The :token is an encoded asset ID (not a raw UUID).
 */

import { NextRequest, NextResponse } from 'next/server';
import { immich, ImageSize, ImmichUnavailableError } from '@/lib/immich';
import { decodeAssetId } from '@/lib/tokens';
import { getConfig } from '@/lib/config';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const VALID_SIZES: ImageSize[] = ['thumbnail', 'preview', 'original'];

/**
 * Map a requested pixel width to the best Immich size tier.
 */
function widthToSize(w: number): ImageSize {
  if (w <= 250) return 'thumbnail';
  if (w <= 1440) return 'preview';
  return 'original';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ── Rate limiting ──────────────────────────────────
  const ip = getClientIp(request);
  const { success, remaining, resetAt } = checkRateLimit(`image:${ip}`, getConfig().rateLimitRpm);

  if (!success) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    console.warn(
      `[Image API] ⚠️ Rate limit exceeded for IP: ${ip} (UA: ${userAgent}). Retry after ${retryAfter}s`,
    );
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id: token } = await params;

  // Decode the opaque token back to an Immich asset ID
  const assetId = decodeAssetId(token);
  if (!assetId) {
    console.error(`[Image API] ❌ Invalid token: ${token.substring(0, 10)}...`);
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  // Determine size: prefer explicit ?size=, then infer from ?w=
  const sizeParam = request.nextUrl.searchParams.get('size');
  const widthParam = request.nextUrl.searchParams.get('w');

  let size: ImageSize = 'preview';
  if (sizeParam && VALID_SIZES.includes(sizeParam as ImageSize)) {
    size = sizeParam as ImageSize;
  } else if (widthParam) {
    const w = parseInt(widthParam, 10);
    if (!isNaN(w) && w > 0) {
      size = widthToSize(w);
    }
  }

  // ── Browser Cache Optimization ─────────────────────
  // Use the opaque token to generate a safe ETag without leaking Immich UUIDs
  const etag = `W/"${token}-${size}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-RateLimit-Remaining': String(remaining),
      },
    });
  }

  let result;
  try {
    result = await immich.streamAsset(assetId, size);
  } catch (error) {
    // An outage must not look like a deleted photo. These URLs are served with
    // `immutable` on success, and a bare 404 is heuristically cacheable — so
    // without no-store the browser can pin a broken image for the whole session.
    if (error instanceof ImmichUnavailableError) {
      console.error(`[Image API] Immich unavailable for ${assetId}:`, error.message);
      return NextResponse.json(
        { error: 'Immich is currently unavailable' },
        { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
      );
    }
    throw error;
  }

  if (!result) {
    console.error(`[Image API] ❌ Asset not found in Immich: ${assetId} (Size: ${size})`);
    return NextResponse.json(
      { error: 'Asset not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let contentType = result.contentType.toLowerCase();
  if (contentType.includes('application/octet-stream')) {
    contentType = 'image/jpeg';
  } else if (
    !contentType.startsWith('image/') ||
    contentType.includes('svg') ||
    contentType.includes('xml')
  ) {
    contentType = 'application/octet-stream';
  }

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    // Images are immutable once uploaded to Immich — cache aggressively
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: etag,
    'X-RateLimit-Remaining': String(remaining),
  };

  if (result.contentLength) {
    headers['Content-Length'] = result.contentLength;
  }

  return new NextResponse(result.stream, { headers });
}
