import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Resource bounds of the ZIP-of-originals stream: how many archives one client
 * may hold open at once, that every way an archive can end gives its slot
 * back, and that a client which stops reading loses the archive (and its
 * upstream Immich body) instead of pinning both for as long as it likes.
 */

vi.mock('@/lib/immich', () => ({ immich: { streamAsset: vi.fn() } }));
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn((req: NextRequest) => req.headers.get('x-test-ip') ?? 'unknown'),
}));

import {
  ARCHIVE_STALL_TIMEOUT_MS,
  MAX_CONCURRENT_ARCHIVES,
  __archivesInFlight,
  entryDate,
  withArchiveSlot,
} from '@/lib/zipArchive';
import { immich, type ImmichAsset } from '@/lib/immich';

const mockStream = immich.streamAsset as unknown as ReturnType<typeof vi.fn>;

const ASSETS = [
  { id: 'a1', type: 'IMAGE', originalFileName: 'a1.jpg' },
  { id: 'a2', type: 'IMAGE', originalFileName: 'a2.jpg' },
] as unknown as ImmichAsset[];

let ipSeq = 0;
/** A fresh client per test, so slots can never leak from one test into another. */
function freshIp(): string {
  ipSeq++;
  return `203.0.113.${ipSeq}`;
}

const req = (ip: string) =>
  new NextRequest('http://localhost/api/download/tok/archive', { headers: { 'x-test-ip': ip } });

/** Start an archive of `assets` for `ip` through the slot wrapper. */
function start(ip: string, assets: ImmichAsset[] = ASSETS) {
  return withArchiveSlot(req(ip), async (stream) => stream('Album', assets));
}

/**
 * An Immich originals body that produces `chunks` × 64 KB on demand and records
 * whether it was cancelled — i.e. whether the upstream socket was let go.
 */
