/**
 * Removes location from original downloads and leaves the rest of the file
 * alone.
 *
 * Downloads are the deliverable, so camera, lens, exposure, copyright/IPTC and
 * the ICC profile have to arrive with the file. GPS coordinates must not: the
 * rest of the site shows city and country at most. This module removes just
 * the location parts of the metadata and leaves the pixels untouched.
 *
 * Like lib/metadataStrip.ts it never moves a byte. Every change overwrites in
 * place, so the length stays the same (Content-Length stays valid) and every
 * absolute offset in the file still points where it did. That matters most for
 * HEIF/AVIF, whose `iloc` box addresses item data by file offset.
 *
 * What is removed:
 *
 *   - EXIF (JPEG APP1, HEIF/AVIF `Exif` item, Photoshop IRB EXIF): the GPSInfo
 *     pointer is taken out of its IFD and the GPS IFD is zeroed along with
 *     every value it points to. The other tags keep their bytes and offsets.
 *   - XMP (JPEG APP1, HEIF/AVIF `mime` item, TIFF tag 700, Photoshop IRB):
 *     every property whose name starts with `GPS` or contains `Latitude` or
 *     `Longitude`, in any namespace (`exif:GPS*`, `Iptc4xmpExt:GPS*`,
 *     `drone-dji:GpsLatitude`, …), is overwritten with spaces, element and
 *     attribute forms alike. City, state and country stay.
 *   - Extended XMP, C2PA/JUMBF manifests and unknown APP1 segments in the
 *     primary JPEG are zeroed whole. A manifest can carry an EXIF assertion
 *     with coordinates, and changing any byte breaks its hash binding anyway.
 *   - JPEGs embedded further down the file (MPF secondary images, EXIF
 *     thumbnails) get the same EXIF/XMP treatment.
 *
 * If parsing EXIF or XMP runs into anything unexpected, that whole segment or
 * item is zeroed: losing the camera data is better than keeping the location.
 *
 * Only JPEG and the HEIF family (HEIC, HEIF, AVIF) are handled, detected from
 * the bytes rather than a content type. Anything else passes through
 * unchanged; the doctor (`checkDownloadMetadata`) names albums that offer such
 * files for download.
 *
 * Memory: nothing is held longer than needed. A JPEG is held up to its first
 * SOS, a HEIF up to the end of its `meta` box, then the file streams on and
 * only the metadata item ranges are held while they pass. The head is capped
 * at HEAD_CAP; a file whose metadata cannot be found within it is refused, not
 * passed through.
 */

/** Same ceiling as the image route's MAX_STRIP_BYTES. */
export const HEAD_CAP = 64 * 1024 * 1024;

/** Largest EXIF/XMP item we hold in memory to edit; larger ones are zeroed. */
const MAX_ITEM_BYTES = 16 * 1024 * 1024;

/** How far a JPEG embedded later in the file is held to find its metadata. */
const EMBEDDED_HEAD_CAP = 4 * 1024 * 1024;

// ── Byte helpers ─────────────────────────────────────────────────────────────

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const fourcc = (b: Uint8Array, i: number) =>
  String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);

function startsWith(b: Uint8Array, at: number, text: string): boolean {
  if (at < 0 || at + text.length > b.length) return false;
  for (let k = 0; k < text.length; k++) {
    if (b[at + k] !== text.charCodeAt(k)) return false;
  }
  return true;
}

function zero(b: Uint8Array, start: number, end: number): void {
  const from = Math.max(0, Math.min(start, b.length));
  const to = Math.max(0, Math.min(end, b.length));
  if (to > from) b.fill(0, from, to);
}

/** Thrown by bounds-checked reads; always caught inside this module. */
class Malformed extends Error {}

// ── EXIF / TIFF ──────────────────────────────────────────────────────────────

/** Byte size of one value of each TIFF field type. */
const TIFF_TYPE_SIZE: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  6: 1, // SBYTE
  7: 1, // UNDEFINED
  8: 2, // SSHORT
  9: 4, // SLONG
  10: 8, // SRATIONAL
  11: 4, // FLOAT
  12: 8, // DOUBLE
  13: 4, // IFD
};

const TAG_GPS_IFD = 0x8825;
const TAG_EXIF_IFD = 0x8769;
const TAG_INTEROP_IFD = 0xa005;
const TAG_XMP = 0x02bc;

/**
 * Remove GPS from the TIFF structure in `b[start, end)` (an EXIF block,
 * starting at its `II*\0` / `MM\0*` header). Returns false when the structure
 * is not one we can walk safely; the caller then zeroes the whole block.
 *
 * Every IFD reachable from IFD0 (IFD1, the EXIF and interoperability IFDs) is
 * searched for the GPSInfo pointer, not only IFD0: a reader that finds one in
 * an unusual place still shows it.
 */
export function scrubTiffGps(b: Uint8Array, start: number, end: number): boolean {
  try {
    return scrubTiff(b, start, Math.min(end, b.length));
  } catch {
    return false;
  }
}

