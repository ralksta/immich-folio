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
import { immich, ImmichUnavailableError } from '@/lib/immich';
import { isPublishedAsset } from '@/lib/publishedAssets';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import { decodeAssetId } from '@/lib/tokens';
import { getConfig } from '@/lib/config';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';
import { siteLockResponse } from '@/lib/auth';
import {
  parseContentRange,
  patchStream,
  playbackPlan,
  type RangeFetcher,
} from '@/lib/videoPlayback';

/** The first `n` bytes of a stream; the rest is cancelled. */
async function readUpTo(stream: ReadableStream<Uint8Array>, n: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (length < n) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      length += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(Math.min(length, n));
  let at = 0;
  for (const part of parts) {
    if (at >= out.length) break;
    out.set(part.subarray(0, out.length - at), at);
    at += part.length;
  }
  return out;
}

/** Ranged reads of one video's playback file, for lib/videoPlayback.ts. */
function rangeFetcher(assetId: string): RangeFetcher {
  return async (start, end) => {
    const res = await immich.streamVideo(assetId, `bytes=${start}-${end}`);
    if (!res) return null;
    const range = parseContentRange(res.contentRange);
    if (res.status === 206 && range?.start === start) {
      return { bytes: await readUpTo(res.stream, end - start + 1), total: range.total };
    }
    // A 200 is the whole file. That only works for a read from the start.
    const total = Number(res.contentLength);
    if (res.status === 200 && start === 0 && Number.isFinite(total)) {
      return { bytes: await readUpTo(res.stream, end + 1), total };
    }
    await res.stream.cancel().catch(() => {});
    throw new Error(`Immich did not answer the range ${start}-${end} for video ${assetId}`);
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ── Rate limiting ──────────────────────────────────
  const ip = getClientIp(request);
  const { success, remaining, resetAt } = checkRateLimit(`video:${ip}`, getConfig().rateLimitRpm);

  if (!success) {
    const retryAfter = retryAfterSeconds(resetAt);
    console.warn(`[Video API] ⚠️ Rate limit exceeded for IP: ${ip}. Retry after ${retryAfter}s`);
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
    console.error(`[Video API] ❌ Invalid token: ${token.substring(0, 10)}...`);
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  // Only what the site currently shows (GHSA-gfh4-6275-9gqv): a token stays
  // decodable forever, so an unpublished album or a revoked proofing link
  // would otherwise keep serving. Signed-in admins pass for previews.
  if (!(await isPublishedAsset(assetId)) && !(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Forward Range header from browser (needed for <video> seeking)
  const rangeHeader = request.headers.get('range');

  let result;
  try {
    result = await immich.streamVideo(assetId, rangeHeader);
  } catch (error) {
    // Same reasoning as the image route: an outage mid-playback must not be
    // cached as a permanently missing video.
    if (error instanceof ImmichUnavailableError) {
      console.error(`[Video API] Immich unavailable for ${assetId}:`, error.message);
      return NextResponse.json(
        { error: 'Immich is currently unavailable' },
        { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
      );
    }
    throw error;
  }

  if (!result) {
    console.error(`[Video API] ❌ Asset not found in Immich: ${assetId}`);
    return NextResponse.json(
      { error: 'Asset not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Location out of what is played (lib/videoPlayback.ts): Immich's playback
  // file is the original whenever it did not transcode, and an original
  // keeps where it was recorded. The edits are planned once per video and
  // applied to whichever range this response carries.
  const served =
    result.status === 206
      ? parseContentRange(result.contentRange)
      : { start: 0, total: Number(result.contentLength) };
  let planned;
  try {
    if (!served || !Number.isFinite(served.total)) throw new Error('unknown video length');
    planned = await playbackPlan(assetId, served.total, rangeFetcher(assetId));
  } catch (error) {
    await result.stream.cancel().catch(() => {});
    if (error instanceof ImmichUnavailableError) {
      console.error(`[Video API] Immich unavailable for ${assetId}:`, error.message);
      return NextResponse.json(
        { error: 'Immich is currently unavailable' },
        { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
      );
    }
    planned = {
      ok: false as const,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
  if (!planned.ok) {
    await result.stream.cancel().catch(() => {});
    console.warn(
      `[Video API] Refused video ${assetId}: its location metadata could not be located (${planned.reason}).`,
    );
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const body = patchStream(result.stream, served!.start, planned.plan.patches);

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

  return new NextResponse(body, {
    status: result.status,
    headers,
  });
}
