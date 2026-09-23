/**
 * POST /api/proof/:token/submit — lock the client's selection and notify the
 * photographer.
 *
 * Idempotent: submitting twice answers 200 both times, and only the first call
 * fires the webhook.
 */

import { NextRequest, NextResponse } from 'next/server';
import { proofError, resolveProofAccess } from '@/lib/proofAccess';
import { ProofError, submitSelection } from '@/lib/proofSessions';
import { notifySubmitted } from '@/lib/proofWebhook';
import { getConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

const SUBMIT_RPM = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = await resolveProofAccess(request, token, 'proof-submit', SUBMIT_RPM);
  if ('error' in access) return access.error;

  if (access.session.selection.length === 0 && !access.session.submittedAt) {
    return proofError(400, 'Nothing selected');
  }

  try {
    const { session, firstSubmit } = await submitSelection(token);
    if (firstSubmit) {
      // Not awaited: a slow or broken webhook must not hold up the client.
      void notifySubmitted(session, access.albumName, getConfig().siteUrl);
    }
    return NextResponse.json(
      { ok: true, submittedAt: session.submittedAt },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    if (err instanceof ProofError) return proofError(404, 'Not found');
    throw err;
  }
}
