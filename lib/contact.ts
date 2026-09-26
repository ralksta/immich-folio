/**
 * The built-in contact form (#702): validation, storage and notification.
 *
 * Messages stay on this server, one JSON file each in `content/messages/`.
 * No SMTP and no form service: the owner reads them in the admin panel and
 * learns about new ones through an optional plain-text POST to
 * `contact.notifyUrl` (an ntfy topic, typically). The notification carries
 * the sender's name only, never the message, so the text does not end up on
 * a push service.
 *
 * Retention is enforced on every read and write rather than by a timer, so
 * nothing older than `retentionDays` survives the next visit to the inbox or
 * the next submission. The privacy policy can then state a fixed period.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface ContactMessage {
  id: string;
  /** ISO timestamp. */
  receivedAt: string;
  name: string;
  email: string;
  message: string;
  read: boolean;
}

export interface ContactInput {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  /** Honeypot: a field hidden from people. Anything in it means a bot. */
  website?: unknown;
  /** When the form was rendered (epoch ms), for the minimum fill time. */
  startedAt?: unknown;
}

export const LIMITS = { name: 100, email: 200, message: 5000 } as const;

/** Faster than a person can type a message; slower than a bot posting on load. */
export const MIN_FILL_MS = 3000;

/** A form older than this was not filled in just now. */
const MAX_FILL_MS = 24 * 60 * 60 * 1000;

/**
 * Hard cap on stored messages. A flood that gets past the rate limit fills the
 * inbox and then stops, rather than filling the disk. New messages are refused
 * at the cap instead of evicting old ones: a flood must not delete real mail.
 */
export const MAX_MESSAGES = 500;

const ID_RE = /^\d{13}-[a-f0-9]{8}$/;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;

export function messagesDir(): string {
  return path.join(process.cwd(), 'content', 'messages');
}

export type ValidationResult =
  | { ok: true; name: string; email: string; message: string }
  | { ok: false; reason: 'invalid' }
  /** Looks like a bot. The route answers as if it had worked, so the bot learns nothing. */
  | { ok: false; reason: 'spam' };

export function validateContact(input: ContactInput, now = Date.now()): ValidationResult {
  if (typeof input.website === 'string' && input.website.trim()) {
    return { ok: false, reason: 'spam' };
  }
  const started = Number(input.startedAt);
  if (!Number.isFinite(started) || now - started < MIN_FILL_MS || now - started > MAX_FILL_MS) {
    return { ok: false, reason: 'spam' };
  }

  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const name = text(input.name);
  const email = text(input.email);
  const message = text(input.message);

  if (
    !name ||
    name.length > LIMITS.name ||
    !EMAIL_RE.test(email) ||
    email.length > LIMITS.email ||
    !message ||
    message.length > LIMITS.message
  ) {
    return { ok: false, reason: 'invalid' };
  }
  // A name is one line. Keeping newlines out also keeps them out of the
  // notification text and the reply subject.
  return { ok: true, name: name.replace(/\s+/g, ' '), email, message };
}

function isMessage(value: unknown): value is ContactMessage {
  const m = value as ContactMessage;
  return (
    !!m &&
    typeof m.id === 'string' &&
    ID_RE.test(m.id) &&
    typeof m.receivedAt === 'string' &&
    typeof m.name === 'string' &&
    typeof m.email === 'string' &&
    typeof m.message === 'string'
  );
}

async function writeMessage(msg: ContactMessage): Promise<void> {
  await fs.mkdir(messagesDir(), { recursive: true });
  const target = path.join(messagesDir(), `${msg.id}.json`);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(msg, null, 2), { mode: 0o600 });
  await fs.rename(tmp, target);
}

/**
 * Every stored message, newest first, after deleting the ones past their
 * retention. Unreadable files are skipped rather than failing the inbox.
 */
export async function listMessages(
  retentionDays: number,
  now = Date.now(),
): Promise<ContactMessage[]> {
  let names: string[];
  try {
    names = await fs.readdir(messagesDir());
  } catch {
    return [];
  }

  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  const messages: ContactMessage[] = [];
  for (const name of names) {
    const id = name.replace(/\.json$/, '');
    if (!ID_RE.test(id) || !name.endsWith('.json')) continue;
    const file = path.join(messagesDir(), name);
    if (Number(id.slice(0, 13)) < cutoff) {
      await fs.rm(file, { force: true });
      continue;
    }
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
      if (isMessage(parsed)) messages.push({ ...parsed, read: parsed.read === true });
    } catch {
      // A half-written or hand-edited file is not worth failing the inbox for.
    }
  }
  return messages.sort((a, b) => b.id.localeCompare(a.id));
}

export async function saveMessage(
  fields: { name: string; email: string; message: string },
  retentionDays: number,
  now = Date.now(),
): Promise<ContactMessage | 'full'> {
  const existing = await listMessages(retentionDays, now);
  if (existing.length >= MAX_MESSAGES) return 'full';

  const msg: ContactMessage = {
    id: `${now}-${crypto.randomBytes(4).toString('hex')}`,
    receivedAt: new Date(now).toISOString(),
    ...fields,
    read: false,
  };
  await writeMessage(msg);
  return msg;
}

/** Ids come from the admin client; the pattern keeps them inside the directory. */
export function isMessageId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}

export async function setRead(id: string, read: boolean): Promise<boolean> {
  if (!isMessageId(id)) return false;
  const file = path.join(messagesDir(), `${id}.json`);
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!isMessage(parsed)) return false;
    await writeMessage({ ...parsed, read });
    return true;
  } catch {
    return false;
  }
}

export async function deleteMessage(id: string): Promise<boolean> {
  if (!isMessageId(id)) return false;
  try {
    await fs.rm(path.join(messagesDir(), `${id}.json`));
    return true;
  } catch {
    return false;
  }
}

/**
 * Tell the owner a message arrived. Best effort: the message is already
 * stored, so a failing push service must not fail the visitor's submission.
 *
 * The body is plain text, which is what ntfy expects; its `Title` and `Click`
 * headers are ignored by endpoints that do not know them.
 */
export async function notifyNewMessage(
  notifyUrl: string | undefined,
  name: string,
  inboxUrl: string | null,
): Promise<void> {
  if (!notifyUrl) return;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'text/plain; charset=utf-8',
      Title: 'New contact form message',
      Tags: 'envelope',
    };
    if (inboxUrl) headers.Click = inboxUrl;
    const res = await fetch(notifyUrl, {
      method: 'POST',
      headers,
      body: `New message from ${name}`,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`[Folio] contact: notification answered ${res.status}`);
  } catch (err) {
    console.warn(`[Folio] contact: notification failed: ${(err as Error).message}`);
  }
}