function scrubTiff(b: Uint8Array, start: number, end: number): boolean {
  const len = end - start;
  if (start < 0 || len < 8) return false;

  let le: boolean;
  if (b[start] === 0x49 && b[start + 1] === 0x49) le = true;
  else if (b[start] === 0x4d && b[start + 1] === 0x4d) le = false;
  else return false;

  const at = (o: number, n: number) => {
    if (!Number.isInteger(o) || o < 0 || o + n > len) throw new Malformed();
    return start + o;
  };
  const r16 = (o: number) => {
    const p = at(o, 2);
    return le ? b[p] | (b[p + 1] << 8) : (b[p] << 8) | b[p + 1];
  };
  const r32 = (o: number) => {
    const p = at(o, 4);
    return le
      ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0
      : ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
  };
  const w16 = (o: number, v: number) => {
    const p = at(o, 2);
    if (le) [b[p], b[p + 1]] = [v & 0xff, (v >> 8) & 0xff];
    else [b[p], b[p + 1]] = [(v >> 8) & 0xff, v & 0xff];
  };
  const w32 = (o: number, v: number) => {
    const p = at(o, 4);
    const bytes = [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
    if (le) bytes.reverse();
    b.set(bytes, p);
  };
  /** Offset and byte size of an entry's value, inline or out of line. */
  const valueOf = (entry: number): { off: number; size: number } | null => {
    const typeSize = TIFF_TYPE_SIZE[r16(entry + 2)];
    if (!typeSize) return null;
    const size = typeSize * r32(entry + 4);
    const off = size <= 4 ? entry + 8 : r32(entry + 8);
    at(off, size);
    return { off, size };
  };

  if (r16(2) !== 42) return false; // BigTIFF (43) and anything else: not ours

  const queue = [r32(4)];
  const seen = new Set<number>();
  const gpsIfds: number[] = [];

  while (queue.length) {
    const ifd = queue.shift() as number;
    if (ifd === 0 || seen.has(ifd)) continue;
    if (seen.size >= 32) return false; // a real file has five at most
    seen.add(ifd);

    let count = r16(ifd);
    const tableEnd = ifd + 2 + count * 12;
    const next = r32(tableEnd);

    for (let i = 0; i < count;) {
      const entry = ifd + 2 + i * 12;
      const tag = r16(entry);
      if (tag === TAG_GPS_IFD) {
        gpsIfds.push(r32(entry + 8));
        // Pull the following entries up over this one. Their values are
        // addressed by absolute offset, so nothing else has to move.
        b.copyWithin(at(entry, 12), at(entry + 12, 0), at(ifd + 2 + count * 12, 0));
        count--;
        continue; // the next entry now sits at index i
      }
      if (tag === TAG_EXIF_IFD || tag === TAG_INTEROP_IFD) queue.push(r32(entry + 8));
      if (tag === TAG_XMP) {
        const value = valueOf(entry);
        if (!value) return false;
        const from = start + value.off;
        if (!scrubXmpLocation(b, from, from + value.size)) zero(b, from, from + value.size);
      }
      i++;
    }

    const removed = (tableEnd - (ifd + 2 + count * 12)) / 12;
    if (removed > 0) {
      w16(ifd, count);
      const newEnd = ifd + 2 + count * 12;
      w32(newEnd, next);
      zero(b, at(newEnd + 4, 0), at(tableEnd + 4, 0));
    }
    if (next) queue.push(next);
  }

  for (const gps of gpsIfds) {
    if (gps === 0) continue;
    const count = r16(gps);
    const tableEnd = gps + 2 + count * 12;
    at(gps, tableEnd - gps + 4);
    for (let i = 0; i < count; i++) {
      const value = valueOf(gps + 2 + i * 12);
      if (!value) return false; // unknown type: its data cannot be located
      if (value.size > 4) zero(b, start + value.off, start + value.off + value.size);
    }
    zero(b, start + gps, start + tableEnd + 4);
  }
  return true;
}

// ── XMP ──────────────────────────────────────────────────────────────────────

/** A property that pins down a place more precisely than city/country. */
function isLocationName(local: string): boolean {
  return /^gps/i.test(local) || /latitude|longitude/i.test(local);
}

const NAME = '[A-Za-z_][\\w.\\-]*';
/** Start tag, prefix optional: `<exif:GPSLatitude`, `<GPSLatitude`. */
const START_TAG = new RegExp(`<(?:(${NAME}):)?(${NAME})(?=[\\s/>])`, 'g');
/** Prefixed attribute with its quoted value. */
const ATTRIBUTE = new RegExp(`(${NAME}):(${NAME})\\s*=\\s*("[^"]*"|'[^']*')`, 'g');
/** Any prefixed name, for the final check. */
const QNAME = new RegExp(`(${NAME}):(${NAME})`, 'g');

/** Index just past the `>` closing the tag whose name ends at `from`, or -1. */
function endOfTag(s: string, from: number): number {
  let quote = '';
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '<') return -1;
    else if (c === '>') return i + 1;
  }
  return -1;
}

