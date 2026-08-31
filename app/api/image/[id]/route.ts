/**
 * Image proxy route — serves Immich assets to the browser
 * without exposing the Immich server or API key.
 *
 * Usage: GET /api/image/:token?size=thumbnail|preview|original
 *        GET /api/image/:token?w=640&q=75  (for next/image loader)
 * The :token is an encoded asset ID (not a raw UUID).
 */

import { NextRequest, NextResponse } from 'next/server';
import { immich, ImmichUnavailableError } from '@/lib/immich';
import { resolveImageSize } from '@/lib/imageSize';
import { decodeAssetId } from '@/lib/tokens';
import { getConfig } from '@/lib/config';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';
import { siteLockResponse } from '@/lib/auth';
import { blankRanges, findMetadataRanges } from '@/lib/metadataStrip';

/**
 * Bumping this changes every original's ETag, so a revalidating cache fetches
 * the stripped bytes instead of replaying a pre-fix copy. Browsers hold these
 * URLs as `immutable` and will not revalidate at all, so a real rollout also
 * needs IMAGE_CACHE_VERSION bumped — that changes the URL itself.
 */
const STRIP_VERSION = 's1';

/**
 * Originals are buffered whole so their metadata can be blanked before a single
 * byte reaches the client. Anything larger is not worth holding in memory; those
 * fall back to the preview rendition, which Immich generates without EXIF.
 */
const MAX_STRIP_BYTES = 64 * 1024 * 1024;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ── Rate limiting ──────────────────────────────────
  const ip = getClientIp(request);
  const { success, remaining, resetAt } = checkRateLimit(`image:${ip}`, getConfig().rateLimitRpm);

  if (!success) {
    const retryAfter = retryAfterSeconds(resetAt);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    console.warn(
      `[Image API] ⚠️ Rate limit exceeded for IP: ${ip} (UA: ${userAgent}). Retry after ${retryAfter}s`,
    );
    // Without Retry-After the browser and next/image back off on their own
    // schedule — a retry storm against a server that just said it was
    // overloaded, and one page issues ~50 of these requests. no-store because
    // the success path serves this URL as `immutable`.
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
    console.error(`[Image API] ❌ Invalid token: ${token.substring(0, 10)}...`);
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const size = resolveImageSize(
    request.nextUrl.searchParams.get('size'),
    request.nextUrl.searchParams.get('w'),
  );

  // ── Browser Cache Optimization ─────────────────────
  // Use the opaque token to generate a safe ETag without leaking Immich UUIDs.
  // IMAGE_CACHE_VERSION participates so that a bump is not defeated by a client
  // replaying the old ETag against the new URL — the response is served
  // `immutable`, so this only matters after expiry or a cache eviction, but a
  // matching ETag across two different URLs would be wrong either way.
  const cacheVersion = request.nextUrl.searchParams.get('v') ?? '';
  const etag = `W/"${token}-${size}-${STRIP_VERSION}${cacheVersion ? `-${cacheVersion}` : ''}"`;
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

  // ── Metadaten aus Originalen entfernen ─────────────
  // Das Asset-Token autorisiert das Bild, nicht die Groesse: ein aus dem
  // oeffentlichen HTML gelesenes Thumbnail-Token plus ?size=original lieferte
  // bis hierher die unveraenderte Datei — mitsamt GPS. app/api/exif haelt
  // Koordinaten bewusst zurueck, und /api/map quantisiert sie; dieser Pfad ging
  // an beidem vorbei. Nur die Metadaten-Bytes werden genullt, die Bilddaten
  // bleiben bitgenau erhalten — deshalb kostet das keine Qualitaet.
  let body: BodyInit = result.stream;
  // Gesetzt, sobald wir gestrippte Bytes ausliefern — der Wert ist dann die
  // maßgebliche Content-Length.
  let strippedLength: number | null = null;
  if (size === 'original') {
    const declaredLength = result.contentLength ? parseInt(result.contentLength, 10) : NaN;
    const zuGross = Number.isFinite(declaredLength) && declaredLength > MAX_STRIP_BYTES;

    const raw = zuGross ? null : new Uint8Array(await new Response(result.stream).arrayBuffer());
    const ranges =
      raw && raw.length <= MAX_STRIP_BYTES ? findMetadataRanges(raw, contentType) : null;

    if (raw && ranges) {
      const blanked = blankRanges(raw, ranges);
      strippedLength = blanked.byteLength;
      // ArrayBuffer statt Uint8Array: nur der ist ein gueltiger BodyInit. Die
      // Zusicherung ist sicher — die Bytes stammen aus Response.arrayBuffer(),
      // also nie aus einem SharedArrayBuffer, den ArrayBufferLike mit einschliesst.
      body = blanked.buffer.slice(
        blanked.byteOffset,
        blanked.byteOffset + blanked.byteLength,
      ) as ArrayBuffer;
    } else {
      // Unbekanntes Format, kaputter Container oder zu gross: lieber die
      // Vorschau ausliefern als ein Original, dessen Metadaten wir nicht
      // sicher finden. Stillschweigend durchreichen war genau der Fehler.
      console.warn(
        `[Image API] Original von ${assetId} (${contentType}) nicht strippbar — liefere Preview.`,
      );
      const preview = await immich.streamAsset(assetId, 'preview');
      if (!preview) {
        return NextResponse.json(
          { error: 'Asset not found' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      body = preview.stream;
      contentType = preview.contentType.toLowerCase().startsWith('image/')
        ? preview.contentType
        : 'image/jpeg';
      result = { ...preview, contentLength: preview.contentLength };
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    // Images are immutable once uploaded to Immich — cache aggressively
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: etag,
    'X-RateLimit-Remaining': String(remaining),
  };

  // Das Nullen ist laengentreu, der Wert bleibt also gueltig; beim
  // Preview-Fallback stammt er vom Preview-Abruf.
  if (strippedLength !== null) {
    headers['Content-Length'] = String(strippedLength);
  } else if (result.contentLength) {
    headers['Content-Length'] = result.contentLength;
  }

  return new NextResponse(body, { headers });
}
