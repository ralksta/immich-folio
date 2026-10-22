import { describe, it, expect } from 'vitest';
import { scrubLocationStream } from '../locationScrub';
import { findMp4Start, isLocationKey, isVideoBrand } from '../mp4Location';
import {
  ascii,
  be32,
  bytes,
  cat,
  chunked,
  contains,
  indexOf,
  latin1,
  seg,
  JFIF,
  SOS,
  SCAN,
  EOI,
  XMP_PACKET,
  utf8,
} from './fixtures/location';
import {
  C2PA_UUID,
  FRAMES,
  ISO6709,
  XMP_UUID,
  appleMeta,
  box,
  ftyp,
  itunesMeta,
  latin1Bytes,
  loci,
  make,
  mdat,
  moovWith,
  xyz,
} from './fixtures/mp4';

/**
 * Location in MP4/QuickTime videos and in the clip a motion photo appends
 * (#829). Every case runs at several chunk sizes, so a box header, a held
 * `keys` box or the `ftyp` of a motion-photo clip split across two chunks is
 * covered too.
 */

async function scrub(data: Uint8Array, size: number) {
  const result = await scrubLocationStream(chunked(data, size));
  if (!result.ok) throw new Error(result.reason);
  return {
    format: result.format,
    out: new Uint8Array(await new Response(result.stream).arrayBuffer()),
  };
}

const SIZES = [1, 3, 7, 64, 1 << 20];

/** Bytes outside the listed ranges must be identical. */
function expectOnlyChanged(before: Uint8Array, after: Uint8Array, ranges: Array<[number, number]>) {
  expect(after.length).toBe(before.length);
  for (let i = 0; i < before.length; i++) {
    if (ranges.some(([s, e]) => i >= s && i < e)) continue;
    if (after[i] !== before[i]) throw new Error(`byte ${i} changed`);
  }
}

describe('MP4 / QuickTime videos', () => {
  it.each(SIZES)(
    'zeroes ©xyz and loci, keeps camera data and the samples (chunk %i)',
    async (size) => {
      const file = cat(ftyp('qt  '), mdat(FRAMES), moovWith(xyz, loci, make));
      const { format, out } = await scrub(file, size);

      expect(format).toBe('video');
      expect(out.length).toBe(file.length);
      expect(contains(out, ascii(ISO6709))).toBe(false);
      expect(contains(out, ascii('Brandenburger Tor'))).toBe(false);
      expect(contains(out, ascii('Apple'))).toBe(true);
      // The samples, SOI look-alike included, pass untouched.
      expect(contains(out, FRAMES)).toBe(true);
      // The boxes stay where they were, renamed to `free`, so the file still
      // parses and no reader takes the zeroed `loci` for the coordinates 0/0.
      expect(contains(out, latin1Bytes('\u00a9xyz'))).toBe(false);
      expect(contains(out, ascii('loci'))).toBe(false);
      const at = indexOf(file, latin1Bytes('\u00a9xyz'));
      expect(latin1(out.subarray(at, at + 4))).toBe('free');
    },
  );

  it.each(SIZES)('handles moov before mdat (fast start, chunk %i)', async (size) => {
    const file = cat(ftyp('mp42'), moovWith(xyz), mdat(FRAMES));
    const { out } = await scrub(file, size);
    expect(contains(out, ascii(ISO6709))).toBe(false);
    expect(contains(out, FRAMES)).toBe(true);
  });

  it.each(SIZES)('zeroes Apple location keys only (chunk %i)', async (size) => {
    const file = cat(ftyp('qt  '), mdat(FRAMES), box('moov', appleMeta()));
    const { out } = await scrub(file, size);
    expect(contains(out, ascii(ISO6709))).toBe(false);
    expect(contains(out, ascii('Pariser Platz'))).toBe(false);
    expect(contains(out, ascii('Apple'))).toBe(true);
    // The key names are not the location and stay readable.
    expect(contains(out, ascii('com.apple.quicktime.location.ISO6709'))).toBe(true);
  });

  it('zeroes every indexed item when ilst comes before its keys', async () => {
    const file = cat(ftyp('qt  '), box('moov', appleMeta('ilst-first')));
    const { out } = await scrub(file, 5);
    expect(contains(out, ascii(ISO6709))).toBe(false);
    expect(contains(out, ascii('Pariser Platz'))).toBe(false);
  });

  it.each(SIZES)(
    'zeroes the iTunes-style ©xyz item and keeps the others (chunk %i)',
    async (size) => {
      const file = cat(ftyp('isom'), box('moov', box('udta', itunesMeta)), mdat(FRAMES));
      const { out } = await scrub(file, size);
      expect(contains(out, ascii(ISO6709))).toBe(false);
      expect(contains(out, ascii('Lavf61.7.100'))).toBe(true);
    },
  );

  it.each(SIZES)('scrubs XMP in udta and in a top-level uuid box (chunk %i)', async (size) => {
    const packet = utf8(XMP_PACKET);
    const file = cat(
      ftyp('mp42'),
      box('moov', box('udta', box('XMP_', packet))),
      mdat(FRAMES),
      box('uuid', XMP_UUID, packet),
    );
    const { out } = await scrub(file, size);
    expect(latin1(out)).not.toContain('GPSLatitude');
    expect(latin1(out)).toContain('tiff:Make="Canon"');
    expect(out.length).toBe(file.length);
  });

  it('zeroes a C2PA manifest box', async () => {
    const manifest = ascii('jumb c2pa.assertions stds.exif GPSLatitude 52.52');
    const file = cat(ftyp('mp42'), mdat(FRAMES), box('uuid', C2PA_UUID, manifest));
    const { out } = await scrub(file, 4);
    expect(contains(out, manifest)).toBe(false);
    expect(contains(out, C2PA_UUID)).toBe(true);
  });

  it('reads a 64-bit mdat size', async () => {
    const big = cat(be32(1), ascii('mdat'), be32(0), be32(16 + FRAMES.length), FRAMES);
    const file = cat(ftyp('qt  '), big, moovWith(xyz));
    const { out } = await scrub(file, 6);
    expect(contains(out, ascii(ISO6709))).toBe(false);
    expect(contains(out, FRAMES)).toBe(true);
  });

  it('handles QuickTime files that start without ftyp', async () => {
    const file = cat(box('wide'), mdat(FRAMES), moovWith(xyz));
    const { format, out } = await scrub(file, 3);
    expect(format).toBe('video');
    expect(contains(out, ascii(ISO6709))).toBe(false);
  });

  it('zeroes the rest of a udta it cannot read', async () => {
    const broken = cat(be32(0xffff), ascii('©xy'), ascii(ISO6709)); // overruns its parent
    const udta = box('udta', broken);
    const file = cat(ftyp('qt  '), box('moov', udta), mdat(FRAMES));
    const { out } = await scrub(file, 4);
    expect(contains(out, ascii(ISO6709))).toBe(false);
    expect(contains(out, FRAMES)).toBe(true);
  });

  it('changes nothing in a video without location', async () => {
    const file = cat(ftyp('mp42'), box('moov', box('udta', make)), mdat(FRAMES));
    const { out } = await scrub(file, 3);
    expect(out).toEqual(file);
  });
});

