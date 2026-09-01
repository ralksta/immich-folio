import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * The archive route streams originals as a ZIP for either the whole album
 * (GET) or a proofing selection (POST). It shares the single-asset download's
 * checks — allowlist, `download: true`, password gates, asset membership — and
 * adds one of its own: a selected token must decode to an asset that actually
 * belongs to the album it names.
 */

vi.mock('@/lib/config', () => ({ getConfig: vi.fn() }));
vi.mock('@/lib/tokens', () => ({ decodeAssetId: vi.fn() }));
vi.mock('@/lib/immich', () => ({
  immich: { getAlbum: vi.fn(), streamAsset: vi.fn() },
  ImmichUnavailableError: class ImmichUnavailableError extends Error {},
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ success: true, resetAt: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  retryAfterSeconds: vi.fn(() => 60),
}));
vi.mock('@/lib/auth', () => ({
  siteLockResponse: vi.fn(() => null),
  isAlbumReachable: vi.fn(() => true),
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ get: () => undefined })),
}));

import { GET, POST } from '../route';
import { getConfig } from '@/lib/config';
import { decodeAssetId } from '@/lib/tokens';
import { immich } from '@/lib/immich';

const mockConfig = getConfig as unknown as ReturnType<typeof vi.fn>;
const mockDecode = decodeAssetId as unknown as ReturnType<typeof vi.fn>;
const mockGetAlbum = immich.getAlbum as unknown as ReturnType<typeof vi.fn>;
const mockStream = immich.streamAsset as unknown as ReturnType<typeof vi.fn>;

const ALBUM = {
  id: 'album-uuid',
  albumName: 'Test Album',
  assets: [
    { id: 'asset-1', type: 'IMAGE', originalFileName: 'photo-1.jpg' },
    { id: 'asset-2', type: 'IMAGE', originalFileName: 'photo-2.jpg' },
  ],
};

/** A config where the album is on the allowlist and opted into downloads. */
function optedIn() {
  return { albums: ['album-uuid'], albumDownloads: { 'album-uuid': true } };
}

/** Decode album/asset tokens into the UUIDs under test; unknown → null. */
function decodeMap() {
  mockDecode.mockImplementation((token: string) => {
    if (token === 'album-token') return 'album-uuid';
    if (token === 'asset-token-1') return 'asset-1';
    if (token === 'asset-token-2') return 'asset-2';
    if (token === 'asset-token-foreign') return 'asset-foreign';
    return null;
  });
}

/** A tiny originals stream, standing in for Immich's response body. */
function originStream(bytes: string) {
  const data = new TextEncoder().encode(bytes);
  return {
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    }),
    contentType: 'image/jpeg',
    contentLength: null,
  };
}

const getReq = () => new NextRequest('http://localhost/api/download/album-token/archive');
const params = { params: Promise.resolve({ album: 'album-token' }) };

function postReq(tokens: unknown[]) {
  return new NextRequest('http://localhost/api/download/album-token/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assets: tokens }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  decodeMap();
  mockConfig.mockReturnValue(optedIn());
  mockGetAlbum.mockResolvedValue(ALBUM);
  // A fresh stream per call — a real Immich fetch never hands back the same
  // body twice, and a shared web stream would be locked by the first consumer.
  mockStream.mockImplementation(() => Promise.resolve(originStream('image-bytes')));
});

describe('GET /api/download/[album]/archive', () => {
  it('streams a ZIP of the whole album when opted in', async () => {
    const res = await GET(getReq(), params);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('attachment');

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'
  });

  it('refuses an album that has not opted into downloads', async () => {
    mockConfig.mockReturnValue({ albums: ['album-uuid'], albumDownloads: {} });
    const res = await GET(getReq(), params);
    expect(res.status).toBe(404);
  });

  it('refuses an album that is not on the allowlist', async () => {
    mockConfig.mockReturnValue({ albums: [], albumDownloads: { 'album-uuid': true } });
    const res = await GET(getReq(), params);
    expect(res.status).toBe(404);
  });

  it('refuses a token that does not decode', async () => {
    mockDecode.mockImplementation(() => null);
    const res = await GET(getReq(), params);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/download/[album]/archive', () => {
  it('streams only the selected assets', async () => {
    mockStream
      .mockResolvedValueOnce(originStream('one'))
      .mockResolvedValueOnce(originStream('two'));
    const res = await POST(postReq(['asset-token-1', 'asset-token-2']), params);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(mockStream).toHaveBeenCalledTimes(2);
  });

  it('refuses a token that decodes to an asset outside the album', async () => {
    const res = await POST(postReq(['asset-token-foreign']), params);
    expect(res.status).toBe(404);
  });

  it('refuses an empty selection', async () => {
    const res = await POST(postReq([]), params);
    expect(res.status).toBe(404);
  });

  it('refuses a malformed body', async () => {
    const req = new NextRequest('http://localhost/api/download/album-token/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req, params);
    expect(res.status).toBe(404);
  });
});
