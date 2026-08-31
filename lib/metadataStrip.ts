/**
 * Removes camera metadata (EXIF, XMP, IPTC) from image bytes on the way out.
 *
 * Why this exists: `/api/image/:token?size=original` streams the untouched file
 * from Immich, and the asset token authorises *the asset, not the size* — so a
 * thumbnail token lifted from the public HTML plus `?size=original` returns the
 * full original, GPS coordinates and all. `app/api/exif/[id]/route.ts`
 * deliberately hands the browser only city and country; the original download
 * walked straight past that.
 *
 * Why zero the bytes instead of cutting them out: the pixel data must stay
 * bit-identical — re-encoding would cost quality, which is the whole reason we
 * serve originals. Overwriting in place keeps every other byte and the total
 * length untouched, so Content-Length stays valid and, crucially for AVIF, the
 * absolute offsets in the `iloc` box keep pointing where they did. Removing an
 * item would mean rewriting every offset in the container.
 *
 * A zeroed APPn segment is simply an application segment a decoder does not
 * recognise, and decoders skip those. A zeroed ISOBMFF item payload is still
 * addressed by `iloc`, but no longer parses as EXIF.
 *
 * NOT stripped: JPEG APP0 (JFIF) and APP2 (ICC colour profile). Dropping the
 * ICC profile would visibly shift colours — that is a rendering change, not a
 * privacy one.
 */

/** Half-open byte range [start, end). */
export type ByteRange = { start: number; end: number };

/** Formats whose metadata layout we can locate with confidence. */
export const STRIPPABLE_CONTENT_TYPES = [
  'image/jpeg',
  'image/avif',
  'image/heic',
  'image/heif',
] as const;

export function isStrippable(contentType: string): boolean {
  const t = contentType.toLowerCase().split(';')[0].trim();
  return (STRIPPABLE_CONTENT_TYPES as readonly string[]).includes(t);
}

const u16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32 = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const fourcc = (b: Uint8Array, i: number) =>
  String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);

/** Read a big-endian unsigned integer of `n` bytes (n <= 8). */
function uint(b: Uint8Array, i: number, n: number): number {
  let v = 0;
  for (let k = 0; k < n; k++) v = v * 256 + b[i + k];
  return v;
}

// ── JPEG ────────────────────────────────────────────────────────────────────
// Segment layout: 0xFF <marker> <2-byte length incl. itself> <payload>.
// Metadata always precedes SOS (0xDA); everything after it is entropy-coded
// image data that must not be touched.

const JPEG_STRIP_MARKERS = new Set([
  0xe1, // APP1 — EXIF and XMP
  0xed, // APP13 — Photoshop/IPTC
  0xfe, // COM — free-text comment
]);

export function findJpegMetadataRanges(b: Uint8Array): ByteRange[] {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) {
    throw new Error('not a JPEG (missing SOI)');
  }
  const ranges: ByteRange[] = [];
  let pos = 2;

  while (pos + 3 < b.length) {
    if (b[pos] !== 0xff) throw new Error(`lost segment alignment at ${pos}`);
    const marker = b[pos + 1];

    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos += 2;
      continue;
    }
    if (marker === 0xd9) break; // EOI
    if (marker === 0xda) break; // SOS — image data follows

    const len = u16(b, pos + 2);
    if (len < 2) throw new Error(`bogus segment length ${len} at ${pos}`);
    const payloadStart = pos + 4;
    const segmentEnd = pos + 2 + len;
    if (segmentEnd > b.length) break; // truncated head — stop where we are

    if (JPEG_STRIP_MARKERS.has(marker) && segmentEnd > payloadStart) {
      ranges.push({ start: payloadStart, end: segmentEnd });
    }
    pos = segmentEnd;
  }
  return ranges;
}

// ── ISOBMFF (AVIF / HEIC / HEIF) ────────────────────────────────────────────
// Boxes are <4-byte size><4-byte type>[<8-byte largesize>]<payload>. Metadata
// items live in `meta`: `iinf`/`infe` name them, `iloc` says where their bytes
// are. We zero exactly those byte ranges.

type Box = { type: string; start: number; contentStart: number; end: number };

function readBoxes(b: Uint8Array, from: number, to: number): Box[] {
  const boxes: Box[] = [];
  let pos = from;
  while (pos + 8 <= to) {
    let size = u32(b, pos);
    let contentStart = pos + 8;
    if (size === 1) {
      if (pos + 16 > to) break;
      size = uint(b, pos + 8, 8);
      contentStart = pos + 16;
    } else if (size === 0) {
      size = to - pos; // extends to the end
    }
    if (size < 8) break;
    const end = Math.min(pos + size, to);
    boxes.push({ type: fourcc(b, pos + 4), start: pos, contentStart, end });
    if (end <= pos) break;
    pos = end;
  }
  return boxes;
}

