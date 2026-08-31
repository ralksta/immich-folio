import { describe, it, expect } from 'vitest';
import {
  findJpegMetadataRanges,
  findIsobmffMetadataRanges,
  findMetadataRanges,
  stripMetadata,
  isStrippable,
} from '../metadataStrip';

// ── kleine Bau-Helfer ───────────────────────────────────────────────────────

const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const bytes = (...n: number[]) => new Uint8Array(n);
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const be16 = (n: number) => bytes((n >> 8) & 0xff, n & 0xff);
const be32 = (n: number) => bytes((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);

/** JPEG-Segment: FFxx <len inkl. Längenfeld> <payload> */
const seg = (marker: number, payload: Uint8Array) =>
  cat(bytes(0xff, marker), be16(payload.length + 2), payload);

/** ISOBMFF-Box mit korrekt berechneter Größe. */
const box = (type: string, ...content: Uint8Array[]) => {
  const body = cat(...content);
  return cat(be32(body.length + 8), ascii(type), body);
};

describe('isStrippable', () => {
  it('kennt JPEG und die ISOBMFF-Familie', () => {
    expect(isStrippable('image/jpeg')).toBe(true);
    expect(isStrippable('IMAGE/AVIF')).toBe(true);
    expect(isStrippable('image/jpeg; charset=binary')).toBe(true);
    expect(isStrippable('image/png')).toBe(false);
    expect(isStrippable('application/octet-stream')).toBe(false);
  });
});

describe('JPEG', () => {
  const exifPayload = cat(ascii('Exif\0\0'), ascii('MM\0*GPS 54.156, 15.3717'));
  const iccPayload = cat(ascii('ICC_PROFILE\0'), bytes(1, 1, 2, 3, 4, 5));
  const jfifPayload = cat(ascii('JFIF\0'), bytes(1, 2, 0, 0, 1, 0, 1, 0, 0));
  const bildDaten = bytes(0x12, 0x34, 0x56, 0x78, 0x9a);

  const bauJpeg = () =>
    cat(
      bytes(0xff, 0xd8), // SOI
      seg(0xe0, jfifPayload), // APP0 JFIF   — bleibt
      seg(0xe1, exifPayload), // APP1 EXIF    — muss weg
      seg(0xe2, iccPayload), // APP2 ICC     — bleibt (Farbprofil!)
      seg(0xed, ascii('Photoshop 3.0\0IPTC')), // APP13 — muss weg
      seg(0xfe, ascii('ein Kommentar')), // COM   — muss weg
      bytes(0xff, 0xda),
      be16(8),
      bytes(1, 0, 0, 63, 0), // SOS
      bildDaten,
      bytes(0xff, 0xd9), // EOI
    );

  it('findet EXIF, IPTC und Kommentar, aber nicht JFIF/ICC', () => {
    const b = bauJpeg();
    const ranges = findJpegMetadataRanges(b);
    expect(ranges).toHaveLength(3);
    // Das EXIF-Segment muss vollständig erfasst sein
    const exifStart = b.indexOf(0x45); // 'E' von 'Exif'
    expect(ranges[0].start).toBe(exifStart);
    expect(ranges[0].end - ranges[0].start).toBe(exifPayload.length);
  });

  it('nullt die GPS-Daten und lässt alles andere unangetastet', () => {
    const original = bauJpeg();
    const gestrippt = stripMetadata(bauJpeg(), 'image/jpeg')!;

    expect(gestrippt).not.toBeNull();
    // Länge unverändert -> Content-Length bleibt gültig
    expect(gestrippt.length).toBe(original.length);

    const alsText = new TextDecoder('latin1').decode(gestrippt);
    expect(alsText).not.toContain('GPS 54.156');
    expect(alsText).not.toContain('Exif');
    expect(alsText).not.toContain('IPTC');
    expect(alsText).not.toContain('ein Kommentar');

    // Farbprofil und JFIF müssen erhalten bleiben, sonst kippen die Farben
    expect(alsText).toContain('ICC_PROFILE');
    expect(alsText).toContain('JFIF');

    // Bilddaten hinter SOS Byte für Byte identisch
    const sos = original.length - bildDaten.length - 2;
    expect(Array.from(gestrippt.slice(sos))).toEqual(Array.from(original.slice(sos)));
  });

  it('weist etwas zurück, das kein JPEG ist', () => {
    expect(() => findJpegMetadataRanges(bytes(0x00, 0x01, 0x02, 0x03))).toThrow();
    expect(findMetadataRanges(bytes(0x00, 0x01, 0x02, 0x03), 'image/jpeg')).toBeNull();
  });
});

describe('AVIF / ISOBMFF', () => {
  const exifNutzlast = ascii('MM\0*GEHEIME-GPS-KOORDINATEN');
  const bildNutzlast = ascii('AV1-BILDDATEN-UNANTASTBAR');

  /** infe v2: version+flags, item_ID(16), protection(16), item_type(4) */
  const infe = (id: number, typ: string) =>
    box('infe', bytes(2, 0, 0, 0), be16(id), be16(0), ascii(typ), bytes(0));

  const bauAvif = () => {
    // Erst ohne mdat bauen, um die Offsets zu kennen.
    const ftyp = box('ftyp', ascii('avif'), be32(0), ascii('avifmif1'));
    const iinf = box('iinf', bytes(0, 0, 0, 0), be16(2), infe(1, 'Exif'), infe(2, 'av01'));

    // iloc v0: offset_size=4, length_size=4, base_offset_size=0
    const ilocEintrag = (id: number, offset: number, len: number) =>
      cat(be16(id), be16(0), be16(1), be32(offset), be32(len));

    // Platzhalter, um die Gesamtlänge des Headers zu bestimmen
    const ilocRoh = (o1: number, o2: number) =>
      box(
        'iloc',
        bytes(0, 0, 0, 0),
        bytes(0x44, 0x00),
        be16(2),
        ilocEintrag(1, o1, exifNutzlast.length),
        ilocEintrag(2, o2, bildNutzlast.length),
      );

    const kopfLaenge = (iloc: Uint8Array) =>
      ftyp.length + box('meta', bytes(0, 0, 0, 0), iinf, iloc).length + 8; // +8 mdat-Header

    let iloc = ilocRoh(0, 0);
    const basis = kopfLaenge(iloc);
    iloc = ilocRoh(basis, basis + exifNutzlast.length);

    const meta = box('meta', bytes(0, 0, 0, 0), iinf, iloc);
    const mdat = box('mdat', exifNutzlast, bildNutzlast);
    return cat(ftyp, meta, mdat);
  };

  it('findet das Exif-Item über iinf und iloc', () => {
    const b = bauAvif();
    const ranges = findIsobmffMetadataRanges(b);
    expect(ranges).toHaveLength(1);
    const gefunden = new TextDecoder('latin1').decode(b.slice(ranges[0].start, ranges[0].end));
    expect(gefunden).toBe('MM\0*GEHEIME-GPS-KOORDINATEN');
  });

  it('nullt EXIF, lässt die Bilddaten und die Länge unberührt', () => {
    const original = bauAvif();
    const gestrippt = stripMetadata(bauAvif(), 'image/avif')!;

    expect(gestrippt.length).toBe(original.length);
    const alsText = new TextDecoder('latin1').decode(gestrippt);
    expect(alsText).not.toContain('GEHEIME-GPS-KOORDINATEN');
    expect(alsText).toContain('AV1-BILDDATEN-UNANTASTBAR');
    // Die Container-Struktur muss intakt bleiben
    expect(alsText).toContain('ftyp');
    expect(alsText).toContain('iloc');
  });

  it('gibt null zurück, wenn es kein ISOBMFF ist', () => {
    expect(findMetadataRanges(ascii('nicht mal ansatzweise'), 'image/avif')).toBeNull();
  });
});

describe('unbekannte Formate', () => {
  it('liefern null — lieber nicht ausliefern als leaken', () => {
    expect(findMetadataRanges(bytes(0x89, 0x50, 0x4e, 0x47), 'image/png')).toBeNull();
    expect(stripMetadata(bytes(1, 2, 3), 'application/octet-stream')).toBeNull();
  });
});
