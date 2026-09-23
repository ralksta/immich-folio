import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import { loadAlbums, toAdminSession } from '@/lib/admin/proofing-view';
import { immich } from '@/lib/immich';
import { createSession, listSessions, ProofError, sessionInputSchema } from '@/lib/proofSessions';
import { webhookUrl } from '@/lib/proofWebhook';

/** GET: every proofing link, newest first. */
export const GET = withAdmin(async () => {
  const sessions = await listSessions();
  const albums = await loadAlbums(sessions.map((s) => s.albumId));
  const list = sessions
    .map((s) => toAdminSession(s, albums.get(s.albumId) ?? null))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ sessions: list, webhookConfigured: webhookUrl() !== null });
});

/** POST: create a proofing link for one client and one album. */
export const POST = withAdmin(async (request: NextRequest) => {
  const parsed = sessionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  // Refuse a link to an album Immich does not have, rather than hand out a 404.
  const album = await immich.getProofingAlbum(parsed.data.albumId).catch(() => null);
  if (!album) {
    return NextResponse.json({ error: 'Immich has no album with that ID' }, { status: 400 });
  }

  try {
    const session = await createSession(parsed.data);
    return NextResponse.json({ session: toAdminSession(session, album) }, { status: 201 });
  } catch (err) {
    if (err instanceof ProofError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
});