describe('motion photos', () => {
  /** A JPEG with the clip appended after its EOI, as Samsung and Pixel write it. */
  function motionPhoto(clip: Uint8Array, marker = ascii('MotionPhoto_Data')) {
    const jpeg = cat(bytes(0xff, 0xd8), seg(0xe0, JFIF), SOS, SCAN, EOI);
    return { jpeg, file: cat(jpeg, marker, clip) };
  }

  it.each(SIZES)('zeroes the location in the appended clip (chunk %i)', async (size) => {
    const clip = cat(ftyp('mp42'), mdat(FRAMES), moovWith(xyz, loci));
    const { file } = motionPhoto(clip);
    const { format, out } = await scrub(file, size);
    expect(format).toBe('jpeg');
    expect(out.length).toBe(file.length);
    expect(contains(out, ascii(ISO6709))).toBe(false);
    expect(contains(out, ascii('Brandenburger Tor'))).toBe(false);
  });

  it('does not mistake SOI-like bytes in the clip for a JPEG', async () => {
    // FRAMES holds FF D8 FF E1 ...: read as an embedded JPEG, its "APP1" would
    // be zeroed and the video damaged.
    const clip = cat(ftyp('mp42'), mdat(FRAMES), moovWith(xyz));
    const { file } = motionPhoto(clip);
    const { out } = await scrub(file, 5);
    expect(contains(out, FRAMES)).toBe(true);
  });

  it('passes a vendor trailer after the clip through unchanged', async () => {
    const clip = cat(ftyp('mp42'), moovWith(xyz), mdat(FRAMES));
    const sef = cat(ascii('SEFH'), bytes(0x01, 0x00, 0x00, 0x00, 0x02), ascii('\x01\x02SEFT'));
    const { jpeg, file } = motionPhoto(cat(clip, sef));
    const { out } = await scrub(file, 7);
    const changed: Array<[number, number]> = [[jpeg.length, jpeg.length + 16 + clip.length]];
    expectOnlyChanged(file, out, changed);
    expect(out.subarray(out.length - sef.length)).toEqual(sef);
  });
});

describe('helpers', () => {
  it('recognises location keys', () => {
    expect(isLocationKey('com.apple.quicktime.location.ISO6709')).toBe(true);
    expect(isLocationKey('com.android.capture.gps')).toBe(true);
    expect(isLocationKey('©xyz')).toBe(true);
    expect(isLocationKey('com.apple.quicktime.make')).toBe(false);
  });

  it('tells video brands from still-image ones', () => {
    for (const brand of ['isom', 'iso6', 'mp41', 'mp42', 'qt  ', 'M4V ', '3gp5', 'avc1']) {
      expect(isVideoBrand(brand), brand).toBe(true);
    }
    for (const brand of ['heic', 'mif1', 'avif', 'jxl ', 'crx ']) {
      expect(isVideoBrand(brand), brand).toBe(false);
    }
  });

  it('finds the clip by its ftyp, not by a stray "ftyp" in other data', () => {
    const clip = ftyp('mp42');
    const trailer = cat(ascii('noise ftyp here'), ascii('MotionPhoto_Data'), clip);
    expect(findMp4Start(trailer, 0)).toBe(trailer.length - clip.length);
  });
});
