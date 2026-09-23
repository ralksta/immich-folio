/**
 * GET /api/proof/:token/archive?scope=selection|album — the originals of a
 * client proofing link as a ZIP.
 *
 * What may be downloaded is the session's to say (`download: selection` or
 * `album`), every successful start counts against its `downloadLimit`, and
 * the selection ZIP is built from the saved selection, never from the request.
 * Streaming and the refusal page are shared with the album archive route.
 */

import { NextRequest } from 'next/server';
import { resolveProofAccess } from '@/lib/proofAccess';
import { claimDownload, ProofError } from '@/lib/proofSessions';
import { refusal, streamArchive } from '@/lib/zipArchive';

export const dynamic = 'force-dynamic';

/** Same budget as the album archive: a whole album of originals per request. */
const ARCHIVE_RPM = 5;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = await resolveProofAccess(request, token, 'proof-archive', ARCHIVE_RPM);
  if ('error' in access) {
    const status = access.error.status;
    if (status === 429) {
      const retry = Number(access.error.headers.get('Retry-After')) || undefined;
      return refusal(request, 429, 'rateLimited', retry);
    }
    if (status === 503) return refusal(request, 503, 'immichUnavailable', 30);
    if (status === 401) return access.error;
    return refusal(request, 404, 'notAvailable');
  }

  const { session } = access;
  const scope = request.nextUrl.searchParams.get('scope') === 'album' ? 'album' : 'selection';
  if (session.download === 'none') return refusal(request, 404, 'notAvailable');
  if (scope === 'album' && session.download !== 'album') {
    return refusal(request, 404, 'notAvailable');
  }

  const chosen = new Set(session.selection);
  const assets =
    scope === 'album' ? access.assets : access.assets.filter((asset) => chosen.has(asset.id));
  if (assets.length === 0) return refusal(request, 404, 'notAvailable');

  try {
    await claimDownload(token);
  } catch (err) {
    if (err instanceof ProofError && err.code === 'limit') {
      return refusal(request, 403, 'limitReached');
    }
    if (err instanceof ProofError) return refusal(request, 404, 'notAvailable');
    throw err;
  }

  return streamArchive(access.albumName, assets);
}
