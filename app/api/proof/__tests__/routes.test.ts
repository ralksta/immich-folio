import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

/**
 * The public proofing routes against a real session store in a temp dir. Immich,
 * the asset tokens, the ZIP stream and the webhook are mocked; what is under
 * test is the authorisation: which token may change what, and when.
 */

vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(() => ({ siteUrl: null })),
  getConfigOrNull: vi.fn(() => null),
}));
vi.mock('@/lib/tokens', () => ({
  decodeAssetId: vi.fn((token: string) => (token.startsWith('tok-') ? token.slice(4) : null)),
}));
vi.mock('@/lib/immich', () => ({
  immich: { getProofingAlbum: vi.fn() },
  ImmichUnavailableError: class ImmichUnavailableError extends Error {},
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ success: true, resetAt: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  retryAfterSeconds: vi.fn(() => 60),
}));
vi.mock('@/lib/auth', () => ({ siteLockResponse: vi.fn(() => null) }));
vi.mock('@/lib/proofWebhook', () => ({ notifySubmitted: vi.fn(async () => {}) }));
vi.mock('@/lib/zipArchive', () => ({
  streamArchive: vi.fn((name: string, assets: { id: string }[]) =>
    Response.json({ name, ids: assets.map((a) => a.id) }),
  ),
  refusal: vi.fn((_req: unknown, status: number, reason: string) =>
    Response.json({ reason }, { status }),
  ),
}));

import { PUT } from '../[token]/selection/route';
import { POST } from '../[token]/submit/route';
import { GET } from '../[token]/archive/route';
import { immich } from '@/lib/immich';
import { notifySubmitted } from '@/lib/proofWebhook';
import { siteLockResponse } from '@/lib/auth';
import { createSession, getSessionById, sessionInputSchema } from '@/lib/proofSessions';

const mockAlbum = immich.getProofingAlbum as unknown as ReturnType<typeof vi.fn>;
const mockNotify = notifySubmitted as unknown as ReturnType<typeof vi.fn>;
const mockLock = siteLockResponse as unknown as ReturnType<typeof vi.fn>;

const ALBUM_ID = '11111111-1111-1111-1111-111111111111';
const ALBUM = {
  id: ALBUM_ID,
  albumName: 'Wedding',
  assets: [
    { id: 'a1', type: 'IMAGE', originalFileName: 'a1.jpg' },
    { id: 'a2', type: 'IMAGE', originalFileName: 'a2.jpg' },
    { id: 'a3', type: 'VIDEO', originalFileName: 'a3.mp4' },
  ],
};

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-proof-routes-'));
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
  mockAlbum.mockResolvedValue(structuredClone(ALBUM));
  mockNotify.mockClear();
  mockLock.mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function session(overrides: Record<string, unknown> = {}) {
  return createSession(
    sessionInputSchema.parse({ clientName: 'Anna', albumId: ALBUM_ID, ...overrides }),
  );
}

const ctx = (token: string) => ({ params: Promise.resolve({ token }) });

function put(token: string, assets: unknown) {
  return PUT(
    new NextRequest(`https://folio.example/api/proof/${token}/selection`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assets }),
    }),
    ctx(token),
  );
}

const submit = (token: string) =>
  POST(
    new NextRequest(`https://folio.example/api/proof/${token}/submit`, { method: 'POST' }),
    ctx(token),
  );

const archive = (token: string, scope = 'selection') =>
  GET(
    new NextRequest(`https://folio.example/api/proof/${token}/archive?scope=${scope}`),
    ctx(token),
  );

describe('PUT selection', () => {
  it('saves the selection in album order', async () => {
    const s = await session();
    const res = await put(s.token, ['tok-a3', 'tok-a1']);
    expect(res.status).toBe(200);
    expect((await getSessionById(s.id))?.selection).toEqual(['a1', 'a3']);
    // The album comes from the session, not from the request.
    expect(mockAlbum).toHaveBeenCalledWith(ALBUM_ID);
  });

  it('refuses an asset from another album', async () => {
    const s = await session();
    expect((await put(s.token, ['tok-a1', 'tok-elsewhere'])).status).toBe(400);
    expect((await put(s.token, ['garbage'])).status).toBe(400);
    expect((await put(s.token, 'tok-a1')).status).toBe(400);
    expect((await getSessionById(s.id))?.selection).toEqual([]);
  });

  it('answers 404 for an unknown or expired link', async () => {
    expect((await put('x'.repeat(32), ['tok-a1'])).status).toBe(404);
    const expired = await session({ expiresOn: '2000-01-01' });
    expect((await put(expired.token, ['tok-a1'])).status).toBe(404);
  });

  it('answers 409 once submitted', async () => {
    const s = await session();
    await put(s.token, ['tok-a1']);
    await submit(s.token);
    expect((await put(s.token, ['tok-a2'])).status).toBe(409);
  });

  it('keeps the site password in charge', async () => {
    const s = await session();
    mockLock.mockReturnValue(Response.json({ error: 'locked' }, { status: 401 }));
    expect((await put(s.token, ['tok-a1'])).status).toBe(401);
  });
});

describe('POST submit', () => {
  it('refuses an empty selection', async () => {
    const s = await session();
    expect((await submit(s.token)).status).toBe(400);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('locks the selection and notifies once', async () => {
    const s = await session();
    await put(s.token, ['tok-a2']);
    expect((await submit(s.token)).status).toBe(200);
    expect((await submit(s.token)).status).toBe(200);
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect((await getSessionById(s.id))?.submittedAt).toBeTruthy();
  });
});

describe('GET archive', () => {
  it('refuses when the link offers no downloads', async () => {
    const s = await session();
    await put(s.token, ['tok-a1']);
    expect((await archive(s.token)).status).toBe(404);
  });

  it('streams only the saved selection', async () => {
    const s = await session({ download: 'selection' });
    await put(s.token, ['tok-a2']);
    const res = await archive(s.token);
    expect(await res.json()).toEqual({ name: 'Wedding', ids: ['a2'] });
  });

  it('allows the whole album only when the link says so', async () => {
    const selectionOnly = await session({ download: 'selection' });
    expect((await archive(selectionOnly.token, 'album')).status).toBe(404);

    const whole = await session({ download: 'album' });
    const res = await archive(whole.token, 'album');
    expect((await res.json()).ids).toEqual(['a1', 'a2', 'a3']);
  });

  it('stops at the download limit', async () => {
    const s = await session({ download: 'album', downloadLimit: 1 });
    expect((await archive(s.token, 'album')).status).toBe(200);
    const refused = await archive(s.token, 'album');
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ reason: 'limitReached' });
  });
});