/** Index just past the end tag matching an element opened before `from`, or -1. */
function endOfElement(s: string, qname: string, from: number): number {
  const re = new RegExp(`<(/?)${qname.replace(/[.\\-]/g, '\\$&')}(?=[\\s/>])`, 'g');
  re.lastIndex = from;
  let depth = 1;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    const tagEnd = endOfTag(s, m.index + m[0].length);
    if (tagEnd < 0) return -1;
    if (m[1] === '/') {
      if (--depth === 0) return tagEnd;
    } else if (s[tagEnd - 2] !== '/') {
      depth++;
    }
    re.lastIndex = tagEnd;
  }
  return -1;
}

/**
 * Overwrite every location property in the XMP packet at `b[start, end)` with
 * spaces. Returns false when that cannot be done with confidence (not UTF-8,
 * an unclosed element, a location name left over afterwards); the caller then
 * zeroes the whole packet.
 */
export function scrubXmpLocation(b: Uint8Array, start: number, end: number): boolean {
  end = Math.min(end, b.length);
  if (start < 0 || start > end) return false;
  // Trailing NUL padding is common; a NUL anywhere else means UTF-16/32,
  // which the byte-wise matching below cannot read.
  let contentEnd = end;
  while (contentEnd > start && b[contentEnd - 1] === 0) contentEnd--;
  if (b.subarray(start, contentEnd).includes(0)) return false;

  // latin1 maps every byte to exactly one character, so string indices are
  // byte offsets. Multi-byte UTF-8 only ever appears inside values.
  const s = Buffer.from(b.buffer, b.byteOffset + start, contentEnd - start).toString('latin1');
  const blanks: Array<[number, number]> = [];

  for (const m of s.matchAll(START_TAG)) {
    const [, prefix, local] = m;
    if (prefix === 'xmlns' || !isLocationName(local)) continue;
    const tagEnd = endOfTag(s, m.index + m[0].length);
    if (tagEnd < 0) return false;
    if (s[tagEnd - 2] === '/') {
      blanks.push([m.index, tagEnd]);
      continue;
    }
    const close = endOfElement(s, prefix ? `${prefix}:${local}` : local, tagEnd);
    if (close < 0) return false;
    blanks.push([m.index, close]);
  }
  for (const m of s.matchAll(ATTRIBUTE)) {
    if (m[1] === 'xmlns' || !isLocationName(m[2])) continue;
    blanks.push([m.index, m.index + m[0].length]);
  }

  for (const [from, to] of blanks) b.fill(0x20, start + from, start + to);

  if (!blanks.length) return true;
  const after = Buffer.from(b.buffer, b.byteOffset + start, contentEnd - start).toString('latin1');
  for (const m of after.matchAll(QNAME)) {
    if (m[1] !== 'xmlns' && isLocationName(m[2])) return false;
  }
  for (const m of after.matchAll(START_TAG)) {
    if (!m[1] && isLocationName(m[2])) return false;
  }
  return true;
}

// ── Photoshop IRB (JPEG APP13) ───────────────────────────────────────────────

const PHOTOSHOP_HEADER = 'Photoshop 3.0\0';

/**
 * APP13 keeps its IPTC record (IIM has no coordinates). It can also carry an
 * EXIF block (resources 0x0422/0x0423) or XMP (0x0424), which are treated like
 * their APP1 counterparts.
 */
function scrubPhotoshop(b: Uint8Array, start: number, end: number): void {
  let p = start;
  if (startsWith(b, p, PHOTOSHOP_HEADER)) p += PHOTOSHOP_HEADER.length;
  while (p + 12 <= end && startsWith(b, p, '8BIM')) {
    const id = u16be(b, p + 4);
    const nameField = (b[p + 6] + 2) & ~1; // Pascal string, padded to even
    const sizeAt = p + 6 + nameField;
    if (sizeAt + 4 > end) break;
    const size = u32be(b, sizeAt);
    const dataStart = sizeAt + 4;
    const dataEnd = Math.min(dataStart + size, end);
    if (id === 0x0422 || id === 0x0423) {
      if (!scrubTiffGps(b, dataStart, dataEnd)) zero(b, dataStart, dataEnd);
    } else if (id === 0x0424) {
      if (!scrubXmpLocation(b, dataStart, dataEnd)) zero(b, dataStart, dataEnd);
    }
    p = dataStart + size + (size & 1);
  }
  // A layout we could not follow to the end (or a continuation segment of an
  // IRB split across several): if an EXIF or XMP resource might be in the
  // rest, it goes.
  for (let i = p; i + 6 <= end; i++) {
    if (
      startsWith(b, i, '8BIM') &&
      b[i + 4] === 0x04 &&
      (b[i + 5] === 0x22 || b[i + 5] === 0x23 || b[i + 5] === 0x24)
    ) {
      zero(b, p, end);
      return;
    }
  }
}

