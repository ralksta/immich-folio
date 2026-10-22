import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scrubLocation } from '../locationScrub';
import {
  clearPlaybackPlans,
  parseContentRange,
  patchStream,
  planPlayback,
  playbackPlan,
  type RangeFetcher,
} from '../videoPlayback';
import { ascii, be32, cat, chunked, contains } from './fixtures/location';
import {
  FRAMES,
  ISO6709,
  appleMeta,
  box,
  ftyp,
  loci,
  make,
  mdat,
  moovWith,
  xyz,
} from './fixtures/mp4';

/**
 * Playback serves ranges, so the edits are planned once per video and applied
 * to whatever range is asked for. Whatever range that is, the bytes must be
 * exactly what the download scrubber makes of the same part of the file.
 */

/** A ranged reader over `file`, logging every request. */
function fetcherFor(file: Uint8Array) {
  const requests: Array<[number, number]> = [];
  const fetch: RangeFetcher = async (start, end) => {
    requests.push([start, end]);
    return { bytes: file.slice(start, end + 1), total: file.length };
  };
  return { fetch, requests };
}

async function served(file: Uint8Array, start: number, end: number, chunk: number) {
  const result = await planPlayback(fetcherFor(file).fetch);
  if (!result.ok) throw new Error(result.reason);
  const stream = patchStream(chunked(file.slice(start, end), chunk), start, result.plan.patches);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const BIG_FRAMES = cat(...new Array(400).fill(FRAMES)); // a few KB of "video"
/** moov after mdat, as phones write it. */
const PHONE = cat(ftyp('qt  '), mdat(BIG_FRAMES), moovWith(xyz, loci, make), box('free'));
/** moov first (fast start), with Apple's location keys. */
const FAST_START = cat(ftyp('mp42'), box('moov', appleMeta()), mdat(BIG_FRAMES));

beforeEach(() => clearPlaybackPlans());

describe('planPlayback', () => {
  it('reads the box headers and moov, never the samples', async () => {
    const { fetch, requests } = fetcherFor(PHONE);
    const result = await planPlayback(fetch);
    expect(result.ok).toBe(true);

    const mdatStart = 32; // after the 32-byte ftyp
    const samplesFrom = mdatStart + 8;
    const samplesTo = samplesFrom + BIG_FRAMES.length;
    for (const [start, end] of requests) {
      // The first read (64 bytes, for ftyp's brands) and the 16-byte header
      // reads may touch the samples' first bytes; nothing reads further.
      const overlap = Math.min(end + 1, samplesTo) - Math.max(start, samplesFrom);
      expect(overlap, `${start}-${end}`).toBeLessThanOrEqual(64);
    }
    expect(requests.length).toBeLessThanOrEqual(6);
  });

  it('gives an empty plan for a file that is not MP4', async () => {
    const webm = cat(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), ascii('webm and more bytes...'));
    const result = await planPlayback(fetcherFor(webm).fetch);
    expect(result).toEqual({ ok: true, plan: { total: webm.length, patches: [] } });
  });

  it('refuses an MP4 it cannot walk', async () => {
    const truncated = PHONE.slice(0, PHONE.length - 40); // moov cut short
    expect((await planPlayback(fetcherFor(truncated).fetch)).ok).toBe(false);
    const noMoov = cat(ftyp('mp42'), mdat(FRAMES));
    expect(await planPlayback(fetcherFor(noMoov).fetch)).toEqual({
      ok: false,
      reason: 'no moov box',
    });
  });

  it('reads a 64-bit box size', async () => {
    const big = cat(be32(1), ascii('mdat'), be32(0), be32(16 + FRAMES.length), FRAMES);
    const file = cat(ftyp('qt  '), big, moovWith(xyz));
    const out = await served(file, 0, file.length, 13);
    expect(contains(out, ascii(ISO6709))).toBe(false);
  });
});

describe('patchStream', () => {
  it.each([
    ['moov at the end', PHONE],
    ['fast start', FAST_START],
  ])('matches the download scrubber for any range (%s)', async (_name, file) => {
    const whole = await scrubLocation(file);
    if (!whole) throw new Error('download scrubber refused');
    expect(contains(whole, ascii(ISO6709))).toBe(false);

    // Ranges a player asks for: from the start, a seek into the middle, the
    // tail where moov lives, single bytes across a patch.
    let seed = 7;
    const random = (n: number) => (seed = (seed * 48271) % 2147483647) % n;
    const ranges: Array<[number, number]> = [
      [0, file.length],
      [0, 100],
      [file.length - 600, file.length],
    ];
    for (let i = 0; i < 40; i++) {
      const start = random(file.length);
      ranges.push([start, start + 1 + random(file.length - start)]);
    }
    for (const [start, end] of ranges) {
      for (const chunk of [1, 17, 4096]) {
        expect(await served(file, start, end, chunk)).toEqual(whole.slice(start, end));
      }
    }
  });

  it('leaves the source chunks untouched', async () => {
    const result = await planPlayback(fetcherFor(PHONE).fetch);
    if (!result.ok) throw new Error(result.reason);
    const chunk = PHONE.slice();
    const source = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(chunk);
        c.close();
      },
    });
    await new Response(patchStream(source, 0, result.plan.patches)).arrayBuffer();
    expect(chunk).toEqual(PHONE);
  });
});

describe('playbackPlan cache', () => {
  it('plans a video once and reuses it', async () => {
    const fetch = vi.fn(fetcherFor(PHONE).fetch);
    await playbackPlan('a', PHONE.length, fetch);
    const calls = fetch.mock.calls.length;
    await playbackPlan('a', PHONE.length, fetch);
    expect(fetch.mock.calls.length).toBe(calls);
  });

  it('shares one planning run between concurrent requests', async () => {
    const fetch = vi.fn(fetcherFor(PHONE).fetch);
    const [a, b] = await Promise.all([
      playbackPlan('a', PHONE.length, fetch),
      playbackPlan('a', PHONE.length, fetch),
    ]);
    expect(a).toEqual(b);
    const single = vi.fn(fetcherFor(PHONE).fetch);
    clearPlaybackPlans();
    await playbackPlan('a', PHONE.length, single);
    expect(fetch.mock.calls.length).toBe(single.mock.calls.length);
  });

  it('plans again when the file has a different length', async () => {
    await playbackPlan('a', PHONE.length, fetcherFor(PHONE).fetch);
    const other = fetcherFor(FAST_START);
    const result = await playbackPlan('a', FAST_START.length, other.fetch);
    expect(result.ok && result.plan.total).toBe(FAST_START.length);
    expect(other.requests.length).toBeGreaterThan(0);
  });

  it('refuses a plan made for another length', async () => {
    // Immich swapped the file (a transcode finished) between the served
    // response and the planning reads.
    const result = await playbackPlan('a', PHONE.length + 1, fetcherFor(PHONE).fetch);
    expect(result.ok).toBe(false);
  });

  it('does not cache a failure', async () => {
    const broken = cat(ftyp('mp42'), mdat(FRAMES));
    expect((await playbackPlan('a', broken.length, fetcherFor(broken).fetch)).ok).toBe(false);
    const fixed = cat(ftyp('mp42'), mdat(FRAMES), moovWith(xyz));
    expect((await playbackPlan('a', fixed.length, fetcherFor(fixed).fetch)).ok).toBe(true);
  });
});

describe('parseContentRange', () => {
  it('reads the first byte and the total', () => {
    expect(parseContentRange('bytes 100-199/1000')).toEqual({ start: 100, total: 1000 });
    expect(parseContentRange('bytes */1000')).toBeNull();
    expect(parseContentRange(null)).toBeNull();
  });
});
