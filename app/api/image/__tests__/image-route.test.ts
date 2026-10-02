import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../[id]/route';
import { encodeAssetId } from '@/lib/tokens';
import { immich, ImmichUnavailableError } from '@/lib/immich';

const published = vi.hoisted(() => ({ value: true, asked: [] as string[] }));
vi.mock('@/lib/publishedAssets', () => ({
  isPublishedAsset: async (id: string) => {
    published.asked.push(id);
    return published.value;
  },
}));
vi.mock('@/lib/admin/auth', () => ({
  isAdminAuthenticated: async () => false,
}));

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

  it('refuses an asset the site no longer shows, without caching the refusal', async () => {
    published.value = false;
    try {
      const res = await call(encodeAssetId(ASSET_ID));
      expect(res.status).toBe(404);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(mockStream).not.toHaveBeenCalled();
    } finally {
      published.value = true;
    }
  });

  it('serves a valid token', async () => {
    mockStream.mockResolvedValue(fakeBody('image/jpeg'));
    const res = await call(encodeAssetId(ASSET_ID));
    expect(res.status).toBe(200);
    expect(mockStream).toHaveBeenCalledWith(ASSET_ID, 'preview', true);
  });

  describe('photos edited in Immich (#831)', () => {
    beforeEach(() => {
      published.asked = [];
    });

    it('asks Immich for the edit when the URL carries the edit marker', async () => {
      mockStream.mockResolvedValue(fakeBody('image/jpeg'));
      const res = await call(encodeAssetId(ASSET_ID), '?size=preview&e=mf3k2abc');
      expect(res.status).toBe(200);
      expect(mockStream).toHaveBeenCalledWith(ASSET_ID, 'preview', true);
    });

    it('asks for the edited thumbnail too', async () => {
      mockStream.mockResolvedValue(fakeBody('image/webp'));
      await call(encodeAssetId(ASSET_ID), '?size=thumbnail&e=mf3k2abc');
      expect(mockStream).toHaveBeenCalledWith(ASSET_ID, 'thumbnail', true);
    });

    it('shows the edit to a URL stripped of its marker: the server decides, not the URL', async () => {
      // Review of #832: with the marker as the switch, dropping `&e=` from a
      // URL brought back what the photographer had cropped out.
      mockStream.mockResolvedValue(fakeBody('image/jpeg'));
      await call(encodeAssetId(ASSET_ID), '?size=preview&w=1440');
      expect(mockStream).toHaveBeenCalledWith(ASSET_ID, 'preview', true);
      mockStream.mockResolvedValue(fakeBody('image/webp'));
      await call(encodeAssetId(ASSET_ID), '?size=thumbnail');
      expect(mockStream).toHaveBeenCalledWith(ASSET_ID, 'thumbnail', true);
      expect(mockStream).not.toHaveBeenCalledWith(ASSET_ID, expect.anything(), false);
    });

    it('is still gated by the published-asset check, which goes by the asset alone', async () => {
      mockStream.mockResolvedValue(fakeBody('image/jpeg'));
      const res = await call(encodeAssetId(ASSET_ID), '?size=preview&e=mf3k2abc&w=1440');
      expect(res.status).toBe(200);
      expect(published.asked).toEqual([ASSET_ID]);

      published.value = false;
      try {
        const refused = await call(encodeAssetId(ASSET_ID), '?size=preview&e=mf3k2abc');
        expect(refused.status).toBe(404);
      } finally {
        published.value = true;
      }
    });

    it('gives the edited rendition its own ETag', async () => {
      mockStream.mockResolvedValue(fakeBody('image/jpeg'));
      const token = encodeAssetId(ASSET_ID);
      const plain = (await call(token, '?size=preview')).headers.get('ETag');
      mockStream.mockResolvedValue(fakeBody('image/jpeg'));
      const edited = (await call(token, '?size=preview&e=mf3k2abc')).headers.get('ETag');
      mockStream.mockResolvedValue(fakeBody('image/jpeg'));
      const reEdited = (await call(token, '?size=preview&e=mf9zz001')).headers.get('ETag');
      expect(new Set([plain, edited, reEdited]).size).toBe(3);
    });

    it('ignores a marker that is not one, and keeps it out of the ETag', async () => {
      mockStream.mockResolvedValue(fakeBody('image/jpeg'));
      const token = encodeAssetId(ASSET_ID);
      const res = await call(token, `?size=preview&e=${encodeURIComponent('"x", W/"y')}`);
      expect(mockStream).toHaveBeenCalledWith(ASSET_ID, 'preview', true);
      expect(res.headers.get('ETag')).not.toContain('y');
    });
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