// ── JPEG ─────────────────────────────────────────────────────────────────────

const EXIF_HEADER = 'Exif\0';
const XMP_HEADER = 'http://ns.adobe.com/xap/1.0/\0';

type HeadWalk = { status: 'more' } | { status: 'done'; end: number } | { status: 'error' };

/**
 * Walk the marker segments of the JPEG whose SOI is at `soi`, up to SOS.
 *
 * `strict` is for the primary image: an APP1 we do not recognise and a C2PA
 * manifest are zeroed. A JPEG found further down the file only has its EXIF
 * and XMP scrubbed, so that bytes that merely look like a JPEG (inside a
 * colour profile, say) are not damaged.
 *
 * With `scrub` false it only reports whether the head is complete.
 */
function walkJpegHead(
  b: Uint8Array,
  soi: number,
  limit: number,
  scrub: false | 'strict' | 'lenient',
): HeadWalk {
  let pos = soi + 2;
  for (;;) {
    // Any number of 0xFF fill bytes may precede a marker.
    while (pos + 1 < limit && b[pos] === 0xff && b[pos + 1] === 0xff) pos++;
    if (pos + 1 >= limit) return { status: 'more' };
    if (b[pos] !== 0xff) return { status: 'error' };
    const marker = b[pos + 1];

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return { status: 'done', end: pos };
    if (marker === 0xd8 || marker === 0x00) return { status: 'error' };

    if (pos + 4 > limit) return { status: 'more' };
    const len = u16be(b, pos + 2);
    if (len < 2) return { status: 'error' };
    const payload = pos + 4;
    const segmentEnd = pos + 2 + len;
    if (segmentEnd > limit) return { status: 'more' };
    if (scrub) scrubJpegSegment(b, marker, payload, segmentEnd, scrub === 'strict');
    pos = segmentEnd;
  }
}

function scrubJpegSegment(
  b: Uint8Array,
  marker: number,
  start: number,
  end: number,
  strict: boolean,
): void {
  if (marker === 0xe1) {
    if (startsWith(b, start, EXIF_HEADER) && end - start >= 6) {
      if (!scrubTiffGps(b, start + 6, end)) zero(b, start, end);
    } else if (startsWith(b, start, XMP_HEADER)) {
      if (!scrubXmpLocation(b, start + XMP_HEADER.length, end)) zero(b, start, end);
    } else if (startsWith(b, start, 'http://ns.adobe.com/xmp/extension/\0')) {
      zero(b, start, end); // extended XMP: chunks of a packet we cannot edit piecewise
    } else if (strict) {
      zero(b, start, end); // unknown APP1 (FLIR, Casio, …): cannot vouch for it
    }
  } else if (marker === 0xed) {
    scrubPhotoshop(b, start, end);
  } else if (marker === 0xeb && strict) {
    // JUMBF (C2PA): "JP", box instance, sequence number, then the superbox.
    if (startsWith(b, start, 'JP') && startsWith(b, start + 12, 'jumb')) zero(b, start, end);
  }
}

/** Next `FF D8 FF` (an SOI followed by a marker) at or after `from`, or -1. */
function findSoi(b: Uint8Array, from: number): number {
  for (let i = b.indexOf(0xff, from); i >= 0 && i + 2 < b.length; i = b.indexOf(0xff, i + 1)) {
    if (b[i + 1] === 0xd8 && b[i + 2] === 0xff) return i;
  }
  return -1;
}

// ── HEIF / AVIF (ISOBMFF) ────────────────────────────────────────────────────

/** Brands that mark an ISOBMFF file as a HEIF-family still image. */
const HEIF_BRANDS = new Set([
  'mif1',
  'mif2',
  'msf1',
  'heic',
  'heix',
  'heim',
  'heis',
  'hevc',
  'hevx',
  'hevm',
  'hevs',
  'avif',
  'avis',
  'avio',
]);

const C2PA_UUID = 'd8fec3d61b0e483c92975828877ec481';
const XMP_UUID = 'be7acfcb97a942e89c71999491e3afac';

/** A byte range to edit. `zeroOnly` ranges are zeroed as they stream past. */
interface Edit {
  start: number;
  end: number;
  zeroOnly: boolean;
  apply: (b: Uint8Array, start: number, end: number) => void;
}

const zeroEdit = (start: number, end: number): Edit => ({
  start,
  end,
  zeroOnly: true,
  apply: zero,
});

function exifItemEdit(start: number, end: number): Edit {
  return {
    start,
    end,
    zeroOnly: false,
    // The item starts with a 4-byte offset to the TIFF header (ISO/IEC 23008-12).
    apply(b, s, e) {
      if (e - s >= 4) {
        const tiff = s + 4 + u32be(b, s);
        if (tiff < e && scrubTiffGps(b, tiff, e)) return;
      }
      zero(b, s, e);
    },
  };
}

