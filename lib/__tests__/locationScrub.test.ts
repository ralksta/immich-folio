import { describe, it, expect } from 'vitest';
import {
  scrubLocation,
  scrubLocationStream,
  scrubTiffGps,
  scrubXmpLocation,
  isLocationScrubbable,
  Pending,
  HEAD_CAP,
} from '../locationScrub';
import {
  ALT,
  ICC,
  JFIF,
  LAT,
  LON,
  SCAN,
  XMP_LOCATION_VALUES,
  XMP_PACKET,
  ascii,
  asciiOf,
  be32,
  bytes,
  cameraHeic,
  cameraJpeg,
  cameraTiff,
  cat,
  chunked,
  contains,
  exifOf,
  exifSegment,
  heicExif,
  indexOf,
  jpegSegments,
  latin1,
  parseTiff,
  seg,
  SOS,
  EOI,
  utf8,
  xmpSegment,
  be16,
} from './fixtures/location';

const LAT_BYTES = (le: boolean) => LAT.value(le);
const LON_BYTES = (le: boolean) => LON.value(le);
const ALT_BYTES = (le: boolean) => ALT.value(le);

/** Run the stream scrubber over `data`, delivered in `size`-byte chunks. */
async function viaStream(data: Uint8Array, size: number): Promise<Uint8Array | null> {
  const result = await scrubLocationStream(chunked(data, size));
  if (!result.ok) return null;
  return new Uint8Array(await new Response(result.stream).arrayBuffer());
}

/** Camera data that must come through untouched. */
function expectCameraData(tiff: Uint8Array) {
  const t = parseTiff(tiff);
  expect(asciiOf(t.ifd0.get(0x010f))).toBe('Canon');
  expect(asciiOf(t.ifd0.get(0x0110))).toBe('Canon EOS R5');
  expect(asciiOf(t.ifd0.get(0x8298))).toBe('(c) Jane Doe');
  expect(asciiOf(t.exif?.get(0xa434))).toBe('RF24-70mm F2.8 L IS USM');
  expect(t.exif?.get(0x8827)).toBeDefined();
  expect(t.ifd1?.get(0x0103)).toBeDefined(); // IFD1 still chained
  return t;
}

function expectNoGps(tiff: Uint8Array, le: boolean) {
  const t = parseTiff(tiff);
  expect(t.ifd0.has(0x8825)).toBe(false);
  expect(t.exif?.has(0x8825)).toBe(false);
  expect(t.gps).toBeNull();
  expect(contains(tiff, LAT_BYTES(le))).toBe(false);
  expect(contains(tiff, LON_BYTES(le))).toBe(false);
  expect(contains(tiff, ALT_BYTES(le))).toBe(false);
}

function expectXmpScrubbed(text: string) {
  expect(text).not.toMatch(/:GPS|:Gps/);
  for (const v of XMP_LOCATION_VALUES) expect(text).not.toContain(v);
  expect(text).toContain('photoshop:City="Berlin"');
  expect(text).toContain('photoshop:Country="Germany"');
  expect(text).toContain('<Iptc4xmpExt:City>Berlin</Iptc4xmpExt:City>');
  expect(text).toContain('© Jane Doe');
  expect(text).toContain('tiff:Make="Canon"');
}

