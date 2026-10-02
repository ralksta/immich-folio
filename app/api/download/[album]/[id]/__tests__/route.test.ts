import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  LAT,
  cameraHeic,
  cameraJpeg,
  chunked,
  contains,
  exifOf,
  heicExif,
  latin1,
  parseTiff,
  asciiOf,
} from '@/lib/__tests__/fixtures/location';

/**
 * The single-original download serves the file without its location: GPS is
 * removed from JPEG/HEIC/AVIF on the way through, camera data stays, and the
 * length (and so Content-Length) does not change.
 */

vi.mock('@/lib/config', () => ({ getConfig: vi.fn() }));
vi.mock('@/lib/tokens', () => ({ decodeAssetId: vi.fn((t: string) => t.replace('tok-', '')) }));
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

import { GET } from '../route';
import { getConfig } from '@/lib/config';
import { immich } from '@/lib/immich';

const mockConfig = getConfig as unknown as ReturnType<typeof vi.fn>;
const mockGetAlbum = immich.getAlbum as unknown as ReturnType<typeof vi.fn>;
const mockStream = immich.streamAsset as unknown as ReturnType<typeof vi.fn>;

const ALBUM = {
  id: 'album',
  albumName: 'Album',
  assets: [{ id: 'asset', type: 'IMAGE', originalFileName: 'IMG_0001.JPG' }],
};

function original(data: Uint8Array, contentType: string) {
  return {
    stream: chunked(data, 1000),
    contentType,
    contentLength: String(data.length),
  };
}

const download = () =>
  GET(new NextRequest('http://localhost/api/download/tok-album/tok-asset'), {
    params: Promise.resolve({ album: 'tok-album', id: 'tok-asset' }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockConfig.mockReturnValue({ albums: ['album'], albumDownloads: { album: true } });
  mockGetAlbum.mockResolvedValue(ALBUM);
});

describe('GET /api/download/[album]/[id]', () => {
  it('serves a JPEG without GPS, camera data and length intact', async () => {
    const { file } = cameraJpeg(true);
    mockStream.mockResolvedValue(original(file, 'image/jpeg'));

    const res = await download();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-length')).toBe(String(file.length));
    expect(res.headers.get('content-disposition')).toContain('IMG_0001.JPG');

    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.length).toBe(file.length);
    const tiff = parseTiff(exifOf(body)!);
    expect(tiff.gps).toBeNull();
    expect(tiff.ifd0.has(0x8825)).toBe(false);
    expect(asciiOf(tiff.ifd0.get(0x0110))).toBe('Canon EOS R5');
    expect(contains(body, LAT.value(true))).toBe(false);
    expect(latin1(body)).not.toMatch(/exif:GPS/);
    expect(latin1(body)).toContain('photoshop:City="Berlin"');
  });

  it('serves a HEIC without GPS', async () => {
    const { file } = cameraHeic();
    mockStream.mockResolvedValue(original(file, 'image/heic'));

    const body = new Uint8Array(await (await download()).arrayBuffer());
    expect(body.length).toBe(file.length);
    const tiff = parseTiff(heicExif(body)!);
    expect(tiff.gps).toBeNull();
    expect(asciiOf(tiff.ifd0.get(0x010f))).toBe('Canon');
  });

  it('passes a format it does not edit through unchanged', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    mockStream.mockResolvedValue(original(png, 'image/png'));
    const body = new Uint8Array(await (await download()).arrayBuffer());
    expect(body).toEqual(png);
  });

  it('refuses a JPEG whose metadata it cannot locate', async () => {
    mockStream.mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          // SOI, then an APP1 claiming more bytes than the file has.
          controller.enqueue(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00, 0x45, 0x78]));
          controller.close();
        },
      }),
      contentType: 'image/jpeg',
      contentLength: '8',
    });
    const res = await download();
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  describe('a photo edited in Immich (#831)', () => {
    const EDITED = {
      id: 'album',
      albumName: 'Album',
      assets: [{ id: 'asset', type: 'IMAGE', originalFileName: 'IMG_9262.HEIC', isEdited: true }],
    };

    it('serves the edited rendition, named as the JPEG it is, without GPS', async () => {
      mockGetAlbum.mockResolvedValue(EDITED);
      // Immich's edited rendition carries no EXIF; one that did must still
      // lose its GPS on the way through.
      const { file } = cameraJpeg(true);
      mockStream.mockResolvedValue(original(file, 'image/jpeg'));

      const res = await download();
      expect(res.status).toBe(200);
      expect(mockStream).toHaveBeenCalledWith('asset', 'original', true);
      expect(res.headers.get('content-type')).toBe('image/jpeg');
      expect(res.headers.get('content-disposition')).toContain('IMG_9262.jpg');
      expect(res.headers.get('content-disposition')).not.toContain('HEIC');
      const body = new Uint8Array(await res.arrayBuffer());
      expect(parseTiff(exifOf(body)!).gps).toBeNull();
      expect(contains(body, LAT.value(true))).toBe(false);
    });

    it('keeps the name of an edited JPEG', async () => {
      mockGetAlbum.mockResolvedValue({
        ...EDITED,
        assets: [{ ...EDITED.assets[0], originalFileName: 'scan.jpeg' }],
      });
      mockStream.mockResolvedValue(original(cameraJpeg(true).file, 'image/jpeg'));
      const res = await download();
      expect(res.headers.get('content-disposition')).toContain('scan.jpeg');
    });

    it('refuses an edited rendition the scrubber would pass through (review of #832)', async () => {
      mockGetAlbum.mockResolvedValue(EDITED);
      const webp = new TextEncoder().encode('RIFF\x10\x00\x00\x00WEBPVP8 ');
      mockStream.mockResolvedValue(original(webp, 'image/webp'));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const res = await download();
      expect(res.status).toBe(404);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(warn.mock.calls.some((args) => String(args[0]).includes('Refused edited asset'))).toBe(
        true,
      );
      warn.mockRestore();
    });

    it('asks for the original of a photo that is not edited exactly as before', async () => {
      mockStream.mockResolvedValue(original(cameraJpeg(true).file, 'image/jpeg'));
      await download();
      expect(mockStream).toHaveBeenCalledWith('asset', 'original', false);
    });
  });
});