function xmpEdit(start: number, end: number): Edit {
  return {
    start,
    end,
    zeroOnly: false,
    apply(b, s, e) {
      if (!scrubXmpLocation(b, s, e)) zero(b, s, e);
    },
  };
}

/** Read an unsigned big-endian integer of `n` bytes, bounds-checked. */
function readUint(b: Uint8Array, at: number, n: number, limit: number): number {
  if (at + n > limit) throw new Malformed();
  let v = 0;
  for (let k = 0; k < n; k++) v = v * 256 + b[at + k];
  return v;
}

type Box = { type: string; start: number; content: number; end: number };

/** The child boxes of `[from, to)`; throws on a box that overruns it. */
function childBoxes(b: Uint8Array, from: number, to: number): Box[] {
  const boxes: Box[] = [];
  let pos = from;
  while (pos + 8 <= to) {
    let size = u32be(b, pos);
    let content = pos + 8;
    if (size === 1) {
      size = readUint(b, pos + 8, 8, to);
      content = pos + 16;
    } else if (size === 0) {
      size = to - pos;
    }
    if (size < content - pos || pos + size > to) throw new Malformed();
    boxes.push({ type: fourcc(b, pos + 4), start: pos, content, end: pos + size });
    pos += size;
  }
  return boxes;
}

/** A NUL-terminated string at `at`, and the index after its terminator. */
function cString(b: Uint8Array, at: number, limit: number): [string, number] {
  const text = (from: number, to: number) =>
    Buffer.from(b.buffer, b.byteOffset + from, Math.max(0, to - from)).toString('latin1');
  if (at >= limit) return ['', limit];
  const nul = b.subarray(at, limit).indexOf(0);
  if (nul < 0) return [text(at, limit), limit];
  return [text(at, at + nul), at + nul + 1];
}

/** `zero`: an XMP packet we cannot edit in place (compressed), zeroed whole. */
type ItemKind = 'exif' | 'xmp' | 'zero' | 'other';

/** item_ID → what it is, from `iinf`. */
function readItemKinds(b: Uint8Array, iinf: Box): Map<number, ItemKind> {
  const kinds = new Map<number, ItemKind>();
  const version = b[iinf.content];
  const first = iinf.content + 4 + (version === 0 ? 2 : 4);
  for (const infe of childBoxes(b, first, iinf.end)) {
    if (infe.type !== 'infe') continue;
    const v = b[infe.content];
    let p = infe.content + 4;
    let itemId: number;
    let itemType = 'mime'; // versions 0/1 have no item_type; they read like `mime`
    if (v >= 2) {
      const idBytes = v === 2 ? 2 : 4;
      itemId = readUint(b, p, idBytes, infe.end);
      p += idBytes + 2; // + item_protection_index
      if (p + 4 > infe.end) throw new Malformed();
      itemType = fourcc(b, p);
      p += 4;
    } else {
      itemId = readUint(b, p, 2, infe.end);
      p += 4; // + item_protection_index
    }

    let kind: ItemKind = 'other';
    if (itemType === 'Exif') kind = 'exif';
    else if (itemType === 'mime') {
      const [, afterName] = cString(b, p, infe.end);
      const [contentType, afterType] = cString(b, afterName, infe.end);
      const [encoding] = afterType < infe.end ? cString(b, afterType, infe.end) : [''];
      if (contentType.trim().toLowerCase() === 'application/rdf+xml') {
        kind = encoding ? 'zero' : 'xmp';
      }
    }
    kinds.set(itemId, kind);
  }
  return kinds;
}

type Extent = { start: number; end: number };

/** item_ID → absolute file ranges, from `iloc` (and `idat` for method 1). */
function readItemExtents(b: Uint8Array, iloc: Box, idat: Box | undefined): Map<number, Extent[]> {
  const out = new Map<number, Extent[]>();
  const end = iloc.end;
  const version = b[iloc.content];
  if (version > 2) throw new Malformed();
  let p = iloc.content + 4;
  const sizes = readUint(b, p, 2, end);
  const offsetSize = sizes >> 12;
  const lengthSize = (sizes >> 8) & 0x0f;
  const baseOffsetSize = (sizes >> 4) & 0x0f;
  const indexSize = version > 0 ? sizes & 0x0f : 0;
  p += 2;
  const idBytes = version < 2 ? 2 : 4;
  const itemCount = readUint(b, p, idBytes, end);
  p += idBytes;

  for (let i = 0; i < itemCount; i++) {
    const itemId = readUint(b, p, idBytes, end);
    p += idBytes;
    let method = 0;
    if (version > 0) {
      method = readUint(b, p, 2, end) & 0x0f;
      p += 2;
    }
    const dataRef = readUint(b, p, 2, end);
    p += 2;
    const baseOffset = readUint(b, p, baseOffsetSize, end);
    p += baseOffsetSize;
    const extentCount = readUint(b, p, 2, end);
    p += 2;

    const extents: Extent[] = [];
    for (let e = 0; e < extentCount; e++) {
      p += indexSize;
      const offset = readUint(b, p, offsetSize, end);
      p += offsetSize;
      const length = readUint(b, p, lengthSize, end);
      p += lengthSize;
      if (method === 0) {
        extents.push({ start: baseOffset + offset, end: baseOffset + offset + length });
      } else if (method === 1) {
        if (!idat) throw new Malformed();
        const start = idat.content + baseOffset + offset;
        if (start + length > idat.end) throw new Malformed();
        extents.push({ start, end: start + length });
      } else {
        extents.push({ start: -1, end: -1 }); // item reference: not file bytes
      }
    }
    // Data in another file (dref) is not in this one.
    if (dataRef === 0) out.set(itemId, extents);
  }
  return out;
}

