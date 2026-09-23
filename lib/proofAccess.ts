/**
 * The shared preamble of every public proofing route: rate limit, site lock,
 * the session behind the link token, and the album it was created for.
 *
 * The album ID always comes from the stored session, never from the request,
 * which is what makes it safe to load an unpublished album here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { immich, ImmichUnavailableError, type ImmichAsset } from './immich';
import { checkRateLimit, getClientIp, retryAfterSeconds } from './rate-limit';
import { siteLockResponse } from './auth';
import { decodeAssetId } from './tokens';
import { findSessionByToken, isExpired, type ProofSession } from './proofSessions';

export type ProofAccess =
  { error: Response } | { session: ProofSession; albumName: string; assets: ImmichAsset[] };

const noStore = { 'Cache-Control': 'no-store' };

export function proofError(status: number, error: string, extra?: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers: { ...noStore, ...extra } });
}

export async function resolveProofAccess(
  request: NextRequest,
  token: string,
  bucket: string,
  rpm: number,
): Promise<ProofAccess> {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${bucket}:${ip}`, rpm);
  if (!rl.success) {
    return {
      error: proofError(429, 'Too many requests', {
        'Retry-After': String(retryAfterSeconds(rl.resetAt)),
      }),
    };
  }

  const locked = siteLockResponse(request);
  if (locked) return { error: locked };

  const session = await findSessionByToken(token);
  // Unknown and expired answer the same, so a guessed token learns nothing.
  if (!session || isExpired(session)) return { error: proofError(404, 'Not found') };

  let album;
  try {
    album = await immich.getProofingAlbum(session.albumId);
  } catch (error) {
    if (error instanceof ImmichUnavailableError) {
      return { error: proofError(503, 'Immich is currently unavailable', { 'Retry-After': '30' }) };
    }
    throw error;
  }
  if (!album) return { error: proofError(404, 'Not found') };

  return {
    session,
    albumName: album.albumName,
    assets: album.assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO'),
  };
}

/**
 * Asset tokens from the client → Immich asset IDs of this album, in album
 * order. Null when any token does not decode or names an asset outside the
 * album: a token is unforgeable, but membership is what keeps one session
 * from recording another album's photos.
 */
export function decodeSelection(tokens: unknown, assets: ImmichAsset[]): string[] | null {
  if (!Array.isArray(tokens)) return null;
  const inAlbum = new Set(assets.map((a) => a.id));
  const picked = new Set<string>();
  for (const token of tokens) {
    if (typeof token !== 'string') return null;
    const id = decodeAssetId(token);
    if (!id || !inAlbum.has(id)) return null;
    picked.add(id);
  }
  return assets.filter((a) => picked.has(a.id)).map((a) => a.id);
}
