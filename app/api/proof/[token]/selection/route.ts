/**
 * PUT /api/proof/:token/selection — replace a client's saved selection.
 *
 * Body: `{ "assets": [<asset token>, …] }`, the album's opaque asset tokens in
 * any order. Answers 409 once the selection has been submitted, which the page
 * turns into its locked state.
 */

import { NextRequest, NextResponse } from 'next/server';
import { decodeSelection, proofError, resolveProofAccess } from '@/lib/proofAccess';
import { MAX_SELECTION, ProofError, saveSelection } from '@/lib/proofSessions';
import { readJsonCapped } from '@/lib/requestBody';

export const dynamic = 'force-dynamic';

/** Autosave fires once per burst of hearts; this is generous for one visitor. */
const SELECTION_RPM = 60;

/** MAX_SELECTION tokens of ~70 characters each, with room to spare. */
const MAX_BODY_BYTES = 256 * 1024;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = await resolveProofAccess(request, token, 'proof-save', SELECTION_RPM);
  if ('error' in access) return access.error;

  const body = (await readJsonCapped(request, MAX_BODY_BYTES)) as { assets?: unknown } | null;
  const assets = body?.assets;
  if (!Array.isArray(assets) || assets.length > MAX_SELECTION) {
    return proofError(400, 'Invalid selection');
  }
  const ids = decodeSelection(assets, access.assets);
  if (!ids) return proofError(400, 'Invalid selection');

  try {
    const session = await saveSelection(token, ids);
    return NextResponse.json(
      { ok: true, selected: session.selection.length },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    if (err instanceof ProofError && err.code === 'submitted') {
      return proofError(409, 'Selection already submitted');
    }
    if (err instanceof ProofError) return proofError(404, 'Not found');
    throw err;
  }
}