/** Edits for the EXIF and XMP items listed in the `meta` box. */
function metaEdits(b: Uint8Array, meta: Box): Edit[] {
  const children = childBoxes(b, meta.content + 4, meta.end); // FullBox
  const iinf = children.find((x) => x.type === 'iinf');
  const iloc = children.find((x) => x.type === 'iloc');
  const idat = children.find((x) => x.type === 'idat');
  if (!iinf || !iloc) return [];

  const kinds = readItemKinds(b, iinf);
  const extents = readItemExtents(b, iloc, idat);
  const edits: Edit[] = [];
  for (const [itemId, kind] of kinds) {
    if (kind === 'other') continue;
    const ranges = extents.get(itemId) ?? [];
    if (ranges.some((r) => r.start < 0 || r.end <= r.start)) throw new Malformed();
    for (const r of ranges) {
      const single = ranges.length === 1 && r.end - r.start <= MAX_ITEM_BYTES;
      if (!single || kind === 'zero') edits.push(zeroEdit(r.start, r.end));
      else if (kind === 'exif') edits.push(exifItemEdit(r.start, r.end));
      else edits.push(xmpEdit(r.start, r.end));
    }
  }
  return edits;
}

type HeifPlan = { status: 'more' } | { status: 'fail' } | { status: 'plan'; edits: Edit[] };

/**
 * Find the top-level `meta` box and plan the edits for its items. Needs the
 * whole `meta` box in `b`; asks for more until it is there.
 */
function planHeif(b: Uint8Array, eof: boolean): HeifPlan {
  let pos = 0;
  for (let guard = 0; guard < 100_000; guard++) {
    if (pos + 8 > b.length) return eof ? { status: 'plan', edits: [] } : { status: 'more' };
    let size = u32be(b, pos);
    const type = fourcc(b, pos + 4);
    let header = 8;
    if (size === 1) {
      if (pos + 16 > b.length) return eof ? { status: 'fail' } : { status: 'more' };
      size = readUint(b, pos + 8, 8, b.length);
      header = 16;
    } else if (size === 0) {
      if (type !== 'meta') return { status: 'plan', edits: [] }; // last box, no meta
      if (!eof) return { status: 'more' };
      size = b.length - pos;
    }
    if (size < header) return { status: 'fail' };
    if (type === 'meta') {
      if (pos + size > b.length) return eof ? { status: 'fail' } : { status: 'more' };
      try {
        const edits = metaEdits(b, { type, start: pos, content: pos + header, end: pos + size });
        return { status: 'plan', edits };
      } catch {
        return { status: 'fail' };
      }
    }
    pos += size;
  }
  return { status: 'fail' };
}

// ── Streaming ────────────────────────────────────────────────────────────────

/**
 * A format's in-place editor, driven by `scrubbedStream`. Given the bytes not
 * yet sent (`buf`, starting at absolute offset `base`), it edits what it can
 * and returns the absolute offset up to which the bytes are final. At `eof` it
 * must finish everything.
 */
interface Scrubber {
  advance(buf: Uint8Array, base: number, eof: boolean): number;
}

/** A growable byte buffer the stream holds back while a scrubber waits. */
class Pending {
  private buf = new Uint8Array(0);
  length = 0;

  view(): Uint8Array {
    return this.buf.subarray(0, this.length);
  }

  push(chunk: Uint8Array): void {
    if (this.length + chunk.length > this.buf.length) {
      const grown = new Uint8Array(Math.max(64 * 1024, (this.length + chunk.length) * 2));
      grown.set(this.view());
      this.buf = grown;
    }
    this.buf.set(chunk, this.length);
    this.length += chunk.length;
  }

  /** Remove and return the first `n` bytes. */
  take(n: number): Uint8Array {
    const out = this.buf.slice(0, n);
    const rest = this.buf.subarray(n, this.length);
    if (this.buf.length > 1024 * 1024 && rest.length < this.buf.length / 4) {
      // Give a large head's memory back once it has been sent.
      this.buf = new Uint8Array(Math.max(64 * 1024, rest.length * 2));
      this.buf.set(rest);
    } else {
      this.buf.copyWithin(0, n, this.length);
    }
    this.length -= n;
    return out;
  }
}

