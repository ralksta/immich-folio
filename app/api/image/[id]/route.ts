/**
 * Image proxy route — serves Immich assets to the browser
 * without exposing the Immich server or API key.
 *
 * Usage: GET /api/image/:token?size=thumbnail|preview|original
 *        GET /api/image/:token?w=640&q=75  (for next/image loader)
 * The :token is an encoded asset ID (not a raw UUID).
 */

import { NextRequest, NextResponse } from 'next/server';
import { immich, ImageSize } from '@/lib/immich';
import { decodeAssetId } from '@/lib/tokens';
import { getConfig } from '@/lib/config';
import { checkRateLimit } from '@/lib/rate-limit';

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
  // Security: Prioritize request.ip and x-real-ip to prevent x-forwarded-for spoofing
  const ip =
    request.ip ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown';
  const { success, remaining, resetAt } = checkRateLimit(ip, getConfig().rateLimitRpm);

  if (!success) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    console.warn(`[Image API] ⚠️ Rate limit exceeded for IP: ${ip}. Retry after ${retryAfter}s`);
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

  const result = await immich.streamAsset(assetId, size);
  if (!result) {
    console.error(`[Image API] ❌ Asset not found in Immich: ${assetId} (Size: ${size})`);
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const headers: Record<string, string> = {
    'Content-Type': result.contentType.includes('application/octet-stream')
      ? 'image/jpeg'
      : result.contentType,
    // Images are immutable once uploaded to Immich — cache aggressively
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-RateLimit-Remaining': String(remaining),
  };

  if (result.contentLength) {
    headers['Content-Length'] = result.contentLength;
  }

  return new NextResponse(result.stream, { headers });
}