/** item_ID -> item_type, from the `iinf` box. */
function readItemTypes(b: Uint8Array, iinf: Box): Map<number, string> {
  const types = new Map<number, string>();
  const version = b[iinf.contentStart];
  let pos = iinf.contentStart + 4; // version + flags
  if (version === 0) pos += 2;
  else pos += 4; // entry_count

  for (const infe of readBoxes(b, pos, iinf.end)) {
    if (infe.type !== 'infe') continue;
    const v = b[infe.contentStart];
    let p = infe.contentStart + 4;
    if (v < 2) continue; // versions 0/1 predate item_type
    const itemId = v === 2 ? u16(b, p) : u32(b, p);
    p += v === 2 ? 2 : 4;
    p += 2; // item_protection_index
    types.set(itemId, fourcc(b, p));
  }
  return types;
}

/** item_ID -> byte ranges, from the `iloc` box. */
function readItemLocations(b: Uint8Array, iloc: Box): Map<number, ByteRange[]> {
  const out = new Map<number, ByteRange[]>();
  const version = b[iloc.contentStart];
  let p = iloc.contentStart + 4; // version + flags

  const offsetSize = b[p] >> 4;
  const lengthSize = b[p] & 0x0f;
  const baseOffsetSize = b[p + 1] >> 4;
  const indexSize = version === 1 || version === 2 ? b[p + 1] & 0x0f : 0;
  p += 2;

  const itemCount = version < 2 ? u16(b, p) : u32(b, p);
  p += version < 2 ? 2 : 4;

  for (let i = 0; i < itemCount && p < iloc.end; i++) {
    const itemId = version < 2 ? u16(b, p) : u32(b, p);
    p += version < 2 ? 2 : 4;
    if (version === 1 || version === 2) p += 2; // construction_method
    p += 2; // data_reference_index
    const baseOffset = baseOffsetSize ? uint(b, p, baseOffsetSize) : 0;
    p += baseOffsetSize;
    const extentCount = u16(b, p);
    p += 2;

    const ranges: ByteRange[] = [];
    for (let e = 0; e < extentCount; e++) {
      if ((version === 1 || version === 2) && indexSize) p += indexSize;
      const extentOffset = offsetSize ? uint(b, p, offsetSize) : 0;
      p += offsetSize;
      const extentLength = lengthSize ? uint(b, p, lengthSize) : 0;
      p += lengthSize;
      if (extentLength > 0) {
        const start = baseOffset + extentOffset;
        ranges.push({ start, end: start + extentLength });
      }
    }
    if (ranges.length) out.set(itemId, ranges);
  }
  return out;
}

export function findIsobmffMetadataRanges(b: Uint8Array): ByteRange[] {
  const top = readBoxes(b, 0, b.length);
  if (!top.some((x) => x.type === 'ftyp')) throw new Error('not ISOBMFF (no ftyp)');
  const meta = top.find((x) => x.type === 'meta');
  if (!meta) return []; // no metadata box at all — nothing to strip

  // `meta` is a FullBox: skip version + flags before its children.
  const children = readBoxes(b, meta.contentStart + 4, meta.end);
  const iinf = children.find((x) => x.type === 'iinf');
  const iloc = children.find((x) => x.type === 'iloc');
  if (!iinf || !iloc) return [];

  const types = readItemTypes(b, iinf);
  const locations = readItemLocations(b, iloc);

  const ranges: ByteRange[] = [];
  for (const [itemId, itemType] of types) {
    // 'Exif' is EXIF; 'mime' items are XMP in every AVIF/HEIC writer we see.
    if (itemType !== 'Exif' && itemType !== 'mime') continue;
    for (const r of locations.get(itemId) ?? []) ranges.push(r);
  }
  return ranges;
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * Byte ranges to blank out, or null when the format is not one we understand.
 * Callers must treat null as "do not serve this original" — silently passing it
 * through is what caused the leak in the first place.
 */
export function findMetadataRanges(b: Uint8Array, contentType: string): ByteRange[] | null {
  const t = contentType.toLowerCase().split(';')[0].trim();
  try {
    if (t === 'image/jpeg') return findJpegMetadataRanges(b);
    if (t === 'image/avif' || t === 'image/heic' || t === 'image/heif') {
      return findIsobmffMetadataRanges(b);
    }
  } catch {
    return null; // malformed or unexpected layout — refuse rather than leak
  }
  return null;
}

/** Overwrite `ranges` with zeroes. Mutates and returns `b`. */
export function blankRanges(b: Uint8Array, ranges: ByteRange[]): Uint8Array {
  for (const { start, end } of ranges) {
    const from = Math.max(0, Math.min(start, b.length));
    const to = Math.max(0, Math.min(end, b.length));
    if (to > from) b.fill(0, from, to);
  }
  return b;
}

/** Convenience for buffered callers and tests. */
export function stripMetadata(b: Uint8Array, contentType: string): Uint8Array | null {
  const ranges = findMetadataRanges(b, contentType);
  if (ranges === null) return null;
  return blankRanges(b, ranges);
}
