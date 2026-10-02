import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  LAT,
  cameraHeic,
  cameraJpeg,
  chunked,
  contains,
  latin1,
} from '@/lib/__tests__/fixtures/location';

/**
 * The archive route streams originals as a ZIP for either the whole album
 * (GET) or a proofing selection (POST). It shares the single-asset download's
 * checks — allowlist, `download: true`, password gates, asset membership — and
 * adds one of its own: a selected token must decode to an asset that actually
 * belongs to the album it names.
 */

vi.mock('@/lib/config', () => ({ getConfig: vi.fn(), getConfigOrNull: vi.fn() }));
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
import { getConfig, getConfigOrNull } from '@/lib/config';
import { decodeAssetId } from '@/lib/tokens';
import { immich } from '@/lib/immich';
import { getClientIp } from '@/lib/rate-limit';

const mockConfig = getConfig as unknown as ReturnType<typeof vi.fn>;
const mockConfigOrNull = getConfigOrNull as unknown as ReturnType<typeof vi.fn>;
const mockDecode = decodeAssetId as unknown as ReturnType<typeof vi.fn>;
const mockGetAlbum = immich.getAlbum as unknown as ReturnType<typeof vi.fn>;
const mockStream = immich.streamAsset as unknown as ReturnType<typeof vi.fn>;
const mockClientIp = getClientIp as unknown as ReturnType<typeof vi.fn>;

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

/** The form POST the proofing modal makes — one `assets` field per token. */
function formReq(tokens: string[]) {
  const body = tokens.map((t) => `assets=${encodeURIComponent(t)}`).join('&');
  return new NextRequest('http://localhost/api/download/album-token/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

const browsesHtml = (referer?: string) =>
  new NextRequest('http://localhost/api/download/album-token/archive', {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      ...(referer ? { Referer: referer } : {}),
    },
  });

beforeEach(() => {
  vi.clearAllMocks();
  decodeMap();
  mockConfig.mockReturnValue(optedIn());
  mockConfigOrNull.mockReturnValue(null);
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

  it('accepts the form body the proofing modal posts', async () => {
    const res = await POST(formReq(['asset-token-1', 'asset-token-2']), params);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    // Draining the body drives the background streaming loop to completion.
    await res.arrayBuffer();
    expect(mockStream).toHaveBeenCalledTimes(2);
  });

  /**
   * `byId.get()` is a lookup, not a consume, so without a `seen` set the same
   * token could be appended once per occurrence — a 2 GB video repeated 800
   * times is 1.6 TB off the Immich server.
   */
  it('appends a repeated token only once', async () => {
    const res = await POST(
      postReq(['asset-token-1', 'asset-token-1', 'asset-token-1', 'asset-token-1']),
      params,
    );
    expect(res.status).toBe(200);
    await res.arrayBuffer();
    expect(mockStream).toHaveBeenCalledTimes(1);
  });

  it('refuses a selection past the absolute ceiling', async () => {
    const assets = Array.from({ length: 1001 }, (_, i) => ({
      id: `asset-${i}`,
      type: 'IMAGE',
      originalFileName: `photo-${i}.jpg`,
    }));
    mockGetAlbum.mockResolvedValue({ ...ALBUM, assets });
    mockDecode.mockImplementation((token: string) =>
      token === 'album-token' ? 'album-uuid' : token.replace('token-', ''),
    );
    const tokens = assets.map((a) => `token-${a.id}`);

    const res = await POST(postReq(tokens), params);
    expect(res.status).toBe(404);
  });

  it('refuses a body past the size cap', async () => {
    const big = JSON.stringify({ assets: Array(30000).fill('asset-token-1') });
    const req = new NextRequest('http://localhost/api/download/album-token/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: big,
    });
    const res = await POST(req, params);
    expect(res.status).toBe(404);
  });
});

