import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  claimDownload,
  createSession,
  deleteSession,
  downloadsRemaining,
  findSessionByToken,
  getSessionById,
  isExpired,
  isTokenShaped,
  listSessions,
  newToken,
  ProofError,
  saveSelection,
  sessionInputSchema,
  sessionPatchSchema,
  sessionState,
  submitSelection,
  updateSession,
  type ProofSession,
} from '../proofSessions';

const ALBUM = '11111111-1111-1111-1111-111111111111';
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-proof-'));
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

const storePath = () => path.join(dir, 'content', 'proofing.json');

function input(overrides: Record<string, unknown> = {}) {
  return sessionInputSchema.parse({ clientName: 'Anna', albumId: ALBUM, ...overrides });
}

describe('tokens', () => {
  it('are 192-bit URL-safe strings and never repeat', () => {
    const a = newToken();
    expect(isTokenShaped(a)).toBe(true);
    expect(a).not.toBe(newToken());
  });

  it('rejects anything else before touching the store', async () => {
    expect(isTokenShaped('../../etc/passwd')).toBe(false);
    expect(isTokenShaped('short')).toBe(false);
    expect(await findSessionByToken('short')).toBeNull();
  });
});

describe('expiry', () => {
  it('is inclusive of the last day', () => {
    const session = { expiresOn: '2026-05-12' };
    expect(isExpired(session, new Date('2026-05-12T22:00:00'))).toBe(false);
    expect(isExpired(session, new Date('2026-05-13T00:00:01'))).toBe(true);
  });

  it('never expires without a date', () => {
    expect(isExpired({}, new Date('2999-01-01'))).toBe(false);
  });
});

describe('input validation', () => {
  it('requires a client name and an album UUID', () => {
    expect(sessionInputSchema.safeParse({ clientName: ' ', albumId: ALBUM }).success).toBe(false);
    expect(sessionInputSchema.safeParse({ clientName: 'A', albumId: 'nope' }).success).toBe(false);
  });

  it('rejects malformed dates and limits', () => {
    expect(sessionInputSchema.safeParse({ ...input(), expiresOn: '12.05.2026' }).success).toBe(
      false,
    );
    expect(sessionInputSchema.safeParse({ ...input(), downloadLimit: 0 }).success).toBe(false);
  });

  it('does not let a patch move a link to another album', () => {
    const parsed = sessionPatchSchema.parse({ albumId: ALBUM, clientName: 'B' });
    expect(parsed).not.toHaveProperty('albumId');
  });
});

describe('store', () => {
  it('creates, finds and lists a session, written 0600', async () => {
    const session = await createSession(input({ download: 'selection', downloadLimit: 2 }));
    expect(session.selection).toEqual([]);
    expect(session.downloadsUsed).toBe(0);
    expect(await findSessionByToken(session.token)).toMatchObject({ id: session.id });
    expect(await getSessionById(session.id)).toMatchObject({ clientName: 'Anna' });
    expect(await listSessions()).toHaveLength(1);
    if (process.platform !== 'win32') {
      expect(fs.statSync(storePath()).mode & 0o777).toBe(0o600);
    }
  });

  it('saves and de-duplicates a selection', async () => {
    const { token } = await createSession(input());
    const saved = await saveSelection(token, ['a', 'b', 'a']);
    expect(saved.selection).toEqual(['a', 'b']);
    expect(saved.updatedAt).toBeTruthy();
  });

  it('serialises concurrent saves instead of losing one', async () => {
    const one = await createSession(input({ clientName: 'One' }));
    const two = await createSession(input({ clientName: 'Two' }));
    await Promise.all([saveSelection(one.token, ['x']), saveSelection(two.token, ['y'])]);
    expect((await getSessionById(one.id))?.selection).toEqual(['x']);
    expect((await getSessionById(two.id))?.selection).toEqual(['y']);
  });

  it('locks the selection on submit, and only the first submit counts', async () => {
    const { token, id } = await createSession(input());
    await saveSelection(token, ['a']);
    const first = await submitSelection(token);
    const second = await submitSelection(token);
    expect(first.firstSubmit).toBe(true);
    expect(second.firstSubmit).toBe(false);
    await expect(saveSelection(token, ['b'])).rejects.toMatchObject({ code: 'submitted' });
    expect(sessionState((await getSessionById(id)) as ProofSession)).toBe('submitted');

    // The photographer can reopen it.
    await updateSession(id, { reopen: true });
    expect((await saveSelection(token, ['b'])).selection).toEqual(['b']);
  });

  it('refuses every client action on an expired link', async () => {
    const { token } = await createSession(input({ expiresOn: '2000-01-01' }));
    await expect(saveSelection(token, ['a'])).rejects.toMatchObject({ code: 'expired' });
    await expect(submitSelection(token)).rejects.toMatchObject({ code: 'expired' });
  });

  it('counts downloads against the limit', async () => {
    const created = await createSession(input({ download: 'album', downloadLimit: 2 }));
    await claimDownload(created.token);
    const after = await claimDownload(created.token);
    expect(downloadsRemaining(after)).toBe(0);
    await expect(claimDownload(created.token)).rejects.toMatchObject({ code: 'limit' });

    await updateSession(created.id, { resetDownloads: true });
    expect(downloadsRemaining(await claimDownload(created.token))).toBe(1);
  });

  it('refuses downloads on a link that offers none', async () => {
    const { token } = await createSession(input());
    await expect(claimDownload(token)).rejects.toBeInstanceOf(ProofError);
  });

  it('clears optional fields with null in a patch', async () => {
    const { id } = await createSession(
      input({ expiresOn: '2030-01-01', download: 'album', downloadLimit: 3 }),
    );
    const patched = await updateSession(id, { expiresOn: null, downloadLimit: null });
    expect(patched.expiresOn).toBeUndefined();
    expect(patched.downloadLimit).toBeUndefined();
    expect(downloadsRemaining(patched)).toBeNull();
  });

  it('deletes a link, which stops it working', async () => {
    const { id, token } = await createSession(input());
    await deleteSession(id);
    expect(await findSessionByToken(token)).toBeNull();
    await expect(deleteSession(id)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('does not overwrite a store it cannot parse', async () => {
    fs.mkdirSync(path.dirname(storePath()), { recursive: true });
    fs.writeFileSync(storePath(), '{ not json');
    await expect(createSession(input())).rejects.toThrow();
    expect(fs.readFileSync(storePath(), 'utf8')).toBe('{ not json');
    // …and the queue is not stuck behind the failure.
    fs.writeFileSync(storePath(), '{"sessions":[]}');
    await expect(createSession(input())).resolves.toBeTruthy();
  });
});
