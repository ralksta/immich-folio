import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  LAT,
  asciiOf,
  cameraHeic,
  cameraJpeg,
  chunked,
  contains,
  exifOf,
  heicExif,
  latin1,
  parseTiff,
} from '@/lib/__tests__/fixtures/location';

/**
 * GET /api/zoom/[album]/[id] (#467): the full-resolution file behind the
 * lightbox zoom. Every refusal is the same 404; the route checks are tested
 * here, the per-route zoom/password resolution in lib/__tests__/auth-zoom.
 */

vi.mock('@/lib/config', () => ({ getConfig: vi.fn() }));
vi.mock('@/lib/tokens', () => ({
  decodeAssetId: vi.fn((t: string) => (t.startsWith('tok-') ? t.replace('tok-', '') : null)),
}));
vi.mock('@/lib/immich', () => ({
  immich: { getAlbum: vi.fn(), streamAsset: vi.fn(), streamFullsize: vi.fn() },
  ImmichUnavailableError: class ImmichUnavailableError extends Error {},
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ success: true, resetAt: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  retryAfterSeconds: vi.fn(() => 60),
}));
vi.mock('@/lib/auth', () => ({
  siteLockResponse: vi.fn(() => null),
  isAlbumZoomReachable: vi.fn(() => true),
}));
vi.mock('@/lib/publishedAssets', () => ({ isPublishedAsset: vi.fn(async () => true) }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ get: () => undefined })),
}));

import { GET } from '../route';
import { getConfig } from '@/lib/config';
import { immich, ImmichUnavailableError } from '@/lib/immich';
import { checkRateLimit } from '@/lib/rate-limit';
import { isAlbumZoomReachable, siteLockResponse } from '@/lib/auth';
import { isPublishedAsset } from '@/lib/publishedAssets';

const mocked = <T>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const asset = (id: string, originalMimeType: string, type = 'IMAGE') => ({
  id,
  type,
  originalMimeType,
  originalFileName: `${id}.bin`,
});

const ALBUM = {
  id: 'album',
  albumName: 'Album',
  assets: [
    asset('jpeg', 'image/jpeg'),
    asset('avif', 'image/avif'),
    asset('heic', 'image/heic'),
    asset('png', 'image/png'),
    asset('webp', 'image/webp'),
    asset('mov', 'video/quicktime', 'VIDEO'),
    { ...asset('edited', 'image/jpeg'), isEdited: true },
    { ...asset('edited-heic', 'image/heic'), isEdited: true },
  ],
};

function upstream(data: Uint8Array, contentType: string) {
  return { stream: chunked(data, 1000), contentType, contentLength: String(data.length) };
}

const zoom = (assetToken = 'tok-jpeg', albumToken = 'tok-album') =>
  GET(new NextRequest(`http://localhost/api/zoom/${albumToken}/${assetToken}`), {
    params: Promise.resolve({ album: albumToken, id: assetToken }),
  });

/** A HEIF-family file branded as AVIF, as Lightroom writes one. */
function avifFile() {
  const { file } = cameraHeic();
  const out = file.slice();
  out.set([0x61, 0x76, 0x69, 0x66], 8); // major brand → 'avif'
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked(getConfig).mockReturnValue({ albums: ['album'] });
  mocked(immich.getAlbum).mockResolvedValue(ALBUM);
});