describe('refusals', () => {
  it('renders HTML for a browser navigation instead of raw JSON', async () => {
    mockConfig.mockReturnValue({ albums: ['album-uuid'], albumDownloads: {} });
    const res = await GET(browsesHtml(), params);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it("speaks the site's language", async () => {
    mockConfig.mockReturnValue({ albums: ['album-uuid'], albumDownloads: {} });
    mockConfigOrNull.mockReturnValue({ lang: 'de' });
    const html = await (await GET(browsesHtml(), params)).text();
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('Download nicht möglich');
    expect(html).toContain('Zurück zur Galerie');
  });

  it('links back to the page the download started from', async () => {
    mockConfig.mockReturnValue({ albums: ['album-uuid'], albumDownloads: {} });
    const html = await (
      await GET(browsesHtml('http://localhost/deutschland/kloster-chorin?fav=abc'), params)
    ).text();
    expect(html).toContain('href="/deutschland/kloster-chorin?fav=abc"');
  });

  it('does not follow a foreign referer', async () => {
    mockConfig.mockReturnValue({ albums: ['album-uuid'], albumDownloads: {} });
    const html = await (await GET(browsesHtml('https://evil.example/phish'), params)).text();
    expect(html).toContain('href="/"');
    expect(html).not.toContain('evil.example');
  });

  /**
   * Next rebuilds `nextUrl` from its own bind address, so behind
   * `next start -H 127.0.0.1` or a reverse proxy it reads `localhost` while
   * the visitor's Referer names the host they typed. Comparing against
   * `nextUrl.origin` sent every visitor home.
   */
  it('follows the Referer when Next knows itself as localhost but was asked as another host', async () => {
    mockConfig.mockReturnValue({ albums: ['album-uuid'], albumDownloads: {} });
    const req = new NextRequest('http://localhost:3598/api/download/album-token/archive', {
      headers: {
        Accept: 'text/html',
        Host: '127.0.0.1:3598',
        Referer: 'http://127.0.0.1:3598/polen/krakau',
      },
    });
    const html = await (await GET(req, params)).text();
    expect(html).toContain('href="/polen/krakau"');
  });

  it('does not follow a Referer whose path would read as a host', async () => {
    mockConfig.mockReturnValue({ albums: ['album-uuid'], albumDownloads: {} });
    const html = await (await GET(browsesHtml('http://localhost//evil.example/x'), params)).text();
    expect(html).toContain('href="/"');
    expect(html).not.toContain('evil.example');
  });

  it('ignores X-Forwarded-Host unless a proxy is trusted', async () => {
    mockConfig.mockReturnValue({ albums: ['album-uuid'], albumDownloads: {} });
    const req = new NextRequest('http://localhost/api/download/album-token/archive', {
      headers: {
        Accept: 'text/html',
        'X-Forwarded-Host': 'evil.example',
        Referer: 'https://evil.example/phish',
      },
    });
    const html = await (await GET(req, params)).text();
    expect(html).toContain('href="/"');
  });

  /**
   * The page used to be browser-default: white, blue link, system font — in
   * the middle of a dark gallery. It now carries the site's colour mode and
   * accent in an inline stylesheet, and a policy that allows nothing else.
   */
  it("wears the site's colour mode and accent, under a policy that allows only its style", async () => {
    mockConfig.mockReturnValue({ albums: ['album-uuid'], albumDownloads: {} });
    mockConfigOrNull.mockReturnValue({
      lang: 'de',
      colorMode: 'dark',
      theme: { preset: 'studio-modern', accent: '#e60012' },
    });
    const res = await GET(browsesHtml(), params);
    const html = await res.text();
    expect(html).toContain('<style>');
    expect(html).toContain('color-scheme:dark;--bg:#121212');
    expect(html).toContain('--accent:#e60012');
    expect(html).not.toContain('style="');
    expect(res.headers.get('content-security-policy')).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    );
  });

  it("follows the visitor's OS when the site's mode is auto", async () => {
    mockConfig.mockReturnValue({ albums: ['album-uuid'], albumDownloads: {} });
    mockConfigOrNull.mockReturnValue({ colorMode: 'auto' });
    const html = await (await GET(browsesHtml(), params)).text();
    expect(html).toContain('@media (prefers-color-scheme: light){:root{color-scheme:light;');
  });

  it('keeps JSON for an API caller', async () => {
    mockConfig.mockReturnValue({ albums: ['album-uuid'], albumDownloads: {} });
    const res = await GET(getReq(), params);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

/**
 * An original that is still arriving when the visitor gives up must be let go:
 * the loop stopping is not enough, because the upstream body keeps its socket
 * out of undici's pool until something cancels it (#635).
 */
describe('abort', () => {
  /** An original that sends one chunk and then never finishes. */
  function stallingStream(onCancel: () => void) {
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('first-chunk'));
        },
        cancel: onCancel,
      }),
      contentType: 'image/jpeg',
      contentLength: null,
    };
  }

  it('cancels the original in flight when the download is aborted', async () => {
    const cancelled = vi.fn();
    mockStream.mockImplementation(() => Promise.resolve(stallingStream(cancelled)));

    const res = await GET(getReq(), params);
    const reader = res.body!.getReader();
    await reader.read(); // the entry is under way
    await reader.cancel();

    await vi.waitFor(() => expect(cancelled).toHaveBeenCalled());
    // The loop stopped rather than moving on to the next original.
    expect(mockStream).toHaveBeenCalledTimes(1);
  });
});

/**
 * The album archive and the proofing archive draw on one pool of slots per
 * client, so holding two album ZIPs open closes the proofing route as well.
 */