describe('scrubTiffGps', () => {
  for (const le of [true, false]) {
    const order = le ? 'little-endian (II)' : 'big-endian (MM)';

    it(`removes the GPS IFD and keeps the camera tags, ${order}`, () => {
      const tiff = cameraTiff(le);
      const before = parseTiff(tiff);
      expect(before.gps?.get(0x0002)).toBeDefined(); // the fixture really has GPS

      const out = tiff.slice();
      expect(scrubTiffGps(out, 0, out.length)).toBe(true);
      expect(out.length).toBe(tiff.length);
      expectNoGps(out, le);
      const after = expectCameraData(out);
      // Values are byte-identical, not just present.
      for (const tag of [0x010f, 0x0110, 0x0112, 0x8298]) {
        expect(after.ifd0.get(tag)).toEqual(before.ifd0.get(tag));
      }
      expect(after.exif).toEqual(before.exif);
    });

    it(`leaves a file without GPS byte-identical, ${order}`, () => {
      const tiff = cameraTiff(le, { withGps: false });
      const out = tiff.slice();
      expect(scrubTiffGps(out, 0, out.length)).toBe(true);
      expect(out).toEqual(tiff);
    });
  }

  it('scrubs XMP embedded in TIFF tag 700', () => {
    const tiff = cameraTiff(false, { xmp: utf8(XMP_PACKET) });
    const out = tiff.slice();
    expect(scrubTiffGps(out, 0, out.length)).toBe(true);
    const xmp = parseTiff(out).ifd0.get(0x02bc)!;
    expectXmpScrubbed(Buffer.from(xmp.value).toString('utf8'));
  });

  it('refuses what it cannot walk', () => {
    const bad = (mutate: (t: Uint8Array) => void) => {
      const t = cameraTiff(true);
      mutate(t);
      return scrubTiffGps(t, 0, t.length);
    };
    expect(bad((t) => t.set(ascii('XX'), 0))).toBe(false); // byte order
    expect(bad((t) => (t[2] = 43))).toBe(false); // BigTIFF
    expect(bad((t) => t.set([0xff, 0xff, 0, 0], 4))).toBe(false); // IFD0 out of range
    expect(scrubTiffGps(bytes(0x49, 0x49), 0, 2)).toBe(false);
  });

  it('refuses a GPS IFD whose values point outside the block', () => {
    const t = cameraTiff(false);
    const gps = parseTiff(t);
    expect(gps.gps).not.toBeNull();
    // Find the GPSLatitude entry (tag 2, RATIONAL) and point it past the end.
    const entry = indexOf(t, bytes(0x00, 0x02, 0x00, 0x05, 0x00, 0x00, 0x00, 0x03));
    t.set(be32(0x7fffffff), entry + 8);
    expect(scrubTiffGps(t, 0, t.length)).toBe(false);
  });
});

describe('scrubXmpLocation', () => {
  it('blanks every location property, keeps the length and the rest', () => {
    const packet = utf8(XMP_PACKET);
    const out = packet.slice();
    expect(scrubXmpLocation(out, 0, out.length)).toBe(true);
    expect(out.length).toBe(packet.length);
    expectXmpScrubbed(Buffer.from(out).toString('utf8'));
  });

  it('leaves a packet without location untouched', () => {
    const packet = utf8('<x:xmpmeta><rdf:Description photoshop:City="Berlin"/></x:xmpmeta>');
    const out = packet.slice();
    expect(scrubXmpLocation(out, 0, out.length)).toBe(true);
    expect(out).toEqual(packet);
  });

  it('refuses an unclosed location element', () => {
    const out = utf8('<rdf:Description><exif:GPSLatitude>52,31N</rdf:Description>');
    expect(scrubXmpLocation(out, 0, out.length)).toBe(false);
  });

  it('refuses UTF-16, which it cannot read byte-wise', () => {
    const out = new Uint8Array(Buffer.from('<exif:GPSLatitude>1</exif:GPSLatitude>', 'utf16le'));
    expect(scrubXmpLocation(out, 0, out.length)).toBe(false);
  });

  it('tolerates trailing NUL padding', () => {
    const out = cat(utf8('<a exif:GPSLatitude="1"/>'), bytes(0, 0, 0));
    expect(scrubXmpLocation(out, 0, out.length)).toBe(true);
    expect(latin1(out)).not.toContain('GPS');
  });
});