/** Reads a web stream chunk by chunk; `null` at the end. */
class ChunkReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
  }

  async read(): Promise<Uint8Array | null> {
    for (;;) {
      const { done, value } = await this.reader.read();
      if (done) return null;
      if (value && value.length) return value;
    }
  }

  cancel(reason?: unknown): Promise<void> {
    return this.reader.cancel(reason);
  }
}

function scrubbedStream(
  reader: ChunkReader,
  pending: Pending,
  scrubber: Scrubber,
  initialEof: boolean,
): ReadableStream<Uint8Array> {
  let base = 0;
  let eof = initialEof;
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        for (;;) {
          const view = pending.view();
          let safe = scrubber.advance(view, base, eof);
          if (eof) safe = base + view.length;
          safe = Math.min(safe, base + view.length);
          if (safe > base) {
            controller.enqueue(pending.take(safe - base));
            base = safe;
            return;
          }
          if (eof) {
            controller.close();
            return;
          }
          const chunk = await reader.read();
          if (chunk) pending.push(chunk);
          else eof = true;
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    },
    { highWaterMark: 0 },
  );
}

/** JPEG: scrub every embedded JPEG head found from `scanFrom` on. */
class JpegScrubber implements Scrubber {
  private scanFrom: number;

  constructor(scanFrom: number) {
    this.scanFrom = scanFrom;
  }

  advance(buf: Uint8Array, base: number, eof: boolean): number {
    let i = Math.max(0, this.scanFrom - base);
    for (;;) {
      const hit = findSoi(buf, i);
      if (hit < 0) {
        // Hold back a trailing FF or FF D8 that may start a pattern.
        const n = buf.length;
        const keep =
          n >= 2 && buf[n - 2] === 0xff && buf[n - 1] === 0xd8
            ? 2
            : n >= 1 && buf[n - 1] === 0xff
              ? 1
              : 0;
        const safe = eof ? base + n : base + n - keep;
        this.scanFrom = Math.max(this.scanFrom, base + Math.max(i, n - keep));
        return safe;
      }
      const head = walkJpegHead(buf, hit, buf.length, false);
      if (head.status === 'more' && !eof && buf.length - hit < EMBEDDED_HEAD_CAP) {
        this.scanFrom = base + hit;
        return base + hit; // hold from here until the head is complete
      }
      walkJpegHead(buf, hit, buf.length, 'lenient');
      i = hit + 2;
      this.scanFrom = base + i;
    }
  }
}

/** HEIF/AVIF: the planned item edits, plus top-level `uuid` boxes as they pass. */
class HeifScrubber implements Scrubber {
  private nextBox = 0;
  private edits: Edit[];

  constructor(edits: Edit[]) {
    this.edits = [...edits].sort((a, b) => a.start - b.start);
  }

  private insert(edit: Edit): void {
    const i = this.edits.findIndex((e) => e.start > edit.start);
    if (i < 0) this.edits.push(edit);
    else this.edits.splice(i, 0, edit);
  }