describe('concurrent archives', () => {
  it('shares one per-client cap with the proofing archive route', async () => {
    mockClientIp.mockReturnValue('198.51.100.7');
    // Originals that never finish, so both archives stay open.
    mockStream.mockImplementation(() =>
      Promise.resolve({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('first-chunk'));
          },
        }),
        contentType: 'image/jpeg',
        contentLength: null,
      }),
    );

    const first = await GET(getReq(), params);
    const second = await POST(postReq(['asset-token-1']), params);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const third = await GET(getReq(), params);
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toBeTruthy();

    const { GET: proofArchive } = await import('@/app/api/proof/[token]/archive/route');
    const proof = await proofArchive(
      new NextRequest('http://localhost/api/proof/tok/archive?scope=album'),
      { params: Promise.resolve({ token: 'tok' }) },
    );
    expect(proof.status).toBe(429);

    // Closing one download frees its slot for the next.
    await first.body!.cancel();
    await vi.waitFor(async () => {
      const again = await GET(getReq(), params);
      expect(again.status).toBe(200);
      await again.body!.cancel();
    });
    await second.body!.cancel();
    mockClientIp.mockReturnValue('127.0.0.1');
  });
});

/**
 * The ZIP is stored uncompressed, so each entry's bytes appear in it as they
 * are: what the scrubber left is exactly what a visitor unpacks.
 */
describe('location metadata', () => {
  it('leaves GPS out of every original in the archive and keeps camera data', async () => {
    const jpeg = cameraJpeg(false).file;
    const heic = cameraHeic({ le: true }).file;
    mockStream.mockImplementation((id: string) =>
      Promise.resolve({
        stream: chunked(id === 'asset-1' ? jpeg : heic, 512),
        contentType: id === 'asset-1' ? 'image/jpeg' : 'image/heic',
        contentLength: null,
      }),
    );

    const zip = new Uint8Array(await (await GET(getReq(), params)).arrayBuffer());
    expect(contains(zip, LAT.value(false))).toBe(false);
    expect(contains(zip, LAT.value(true))).toBe(false);
    const text = latin1(zip);
    expect(text).not.toMatch(/exif:GPS/);
    expect(text).not.toContain('52.520095');
    expect(text.split('Canon EOS R5').length - 1).toBeGreaterThanOrEqual(2);
    expect(text).toContain('photoshop:City="Berlin"');
  });

  it('leaves out an original whose metadata cannot be located, and goes on', async () => {
    const broken = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00, 0x45, 0x78]);
    mockStream.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'asset-1'
          ? { stream: chunked(broken, 8), contentType: 'image/jpeg', contentLength: null }
          : originStream('second-original'),
      ),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const zip = latin1(new Uint8Array(await (await GET(getReq(), params)).arrayBuffer()));
    // Visible in the server log: which asset, which album, and how many.
    const logged = warn.mock.calls.map((args) => String(args[0]));
    expect(logged.some((l) => l.includes('asset-1') && l.includes('Test Album'))).toBe(true);
    expect(logged.some((l) => l.includes('missing 1 of 2'))).toBe(true);
    warn.mockRestore();
    expect(zip).not.toContain('photo-1.jpg');
    expect(zip).toContain('photo-2.jpg');
    expect(zip).toContain('second-original');
  });

  it('puts a photo edited in Immich in as edited, renamed, and without GPS (#831)', async () => {
    mockGetAlbum.mockResolvedValue({
      ...ALBUM,
      assets: [
        { id: 'asset-1', type: 'IMAGE', originalFileName: 'IMG_9262.HEIC', isEdited: true },
        { id: 'asset-2', type: 'IMAGE', originalFileName: 'photo-2.jpg' },
      ],
    });
    const jpeg = cameraJpeg(true).file;
    mockStream.mockImplementation(() =>
      Promise.resolve({
        stream: chunked(jpeg, 512),
        contentType: 'image/jpeg',
        contentLength: null,
      }),
    );

    const zip = new Uint8Array(await (await GET(getReq(), params)).arrayBuffer());
    expect(mockStream).toHaveBeenCalledWith('asset-1', 'original', true);
    expect(mockStream).toHaveBeenCalledWith('asset-2', 'original', false);
    const text = latin1(zip);
    expect(text).toContain('IMG_9262.jpg');
    expect(text).not.toContain('IMG_9262.HEIC');
    expect(contains(zip, LAT.value(true))).toBe(false);
  });

  it('leaves out an edited rendition the scrubber would pass through (review of #832)', async () => {
    mockGetAlbum.mockResolvedValue({
      ...ALBUM,
      assets: [
        { id: 'asset-1', type: 'IMAGE', originalFileName: 'IMG_9262.HEIC', isEdited: true },
        { id: 'asset-2', type: 'IMAGE', originalFileName: 'photo-2.jpg' },
      ],
    });
    const webp = new TextEncoder().encode('RIFF\x10\x00\x00\x00WEBPVP8 edited-webp');
    mockStream.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'asset-1'
          ? { stream: chunked(webp, 64), contentType: 'image/webp', contentLength: null }
          : originStream('second-original'),
      ),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const zip = latin1(new Uint8Array(await (await GET(getReq(), params)).arrayBuffer()));
    const logged = warn.mock.calls.map((args) => String(args[0]));
    expect(logged.some((l) => l.includes('edited asset asset-1'))).toBe(true);
    warn.mockRestore();
    expect(zip).not.toContain('edited-webp');
    expect(zip).not.toContain('IMG_9262');
    expect(zip).toContain('second-original');
  });
});