describe('JPEG', () => {
  for (const le of [true, false]) {
    const order = le ? 'little-endian' : 'big-endian';

    it(`removes location and keeps everything else, ${order} EXIF`, async () => {
      const { file, primaryHeadLength, primaryLength } = cameraJpeg(le);
      const out = (await scrubLocation(file))!;
      expect(out).not.toBeNull();
      expect(out.length).toBe(file.length);

      // EXIF: GPS gone, camera data intact.
      const tiff = exifOf(out)!;
      expectNoGps(tiff, le);
      expectCameraData(tiff);

      // XMP: GPS gone, city/country/rights intact.
      const xmp = jpegSegments(out).find((s) =>
        latin1(s.payload).startsWith('http://ns.adobe.com/xap/1.0/'),
      )!;
      expectXmpScrubbed(Buffer.from(xmp.payload).toString('utf8'));

      // JFIF and ICC are byte-identical.
      const segs = jpegSegments(out);
      expect(segs.find((s) => s.marker === 0xe0)!.payload).toEqual(JFIF);
      expect(segs.find((s) => s.marker === 0xe2)!.payload).toEqual(ICC);

      // Extended XMP and the C2PA manifest are zeroed whole.
      const ext = segs.filter((s) => s.marker === 0xe1)[2];
      expect(ext.payload.every((x) => x === 0)).toBe(true);
      const jumbf = segs.find((s) => s.marker === 0xeb)!;
      expect(jumbf.payload.every((x) => x === 0)).toBe(true);

      // APP13: the IPTC record stays, its EXIF resource loses GPS.
      const app13 = segs.find((s) => s.marker === 0xed)!;
      expect(latin1(app13.payload)).toContain('Copyright Jane Doe');
      const irbExif = app13.payload.slice(indexOf(app13.payload, ascii(le ? 'MM' : 'II')));
      expectNoGps(irbExif, !le);
      expectCameraData(irbExif);

      // Scan data and everything after the primary head is identical apart
      // from the appended image's metadata.
      expect(out.slice(primaryHeadLength, primaryLength)).toEqual(
        file.slice(primaryHeadLength, primaryLength),
      );

      // The appended (MPF) image: GPS gone there too, camera data kept.
      const second = exifOf(out, primaryLength)!;
      expectNoGps(second, le);
      expectCameraData(second);
      expect(out.slice(out.length - SCAN.length - 2)).toEqual(
        file.slice(file.length - SCAN.length - 2),
      );

      // Nothing location-shaped anywhere in the file.
      const text = latin1(out);
      expect(text).not.toContain('52.520095');
      expect(contains(out, LAT_BYTES(le))).toBe(false);
      expect(contains(out, LAT_BYTES(!le))).toBe(false);
    });
  }

  it('gives the same bytes however the stream is chunked', async () => {
    const { file } = cameraJpeg(true);
    const whole = (await scrubLocation(file))!;
    for (const size of [1, 2, 3, 7, 64, 1000, 4096]) {
      expect(await viaStream(file, size)).toEqual(whole);
    }
  });

  it('zeroes an EXIF segment it cannot parse, and only that segment', async () => {
    const broken = cat(ascii('MM'), bytes(0, 42), be32(0x7fffff00), ascii('GPS 52.520095'));
    const file = cat(
      bytes(0xff, 0xd8),
      seg(0xe0, JFIF),
      exifSegment(broken),
      xmpSegment(XMP_PACKET),
      seg(0xe2, ICC),
      SOS,
      SCAN,
      EOI,
    );
    const out = (await scrubLocation(file))!;
    expect(out.length).toBe(file.length);
    const segs = jpegSegments(out);
    expect(segs[1].payload.every((x) => x === 0)).toBe(true);
    expectXmpScrubbed(Buffer.from(segs[2].payload).toString('utf8'));
    expect(segs[3].payload).toEqual(ICC);
    expect(latin1(out)).not.toContain('52.520095');
  });

  it('zeroes an unknown APP1 in the primary image', async () => {
    const file = cat(bytes(0xff, 0xd8), seg(0xe1, ascii('FLIR\0GPS 52.520095')), SOS, SCAN, EOI);
    const out = (await scrubLocation(file))!;
    expect(latin1(out)).not.toContain('52.520095');
  });

  it('accepts fill bytes before a marker', async () => {
    const file = cat(bytes(0xff, 0xd8, 0xff, 0xff), exifSegment(cameraTiff(true)), SOS, SCAN, EOI);
    const out = (await scrubLocation(file))!;
    expect(out).not.toBeNull();
    expectNoGps(exifOf(cat(bytes(0xff, 0xd8), out.slice(4)))!, true);
  });

  it('refuses a JPEG whose head never reaches the image data', async () => {
    const truncated = cat(bytes(0xff, 0xd8), exifSegment(cameraTiff(true))).slice(0, 60);
    expect(await scrubLocation(truncated)).toBeNull();
    const noSos = cat(bytes(0xff, 0xd8), seg(0xe0, JFIF));
    expect(await scrubLocation(noSos)).toBeNull();
    const garbage = cat(bytes(0xff, 0xd8), seg(0xe0, JFIF), bytes(0x12, 0x34, 0x56, 0x78));
    expect(await scrubLocation(garbage)).toBeNull();
  });
});