  advance(buf: Uint8Array, base: number, eof: boolean): number {
    const end = base + buf.length;
    let safe = end;

    // Top-level boxes: a C2PA manifest or an XMP packet can sit in a `uuid`
    // box anywhere in the file, usually after `mdat`.
    while (this.nextBox < end) {
      const rel = this.nextBox - base;
      const avail = buf.length - rel;
      if (avail < 8 || (u32be(buf, rel) === 1 && avail < 16)) {
        if (eof) this.nextBox = Infinity;
        else safe = Math.min(safe, this.nextBox);
        break;
      }
      let size = u32be(buf, rel);
      let header = 8;
      if (size === 1) {
        size = readUint(buf, rel + 8, 8, buf.length);
        header = 16;
      }
      const type = fourcc(buf, rel + 4);
      if (type === 'uuid' && avail < header + 16 && !eof) {
        safe = Math.min(safe, this.nextBox);
        break;
      }
      const boxEnd = size === 0 ? Infinity : this.nextBox + size;
      if (size !== 0 && size < header) {
        this.nextBox = Infinity; // malformed: stop walking, items are planned already
        break;
      }
      if (type === 'uuid' && avail >= header + 16) {
        const id = Buffer.from(buf.subarray(rel + header, rel + header + 16)).toString('hex');
        const contentStart = this.nextBox + header + 16;
        if (id === C2PA_UUID) this.insert(zeroEdit(contentStart, boxEnd));
        else if (id === XMP_UUID) {
          this.insert(
            boxEnd - contentStart <= MAX_ITEM_BYTES
              ? xmpEdit(contentStart, boxEnd)
              : zeroEdit(contentStart, boxEnd),
          );
        }
      }
      this.nextBox = boxEnd;
    }

    // Edits, in file order.
    const remaining: Edit[] = [];
    let blocked = false;
    for (const edit of this.edits) {
      if (blocked || edit.start >= end) {
        remaining.push(edit);
        continue;
      }
      const from = Math.max(edit.start, base) - base;
      const to = Math.min(edit.end, end) - base;
      if (edit.zeroOnly) {
        zero(buf, from, to);
        if (edit.end > end) remaining.push(edit);
        continue;
      }
      if (edit.end <= end || eof) {
        edit.apply(buf, from, to);
        continue;
      }
      // Hold everything from its start until the whole range is here.
      safe = Math.min(safe, edit.start);
      remaining.push(edit);
      blocked = true;
    }
    this.edits = remaining;
    return Math.max(base, safe);
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

export type LocationScrubResult =
  | {
      ok: true;
      stream: ReadableStream<Uint8Array>;
      /** 'passthrough' for formats this module does not edit. */
      format: 'jpeg' | 'heif' | 'passthrough';
    }
  | { ok: false; reason: string };

/**
 * Wrap an original's byte stream so it comes out without location metadata.
 *
 * Reads the head before returning, so a file whose metadata cannot be located
 * is refused (`ok: false`) before any response is committed. The source is
 * cancelled in that case. Read errors propagate.
 */
export async function scrubLocationStream(
  source: ReadableStream<Uint8Array>,
): Promise<LocationScrubResult> {
  const reader = new ChunkReader(source);
  const pending = new Pending();
  let eof = false;

  const fill = async (n: number) => {
    while (!eof && pending.length < n) {
      const chunk = await reader.read();
      if (chunk) pending.push(chunk);
      else eof = true;
    }
  };
  const refuse = async (reason: string): Promise<LocationScrubResult> => {
    await reader.cancel().catch(() => {});
    return { ok: false, reason };
  };

  // Eight bytes tell JPEG (FF D8 FF) from ISOBMFF (`ftyp` at 4). Asking for
  // more would stall a short first chunk of a passthrough file.
  await fill(8);
  let b = pending.view();

  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    for (;;) {
      b = pending.view();
      const head = walkJpegHead(b, 0, b.length, false);
      if (head.status === 'done') break;
      if (head.status === 'error' || eof) return refuse('JPEG head could not be parsed');
      if (pending.length > HEAD_CAP) return refuse('JPEG head exceeds the cap');
      await fill(pending.length + 1);
    }
    walkJpegHead(b, 0, b.length, 'strict');
    return {
      ok: true,
      format: 'jpeg',
      stream: scrubbedStream(reader, pending, new JpegScrubber(2), eof),
    };
  }

  if (b.length >= 8 && fourcc(b, 4) === 'ftyp') {
    const ftypSize = u32be(b, 0);
    if (ftypSize < 16 || ftypSize > 4096) return refuse('unexpected ftyp box');
    await fill(ftypSize);
    b = pending.view();
    if (b.length < ftypSize) return refuse('truncated ftyp box');
    const brands = [fourcc(b, 8)];
    for (let p = 16; p + 4 <= ftypSize; p += 4) brands.push(fourcc(b, p));
    if (brands.some((brand) => HEIF_BRANDS.has(brand))) {
      for (;;) {
        b = pending.view();
        const plan = planHeif(b, eof);
        if (plan.status === 'plan') {
          return {
            ok: true,
            format: 'heif',
            stream: scrubbedStream(reader, pending, new HeifScrubber(plan.edits), eof),
          };
        }
        if (plan.status === 'fail') return refuse('HEIF metadata could not be parsed');
        if (pending.length > HEAD_CAP) return refuse('HEIF meta box beyond the cap');
        await fill(pending.length + 1);
      }
    }
  }

  // Not a format we edit: send it as it is.
  return {
    ok: true,
    format: 'passthrough',
    stream: scrubbedStream(reader, pending, { advance: (buf, base) => base + buf.length }, eof),
  };
}

/** Buffered convenience: scrub `bytes` and return the result, or null if refused. */
export async function scrubLocation(bytes: Uint8Array): Promise<Uint8Array | null> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice());
      controller.close();
    },
  });
  const result = await scrubLocationStream(source);
  if (!result.ok) return null;
  return new Uint8Array(await new Response(result.stream).arrayBuffer());
}

// ── For the doctor ───────────────────────────────────────────────────────────

const SCRUBBABLE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/heic',
  'image/heif',
  'image/avif',
]);
const SCRUBBABLE_EXT = /\.(jpe?g|jpe|jfif|heic|heif|hif|avif)$/i;

/**
 * Whether an Immich asset's original is a format this module cleans, judged
 * from what the album response says about it (the stream itself is sniffed).
 */
export function isLocationScrubbable(asset: {
  type?: string;
  originalMimeType?: string | null;
  originalFileName?: string | null;
}): boolean {
  if (asset.type && asset.type !== 'IMAGE') return false;
  const mime = asset.originalMimeType?.toLowerCase().split(';')[0].trim();
  if (mime) return SCRUBBABLE_MIME.has(mime);
  return SCRUBBABLE_EXT.test(asset.originalFileName ?? '');
}
