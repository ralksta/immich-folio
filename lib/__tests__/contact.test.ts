import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MAX_MESSAGES,
  MIN_FILL_MS,
  deleteMessage,
  listMessages,
  notifyNewMessage,
  saveMessage,
  setRead,
  validateContact,
} from '../contact';

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const valid = {
  name: 'Ada',
  email: 'ada@example.com',
  message: 'Hello there',
  website: '',
  startedAt: NOW - 10_000,
};

describe('validateContact', () => {
  it('accepts a normal submission and trims it', () => {
    expect(validateContact({ ...valid, name: '  Ada\nLovelace ' }, NOW)).toEqual({
      ok: true,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: 'Hello there',
    });
  });

  it('treats a filled honeypot as spam', () => {
    expect(validateContact({ ...valid, website: 'http://spam' }, NOW)).toEqual({
      ok: false,
      reason: 'spam',
    });
  });

  it('treats a form sent faster than a person types as spam', () => {
    expect(validateContact({ ...valid, startedAt: NOW - MIN_FILL_MS + 1 }, NOW).ok).toBe(false);
    expect(validateContact({ ...valid, startedAt: undefined }, NOW)).toEqual({
      ok: false,
      reason: 'spam',
    });
  });

  it('rejects a missing field or a malformed email as invalid', () => {
    expect(validateContact({ ...valid, name: ' ' }, NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(validateContact({ ...valid, email: 'not-an-email' }, NOW).ok).toBe(false);
    expect(validateContact({ ...valid, email: 'a@b.c\r\nBcc: x@y.z' }, NOW).ok).toBe(false);
    expect(validateContact({ ...valid, message: 'x'.repeat(5001) }, NOW).ok).toBe(false);
  });
});

describe('message storage', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-contact-'));
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  const fields = { name: 'Ada', email: 'ada@example.com', message: 'Hi' };

  it('stores a message unread and lists newest first', async () => {
    await saveMessage(fields, 90, NOW - 1000);
    const second = await saveMessage({ ...fields, name: 'Grace' }, 90, NOW);
    const list = await listMessages(90, NOW);
    expect(list.map((m) => m.name)).toEqual(['Grace', 'Ada']);
    expect(list[0]).toMatchObject({ read: false, id: (second as { id: string }).id });
  });

  it('writes the file readable by the owner only', async () => {
    const msg = (await saveMessage(fields, 90, NOW)) as { id: string };
    const mode = fs.statSync(path.join(cwd, 'content', 'messages', `${msg.id}.json`)).mode;
    expect(mode & 0o077).toBe(0);
  });

  it('deletes messages past the retention period when listing', async () => {
    await saveMessage(fields, 90, NOW - 31 * DAY);
    await saveMessage(fields, 90, NOW - DAY);
    expect(await listMessages(30, NOW)).toHaveLength(1);
    expect(fs.readdirSync(path.join(cwd, 'content', 'messages'))).toHaveLength(1);
  });

  it('refuses new messages at the cap instead of evicting old ones', async () => {
    const dir = path.join(cwd, 'content', 'messages');
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < MAX_MESSAGES; i++) {
      const id = `${NOW - i}-${i.toString(16).padStart(8, '0')}`;
      fs.writeFileSync(
        path.join(dir, `${id}.json`),
        JSON.stringify({
          id,
          receivedAt: '',
          name: 'x',
          email: 'x@y.z',
          message: 'm',
          read: false,
        }),
      );
    }
    expect(await saveMessage(fields, 90, NOW)).toBe('full');
    expect(fs.readdirSync(dir)).toHaveLength(MAX_MESSAGES);
  });

  it('marks read and deletes by id, and ignores ids that could escape the directory', async () => {
    const msg = (await saveMessage(fields, 90, NOW)) as { id: string };
    expect(await setRead(msg.id, true)).toBe(true);
    expect((await listMessages(90, NOW))[0].read).toBe(true);
    expect(await deleteMessage('../settings')).toBe(false);
    expect(await deleteMessage(msg.id)).toBe(true);
    expect(await listMessages(90, NOW)).toEqual([]);
  });
});

describe('notifyNewMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts the sender name only, never the message', async () => {
    const fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    await notifyNewMessage('https://ntfy.sh/topic', 'Ada', 'https://site.example/admin/messages');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://ntfy.sh/topic');
    expect(init.body).toBe('New message from Ada');
    expect((init.headers as Record<string, string>).Click).toBe(
      'https://site.example/admin/messages',
    );
  });

  it('does nothing without a URL and never throws on failure', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('down');
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await notifyNewMessage(undefined, 'Ada', null);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(notifyNewMessage('https://ntfy.sh/t', 'Ada', null)).resolves.toBeUndefined();
  });
});
