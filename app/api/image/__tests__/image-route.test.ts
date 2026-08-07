import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../[id]/route';
import { encodeAssetId } from '@/lib/tokens';
import { immich, ImmichUnavailableError } from '@/lib/immich';

vi.mock('@/lib/immich', async () => {
  const actual = await vi.importActual<typeof import('@/lib/immich')>('@/lib/immich');
  return {
    // Keep the real error class — the route branches on `instanceof`.
    ImmichUnavailableError: actual.ImmichUnavailableError,
    immich: { streamAsset: vi.fn() },
  };
});

const mockStream = immich.streamAsset as unknown as ReturnType<typeof vi.fn>;

const ASSET_ID = '11111111-2222-3333-4444-555555555555';

/** Stream stub — the route only forwards the body, it never reads it. */
function fakeBody(contentType: string) {
  return {
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    }),
    contentType,
    contentLength: '3',
  };
}

function call(token: string, query = '', headers?: Record<string, string>) {
  const req = new NextRequest(`http://localhost/api/image/${token}${query}`, { headers });
  return GET(req, { params: Promise.resolve({ id: token }) });
}

describe('GET /api/image/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a raw Immich UUID instead of an encoded token', async () => {
    const res = await call(ASSET_ID);
    expect(res.status).toBe(400);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('rejects a syntactically broken token', async () => {
    const res = await call('v2:not-valid-base64url!!');
    expect(res.status).toBe(400);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('serves a valid token', async () => {
    mockStream.mockResolvedValue(fakeBody('image/jpeg'));
    const res = await call(encodeAssetId(ASSET_ID));
    expect(res.status).toBe(200);
    expect(mockStream).toHaveBeenCalledWith(ASSET_ID, 'preview');
  });

  // Regression guard for the stored-XSS fix in c2fa8e7. An SVG served as
  // image/svg+xml executes script in the browser under our own origin.
  // This logic lives in the route and cannot be extracted the way
  // lib/imageSize.ts was, so a route-level test is the only way to pin it.
  it.each([
    ['image/svg+xml', 'application/octet-stream'],
    ['text/xml', 'application/octet-stream'],
    ['text/html', 'application/octet-stream'],
    ['application/octet-stream', 'image/jpeg'],
    ['image/jpeg', 'image/jpeg'],
    ['image/webp', 'image/webp'],
  ])('rewrites upstream Content-Type %s to %s', async (upstream, expected) => {
    mockStream.mockResolvedValue(fakeBody(upstream));
    const res = await call(encodeAssetId(ASSET_ID));
    expect(res.headers.get('Content-Type')).toBe(expected);
  });

  it('returns 304 with no body when the ETag matches', async () => {
    mockStream.mockResolvedValue(fakeBody('image/jpeg'));
    const token = encodeAssetId(ASSET_ID);

    const first = await call(token);
    const etag = first.headers.get('ETag');
    expect(etag).toBeTruthy();

    const res = await call(token, '', { 'if-none-match': etag as string });
    expect(res.status).toBe(304);
    expect(await res.text()).toBe('');
  });

  it('never leaks the raw asset UUID in response headers', async () => {
    mockStream.mockResolvedValue(fakeBody('image/jpeg'));
    const res = await call(encodeAssetId(ASSET_ID));
    const headerDump = JSON.stringify([...res.headers.entries()]);
    expect(headerDump).not.toContain(ASSET_ID);
  });

  it('404s when the asset is genuinely gone', async () => {
    mockStream.mockResolvedValue(null);
    const res = await call(encodeAssetId(ASSET_ID));
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('503s when Immich is unavailable, and does not let it be cached', async () => {
    mockStream.mockRejectedValue(new ImmichUnavailableError('upstream down'));
    const res = await call(encodeAssetId(ASSET_ID));
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });
});