function upstream(chunks: number) {
  const state = { pulled: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (state.pulled >= chunks) {
        controller.close();
        return;
      }
      state.pulled++;
      controller.enqueue(new Uint8Array(64 * 1024).fill(state.pulled));
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { state, result: { stream, contentType: 'image/jpeg', contentLength: null } };
}

beforeEach(() => {
  mockStream.mockReset();
  mockStream.mockImplementation(async () => upstream(2).result);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('archive concurrency cap', () => {
  it(`refuses the ${MAX_CONCURRENT_ARCHIVES + 1}th open archive of one client with a 429`, async () => {
    const ip = freshIp();
    const open = [];
    for (let i = 0; i < MAX_CONCURRENT_ARCHIVES; i++) {
      const res = await start(ip);
      expect(res.status).toBe(200);
      open.push(res);
    }
    expect(__archivesInFlight(ip)).toBe(MAX_CONCURRENT_ARCHIVES);

    const handler = vi.fn();
    const refused = await withArchiveSlot(req(ip), handler);
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
    // Refused before the handler, so before any Immich request.
    expect(handler).not.toHaveBeenCalled();

    // Another client is unaffected.
    const other = freshIp();
    const res = await start(other);
    expect(res.status).toBe(200);

    await Promise.all([...open, res].map((r) => r.body!.cancel()));
  });

  it('gives the slot back when the archive is read to the end', async () => {
    const ip = freshIp();
    const res = await start(ip);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes[0]).toBe(0x50); // 'P'
    await vi.waitFor(() => expect(__archivesInFlight(ip)).toBe(0));
  });

  it('gives the slot back when the archive fails', async () => {
    const ip = freshIp();
    mockStream.mockRejectedValue(new Error('Immich went away'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await start(ip);
    await expect(res.arrayBuffer()).rejects.toThrow();
    await vi.waitFor(() => expect(__archivesInFlight(ip)).toBe(0));
  });

  it('gives the slot back, and lets go of Immich, when the download is cancelled', async () => {
    const ip = freshIp();
    const origin = upstream(1000);
    mockStream.mockResolvedValue(origin.result);
    const res = await start(ip);
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    await vi.waitFor(() => expect(__archivesInFlight(ip)).toBe(0));
    await vi.waitFor(() => expect(origin.state.cancelled).toBe(true));
  });

  it('gives the slot back when the route refuses or throws instead of streaming', async () => {
    const ip = freshIp();
    const refused = await withArchiveSlot(req(ip), async () => new Response(null, { status: 404 }));
    expect(refused.status).toBe(404);
    expect(__archivesInFlight(ip)).toBe(0);

    await expect(
      withArchiveSlot(req(ip), async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(__archivesInFlight(ip)).toBe(0);
  });

  it('never releases a slot twice', async () => {
    const ip = freshIp();
    const first = await start(ip);
    const second = await start(ip);
    await first.arrayBuffer();
    await vi.waitFor(() => expect(__archivesInFlight(ip)).toBe(1));
    // A late cancel on the finished body must not free the other archive's slot.
    await first.body?.cancel().catch(() => {});
    expect(__archivesInFlight(ip)).toBe(1);
    await second.body!.cancel();
    await vi.waitFor(() => expect(__archivesInFlight(ip)).toBe(0));
  });
});

describe('archive stall timeout', () => {
  it('tears down the archive and the upstream body when the client stops reading', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ip = freshIp();
    const origin = upstream(1000);
    mockStream.mockResolvedValue(origin.result);

    const res = await start(ip);
    const reader = res.body!.getReader();
    await reader.read();

    // Still within the window: nothing happens.
    await vi.advanceTimersByTimeAsync(ARCHIVE_STALL_TIMEOUT_MS - 1_000);
    expect(origin.state.cancelled).toBe(false);
    expect(__archivesInFlight(ip)).toBe(1);

    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(origin.state.cancelled).toBe(true));
    expect(__archivesInFlight(ip)).toBe(0);
    // The response is ended with an error rather than left open. The one chunk
    // queued before the stall may still be handed out first.
    await expect(
      (async () => {
        for (;;) if ((await reader.read()).done) return;
      })(),
    ).rejects.toThrow(/stalled/);
  });

  it('does not cut a slow download that keeps reading', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const ip = freshIp();
    const origin = upstream(128);
    mockStream.mockResolvedValue(origin.result);

    const res = await start(ip, [ASSETS[0]]);
    const reader = res.body!.getReader();
    let bytes = 0;
    let elapsed = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      // Well under the stall timeout per read, far over it in total.
      await vi.advanceTimersByTimeAsync(ARCHIVE_STALL_TIMEOUT_MS / 2);
      elapsed += ARCHIVE_STALL_TIMEOUT_MS / 2;
    }

    expect(elapsed).toBeGreaterThan(ARCHIVE_STALL_TIMEOUT_MS * 3);
    expect(bytes).toBeGreaterThan(128 * 64 * 1024);
    expect(origin.state.cancelled).toBe(false);
    await vi.waitFor(() => expect(__archivesInFlight(ip)).toBe(0));
  });
});

/**
 * F-16: every entry carried the time the ZIP was built. Each now carries the
 * capture time, as the wall clock of the camera.
 */
describe('archive entry timestamps', () => {
  /** The DOS date/time of every local file header, as `YYYY-MM-DD HH:MM:SS`. */
  function entryTimes(bytes: Uint8Array): string[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const out: string[] = [];
    for (let i = 0; i + 30 <= bytes.length; i++) {
      if (view.getUint32(i, true) !== 0x04034b50) continue;
      const time = view.getUint16(i + 10, true);
      const date = view.getUint16(i + 12, true);
      const pad = (n: number) => String(n).padStart(2, '0');
      out.push(
        `${(date >> 9) + 1980}-${pad((date >> 5) & 15)}-${pad(date & 31)} ` +
          `${pad(time >> 11)}:${pad((time >> 5) & 63)}:${pad((time & 31) * 2)}`,
      );
    }
    return out;
  }

  it('dates each entry by when the photo was taken, on the camera clock', async () => {
    const assets = [
      {
        id: 'a1',
        originalFileName: 'a1.jpg',
        // 14:30 in Berlin; the instant is 12:30 UTC.
        localDateTime: '2024-05-01T14:30:10.000Z',
        exifInfo: { dateTimeOriginal: '2024-05-01T12:30:10.000Z' },
        fileCreatedAt: '2024-05-01T12:30:10.000Z',
      },
      {
        id: 'a2',
        originalFileName: 'a2.jpg',
        exifInfo: { dateTimeOriginal: '2019-12-24T18:00:00.000Z' },
        fileCreatedAt: '2020-01-01T00:00:00.000Z',
      },
      { id: 'a3', originalFileName: 'a3.jpg', fileCreatedAt: '2021-07-04T09:15:00.000Z' },
    ] as unknown as ImmichAsset[];

    const res = await start(freshIp(), assets);
    const times = entryTimes(new Uint8Array(await res.arrayBuffer()));

    expect(times).toEqual(['2024-05-01 14:30:10', '2019-12-24 18:00:00', '2021-07-04 09:15:00']);
  });

  it('falls back to the default for an asset with no usable date', () => {
    expect(entryDate({ fileCreatedAt: 'not a date' } as unknown as ImmichAsset)).toBeUndefined();
  });
});
