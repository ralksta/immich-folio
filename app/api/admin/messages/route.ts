import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import { getConfig } from '@/lib/config';
import { deleteMessage, isMessageId, listMessages, setRead } from '@/lib/contact';

/**
 * The contact form inbox (#702). Listing also applies the retention period,
 * so opening the inbox is enough to purge what has expired.
 */
export const GET = withAdmin(async () => {
  const { contact } = getConfig();
  const messages = await listMessages(contact.retentionDays);
  return NextResponse.json(
    {
      enabled: contact.enabled,
      notifyConfigured: !!contact.notifyUrl,
      retentionDays: contact.retentionDays,
      messages,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
});

/** PATCH { id, read } — mark a message read or unread. */
export const PATCH = withAdmin(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as { id?: unknown; read?: unknown } | null;
  if (!body || !isMessageId(body.id) || typeof body.read !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  return (await setRead(body.id, body.read))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Not found' }, { status: 404 });
});

/** DELETE ?id=<id> */
export const DELETE = withAdmin(async (request: NextRequest) => {
  const id = request.nextUrl.searchParams.get('id');
  if (!isMessageId(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  return (await deleteMessage(id))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Not found' }, { status: 404 });
});
