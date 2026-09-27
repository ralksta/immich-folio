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
 * A `GET` returns the whole album. A `POST` returns a selection, accepting
 * either `application/json` (`{ "assets": [<token>, …] }`) or the `assets=…`
 * form body the proofing modal posts — the form matters because the browser
 * then streams the response straight to disk instead of buffering the whole ZIP
 * in a blob.
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { immich, ImmichUnavailableError, type ImmichAsset } from '@/lib/immich';
import { decodeAssetId } from '@/lib/tokens';
import { getConfig } from '@/lib/config';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';
import { isAlbumReachable, siteLockResponse } from '@/lib/auth';
import { refusal, streamArchive } from '@/lib/zipArchive';
import { readBodyCapped } from '@/lib/requestBody';

export const dynamic = 'force-dynamic';

/**
 * Far below even the single-asset limit: one request may pull down an entire
 * album of originals, so it must be a deliberate, rare action per visitor.
 */
const ARCHIVE_RPM = 5;

/**
 * Absolute ceiling on one selection, independent of album size. Together with
 * the token de-duplication in POST it bounds the upstream egress a single
 * request can ask for: without it, one 2 GB video's token repeated a thousand
 * times would stream 2 TB out of Immich.
 */
const MAX_SELECTION_ASSETS = 1000;

/**
 * Cap on the POST body, enforced while reading it rather than after. The token
 * list is the only payload a POST carries, so 256 KB comfortably fits the
 * ceiling above and a short body can never become a large parse.
 */
const MAX_BODY_BYTES = 256 * 1024;

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
      error: refusal(request, 429, 'rateLimited', retryAfterSeconds(rl.resetAt)),
    };
  }

  const locked = siteLockResponse(request);
  if (locked) return { error: locked };

  const albumId = decodeAssetId(params.album);
  if (!albumId) return { error: refusal(request, 404, 'notAvailable') };

  const config = getConfig();
  if (!config.albums.includes(albumId)) return { error: refusal(request, 404, 'notAvailable') };
  if (!config.albumDownloads[albumId]) return { error: refusal(request, 404, 'notAvailable') };

  // Every gate on every route to the album — see the single-asset route.
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  if (!isAlbumReachable(albumId, getCookie)) {
    return { error: refusal(request, 404, 'notAvailable') };
  }

  let album;
  try {
    album = await immich.getAlbum(albumId);
  } catch (error) {
    if (error instanceof ImmichUnavailableError) {
      return {
        error: refusal(request, 503, 'immichUnavailable', 30),
      };
    }
    throw error;
  }
  if (!album) return { error: refusal(request, 404, 'notAvailable') };

  const assets = album.assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO');
  return { albumName: album.albumName, assets };
}

/**
 * Read the POST body with a hard cap, then pull the token list out of it.
 *
 * Read by hand rather than through `request.json()`: that helper parses the
 * whole body before anything can object, which is the one place an unbounded
 * payload could land. `Content-Length` is checked first (cheap), and the read
 * itself stops the moment the cap is passed (so a chunked body is capped too).
 */
async function readSelectedTokens(request: NextRequest): Promise<string[] | null> {
  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;

  let text: string;
  try {
    const raw = await readBodyCapped(request, MAX_BODY_BYTES);
    if (raw === null) return null;
    text = raw;
  } catch {
    return null;
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(text) as { assets?: unknown };
      if (!Array.isArray(parsed?.assets)) return null;
      return parsed.assets.filter((token): token is string => typeof token === 'string');
    } catch {
      return null;
    }
  }

  // The proofing modal's form POST: one `assets` field per token.
  const form = new URLSearchParams(text);
  const tokens = form.getAll('assets').filter((token) => token.length > 0);
  return tokens.length > 0 ? tokens : null;
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

  const tokens = await readSelectedTokens(request);
  if (!tokens || tokens.length === 0) {
    return refusal(request, 404, 'notAvailable');
  }

  // Every token must decode to an asset that really belongs to the album; a
  // token is unforgeable (AES-GCM), but membership is the check that keeps one
  // album's archive from naming another album's assets.
  //
  // The `seen` set matters as much as the membership check: a token is only a
  // lookup, not a consume, so the same asset could otherwise be appended once
  // per occurrence. With the absolute ceiling that bounds the whole request.
  const byId = new Map(resolved.assets.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const selected: ImmichAsset[] = [];
  for (const token of tokens) {
    if (selected.length >= MAX_SELECTION_ASSETS) {
      return refusal(request, 404, 'notAvailable');
    }
    const assetId = decodeAssetId(token);
    if (!assetId) return refusal(request, 404, 'notAvailable');
    if (seen.has(assetId)) continue;
    const asset = byId.get(assetId);
    if (!asset) return refusal(request, 404, 'notAvailable');
    seen.add(assetId);
    selected.push(asset);
  }
  if (selected.length === 0) {
    return refusal(request, 404, 'notAvailable');
  }

  return streamArchive(resolved.albumName, selected);
}
