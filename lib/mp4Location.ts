/**
 * Location out of MP4 and QuickTime files, for downloads (#829).
 *
 * Videos and the clips appended to motion photos (Samsung, Google Pixel) keep
 * where they were recorded in a handful of small metadata boxes inside `moov`:
 *
 *   - `©xyz` — the ISO 6709 string ("+52.5200+013.4050/") phones write into
 *     `udta`, and the iTunes-style `ilst` item of the same name.
 *   - `loci` — the 3GPP location box: name, coordinates, altitude.
 *   - Apple's QuickTime metadata: a `meta` box whose `keys` name each `ilst`
 *     item, among them `com.apple.quicktime.location.ISO6709`, `.name`,
 *     `.body`, `.note`, `.role`, `.accuracy.horizontal`.
 *   - XMP, in `udta/XMP_` or a top-level `uuid` box — scrubbed like the XMP of
 *     a photo (lib/locationScrub.ts), or zeroed when that cannot be done.
 *   - C2PA manifests in their `uuid` box, which can carry the same as EXIF.
 *
 * Like the photo scrubber this never moves a byte: values are overwritten in
 * place, so the file keeps its length and every chunk offset in `stco`/`co64`
 * still points at its sample. A `©xyz` or `loci` box is also renamed to
 * `free`, which every reader skips: zeroed but still named, `loci` reads as
 * the coordinates 0/0, a place of its own.
 *
 * It streams. Box headers are read as they pass and the walk descends into the
 * containers that can hold metadata (`moov`, `trak`, `mdia`, `minf`, `udta`,
 * `meta`, `ilst`); only the few leaf boxes that have to be parsed (`keys`,
 * XMP) are held until complete. `mdat` passes through without being held, so
 * it does not matter whether `moov` comes before or after it.
 *
 * Not covered: GPS recorded as a timed metadata track (GoPro GPMF, Google
 * CAMM, some dashcams). Those samples live in `mdat`, and finding them means
 * reading the sample tables, which may only arrive after `mdat` has passed.
 */

import { scrubXmpLocation } from './locationScrub';

/** Largest leaf box held in memory to be parsed; larger ones are zeroed. */
const MAX_HELD_BOX = 16 * 1024 * 1024;

const XMP_UUID = 'be7acfcb97a942e89c71999491e3afac';
const C2PA_UUID = 'd8fec3d61b0e483c92975828877ec481';

/** Boxes walked into because metadata can sit inside them. */
const STRUCTURE = new Set(['moov', 'trak', 'mdia', 'minf']);
/** Metadata containers: anything unreadable inside them is zeroed. */
const METADATA = new Set(['udta']);

const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const fourcc = (b: Uint8Array, i: number) =>
  String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
const COPYRIGHT_XYZ = '©xyz';
const FREE = new Uint8Array([0x66, 0x72, 0x65, 0x65]); // "free"

/** A key or item name that pins down where a video was made. */
export function isLocationKey(name: string): boolean {
  return /location|gps|iso6709/i.test(name) || name === COPYRIGHT_XYZ;
}

/**
 * A plausible box type: four printable characters, or `©` followed by three.
 * Used at the top level, where the walk has to notice that it has left the
 * MP4 data (a motion photo's trailer can continue with a vendor directory).
 */
function plausibleType(b: Uint8Array, at: number): boolean {
  for (let k = 0; k < 4; k++) {
    const c = b[at + k];
    if (!(c >= 0x20 && c <= 0x7e) && !(k === 0 && c === 0xa9)) return false;
  }
  return true;
}

type FrameKind = 'top' | 'structure' | 'metadata' | 'meta' | 'ilst' | 'item';

interface Frame {
  kind: FrameKind;
  /** Absolute end offset; Infinity for the top level. */
  end: number;
  /** For `meta`: the names from its `keys` box, index 1-based like the items. */
  keys?: string[];
  /** For an `ilst` item: whether its value is a location. */
  location?: boolean;
}

