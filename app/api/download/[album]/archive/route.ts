/**
 * Archive download route — streams an album, or a selection of its assets, as
 * a ZIP of the originals.
 *
 * Sits beside the single-asset download and re-checks the exact same things:
 *
 *   - the album must be on the allowlist,
 *   - the album must have opted in with `download: true`,
 *   - every password gate on a route to it must be satisfied, and
 *   - every asset requested must actually belong to that album.
 *
 * A `GET` returns the whole album. A `POST` with `{ "assets": [<token>, …] }`
 * returns only those assets; each token is the opaque asset token the proofing
 * UI already holds, decoded here and checked against the album's membership.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import archiver from 'archiver';
import { cookies } from 'next/headers';
import { immich, ImmichUnavailableError, type ImmichAsset } from '@/lib/immich';
import { decodeAssetId } from '@/lib/tokens';
import { getConfig } from '@/lib/config';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';
import { isAlbumReachable, siteLockResponse } from '@/lib/auth';
import { contentDisposition, safeDownloadName } from '@/lib/downloadName';

export const dynamic = 'force-dynamic';

/**
 * Far below even the single-asset limit: one request may pull down an entire
 * album of originals, so it must be a deliberate, rare action per visitor.
 */
const ARCHIVE_RPM = 5;

/** One 404 for every refusal, so the response never says which check failed. */
const notFound = () =>
  NextResponse.json(
    { error: 'Not found' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } },
  );

/**
 * A unique, ZIP-safe entry name. Originals can collide ("IMG_0001.jpg" from two
 * cards), and a ZIP with duplicate entry names is ambiguous to unzip.
 */
function uniqueEntryName(raw: string | undefined, used: Set<string>): string {
  const base = safeDownloadName(raw);
  let name = base;
  let n = 2;
  while (used.has(name)) {
    const dot = base.lastIndexOf('.');
    name = dot > 0 ? `${base.slice(0, dot)}-${n}${base.slice(dot)}` : `${base}-${n}`;
    n++;
  }
  used.add(name);
  return name;
}

/** A refusal to short-circuit with, or a decoded album ready to stream. */
type ResolvedAlbum = { error: Response } | { albumName: string; assets: ImmichAsset[] };

/**
 * The shared authorisation preamble for both verbs: rate limit, site lock, and
 * every check the single-asset download performs before streaming a byte.
 */
async function resolveAlbum(
  request: NextRequest,
  params: { album: string },
): Promise<ResolvedAlbum> {
  const ip = getClientIp(request);
  // Its own bucket, not the single-asset `download:` one: the two share a
  // client but enforce different limits (5 vs 30 rpm), and letting a handful of
  // single-file downloads spend the whole-album budget would be wrong.
  const rl = checkRateLimit(`archive:${ip}`, ARCHIVE_RPM);
  if (!rl.success) {
    return {
      error: NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds(rl.resetAt)),
            'Cache-Control': 'no-store',
          },
        },
      ),
    };
  }

  const locked = siteLockResponse(request);
  if (locked) return { error: locked };

  const albumId = decodeAssetId(params.album);
  if (!albumId) return { error: notFound() };

  const config = getConfig();
  if (!config.albums.includes(albumId)) return { error: notFound() };
  if (!config.albumDownloads[albumId]) return { error: notFound() };

  // Every gate on every route to the album — see the single-asset route.
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  if (!isAlbumReachable(albumId, getCookie)) return { error: notFound() };

  let album;
  try {
    album = await immich.getAlbum(albumId);
  } catch (error) {
    if (error instanceof ImmichUnavailableError) {
      return {
        error: NextResponse.json(
          { error: 'Immich is currently unavailable' },
          { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
        ),
      };
    }
    throw error;
  }
  if (!album) return { error: notFound() };

  const assets = album.assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO');
  return { albumName: album.albumName, assets };
}

/**
 * Stream `assets` as a ZIP of originals.
 *
 * archiver writes data descriptors for streamed entries, so no size is known up
 * front — each asset is fetched and piped through in order, one at a time,
 * keeping memory flat no matter how large the album is.
 */
function streamArchive(albumName: string, assets: ImmichAsset[]): NextResponse {
  const archive = archiver('zip', { store: true });
  archive.on('error', (err) => {
    console.error(`[Download] Archive stream failed:`, err);
  });

  const body = Readable.toWeb(archive) as unknown as ReadableStream;

  // Append everything in the background: the response has to go out now so the
  // client starts reading, and each originals fetch is awaited in turn.
  void (async () => {
    try {
      const used = new Set<string>();
      for (const asset of assets) {
        const result = await immich.streamAsset(asset.id, 'original');
        if (!result) continue;
        const nodeStream = Readable.fromWeb(
          result.stream as unknown as import('node:stream/web').ReadableStream,
        );
        archive.append(nodeStream, { name: uniqueEntryName(asset.originalFileName, used) });
      }
      await archive.finalize();
    } catch (err) {
      archive.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  const zipName = `${safeDownloadName(albumName, 'album')}.zip`;
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDisposition(zipName),
      // Private: authorised per visitor, so a shared cache must not hand the
      // archive to the next one.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ album: string }> },
) {
  const { album } = await params;
  const resolved = await resolveAlbum(request, { album });
  if ('error' in resolved) return resolved.error;
  return streamArchive(resolved.albumName, resolved.assets);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ album: string }> },
) {
  const { album } = await params;
  const resolved = await resolveAlbum(request, { album });
  if ('error' in resolved) return resolved.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return notFound();
  }

  const tokens = (body as { assets?: unknown })?.assets;
  if (!Array.isArray(tokens) || tokens.length === 0 || tokens.length > resolved.assets.length) {
    return notFound();
  }

  // Every token must decode to an asset that really belongs to the album; a
  // token is unforgeable (AES-GCM), but membership is the check that keeps one
  // album's archive from naming another album's assets.
  const byId = new Map(resolved.assets.map((a) => [a.id, a]));
  const selected: ImmichAsset[] = [];
  for (const token of tokens) {
    if (typeof token !== 'string') return notFound();
    const assetId = decodeAssetId(token);
    if (!assetId) return notFound();
    const asset = byId.get(assetId);
    if (!asset) return notFound();
    selected.push(asset);
  }

  return streamArchive(resolved.albumName, selected);
}