describe('refusals', () => {
  it('answers a locked site with the lock, before anything else', async () => {
    mocked(siteLockResponse).mockReturnValueOnce(
      NextResponse.json(
        { error: 'locked' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ),
    );
    const res = await zoom();
    expect(res.status).toBe(401);
    expect(immich.getAlbum).not.toHaveBeenCalled();
  });

  it('rate-limits in its own bucket', async () => {
    mocked(checkRateLimit).mockReturnValueOnce({ success: false, resetAt: Date.now() + 1000 });
    const res = await zoom();
    expect(res.status).toBe(429);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('retry-after')).toBe('60');
    expect(checkRateLimit).toHaveBeenCalledWith('zoom:127.0.0.1', 20);
  });

  it.each([
    ['an undecodable album token', () => zoom('tok-jpeg', 'garbage')],
    ['an undecodable asset token', () => zoom('garbage')],
  ])('refuses %s', async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('refuses an album that is not on the allowlist', async () => {
    mocked(getConfig).mockReturnValue({ albums: ['other'] });
    expect((await zoom()).status).toBe(404);
    expect(isAlbumZoomReachable).not.toHaveBeenCalled();
  });

  it('refuses when zoom is off, or the album is locked, hidden behind an offline page …', async () => {
    // isAlbumZoomReachable covers each of those (lib/__tests__/auth-zoom).
    mocked(isAlbumZoomReachable).mockReturnValueOnce(false);
    const res = await zoom();
    expect(res.status).toBe(404);
    expect(isAlbumZoomReachable).toHaveBeenCalledWith('album', expect.any(Function));
    expect(immich.streamAsset).not.toHaveBeenCalled();
  });

  it('refuses an asset the site no longer publishes', async () => {
    mocked(isPublishedAsset).mockResolvedValueOnce(false);
    expect((await zoom()).status).toBe(404);
    expect(immich.getAlbum).not.toHaveBeenCalled();
  });

  it('refuses an asset from another album', async () => {
    expect((await zoom('tok-elsewhere')).status).toBe(404);
    expect(immich.streamAsset).not.toHaveBeenCalled();
  });

  it.each(['png', 'webp', 'mov'])('never streams a %s', async (id) => {
    expect((await zoom(`tok-${id}`)).status).toBe(404);
    expect(immich.streamAsset).not.toHaveBeenCalled();
    expect(immich.streamFullsize).not.toHaveBeenCalled();
  });

  it('answers 503 while Immich is down', async () => {
    mocked(immich.getAlbum).mockRejectedValueOnce(new ImmichUnavailableError('down'));
    const res = await zoom();
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('the JPEG original', () => {
  it('goes out without GPS, inline, privately cached, length intact', async () => {
    const { file } = cameraJpeg(true);
    mocked(immich.streamAsset).mockResolvedValue(upstream(file, 'image/jpeg'));

    const res = await zoom();
    expect(res.status).toBe(200);
    expect(immich.streamAsset).toHaveBeenCalledWith('jpeg', 'original');
    expect(immich.streamFullsize).not.toHaveBeenCalled();
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('content-disposition')).toBe('inline');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(res.headers.get('content-length')).toBe(String(file.length));

    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.length).toBe(file.length);
    const tiff = parseTiff(exifOf(body)!);
    expect(tiff.gps).toBeNull();
    expect(asciiOf(tiff.ifd0.get(0x0110))).toBe('Canon EOS R5');
    expect(contains(body, LAT.value(true))).toBe(false);
    expect(latin1(body)).not.toMatch(/exif:GPS/);
  });

  it('is refused when its metadata cannot be located', async () => {
    mocked(immich.streamAsset).mockResolvedValue({
      stream: chunked(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00, 0x45, 0x78]), 8),
      contentType: 'image/jpeg',
      contentLength: '8',
    });
    expect((await zoom()).status).toBe(404);
  });

  it('is refused when the bytes are not a JPEG at all', async () => {
    // Labelled JPEG, actually a PNG: the scrubber would pass it through
    // untouched, eXIf chunk and all.
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    mocked(immich.streamAsset).mockResolvedValue(upstream(png, 'image/jpeg'));
    expect((await zoom()).status).toBe(404);
  });
});

describe('the AVIF original', () => {
  it('goes out without GPS', async () => {
    const file = avifFile();
    mocked(immich.streamAsset).mockResolvedValue(upstream(file, 'image/avif'));
    const res = await zoom('tok-avif');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/avif');
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.length).toBe(file.length);
    expect(parseTiff(heicExif(body)!).gps).toBeNull();
  });
});

describe('a HEIC (not browser-displayable)', () => {
  it('uses Immich’s full-size rendition, scrubbed', async () => {
    const { file } = cameraJpeg(false);
    mocked(immich.streamFullsize).mockResolvedValue(upstream(file, 'image/jpeg'));
    const res = await zoom('tok-heic');
    expect(res.status).toBe(200);
    expect(immich.streamFullsize).toHaveBeenCalledWith('heic', false);
    expect(immich.streamAsset).not.toHaveBeenCalled();
    const body = new Uint8Array(await res.arrayBuffer());
    expect(parseTiff(exifOf(body)!).gps).toBeNull();
  });

  it('is 404 when Immich has no rendition', async () => {
    mocked(immich.streamFullsize).mockResolvedValue(null);
    const res = await zoom('tok-heic');
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('never sends the HEIC original itself', async () => {
    mocked(immich.streamFullsize).mockResolvedValue(upstream(cameraHeic().file, 'image/heic'));
    expect((await zoom('tok-heic')).status).toBe(404);
  });

  it('refuses a WebP rendition, whose metadata is not scrubbed', async () => {
    const webp = new TextEncoder().encode('RIFF\x10\x00\x00\x00WEBPVP8 ');
    mocked(immich.streamFullsize).mockResolvedValue(upstream(webp, 'image/webp'));
    expect((await zoom('tok-heic')).status).toBe(404);
  });
});

describe('a photo edited in Immich (#831)', () => {
  it.each(['edited', 'edited-heic'])(
    'zooms a %s into the edited full-size rendition, never the original',
    async (id) => {
      // Immich's edited rendition is a JPEG; given one with GPS here, the
      // scrubber still has to take it out.
      const { file } = cameraJpeg(true);
      mocked(immich.streamFullsize).mockResolvedValue(upstream(file, 'image/jpeg'));
      const res = await zoom(`tok-${id}`);
      expect(res.status).toBe(200);
      expect(immich.streamFullsize).toHaveBeenCalledWith(id, true);
      expect(immich.streamAsset).not.toHaveBeenCalled();
      const body = new Uint8Array(await res.arrayBuffer());
      expect(parseTiff(exifOf(body)!).gps).toBeNull();
      expect(contains(body, LAT.value(true))).toBe(false);
    },
  );

  it('is 404 when Immich has no edited rendition', async () => {
    mocked(immich.streamFullsize).mockResolvedValue(null);
    const res = await zoom('tok-edited');
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
