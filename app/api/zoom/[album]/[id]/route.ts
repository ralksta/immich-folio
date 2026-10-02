/**
 * The full-resolution image behind the lightbox zoom (#467).
 *
 * Shaped like the download route, and for the same reason: this hands out a
 * file at full resolution, so it re-checks everything instead of treating the
 * asset token as the capability the image proxy does.
 *
 *   - the album must be on the allowlist,
 *   - the visitor must be able to reach it by a route on which zoom resolves
 *     on — album, then subpage, then `zoom` in settings.yaml — with every
 *     password gate on that route satisfied,
 *   - the asset must currently be published and belong to that album, and
 *   - it must have a zoomable source (lib/zoomSource.ts).
 *
 * What it sends:
 *
 *   - JPEG and AVIF originals as they are stored, minus their location: GPS and
 *     sub-city place names are removed in place on the way through
 *     (lib/locationScrub.ts), so the length still holds.
 *   - For formats a browser cannot show (HEIC, RAW, TIFF, …), Immich's
 *     full-size JPEG rendition, through the same scrubber. When Immich has
 *     none — full-size previews switched off, or the asset not yet processed —
 *     the answer is 404 and the lightbox stays on the preview.
 *   - For a photo edited in Immich, whatever its format, the edited full-size
 *     rendition (#831), through the same scrubber, so the zoom shows the crop
 *     and rotation the preview shows.
 *
 * Whatever the source, only a file the scrubber recognised and cleaned goes
 * out, and only as JPEG or AVIF. A format it passes through untouched (a PNG
 * labelled as JPEG, a WebP rendition) is refused rather than sent with
 * whatever metadata it carries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { immich, ImmichUnavailableError } from '@/lib/immich';
import { decodeAssetId } from '@/lib/tokens';
import { getConfig } from '@/lib/config';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';
import { isAlbumZoomReachable, siteLockResponse } from '@/lib/auth';
import { isPublishedAsset } from '@/lib/publishedAssets';
import { scrubLocationStream } from '@/lib/locationScrub';
import { ZOOM_CONTENT_TYPES, zoomSourceFor } from '@/lib/zoomSource';

export const dynamic = 'force-dynamic';

/**
 * Per client IP and minute. A zoom is one deliberate gesture per photo, and
 * each answer is a full-resolution file off the Immich server — 7 MB for a
 * 60 MP JPEG. Twenty a minute is a zoom every three seconds, sustained, which
 * a visitor checking focus does not reach; a script pulling originals does.
 * Below the download route's 30: a download is rarer still, but zooming is
 * offered on whole albums that never opted into downloads.
 */
const ZOOM_RPM = 20;

const NO_STORE = { 'Cache-Control': 'no-store' };

/** One 404 for every refusal, so the response never says which check failed. */
const notFound = () =>
  NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });

const unavailable = () =>
  NextResponse.json(
    { error: 'Immich is currently unavailable' },
    { status: 503, headers: { ...NO_STORE, 'Retry-After': '30' } },
  );

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ album: string; id: string }> },
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`zoom:${ip}`, ZOOM_RPM);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { ...NO_STORE, 'Retry-After': String(retryAfterSeconds(rl.resetAt)) },
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
  if (!config.albums.includes(albumId)) return notFound();

  // Zoom on, and a route to the album the visitor could have taken. A route
  // handler is reached without passing through the page, so the page's gates
  // are asked again here.
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  if (!isAlbumZoomReachable(albumId, getCookie)) return notFound();

  // Same membership test as the image proxy: an album taken offline or an
  // asset removed from it stops being served at once, not after the cache.
  if (!(await isPublishedAsset(assetId))) return notFound();

  let album;
  try {
    album = await immich.getAlbum(albumId);
  } catch (error) {
    if (error instanceof ImmichUnavailableError) return unavailable();
    throw error;
  }
  if (!album) return notFound();

  // The asset has to be in the album that authorised the zoom.
  const asset = album.assets.find((candidate) => candidate.id === assetId);
  if (!asset) return notFound();

  const source = zoomSourceFor(asset);
  if (!source) return notFound();

  let result;
  try {
    // An edited photo (#831) is zoomed into Immich's edited full-size
    // rendition, never its original, which is the unedited file. Redirects
    // are not followed here either: should Immich send one, it would be to a
    // smaller rendition, which must not pass for full resolution.
    result =
      source === 'original'
        ? await immich.streamAsset(assetId, 'original')
        : await immich.streamFullsize(assetId, source === 'edited');
  } catch (error) {
    if (error instanceof ImmichUnavailableError) return unavailable();
    throw error;
  }
  // For `fullsize` this is the common "Immich has no rendition" case.
  if (!result) return notFound();

  const contentType = result.contentType.toLowerCase().split(';')[0].trim();
  if (!ZOOM_CONTENT_TYPES.has(contentType)) {
    await (result.stream as ReadableStream).cancel().catch(() => {});
    console.warn(`[Zoom] Refused ${assetId}: Immich sent ${contentType || 'no type'}.`);
    return notFound();
  }

  let scrubbed;
  try {
    scrubbed = await scrubLocationStream(result.stream as ReadableStream<Uint8Array>);
  } catch (error) {
    console.error(`[Zoom] Reading ${source} ${assetId} failed:`, error);
    return unavailable();
  }
  if (!scrubbed.ok) {
    console.warn(
      `[Zoom] Refused ${assetId}: its location metadata could not be removed (${scrubbed.reason}).`,
    );
    return notFound();
  }
  if (scrubbed.format === 'passthrough') {
    // Labelled JPEG/AVIF, but not a file the scrubber knows how to clean.
    await scrubbed.stream.cancel().catch(() => {});
    console.warn(`[Zoom] Refused ${assetId}: not a JPEG or HEIF-family file.`);
    return notFound();
  }

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    // Shown in the page, never saved by a click.
    'Content-Disposition': 'inline',
    // Private: the answer depends on this visitor's cookies, so a shared cache
    // (a CDN, a proxy) must not hand it to the next one. An hour in the
    // visitor's own cache makes a second zoom into the same photo free.
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  };
  // Scrubbing overwrites in place, so the upstream length still holds.
  if (result.contentLength) headers['Content-Length'] = result.contentLength;

  return new NextResponse(scrubbed.stream, { headers });
}
