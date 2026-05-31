/**
 * Video proxy route — streams Immich video assets to the browser
 * without exposing the Immich server or API key.
 *
 * Supports HTTP Range requests (required for <video> seeking in browsers).
 *
 * Usage: GET /api/video/:token
 *        GET /api/video/:token  (with Range header for seeking)
 * The :token is an encoded asset ID (not a raw UUID).
 */

import { NextRequest, NextResponse } from 'next/server';
import { immich } from '@/lib/immich';
import { decodeAssetId } from '@/lib/tokens';
import { getConfig } from '@/lib/config';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ── Rate limiting ──────────────────────────────────
  const ip = getClientIp(request);
  const { success, remaining, resetAt } = checkRateLimit(`video:${ip}`, getConfig().rateLimitRpm);

  if (!success) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    console.warn(`[Video API] ⚠️ Rate limit exceeded for IP: ${ip}. Retry after ${retryAfter}s`);
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id: token } = await params;

  // Decode the opaque token back to an Immich asset ID
  const assetId = decodeAssetId(token);
  if (!assetId) {
    console.error(`[Video API] ❌ Invalid token: ${token.substring(0, 10)}...`);
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  // Forward Range header from browser (needed for <video> seeking)
  const rangeHeader = request.headers.get('range');

  const result = await immich.streamVideo(assetId, rangeHeader);
  if (!result) {
    console.error(`[Video API] ❌ Asset not found in Immich: ${assetId}`);
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  let contentType = result.contentType.toLowerCase();
  if (!contentType.startsWith('video/') && !contentType.startsWith('audio/')) {
    contentType = 'application/octet-stream';
  }

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    // Videos are immutable once uploaded — cache aggressively
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    'X-RateLimit-Remaining': String(remaining),
  };

  if (result.contentLength) {
    headers['Content-Length'] = result.contentLength;
  }
  if (result.contentRange) {
    headers['Content-Range'] = result.contentRange;
  }

  return new NextResponse(result.stream, {
    status: result.status,
    headers,
  });
}