describe('HEIF / AVIF', () => {
  const check = (out: Uint8Array, file: Uint8Array, imageAt: number, le: boolean) => {
    expect(out.length).toBe(file.length);
    const tiff = heicExif(out)!;
    expect(tiff).not.toBeNull();
    expectNoGps(tiff, le);
    expectCameraData(tiff);
    expectXmpScrubbed(latin1(out.slice(indexOf(out, ascii('<?xpacket')))));
    expect(out.slice(imageAt, imageAt + 20)).toEqual(file.slice(imageAt, imageAt + 20));
  };

  for (const le of [true, false]) {
    it(`removes location from the Exif and XMP items, ${le ? 'II' : 'MM'}`, async () => {
      const { file, imageAt } = cameraHeic({ le });
      check((await scrubLocation(file))!, file, imageAt, le);
    });
  }

  it('handles EXIF stored in idat (construction method 1)', async () => {
    const { file, imageAt } = cameraHeic({ idatExif: true });
    check((await scrubLocation(file))!, file, imageAt, false);
  });

  it('handles a meta box after mdat', async () => {
    const { file, imageAt } = cameraHeic({ metaLast: true });
    check((await scrubLocation(file))!, file, imageAt, false);
  });

  it('zeroes a C2PA manifest box', async () => {
    const { file } = cameraHeic({ c2pa: true });
    const out = (await scrubLocation(file))!;
    expect(latin1(out)).not.toContain('52.520095');
    expect(latin1(out)).not.toContain('c2pa manifest');
  });

  it('gives the same bytes however the stream is chunked', async () => {
    const { file } = cameraHeic({ c2pa: true });
    const whole = (await scrubLocation(file))!;
    for (const size of [1, 5, 13, 100, 4096]) {
      expect(await viaStream(file, size)).toEqual(whole);
    }
    const { file: last } = cameraHeic({ metaLast: true, c2pa: true });
    const lastWhole = (await scrubLocation(last))!;
    for (const size of [1, 7, 333]) {
      expect(await viaStream(last, size)).toEqual(lastWhole);
    }
  });

  it('zeroes an Exif item it cannot parse', async () => {
    const payload = cat(be32(6), ascii('Exif\0\0'), ascii('XXnot-a-tiff GPS 52.520095'));
    const { file } = cameraHeic({ exifPayload: payload });
    const out = (await scrubLocation(file))!;
    expect(out.length).toBe(file.length);
    expect(latin1(out)).not.toContain('52.520095');
    expect(latin1(out)).not.toContain('not-a-tiff');
  });

  it('refuses a file whose meta box cannot be parsed', async () => {
    const { file } = cameraHeic();
    const broken = file.slice();
    const iloc = indexOf(broken, ascii('iloc'));
    broken.set([0xff, 0xff], iloc + 4 + 4 + 2); // item_count far beyond the box
    expect(await scrubLocation(broken)).toBeNull();
  });

  it('refuses a truncated meta box', async () => {
    const { file } = cameraHeic();
    const meta = indexOf(file, ascii('meta'));
    expect(await scrubLocation(file.slice(0, meta + 40))).toBeNull();
  });
});