type Range = { start: number; end: number };

/** Where in a buffer an absolute range lands, clamped to it. */
function clip(range: Range, base: number, length: number): Range | null {
  const start = Math.max(range.start, base) - base;
  const end = Math.min(range.end, base + length) - base;
  return end > start ? { start, end } : null;
}

/** The key names of a QuickTime `keys` box, or null when it does not parse. */
function readKeys(b: Uint8Array, content: number, end: number): string[] | null {
  if (content + 8 > end) return null;
  const count = u32be(b, content + 4); // after version/flags
  const keys: string[] = [];
  let p = content + 8;
  for (let i = 0; i < count; i++) {
    if (p + 8 > end) return null;
    const size = u32be(b, p);
    if (size < 8 || p + size > end) return null;
    keys.push(Buffer.from(b.buffer, b.byteOffset + p + 8, size - 8).toString('latin1'));
    p += size;
  }
  return keys;
}

/**
 * The streaming walker, driven like the photo scrubbers: given the bytes not
 * yet sent (`buf`, starting at absolute offset `base`), it edits what it can
 * and returns the absolute offset up to which the bytes are final.
 */
export class Mp4LocationScrubber {
  /** Absolute offset of the next box header. */
  private pos: number;
  private stack: Frame[] = [{ kind: 'top', end: Infinity }];
  /** Ranges still to be zeroed as they stream past. */
  private zeros: Range[] = [];

  /** `start`: where the MP4 data begins (0 for a video file, later in a motion photo). */
  constructor(start: number) {
    this.pos = start;
  }

  private zeroLater(start: number, end: number): void {
    if (end > start) this.zeros.push({ start, end });
  }

  private applyZeros(buf: Uint8Array, base: number): void {
    const bufEnd = base + buf.length;
    this.zeros = this.zeros.filter((range) => {
      const hit = clip(range, base, buf.length);
      if (hit) buf.fill(0, hit.start, hit.end);
      return range.end > bufEnd;
    });
  }

  advance(buf: Uint8Array, base: number, eof: boolean): number {
    const end = base + buf.length;
    let safe = this.walk(buf, base, eof);
    // Zeros are applied after the walk, which may have added some that start
    // inside this very buffer.
    this.applyZeros(buf, base);
    if (eof) safe = end;
    return Math.max(base, Math.min(safe, end));
  }

  /** Walk box headers inside `buf`; returns how far the bytes are final. */
  private walk(buf: Uint8Array, base: number, eof: boolean): number {
    const end = base + buf.length;
    for (let guard = 0; guard < 1_000_000; guard++) {
      // Leave the containers this position has walked out of.
      while (this.stack.length > 1 && this.pos >= this.stack[this.stack.length - 1].end) {
        this.stack.pop();
      }
      if (!Number.isFinite(this.pos) || this.pos >= end) return end;
      const frame = this.stack[this.stack.length - 1];
      const rel = this.pos - base;
      const avail = buf.length - rel;

      if (avail < 8) return eof ? end : this.pos;
      let size = u32be(buf, rel);
      let header = 8;
      if (size === 1) {
        if (avail < 16) return eof ? end : this.pos;
        const high = u32be(buf, rel + 8);
        size = high * 2 ** 32 + u32be(buf, rel + 12);
        header = 16;
      }
      const boxStart = this.pos;
      const boxEnd = size === 0 ? frame.end : boxStart + size;
      const type = fourcc(buf, rel + 4);

      const malformed =
        (size !== 0 && size < header) ||
        boxEnd > frame.end ||
        (frame.kind === 'top' && !plausibleType(buf, rel + 4));
      if (malformed) {
        if (frame.kind === 'top') {
          // Not (or no longer) MP4 data: the rest goes out as it is.
          this.pos = Infinity;
          return end;
        }
        // Inside metadata, whatever cannot be read is not kept. Inside the
        // structural boxes the samples' layout is at stake, so the rest of
        // that container is left alone rather than damaged.
        if (frame.kind !== 'structure') this.zeroLater(boxStart, frame.end);
        this.pos = frame.end;
        continue;
      }

      const content = boxStart + header;
      const step = this.box(buf, base, eof, frame, type, boxStart, content, boxEnd);
      if (step === 'hold') return boxStart;
      if (step === 'descend') continue;
      this.pos = boxEnd;
    }
    return end;
  }

