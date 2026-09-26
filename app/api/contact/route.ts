/**
 * Contact form submission (#702). POST /api/contact
 * { name, email, message, website (honeypot), startedAt }
 *
 * The message is stored under content/messages/ and the owner is notified
 * through contact.notifyUrl when one is set (lib/contact.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { siteLockResponse } from '@/lib/auth';
import { notifyNewMessage, saveMessage, validateContact } from '@/lib/contact';
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit';

/** A person sends one message, maybe a correction. Three a minute is generous. */
const CONTACT_RPM = 3;

/** Bodies larger than any valid message plus its fields are refused unread. */
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: NextRequest) {
  const config = getConfig();
  if (!config.contact.enabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // The page sits behind the site password; so does the endpoint it posts to.
  const locked = siteLockResponse(request);
  if (locked) return locked;

  const ip = getClientIp(request);
  const { success, resetAt } = checkRateLimit(`contact:${ip}`, CONTACT_RPM);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(resetAt)) } },
    );
  }

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const result = validateContact((body ?? {}) as Record<string, unknown>);
  if (!result.ok) {
    // A bot gets the same answer as a person, so it has nothing to tune against.
    if (result.reason === 'spam') return NextResponse.json({ ok: true });
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
  }

  const saved = await saveMessage(
    { name: result.name, email: result.email, message: result.message },
    config.contact.retentionDays,
  );
  if (saved === 'full') {
    console.warn('[Folio] contact: inbox is full, message refused');
    return NextResponse.json({ error: 'Inbox full' }, { status: 503 });
  }

  const inboxUrl = config.siteUrl ? `${config.siteUrl.replace(/\/$/, '')}/admin/messages` : null;
  await notifyNewMessage(config.contact.notifyUrl, result.name, inboxUrl);

  return NextResponse.json({ ok: true });
}
