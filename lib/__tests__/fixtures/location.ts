/**
 * Builders for real-world-shaped metadata fixtures: TIFF/EXIF with a GPS IFD
 * in either byte order, XMP packets, JPEGs and HEIF files. Shared by
 * lib/__tests__/locationScrub.test.ts and the download route tests.
 */

export const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
export const bytes = (...n: number[]) => new Uint8Array(n);
export const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
export const utf8 = (s: string) => new TextEncoder().encode(s);
export const be16 = (n: number) => bytes((n >> 8) & 0xff, n & 0xff);
export const be32 = (n: number) =>
  bytes((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);

/** Index of `needle` in `hay`, or -1. */
export function indexOf(hay: Uint8Array, needle: Uint8Array, from = 0): number {
  outer: for (let i = from; i + needle.length <= hay.length; i++) {
    for (let k = 0; k < needle.length; k++) if (hay[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}
export const contains = (hay: Uint8Array, needle: Uint8Array) => indexOf(hay, needle) >= 0;
export const latin1 = (b: Uint8Array) => Buffer.from(b).toString('latin1');

// ── TIFF ─────────────────────────────────────────────────────────────────────

export const TYPE = { BYTE: 1, ASCII: 2, SHORT: 3, LONG: 4, RATIONAL: 5, UNDEFINED: 7 } as const;
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 };

export type TiffEntry =
  | { tag: number; type: number; count: number; value: (le: boolean) => Uint8Array }
  | { tag: number; ifd: string };

export interface TiffIfd {
  name: string;
  entries: TiffEntry[];
  next?: string;
}

const u16 = (le: boolean, n: number) => (le ? bytes(n & 0xff, (n >> 8) & 0xff) : be16(n));
const u32 = (le: boolean, n: number) =>
  le ? bytes(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff) : be32(n);

export const asciiValue = (s: string) => ({
  type: TYPE.ASCII,
  count: s.length + 1,
  value: () => ascii(`${s}\0`),
});
export const shortValue = (...n: number[]) => ({
  type: TYPE.SHORT,
  count: n.length,
  value: (le: boolean) => cat(...n.map((v) => u16(le, v))),
});
export const byteValue = (...n: number[]) => ({
  type: TYPE.BYTE,
  count: n.length,
  value: () => bytes(...n),
});
export const rationalValue = (...pairs: Array<[number, number]>) => ({
  type: TYPE.RATIONAL,
  count: pairs.length,
  value: (le: boolean) => cat(...pairs.flatMap(([a, b]) => [u32(le, a), u32(le, b)])),
});
export const undefinedValue = (data: Uint8Array) => ({
  type: TYPE.UNDEFINED,
  count: data.length,
  value: () => data,
});

/** Lay out IFDs after the header, out-of-line values after the IFDs. */
export function buildTiff(le: boolean, ifds: TiffIfd[]): Uint8Array {
  const offsets = new Map<string, number>();
  let pos = 8;
  for (const ifd of ifds) {
    offsets.set(ifd.name, pos);
    pos += 2 + ifd.entries.length * 12 + 4;
  }
  const data: Uint8Array[] = [];
  let dataPos = pos;
  const tables: Uint8Array[] = [];
  for (const ifd of ifds) {
    const parts: Uint8Array[] = [u16(le, ifd.entries.length)];
    for (const e of ifd.entries) {
      if ('ifd' in e) {
        parts.push(u16(le, e.tag), u16(le, TYPE.LONG), u32(le, 1), u32(le, offsets.get(e.ifd)!));
        continue;
      }
      const value = e.value(le);
      expectLength(value.length, TYPE_SIZE[e.type] * e.count);
      parts.push(u16(le, e.tag), u16(le, e.type), u32(le, e.count));
      if (value.length <= 4) {
        const inline = new Uint8Array(4);
        inline.set(value);
        parts.push(inline);
      } else {
        parts.push(u32(le, dataPos));
        data.push(value);
        dataPos += value.length;
        if (value.length % 2) {
          data.push(bytes(0));
          dataPos++;
        }
      }
    }
    parts.push(u32(le, ifd.next ? offsets.get(ifd.next)! : 0));
    tables.push(cat(...parts));
  }
  const header = le
    ? cat(ascii('II'), bytes(42, 0), u32(le, 8))
    : cat(ascii('MM'), bytes(0, 42), u32(le, 8));
  return cat(header, ...tables, ...data);
}

function expectLength(actual: number, expected: number) {
  if (actual !== expected)
    throw new Error(`fixture value is ${actual} bytes, expected ${expected}`);
}

export const LAT = rationalValue([52, 1], [31, 1], [1234, 100]);
export const LON = rationalValue([13, 1], [24, 1], [5678, 100]);
export const ALT = rationalValue([3456, 100]);

/** A camera EXIF block: IFD0, EXIF IFD, GPS IFD and an IFD1. */
export function cameraTiff(le: boolean, opts: { withGps?: boolean; xmp?: Uint8Array } = {}) {
  const withGps = opts.withGps ?? true;
  const ifd0: TiffEntry[] = [
    { tag: 0x010f, ...asciiValue('Canon') },
    { tag: 0x0110, ...asciiValue('Canon EOS R5') },
    { tag: 0x0112, ...shortValue(1) },
  ];
  if (opts.xmp) ifd0.push({ tag: 0x02bc, ...undefinedValue(opts.xmp) });
  ifd0.push({ tag: 0x8298, ...asciiValue('(c) Jane Doe') });
  ifd0.push({ tag: 0x8769, ifd: 'exif' });
  if (withGps) ifd0.push({ tag: 0x8825, ifd: 'gps' });

  const ifds: TiffIfd[] = [
    { name: 'ifd0', entries: ifd0, next: 'ifd1' },
    {
      name: 'exif',
      entries: [
        { tag: 0x829a, ...rationalValue([1, 250]) },
        { tag: 0x829d, ...rationalValue([28, 10]) },
        { tag: 0x8827, ...shortValue(100) },
        { tag: 0xa434, ...asciiValue('RF24-70mm F2.8 L IS USM') },
      ],
    },
  ];
  if (withGps) {
    ifds.push({
      name: 'gps',
      entries: [
        { tag: 0x0000, ...byteValue(2, 3, 0, 0) },
        { tag: 0x0001, ...asciiValue('N') },
        { tag: 0x0002, ...LAT },
        { tag: 0x0003, ...asciiValue('E') },
        { tag: 0x0004, ...LON },
        { tag: 0x0005, ...byteValue(0) },
        { tag: 0x0006, ...ALT },
      ],
    });
  }
  ifds.push({ name: 'ifd1', entries: [{ tag: 0x0103, ...shortValue(6) }] });
  return buildTiff(le, ifds);
}

export interface ParsedEntry {
  type: number;
  count: number;
  value: Uint8Array;
}
export interface ParsedTiff {
  ifd0: Map<number, ParsedEntry>;
  exif: Map<number, ParsedEntry> | null;
  gps: Map<number, ParsedEntry> | null;
  ifd1: Map<number, ParsedEntry> | null;
}

/** A small, strict TIFF reader standing in for exiftool. */
export function parseTiff(t: Uint8Array): ParsedTiff {
  const le = t[0] === 0x49;
  const r16 = (o: number) => (le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1]);
  const r32 = (o: number) =>
    le
      ? (t[o] | (t[o + 1] << 8) | (t[o + 2] << 16) | (t[o + 3] << 24)) >>> 0
      : ((t[o] << 24) | (t[o + 1] << 16) | (t[o + 2] << 8) | t[o + 3]) >>> 0;
  if (r16(2) !== 42) throw new Error('not TIFF');
  const readIfd = (off: number) => {
    const map = new Map<number, ParsedEntry>();
    const count = r16(off);
    if (off + 2 + count * 12 + 4 > t.length) throw new Error('IFD out of bounds');
    let lastTag = -1;
    for (let i = 0; i < count; i++) {
      const e = off + 2 + i * 12;
      const tag = r16(e);
      if (tag <= lastTag) throw new Error('IFD entries out of order');
      lastTag = tag;
      const type = r16(e + 2);
      const n = r32(e + 4);
      const size = TYPE_SIZE[type] * n;
      const at = size <= 4 ? e + 8 : r32(e + 8);
      if (at + size > t.length) throw new Error('value out of bounds');
      map.set(tag, { type, count: n, value: t.slice(at, at + size) });
    }
    return { map, next: r32(off + 2 + count * 12) };
  };
  const ifd0 = readIfd(r32(4));
  const ptr = (m: Map<number, ParsedEntry>, tag: number) => {
    const e = m.get(tag);
    return e
      ? (le
          ? e.value[0] | (e.value[1] << 8) | (e.value[2] << 16) | (e.value[3] << 24)
          : (e.value[0] << 24) | (e.value[1] << 16) | (e.value[2] << 8) | e.value[3]) >>> 0
      : 0;
  };
  const exifOff = ptr(ifd0.map, 0x8769);
  const gpsOff = ptr(ifd0.map, 0x8825);
  return {
    ifd0: ifd0.map,
    exif: exifOff ? readIfd(exifOff).map : null,
    gps: gpsOff ? readIfd(gpsOff).map : null,
    ifd1: ifd0.next ? readIfd(ifd0.next).map : null,
  };
}

export const asciiOf = (e: ParsedEntry | undefined) =>
  e ? latin1(e.value).replace(/\0+$/, '') : undefined;

// ── XMP ──────────────────────────────────────────────────────────────────────

export const XMP_PACKET = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:exif="http://ns.adobe.com/exif/1.0/"
    xmlns:tiff="http://ns.adobe.com/tiff/1.0/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
    xmlns:drone-dji="http://www.dji.com/drone-dji/1.0/"
    tiff:Make="Canon"
    exif:GPSLatitude="52,31.2057N"
    exif:GPSLongitude='13,24.0946E'
    drone-dji:GpsLatitude="52.520095"
    photoshop:City="Berlin"
    photoshop:Country="Germany">
   <exif:GPSAltitude>3456/100</exif:GPSAltitude>
   <exif:GPSAltitudeRef>0</exif:GPSAltitudeRef>
   <exif:GPSTimeStamp>2024-05-01T10:00:00Z</exif:GPSTimeStamp>
   <exif:GPSVersionID/>
   <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">© Jane Doe</rdf:li></rdf:Alt></dc:rights>
   <Iptc4xmpExt:LocationCreated>
    <rdf:Bag>
     <rdf:li rdf:parseType="Resource">
      <Iptc4xmpExt:City>Berlin</Iptc4xmpExt:City>
      <Iptc4xmpExt:GPSLatitude>52.520095</Iptc4xmpExt:GPSLatitude>
      <Iptc4xmpExt:GPSLongitude>13.401577</Iptc4xmpExt:GPSLongitude>
     </rdf:li>
    </rdf:Bag>
   </Iptc4xmpExt:LocationCreated>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

/** Strings from the packet above that must not survive. */
export const XMP_LOCATION_VALUES = [
  '52,31.2057N',
  '13,24.0946E',
  '52.520095',
  '13.401577',
  '3456/100',
];

// ── JPEG ─────────────────────────────────────────────────────────────────────

/** JPEG segment: FFxx <length incl. itself> <payload>. */
export const seg = (marker: number, payload: Uint8Array) =>
  cat(bytes(0xff, marker), be16(payload.length + 2), payload);

export const exifSegment = (tiff: Uint8Array) => seg(0xe1, cat(ascii('Exif\0\0'), tiff));
export const xmpSegment = (packet: string) =>
  seg(0xe1, cat(ascii('http://ns.adobe.com/xap/1.0/\0'), utf8(packet)));

export const SOS = cat(bytes(0xff, 0xda), be16(8), bytes(1, 1, 0, 0, 0x3f, 0));
/** Entropy-coded data with byte stuffing and a restart marker. */
export const SCAN = bytes(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0x78, 0xff, 0x00, 0x9a);
export const EOI = bytes(0xff, 0xd9);

export const ICC = cat(ascii('ICC_PROFILE\0'), bytes(1, 1), ascii('colour profile bytes'));
export const JFIF = cat(ascii('JFIF\0'), bytes(1, 2, 0, 0, 1, 0, 1, 0, 0));

/** Photoshop APP13 with an IPTC record and an EXIF resource. */
export function photoshopSegment(exif: Uint8Array) {
  const iptc = cat(bytes(0x1c, 0x02, 0x74), be16(18), ascii('Copyright Jane Doe'));
  const resource = (id: number, data: Uint8Array) =>
    cat(
      ascii('8BIM'),
      be16(id),
      bytes(0, 0),
      be32(data.length),
      data,
      data.length % 2 ? bytes(0) : bytes(),
    );
  return seg(0xed, cat(ascii('Photoshop 3.0\0'), resource(0x0404, iptc), resource(0x0422, exif)));
}

/** A JPEG as a camera or phone writes it, with a second image appended (MPF). */
export function cameraJpeg(le: boolean) {
  const primaryHead = cat(
    bytes(0xff, 0xd8),
    seg(0xe0, JFIF),
    exifSegment(cameraTiff(le)),
    xmpSegment(XMP_PACKET),
    seg(
      0xe1,
      cat(
        ascii('http://ns.adobe.com/xmp/extension/\0'),
        ascii('GUID'),
        ascii('exif:GPSLatitude="1"'),
      ),
    ),
    seg(0xe2, ICC),
    seg(
      0xeb,
      cat(
        ascii('JP'),
        bytes(0, 1),
        be32(1),
        be32(40),
        ascii('jumbjumd'),
        ascii('c2pa GPS 52.520095'),
      ),
    ),
    photoshopSegment(cameraTiff(!le)),
    seg(0xdb, bytes(0, ...new Array(64).fill(1))),
  );
  const primary = cat(primaryHead, SOS, SCAN, EOI);
  const secondary = cat(bytes(0xff, 0xd8), exifSegment(cameraTiff(le)), SOS, SCAN, EOI);
  return {
    file: cat(primary, secondary),
    primaryHeadLength: primaryHead.length,
    primaryLength: primary.length,
  };
}

/** Every APPn segment of the JPEG at `soi`, up to SOS. */
export function jpegSegments(b: Uint8Array, soi = 0) {
  const out: Array<{ marker: number; payload: Uint8Array; start: number }> = [];
  let pos = soi + 2;
  while (pos + 4 <= b.length && b[pos] === 0xff && b[pos + 1] !== 0xda) {
    const len = (b[pos + 2] << 8) | b[pos + 3];
    out.push({ marker: b[pos + 1], payload: b.slice(pos + 4, pos + 2 + len), start: pos + 4 });
    pos += 2 + len;
  }
  return out;
}

/** The TIFF block of the first EXIF APP1 in the JPEG at `soi`. */
export function exifOf(b: Uint8Array, soi = 0): Uint8Array | null {
  const s = jpegSegments(b, soi).find(
    (x) => x.marker === 0xe1 && latin1(x.payload.slice(0, 6)) === 'Exif\0\0',
  );
  return s ? s.payload.slice(6) : null;
}

// ── HEIF ─────────────────────────────────────────────────────────────────────

export const box = (type: string, ...content: Uint8Array[]) => {
  const body = cat(...content);
  return cat(be32(body.length + 8), ascii(type), body);
};

const infe = (id: number, type: string, extra: Uint8Array = bytes(0)) =>
  box('infe', bytes(2, 0, 0, 0), be16(id), be16(0), ascii(type), extra);

export const IMAGE_DATA = ascii('HEVC-IMAGE-DATA-THAT-MUST-NOT-CHANGE');

/**
 * A HEIC with an image item, an `Exif` item and an XMP `mime` item. Item data
 * goes to `mdat`, or for `idatExif` the EXIF goes into `idat` (method 1).
 * `metaLast` puts `meta` after `mdat`; `c2pa` appends a manifest `uuid` box.
 */
export function cameraHeic(
  opts: {
    le?: boolean;
    idatExif?: boolean;
    metaLast?: boolean;
    c2pa?: boolean;
    exifPayload?: Uint8Array;
  } = {},
) {
  const le = opts.le ?? false;
  const exifItem = opts.exifPayload ?? cat(be32(6), ascii('Exif\0\0'), cameraTiff(le));
  const xmpItem = utf8(XMP_PACKET);

  const ftyp = box('ftyp', ascii('heic'), be32(0), ascii('mif1heic'));
  const iinf = box(
    'iinf',
    bytes(0, 0, 0, 0),
    be16(3),
    infe(1, 'hvc1'),
    infe(2, 'Exif'),
    infe(3, 'mime', cat(bytes(0), ascii('application/rdf+xml\0'))),
  );
  // iloc v1: offset_size 4, length_size 4, base_offset_size 0, index_size 0.
  const entry = (id: number, method: number, offset: number, length: number) =>
    cat(be16(id), be16(method), be16(0), be16(1), be32(offset), be32(length));
  const buildMeta = (o: { image: number; exif: number; xmp: number }) =>
    box(
      'meta',
      bytes(0, 0, 0, 0),
      box('hdlr', bytes(0, 0, 0, 0), be32(0), ascii('pict'), be32(0), be32(0), be32(0), bytes(0)),
      iinf,
      box(
        'iloc',
        bytes(1, 0, 0, 0),
        bytes(0x44, 0x00),
        be16(3),
        entry(1, 0, o.image, IMAGE_DATA.length),
        entry(2, opts.idatExif ? 1 : 0, o.exif, exifItem.length),
        entry(3, 0, o.xmp, xmpItem.length),
      ),
      ...(opts.idatExif ? [box('idat', exifItem)] : []),
    );

  const mdatBody = opts.idatExif ? cat(IMAGE_DATA, xmpItem) : cat(IMAGE_DATA, exifItem, xmpItem);
  const metaLength = buildMeta({ image: 0, exif: 0, xmp: 0 }).length;
  const mdatStart = ftyp.length + (opts.metaLast ? 0 : metaLength) + 8;
  const offsets = {
    image: mdatStart,
    exif: opts.idatExif ? 0 : mdatStart + IMAGE_DATA.length,
    xmp: mdatStart + IMAGE_DATA.length + (opts.idatExif ? 0 : exifItem.length),
  };
  const meta = buildMeta(offsets);
  const mdat = box('mdat', mdatBody);
  const c2pa = opts.c2pa
    ? box(
        'uuid',
        bytes(
          0xd8,
          0xfe,
          0xc3,
          0xd6,
          0x1b,
          0x0e,
          0x48,
          0x3c,
          0x92,
          0x97,
          0x58,
          0x28,
          0x87,
          0x7e,
          0xc4,
          0x81,
        ),
        ascii('c2pa manifest GPS 52.520095'),
      )
    : bytes();
  const file = opts.metaLast ? cat(ftyp, mdat, meta, c2pa) : cat(ftyp, meta, mdat, c2pa);
  return { file, imageAt: offsets.image };
}

/** The TIFF block of the EXIF item, read back by its known offset prefix. */
export function heicExif(file: Uint8Array): Uint8Array | null {
  const at = indexOf(file, cat(be32(6), ascii('Exif\0\0')));
  return at < 0 ? null : file.slice(at + 10);
}

/** Feed `data` as a stream cut into `size`-byte chunks. */
export function chunked(data: Uint8Array, size: number): ReadableStream<Uint8Array> {
  let pos = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pos >= data.length) {
        controller.close();
        return;
      }
      controller.enqueue(data.slice(pos, pos + size));
      pos += size;
    },
  });
}
