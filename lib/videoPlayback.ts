/**
 * Location out of video playback.
 *
 * `/api/video` passes Immich's playback stream through, and when Immich did
 * not transcode a video that stream is the original file, location boxes and
 * all. The download scrubber (lib/mp4Location.ts) cleans a file in one pass
 * from its first byte; a player does not read that way. It asks for ranges,
 * seeks, and may never request byte 0 again.
 *
 * So the edits are worked out once per video and then applied to whatever
 * range is served:
 *
 *   1. `planPlayback()` reads the top-level box headers with small ranged
 *      requests, fetches the boxes that can hold metadata (`moov`, and a
 *      top-level `udta`, `meta` or `uuid`), runs the download scrubber over a
 *      copy of each and records which bytes it changed — a handful of short
 *      patches. `mdat` is skipped by its header and never read.
 *   2. `patchStream()` overwrites those bytes in a served range as it passes.
 *
 * Nothing changes length, so `Content-Length` and `Content-Range` stay as
 * Immich sent them. A file that is not MP4/QuickTime (WebM, AVI) gets an empty
 * plan and passes through, as it does for downloads. A file that is MP4 but
 * cannot be walked has no plan at all, and the route refuses to play it.
 */

import { HEAD_CAP } from './locationScrub';
import { Mp4LocationScrubber, isMp4Head } from './mp4Location';

/** Replacement bytes at an absolute file offset. */
export interface Patch {
  start: number;
  bytes: Uint8Array;
}

export interface PlaybackPlan {
  /** File length the plan was made for; a different length means a different file. */
  total: number;
  patches: Patch[];
}

export type PlanResult = { ok: true; plan: PlaybackPlan } | { ok: false; reason: string };

/**
 * Fetch `[start, end]` (inclusive, like an HTTP Range) of the video, with the
 * file's total length, or null when the video is gone.
 */
export type RangeFetcher = (
  start: number,
  end: number,
) => Promise<{ bytes: Uint8Array; total: number } | null>;

/** Top-level boxes that can carry location metadata. */
const METADATA_BOXES = new Set(['moov', 'udta', 'meta', 'uuid']);
/** A real file has a few top-level boxes; this bounds a hostile one. */
const MAX_TOP_LEVEL_BOXES = 256;

const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const fourcc = (b: Uint8Array, i: number) =>
  String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);

/** The runs of bytes in `after` that differ from `before`, as patches at `offset`. */
function diff(before: Uint8Array, after: Uint8Array, offset: number): Patch[] {
  const patches: Patch[] = [];
  for (let i = 0; i < before.length; i++) {
    if (before[i] === after[i]) continue;
    let j = i + 1;
    while (j < before.length && before[j] !== after[j]) j++;
    patches.push({ start: offset + i, bytes: after.slice(i, j) });
    i = j;
  }
  return patches;
}

