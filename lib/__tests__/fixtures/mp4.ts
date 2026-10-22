/**
 * MP4/QuickTime box builders for the location tests (#829): a file is put
 * together box by box, so a test names exactly the metadata it is about.
 */

import { ascii, be16, be32, bytes, cat, seg, SOS, EOI, utf8 } from './location';

export const box = (type: string, ...payload: Uint8Array[]) => {
  const body = cat(...payload);
  return cat(be32(8 + body.length), latin1Bytes(type), body);
};
/** Box types can contain `©` (0xA9), which `ascii` would mangle. */
export const latin1Bytes = (s: string) => Uint8Array.from(Buffer.from(s, 'latin1'));
export const fullBox = (type: string, ...payload: Uint8Array[]) =>
  box(type, bytes(0, 0, 0, 0), ...payload);

export const ISO6709 = '+52.5200+013.4050+034.000/';
/** QuickTime `©xyz`: 16-bit length, 16-bit language, the string. */
export const xyz = box('©xyz', be16(ISO6709.length), be16(0x15c7), ascii(ISO6709));
/** 3GPP `loci`: version/flags, language, name, role, fixed-point coordinates. */
export const loci = fullBox(
  'loci',
  be16(0x15c7),
  ascii('Brandenburger Tor\0'),
  bytes(0),
  be32(0x000d0000), // longitude 13.0
  be32(0x00340000), // latitude 52.0
  be32(0x00220000), // altitude 34.0
  ascii('Earth\0'),
  ascii('\0'),
);
export const make = box('©mak', be16(5), be16(0x15c7), ascii('Apple'));

export const ftyp = (brand: string) =>
  box('ftyp', ascii(brand), be32(0), ascii(brand), ascii('isom'));
export const mdat = (fill: Uint8Array) => box('mdat', fill);
export const hdlr = (handler: string) =>
  fullBox('hdlr', be32(0), ascii(handler), bytes(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), ascii('\0'));

/** An `ilst` value: `data` box with type (1 = UTF-8) and locale before the value. */
export const dataBox = (value: string) => box('data', be32(1), be32(0), utf8(value));

/** Apple QuickTime metadata: keys named by index, values in `ilst`. */
export function appleMeta(order: 'keys-first' | 'ilst-first' = 'keys-first') {
  const keyEntry = (name: string) => cat(be32(8 + name.length), ascii('mdta'), ascii(name));
  const keys = fullBox(
    'keys',
    be32(3),
    keyEntry('com.apple.quicktime.make'),
    keyEntry('com.apple.quicktime.location.ISO6709'),
    keyEntry('com.apple.quicktime.location.name'),
  );
  const item = (index: number, value: string) =>
    cat(be32(8 + dataBox(value).length), be32(index), dataBox(value));
  const ilst = box('ilst', item(1, 'Apple'), item(2, ISO6709), item(3, 'Pariser Platz'));
  return box('meta', hdlr('mdta'), ...(order === 'keys-first' ? [keys, ilst] : [ilst, keys]));
}

/** iTunes-style metadata: an ISO FullBox `meta` with `ilst` items named by fourcc. */
export const itunesMeta = fullBox(
  'meta',
  hdlr('mdir'),
  box('ilst', box('©xyz', dataBox(ISO6709)), box('©too', dataBox('Lavf61.7.100'))),
);

export const XMP_UUID = Buffer.from('be7acfcb97a942e89c71999491e3afac', 'hex');
export const C2PA_UUID = Buffer.from('d8fec3d61b0e483c92975828877ec481', 'hex');

/**
 * A picture-like fill for `mdat` containing what parses as a JPEG head: SOI,
 * a vendor APP6 segment (which the JPEG scrubber zeroes) and SOS. Read as an
 * embedded JPEG, the "GPMF" bytes would be wiped and the video damaged.
 */
export const FAKE_JPEG = cat(
  bytes(0xff, 0xd8),
  seg(0xe6, ascii('GPMFsample')),
  SOS,
  bytes(0x11, 0x22),
  EOI,
);
export const FRAMES = cat(bytes(0x00, 0x00, 0x01, 0x65), FAKE_JPEG, ascii('picture data'));

export const moovWith = (...udta: Uint8Array[]) =>
  box(
    'moov',
    fullBox('mvhd', bytes(...new Array(96).fill(0))),
    box('trak', box('mdia', box('minf', box('stbl', box('stco', be32(0))))), box('udta', xyz)),
    box('udta', ...udta),
  );