describe('other formats', () => {
  it('passes PNG, TIFF/DNG, video and unknown bytes through unchanged', async () => {
    const samples = [
      cat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), ascii('IHDR...GPS')),
      cameraTiff(true),
      cat(be32(20), ascii('ftypqt  '), be32(0), ascii('qt  '), ascii('moov....')),
      ascii('image-bytes'),
      bytes(),
    ];
    for (const sample of samples) {
      const result = await scrubLocationStream(chunked(sample, 3));
      expect(result.ok && result.format).toBe('passthrough');
      expect(await viaStream(sample, 3)).toEqual(sample);
    }
  });

  it('reports which formats it edits', async () => {
    const jpeg = await scrubLocationStream(
      chunked(cat(bytes(0xff, 0xd8), seg(0xe0, JFIF), SOS, EOI), 4),
    );
    expect(jpeg.ok && jpeg.format).toBe('jpeg');
    const heic = await scrubLocationStream(chunked(cameraHeic().file, 4));
    expect(heic.ok && heic.format).toBe('heif');
  });
});

describe('isLocationScrubbable', () => {
  it('judges by the original MIME type, then the file name', () => {
    expect(isLocationScrubbable({ type: 'IMAGE', originalMimeType: 'image/jpeg' })).toBe(true);
    expect(isLocationScrubbable({ type: 'IMAGE', originalMimeType: 'image/heic' })).toBe(true);
    expect(isLocationScrubbable({ type: 'IMAGE', originalMimeType: 'image/avif' })).toBe(true);
    expect(isLocationScrubbable({ type: 'IMAGE', originalMimeType: 'image/x-adobe-dng' })).toBe(
      false,
    );
    expect(isLocationScrubbable({ type: 'IMAGE', originalMimeType: 'image/png' })).toBe(false);
    expect(isLocationScrubbable({ type: 'VIDEO', originalMimeType: 'video/mp4' })).toBe(false);
    expect(isLocationScrubbable({ type: 'IMAGE', originalFileName: 'IMG_0001.HEIC' })).toBe(true);
    expect(isLocationScrubbable({ type: 'IMAGE', originalFileName: 'DSC_0001.NEF' })).toBe(false);
  });
});

describe('XMP matching stays linear', () => {
  const time = (packet: string) => {
    const b = utf8(packet);
    const started = performance.now();
    const ok = scrubXmpLocation(b, 0, b.length);
    return { ok, ms: performance.now() - started, text: latin1(b) };
  };

  it('scans long name runs without retrying at every character', () => {
    for (const size of [64 * 1024, 1024 * 1024]) {
      const run = time(`<x:xmpmeta exif:GPSLatitude="1">${'a'.repeat(size)}</x:xmpmeta>`);
      expect(run.ok).toBe(true);
      expect(run.text).not.toContain('GPS');
      expect(run.ms).toBeLessThan(100);

      const colons = time(`<x:xmpmeta exif:GPSLatitude="1">${'a:'.repeat(size / 2)}</x:xmpmeta>`);
      expect(colons.ok).toBe(true);
      expect(colons.ms).toBeLessThan(100);
    }
  });

  it('blanks deeply nested location elements in one pass', () => {
    const depth = 20000;
    const nested = time(
      `<x:xmpmeta>${'<exif:GPSArea>'.repeat(depth)}${'</exif:GPSArea>'.repeat(depth)}</x:xmpmeta>`,
    );
    expect(nested.ok).toBe(true);
    expect(nested.text).not.toContain('GPS');
    expect(nested.ms).toBeLessThan(100);
  });
});