/** Work out the edits for a video. Read errors propagate. */
export async function planPlayback(fetchRange: RangeFetcher): Promise<PlanResult> {
  // Enough for `ftyp` with its compatible brands, and the first box header.
  const head = await fetchRange(0, 63);
  if (!head) return { ok: false, reason: 'video not found' };
  const { total } = head;
  if (!isMp4Head(head.bytes)) return { ok: true, plan: { total, patches: [] } };

  const patches: Patch[] = [];
  let sawMoov = false;
  let pos = 0;
  for (let n = 0; pos < total; n++) {
    if (n >= MAX_TOP_LEVEL_BOXES) return { ok: false, reason: 'too many top-level boxes' };
    const header = pos === 0 ? head : await fetchRange(pos, Math.min(pos + 15, total - 1));
    if (!header || header.total !== total) return { ok: false, reason: 'video changed while read' };
    const h = header.bytes;
    if (h.length < 8) return { ok: false, reason: 'truncated box header' };

    let size = u32be(h, 0);
    let headerSize = 8;
    if (size === 1) {
      if (h.length < 16) return { ok: false, reason: 'truncated box header' };
      size = u32be(h, 8) * 2 ** 32 + u32be(h, 12);
      headerSize = 16;
    } else if (size === 0) {
      size = total - pos;
    }
    if (size < headerSize || pos + size > total) return { ok: false, reason: 'malformed box' };
    const type = fourcc(h, 4);

    if (METADATA_BOXES.has(type)) {
      if (size > HEAD_CAP) return { ok: false, reason: `${type} box beyond the cap` };
      const box = await fetchRange(pos, pos + size - 1);
      if (!box || box.total !== total || box.bytes.length !== size) {
        return { ok: false, reason: `${type} box could not be read` };
      }
      const scrubbed = box.bytes.slice();
      new Mp4LocationScrubber(pos).advance(scrubbed, pos, true);
      patches.push(...diff(box.bytes, scrubbed, pos));
      if (type === 'moov') sawMoov = true;
    }
    pos += size;
  }
  // Without moov there is no video to play, and nothing says the location
  // is not somewhere this walk did not look.
  if (!sawMoov) return { ok: false, reason: 'no moov box' };
  return { ok: true, plan: { total, patches } };
}

/**
 * Apply `patches` to a stream that starts at absolute offset `offset` of the
 * file (the start of the served range).
 */
export function patchStream(
  source: ReadableStream<Uint8Array>,
  offset: number,
  patches: Patch[],
): ReadableStream<Uint8Array> {
  if (!patches.length) return source;
  let pos = offset;
  return source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const start = pos;
        const end = pos + chunk.length;
        pos = end;
        let out = chunk;
        for (const patch of patches) {
          const patchEnd = patch.start + patch.bytes.length;
          if (patchEnd <= start || patch.start >= end) continue;
          if (out === chunk) out = chunk.slice(); // the source's buffer stays untouched
          const from = Math.max(patch.start, start);
          const to = Math.min(patchEnd, end);
          out.set(patch.bytes.subarray(from - patch.start, to - patch.start), from - start);
        }
        controller.enqueue(out);
      },
    }),
  );
}

/** First byte and total length from a `Content-Range: bytes S-E/T` header. */
export function parseContentRange(header: string | null): { start: number; total: number } | null {
  const m = header ? /^bytes (\d+)-\d+\/(\d+)$/.exec(header.trim()) : null;
  return m ? { start: Number(m[1]), total: Number(m[2]) } : null;
}

// ── Cache ────────────────────────────────────────────────────────────────────

/** Plans are a few patches each; this many cover any realistic site. */
const MAX_PLANS = 500;
const plans = new Map<string, PlaybackPlan>();
const pending = new Map<string, Promise<PlanResult>>();

/**
 * The plan for `assetId` at file length `total`, made with `fetchRange` when
 * none is cached for that length. Concurrent requests for one video share a
 * single planning run. Failures are not cached: the next request tries again.
 */
export async function playbackPlan(
  assetId: string,
  total: number,
  fetchRange: RangeFetcher,
): Promise<PlanResult> {
  const cached = plans.get(assetId);
  if (cached && cached.total === total) {
    plans.delete(assetId); // re-insert: most recently used last
    plans.set(assetId, cached);
    return { ok: true, plan: cached };
  }

  let run = pending.get(assetId);
  if (!run) {
    run = planPlayback(fetchRange).finally(() => pending.delete(assetId));
    pending.set(assetId, run);
  }
  const result = await run;
  if (!result.ok) return result;
  // A plan for another length belongs to another file (Immich finished a
  // transcode in between, say): it must not be applied to this one.
  if (result.plan.total !== total) return { ok: false, reason: 'video changed while read' };

  plans.set(assetId, result.plan);
  while (plans.size > MAX_PLANS) plans.delete(plans.keys().next().value as string);
  return result;
}

/** For tests. */
export function clearPlaybackPlans(): void {
  plans.clear();
  pending.clear();
}
