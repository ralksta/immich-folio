import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ascii, cat, chunked, contains } from '@/lib/__tests__/fixtures/location';
import {
  FRAMES,
  ISO6709,
  box,
  ftyp,
  loci,
  make,
  mdat,
  moovWith,
  xyz,
} from '@/lib/__tests__/fixtures/mp4';
import { scrubLocation } from '@/lib/locationScrub';
import { clearPlaybackPlans } from '@/lib/videoPlayback';

/**
 * What a player gets from /api/video has no recorded location, whichever
 * range it asks for, with Content-Length and Content-Range as Immich sent
 * them. A file whose metadata cannot be located is not played.
 */

vi.mock('@/lib/config', () => ({ getConfig: vi.fn(() => ({ rateLimitRpm: 1000 })) }));
vi.mock('@/lib/tokens', () => ({ decodeAssetId: vi.fn((t: string) => t.replace('tok-', '')) }));
vi.mock('@/lib/publishedAssets', () => ({ isPublishedAsset: vi.fn(async () => true) }));
vi.mock('@/lib/admin/auth', () => ({ isAdminAuthenticated: vi.fn(async () => false) }));
vi.mock('@/lib/auth', () => ({ siteLockResponse: vi.fn(() => null) }));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ success: true, remaining: 99, resetAt: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  retryAfterSeconds: vi.fn(() => 60),
}));
vi.mock('@/lib/immich', () => ({
  immich: { streamVideo: vi.fn() },
  ImmichUnavailableError: class ImmichUnavailableError extends Error {},
}));

import { GET } from '../route';
import { immich, ImmichUnavailableError } from '@/lib/immich';

const mockStreamVideo = immich.streamVideo as unknown as ReturnType<typeof vi.fn>;

const BIG_FRAMES = cat(...new Array(200).fill(FRAMES));
const VIDEO = cat(ftyp('qt  '), mdat(BIG_FRAMES), moovWith(xyz, loci, make), box('free'));

/** Immich's playback endpoint over `file`, honouring Range like the real one. */
function serve(file: Uint8Array, contentType = 'video/quicktime') {
  mockStreamVideo.mockImplementation(async (_id: string, range?: string | null) => {
    const m = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
    if (!m) {
      return {
        stream: chunked(file, 500),
        contentType,
        contentLength: String(file.length),
        contentRange: null,
        status: 200,
      };
    }
    const start = Number(m[1]);
    const end = m[2] ? Math.min(Number(m[2]), file.length - 1) : file.length - 1;
    return {
      stream: chunked(file.slice(start, end + 1), 500),
      contentType,
      contentLength: String(end - start + 1),
      contentRange: `bytes ${start}-${end}/${file.length}`,
      status: 206,
    };
  });
}

const play = (range?: string) =>
  GET(
    new NextRequest('http://localhost/api/video/tok-asset', {
      headers: range ? { range } : {},
    }),
    { params: Promise.resolve({ id: 'tok-asset' }) },
  );

const body = async (res: Response) => new Uint8Array(await res.arrayBuffer());

beforeEach(() => {
  vi.clearAllMocks();
  clearPlaybackPlans();
});

describe('GET /api/video/[id]', () => {
  it('plays the whole file without its location', async () => {
    serve(VIDEO);
    const res = await play();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Length')).toBe(String(VIDEO.length));
    const out = await body(res);
    expect(out).toEqual(await scrubLocation(VIDEO));
    expect(contains(out, ascii(ISO6709))).toBe(false);
  });

  it('patches a range that covers moov, and leaves its headers alone', async () => {
    serve(VIDEO);
    const start = VIDEO.length - 400;
    const res = await play(`bytes=${start}-`);
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe(
      `bytes ${start}-${VIDEO.length - 1}/${VIDEO.length}`,
    );
    const whole = (await scrubLocation(VIDEO))!;
    expect(await body(res)).toEqual(whole.slice(start));
  });

  it('serves a range of samples unchanged', async () => {
    serve(VIDEO);
    const res = await play('bytes=100-1099');
    expect(await body(res)).toEqual(VIDEO.slice(100, 1100));
  });

  it('passes a video that is not MP4 through', async () => {
    const webm = cat(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), ascii('matroska bytes'));
    serve(webm, 'video/webm');
    const res = await play();
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual(webm);
  });

  it('refuses an MP4 whose metadata cannot be located', async () => {
    serve(cat(ftyp('mp42'), mdat(FRAMES))); // no moov
    const res = await play();
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('answers 503, not 404, when Immich drops out while planning', async () => {
    serve(VIDEO);
    const first = mockStreamVideo.getMockImplementation()!;
    mockStreamVideo
      .mockImplementationOnce(first) // the served response
      .mockImplementationOnce(async () => {
        throw new ImmichUnavailableError('down');
      });
    const res = await play();
    expect(res.status).toBe(503);
  });
});
