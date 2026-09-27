import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import { picksFor, toAdminSession } from '@/lib/admin/proofing-view';
import { immich } from '@/lib/immich';
import {
  deleteSession,
  getSessionById,
  ProofError,
  sessionPatchSchema,
  updateSession,
} from '@/lib/proofSessions';

type Context = { params: Promise<{ id: string }> };

/** GET: one link with its selected photos. */
export const GET = withAdmin(async (_request: NextRequest, { params }: Context) => {
  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const album = await immich.getProofingAlbum(session.albumId).catch(() => null);
  return NextResponse.json({
    session: toAdminSession(session, album),
    picks: picksFor(session, album),
  });
});

/** PATCH: rename, change expiry or downloads, reopen, reset the download count. */
export const PATCH = withAdmin(async (request: NextRequest, { params }: Context) => {
  const { id } = await params;
  const parsed = sessionPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }
  try {
    const session = await updateSession(id, parsed.data);
    const album = await immich.getProofingAlbum(session.albumId).catch(() => null);
    return NextResponse.json({ session: toAdminSession(session, album) });
  } catch (err) {
    if (err instanceof ProofError)
      return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
});

/** DELETE: revoke the link. The client URL stops working immediately. */
export const DELETE = withAdmin(async (_request: NextRequest, { params }: Context) => {
  const { id } = await params;
  try {
    await deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ProofError)
      return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
});
