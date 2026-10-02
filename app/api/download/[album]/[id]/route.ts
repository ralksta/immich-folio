/**
 * Download route for original files (#475).
 *
 * Deliberately separate from the image proxy. That route treats the opaque
 * asset token as the capability: holding one means you saw the page it was
 * rendered on, and it serves previews. Originals are the deliverable a client
 * pays for, so this route re-checks everything rather than inheriting that
 * assumption:
 *
 *   - the album must be on the allowlist,
 *   - the album must have opted in with `download: true`,
 *   - every password gate on a route to it must be satisfied — the album's own
 *     and, where that is the only way to it, the subpage's, and
 *   - the asset must actually belong to that album.
 *
 * The last one is what stops one enabled album's URL being edited into a
 * download of any asset in the Immich instance.
 *
 * The file goes out as Immich stores it, minus its location: GPS coordinates
 * are removed from JPEG, HEIC/HEIF and AVIF originals on the way through
 * (lib/locationScrub.ts). Camera data, copyright and colour profile stay.
 *
 * A photo edited in Immich's editor is the exception (#831): it goes out as
 * edited, which is Immich's full-resolution rendition of the edit — a JPEG
 * without EXIF — named with a matching extension. It passes the same
 * scrubber.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { immich, ImmichUnavailableError } from '@/lib/immich';
import { decodeAssetId } from '@/lib/tokens';
import { getConfig } from '@/lib/config';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';
import { isAlbumReachable, siteLockResponse } from '@/lib/auth';
import { contentDisposition, editedDownloadName } from '@/lib/downloadName';
import { scrubLocationStream } from '@/lib/locationScrub';

export const dynamic = 'force-dynamic';

/**
 * Far below the image limit. A gallery page fires dozens of image requests;
 * a download is one deliberate click, and each one is a full-size file off
 * the Immich server.
 */
const DOWNLOAD_RPM = 30;

/** One 404 for every refusal, so the response never says which check failed. */
const notFound = () =>
  NextResponse.json(
    { error: 'Not found' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } },
  );

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ album: string; id: string }> },
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`download:${ip}`, DOWNLOAD_RPM);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds(rl.resetAt)),
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  const locked = siteLockResponse(request);
  if (locked) return locked;

  const { album: albumToken, id: assetToken } = await params;
  const albumId = decodeAssetId(albumToken);
  const assetId = decodeAssetId(assetToken);
  if (!albumId || !assetId) return notFound();

  const config = getConfig();

  // On the allowlist, and opted in.
  if (!config.albums.includes(albumId)) return notFound();
  if (!config.albumDownloads[albumId]) return notFound();

  // Every gate on every route to the album, not just its own: an album with no
  // password of its own, reachable only through a subpage that has one, was
  // downloadable without that subpage ever being unlocked. The page checks
  // this before rendering; a route handler is reached without passing through
  // the page at all.
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  if (!isAlbumReachable(albumId, getCookie)) return notFound();

  let album;
  try {
    album = await immich.getAlbum(albumId);
  } catch (error) {
    if (error instanceof ImmichUnavailableError) {
      return NextResponse.json(
        { error: 'Immich is currently unavailable' },
        { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
      );
    }
    throw error;
  }
  if (!album) return notFound();

  // The asset has to be in the album that authorised the download.
  const asset = album.assets.find((candidate) => candidate.id === assetId);
  if (!asset) return notFound();

  let result;
  try {
    // A photo edited in Immich goes out as edited (#831): Immich's
    // full-resolution edited rendition rather than the unedited camera file.
    result = await immich.streamAsset(assetId, 'original', asset.isEdited === true);
  } catch (error) {
    if (error instanceof ImmichUnavailableError) {
      return NextResponse.json(
        { error: 'Immich is currently unavailable' },
        { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
      );
    }
    throw error;
  }
  if (!result) return notFound();

  // Location out, everything else in. The head is read before a byte is sent,
  // so a file whose metadata cannot be located is refused rather than leaked.
  let scrubbed;
  try {
    scrubbed = await scrubLocationStream(result.stream as ReadableStream<Uint8Array>);
  } catch (error) {
    console.error(`[Download] Reading original ${assetId} failed:`, error);
    return NextResponse.json(
      { error: 'Immich is currently unavailable' },
      { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
    );
  }
  if (!scrubbed.ok) {
    console.warn(
      `[Download] Refused original ${assetId}: its location metadata could not be removed (${scrubbed.reason}).`,
    );
    return notFound();
  }
  // An edited photo is a rendition Immich made, which Folio expects as JPEG
  // (#831). One in a format the scrubber passes through untouched (WebP,
  // PNG) is not what was measured, and is refused rather than sent with
  // whatever metadata it carries — as the zoom route does.
  if (asset.isEdited === true && scrubbed.format === 'passthrough') {
    await scrubbed.stream.cancel().catch(() => {});
    console.warn(
      `[Download] Refused edited asset ${assetId}: Immich sent ${result.contentType || 'no type'}, which is not a JPEG or HEIF-family file.`,
    );
    return notFound();
  }

  const headers: Record<string, string> = {
    'Content-Type': result.contentType || 'application/octet-stream',
    'Content-Disposition': contentDisposition(
      asset.isEdited === true
        ? editedDownloadName(asset.originalFileName, result.contentType)
        : asset.originalFileName,
    ),
    // Private: a download is authorised per visitor, so a shared cache must
    // not hand the file to the next one.
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  // Scrubbing overwrites in place, so the upstream length still holds.
  if (result.contentLength) headers['Content-Length'] = result.contentLength;

  return new NextResponse(scrubbed.stream, { headers });
}