describe('place names below city level', () => {
  const STREET = 'Hauptstrasse 12';

  it('blanks sub-city XMP place names and keeps city, state and country', () => {
    const packet = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description rdf:about=""
      Iptc4xmpCore:Location="${STREET}"
      Iptc4xmpCore:CountryCode="DE"
      photoshop:City="Berlin" photoshop:State="Berlin" photoshop:Country="Germany">
     <xmpDM:shotLocation>${STREET}</xmpDM:shotLocation>
     <Iptc4xmpExt:LocationShown><rdf:Bag><rdf:li rdf:parseType="Resource">
      <Iptc4xmpExt:Sublocation>${STREET}</Iptc4xmpExt:Sublocation>
      <Iptc4xmpExt:LocationName>Café am Markt</Iptc4xmpExt:LocationName>
      <Iptc4xmpExt:City>Berlin</Iptc4xmpExt:City>
      <Iptc4xmpExt:ProvinceState>Berlin</Iptc4xmpExt:ProvinceState>
      <Iptc4xmpExt:CountryName>Germany</Iptc4xmpExt:CountryName>
      <Iptc4xmpExt:CountryCode>DE</Iptc4xmpExt:CountryCode>
     </rdf:li></rdf:Bag></Iptc4xmpExt:LocationShown>
    </rdf:Description></rdf:RDF></x:xmpmeta>`;
    const b = utf8(packet);
    expect(scrubXmpLocation(b, 0, b.length)).toBe(true);
    const text = Buffer.from(b).toString('utf8');
    expect(b.length).toBe(utf8(packet).length);
    expect(text).not.toContain(STREET);
    expect(text).not.toContain('Café am Markt');
    expect(text).not.toMatch(/:(Sub)?[Ll]ocation\b|shotLocation|LocationName/);
    for (const kept of [
      'Iptc4xmpCore:CountryCode="DE"',
      'photoshop:City="Berlin"',
      'photoshop:State="Berlin"',
      'photoshop:Country="Germany"',
      '<Iptc4xmpExt:City>Berlin</Iptc4xmpExt:City>',
      '<Iptc4xmpExt:ProvinceState>Berlin</Iptc4xmpExt:ProvinceState>',
      '<Iptc4xmpExt:CountryName>Germany</Iptc4xmpExt:CountryName>',
      '<Iptc4xmpExt:CountryCode>DE</Iptc4xmpExt:CountryCode>',
      '<Iptc4xmpExt:LocationShown>',
    ]) {
      expect(text).toContain(kept);
    }
  });

  it('blanks the IIM sub-location (2:92) in place and keeps the rest of the record', async () => {
    const dataset = (n: number, value: string) =>
      cat(bytes(0x1c, 0x02, n), be16(value.length), ascii(value));
    const iim = cat(
      dataset(90, 'Berlin'),
      dataset(92, STREET),
      dataset(101, 'Germany'),
      dataset(116, 'Copyright Jane Doe'),
    );
    const irb = cat(
      ascii('Photoshop 3.0\0'),
      ascii('8BIM'),
      be16(0x0404),
      bytes(0, 0),
      be32(iim.length),
      iim,
      iim.length % 2 ? bytes(0) : bytes(),
    );
    const file = cat(bytes(0xff, 0xd8), seg(0xed, irb), SOS, SCAN, EOI);
    const out = (await scrubLocation(file))!;
    expect(out.length).toBe(file.length);
    const text = latin1(out);
    expect(text).not.toContain(STREET);
    expect(text).toContain(`\x1c\x02\x5c\x00\x0f${' '.repeat(STREET.length)}`);
    for (const kept of ['Berlin', 'Germany', 'Copyright Jane Doe']) expect(text).toContain(kept);
  });
});

describe('vendor APPn segments', () => {
  const GOPRO = cat(ascii('GoPro\0'), ascii('GPS5 52.520095 13.401577'));
  const KODAK = cat(ascii('Meta\0\0'), ascii('GPS 52.520095'));
  const MPF = cat(ascii('MPF\0'), ascii('MM'), bytes(0, 42), be32(8), ascii('mp-index'));
  const ADOBE = cat(ascii('Adobe'), bytes(0, 100, 0, 0, 0, 0, 1));

  const head = () =>
    cat(
      seg(0xe0, JFIF),
      seg(0xe2, MPF),
      seg(0xe2, ICC),
      seg(0xe3, KODAK),
      seg(0xe6, GOPRO),
      seg(0xe0, ascii('AVI1\0GPS 52.520095')),
      seg(0xee, ADOBE),
    );

  const check = (out: Uint8Array, soi: number) => {
    const segs = jpegSegments(out, soi);
    const payload = (marker: number, n = 0) => segs.filter((x) => x.marker === marker)[n].payload;
    expect(payload(0xe0)).toEqual(JFIF);
    expect(payload(0xe2, 0)).toEqual(MPF);
    expect(payload(0xe2, 1)).toEqual(ICC);
    expect(payload(0xee)).toEqual(ADOBE);
    for (const zeroed of [payload(0xe3), payload(0xe6), payload(0xe0, 1)]) {
      expect(zeroed.every((x) => x === 0)).toBe(true);
    }
  };

  it('zeroes APPn segments off the allowlist and keeps JFIF, ICC, MPF and Adobe', async () => {
    const primary = cat(bytes(0xff, 0xd8), head(), SOS, SCAN, EOI);
    const secondary = cat(bytes(0xff, 0xd8), head(), SOS, SCAN, EOI);
    const file = cat(primary, secondary);
    const out = (await scrubLocation(file))!;
    expect(out.length).toBe(file.length);
    expect(latin1(out)).not.toContain('52.520095');
    check(out, 0);
    check(out, primary.length);
    for (const size of [1, 9, 100]) expect(await viaStream(file, size)).toEqual(out);
  });
});

describe('progressive JPEG', () => {
  const DHT = seg(0xc4, bytes(0x10, ...new Array(16).fill(0), 0));

  it('scrubs an APPn segment between scans, and only inside the image', async () => {
    const trailer = cat(ascii('TRAILER'), bytes(0xff, 0xe1, 0x00, 0x10), ascii('not a segment!'));
    const file = cat(
      bytes(0xff, 0xd8),
      seg(0xe0, JFIF),
      SOS,
      SCAN,
      exifSegment(cameraTiff(true)),
      xmpSegment(XMP_PACKET),
      seg(0xe6, ascii('GoPro\0GPS5')),
      DHT,
      SOS,
      SCAN,
      EOI,
      trailer,
    );
    const out = (await scrubLocation(file))!;
    expect(out.length).toBe(file.length);
    const between = indexOf(out, ascii('Exif\0\0'));
    const tiff = parseTiff(out.slice(between + 6));
    expect(tiff.gps).toBeNull();
    expect(asciiOf(tiff.ifd0.get(0x010f))).toBe('Canon');
    expect(latin1(out)).not.toMatch(/exif:GPS|GoPro/);
    // Bytes after EOI that merely look like a marker are not touched.
    expect(out.slice(out.length - trailer.length)).toEqual(trailer);
    for (const size of [1, 3, 50, 777]) expect(await viaStream(file, size)).toEqual(out);
  });
});

describe('padding between segments', () => {
  it('accepts NUL padding and FF fill bytes between segments', async () => {
    const file = cat(
      bytes(0xff, 0xd8),
      seg(0xe0, JFIF),
      bytes(0, 0, 0),
      exifSegment(cameraTiff(false)),
      bytes(0xff, 0xff, 0xff),
      seg(0xe2, ICC),
      bytes(0x00),
      SOS,
      SCAN,
      EOI,
    );
    const out = (await scrubLocation(file))!;
    expect(out).not.toBeNull();
    expect(out.length).toBe(file.length);
    expect(contains(out, LAT_BYTES(false))).toBe(false);
    expect(latin1(out)).toContain('Canon EOS R5');
    expect(contains(out, ICC)).toBe(true);
  });
});

describe('Pending', () => {
  it('never allocates more than the head cap plus one chunk', () => {
    const pending = new Pending();
    const chunk = new Uint8Array(1024 * 1024);
    while (pending.length < HEAD_CAP) pending.push(chunk);
    pending.push(chunk);
    expect(pending.capacity).toBeLessThanOrEqual(HEAD_CAP + chunk.length);
  });
});