  /**
   * Handle one box. Returns 'descend' after pushing a container frame (the walk
   * continues at its first child), 'hold' when the box has to be complete in
   * the buffer first, and 'next' to move past it.
   */
  private box(
    buf: Uint8Array,
    base: number,
    eof: boolean,
    frame: Frame,
    type: string,
    boxStart: number,
    content: number,
    boxEnd: number,
  ): 'descend' | 'hold' | 'next' {
    const bufEnd = base + buf.length;
    const complete = boxEnd <= bufEnd || eof;
    /** Hold a small box until it is all here; a large one is zeroed instead. */
    const needWhole = (): 'hold' | null => {
      if (boxEnd - content > MAX_HELD_BOX) {
        this.zeroLater(content, boxEnd);
        return null;
      }
      return complete ? null : 'hold';
    };

    // Items of an ilst: each one is a container of `data` (and for `----`
    // items `mean` and `name`) boxes.
    if (frame.kind === 'ilst') {
      let name = type;
      const index = u32be(buf, boxStart - base + 4);
      if (frame.keys && index >= 1 && index <= frame.keys.length) name = frame.keys[index - 1];
      // An item addressed by key index whose `keys` are unknown (none came
      // before this ilst) could be anything, a location among it.
      const unnamed = !frame.keys && index >= 1 && index < 0x10000;
      this.stack.push({ kind: 'item', end: boxEnd, location: unnamed || isLocationKey(name) });
      this.pos = content;
      return 'descend';
    }
    if (frame.kind === 'item') {
      if (type === 'name') {
        if (needWhole() === 'hold') return 'hold';
        const s = content - base + 4; // after version/flags
        const e = Math.min(boxEnd, bufEnd) - base;
        if (e > s && isLocationKey(Buffer.from(buf.subarray(s, e)).toString('latin1'))) {
          frame.location = true;
        }
      } else if (type === 'data' && frame.location) {
        this.zeroLater(content + 8, boxEnd); // keep type and locale, drop the value
      }
      return 'next';
    }

    if (STRUCTURE.has(type) && (frame.kind === 'top' || frame.kind === 'structure')) {
      this.stack.push({ kind: 'structure', end: boxEnd });
      this.pos = content;
      return 'descend';
    }
    if (METADATA.has(type)) {
      this.stack.push({ kind: 'metadata', end: boxEnd });
      this.pos = content;
      return 'descend';
    }
    if (type === 'meta') {
      // ISO `meta` is a FullBox (version and flags first); Apple's QuickTime
      // `meta` is not. Its first child, `hdlr`, says which one this is.
      if (content + 12 > bufEnd && !eof) return 'hold';
      const at = content - base;
      const children =
        fourcc(buf, at + 4) === 'hdlr'
          ? content
          : fourcc(buf, at + 8) === 'hdlr'
            ? content + 4
            : -1;
      if (children < 0) {
        this.zeroLater(content, boxEnd); // a meta box we cannot read
        return 'next';
      }
      this.stack.push({ kind: 'meta', end: boxEnd });
      this.pos = children;
      return 'descend';
    }
    if (type === 'ilst' && frame.kind === 'meta') {
      this.stack.push({ kind: 'ilst', end: boxEnd, keys: frame.keys });
      this.pos = content;
      return 'descend';
    }
    if (type === 'keys' && frame.kind === 'meta') {
      if (needWhole() === 'hold') return 'hold';
      const keys = readKeys(buf, content - base, Math.min(boxEnd, bufEnd) - base);
      if (keys) frame.keys = keys;
      else this.zeroLater(content, frame.end); // keys unknown: no item can be trusted
      return 'next';
    }

    if (type === COPYRIGHT_XYZ || type === 'loci') {
      buf.set(FREE, boxStart - base + 4); // the header is in this buffer
      this.zeroLater(content, boxEnd);
      return 'next';
    }
    if (type === 'XMP_') {
      if (needWhole() === 'hold') return 'hold';
      this.scrubXmp(buf, base, content, boxEnd);
      return 'next';
    }
    if (type === 'uuid') {
      if (content + 16 > bufEnd && !eof) return 'hold';
      const at = content - base;
      const id = Buffer.from(buf.subarray(at, at + 16)).toString('hex');
      if (id === C2PA_UUID) this.zeroLater(content + 16, boxEnd);
      else if (id === XMP_UUID) {
        if (needWhole() === 'hold') return 'hold';
        this.scrubXmp(buf, base, content + 16, boxEnd);
      }
      return 'next';
    }
    return 'next';
  }

  /** XMP in `[start, end)`, which is in the buffer unless it was too large. */
  private scrubXmp(buf: Uint8Array, base: number, start: number, end: number): void {
    if (end - start > MAX_HELD_BOX) return; // zeroed by needWhole
    const s = start - base;
    const e = Math.min(end - base, buf.length);
    if (e <= s) return;
    if (!scrubXmpLocation(buf, s, e)) buf.fill(0, s, e);
  }
}

/**
 * Brands of the ISOBMFF files this module edits: MP4, QuickTime, 3GPP and
 * their kin. HEIF-family stills go to the photo scrubber, and anything else
 * (JPEG XL, Canon CR3, …) passes through as before.
 */
export function isVideoBrand(brand: string): boolean {
  return /^(isom|iso\d|mp4[12v ]|avc\d|qt {2}|M4V[ P]?|M4A |3g[p2][\d a-z]|3ge\d|MSNV|XAVC|dash|f4v |mmp4|nvr1|CAEP|caqv)$/.test(
    brand,
  );
}

/** Top-level boxes QuickTime files started with before `ftyp` existed. */
export const LEGACY_QUICKTIME_BOXES = ['moov', 'mdat', 'wide', 'free', 'skip'];

/**
 * Whether the first bytes of a file are an MP4/QuickTime video: an `ftyp`
 * with a video brand among those present, or a legacy QuickTime top box.
 */
export function isMp4Head(b: Uint8Array): boolean {
  if (b.length < 8) return false;
  const type = fourcc(b, 4);
  if (LEGACY_QUICKTIME_BOXES.includes(type)) return true;
  if (type !== 'ftyp' || b.length < 12) return false;
  const end = Math.min(b.length, u32be(b, 0));
  for (let p = 8; p + 4 <= end; p += p === 8 ? 8 : 4) {
    if (isVideoBrand(fourcc(b, p))) return true;
  }
  return false;
}

/**
 * Where an appended MP4 begins in a motion photo's trailer: the offset of an
 * `ftyp` box with a video brand at or after `from` in `b`, or -1.
 */
export function findMp4Start(b: Uint8Array, from: number): number {
  for (let i = b.indexOf(0x66, Math.max(from + 4, 4)); i >= 0; i = b.indexOf(0x66, i + 1)) {
    if (i + 8 > b.length) return -1;
    if (b[i + 1] !== 0x74 || b[i + 2] !== 0x79 || b[i + 3] !== 0x70) continue; // "ftyp"
    const size = u32be(b, i - 4);
    if (size < 16 || size > 4096 || size % 4 !== 0) continue;
    if (isVideoBrand(fourcc(b, i + 4))) return i - 4;
  }
  return -1;
}
