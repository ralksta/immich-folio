import { describe, it, expect, vi } from 'vitest';

// Mock tokens so we get predictable URL output
vi.mock('@/lib/tokens', () => ({
  encodeAssetId: (id: string) => `ENCODED_${id}`,
}));

// Mock thumbhash helpers
vi.mock('@/lib/thumbhash', () => ({
  thumbHashToBlurDataUrl: () => 'data:image/png;base64,mockblur',
  thumbHashToDominantHex: () => '#aabbcc',
}));

import {
  imageUrl,
  exifUrl,
  assetPlaceholder,
  assetExifSummary,
  assetAspectRatio,
  assetCaption,
  editMarker,
} from '@/lib/urls';

describe('imageUrl', () => {
  it('generates a proxy URL with encoded token and default size', () => {
    const url = imageUrl('some-uuid');
    expect(url).toBe('/api/image/ENCODED_some-uuid?size=preview');
  });

  it('uses the specified size parameter', () => {
    expect(imageUrl('id', 'thumbnail')).toBe('/api/image/ENCODED_id?size=thumbnail');
    expect(imageUrl('id', 'original')).toBe('/api/image/ENCODED_id?size=original');
  });
});

describe('imageUrl for photos edited in Immich (#831)', () => {
  const UPDATED = '2026-09-04T19:22:09.220Z';

  it('adds the edit marker only for an edited photo', () => {
    const marker = Math.floor(Date.parse(UPDATED) / 1000).toString(36);
    expect(imageUrl({ id: 'id', isEdited: true, updatedAt: UPDATED })).toBe(
      `/api/image/ENCODED_id?size=preview&e=${marker}`,
    );
    expect(imageUrl({ id: 'id', isEdited: true, updatedAt: UPDATED }, 'thumbnail')).toBe(
      `/api/image/ENCODED_id?size=thumbnail&e=${marker}`,
    );
  });

  it('leaves every other URL exactly as before', () => {
    expect(imageUrl({ id: 'id', isEdited: false, updatedAt: UPDATED })).toBe(
      '/api/image/ENCODED_id?size=preview',
    );
    expect(imageUrl({ id: 'id', updatedAt: UPDATED })).toBe('/api/image/ENCODED_id?size=preview');
    expect(imageUrl({ id: 'id' })).toBe(imageUrl('id'));
  });

  it('changes the marker when the photo is edited again', () => {
    const first = editMarker({ isEdited: true, updatedAt: UPDATED });
    const again = editMarker({ isEdited: true, updatedAt: '2026-10-01T08:00:00.000Z' });
    expect(first).toMatch(/^[0-9a-z]{1,16}$/);
    expect(again).toMatch(/^[0-9a-z]{1,16}$/);
    expect(again).not.toBe(first);
  });

  it('reveals the update time to the second only (review of #832)', () => {
    const marker = editMarker({ isEdited: true, updatedAt: UPDATED });
    expect(marker).toBe((Date.parse('2026-09-04T19:22:09Z') / 1000).toString(36));
    expect(editMarker({ isEdited: true, updatedAt: '2026-09-04T19:22:09.999Z' })).toBe(marker);
    expect(editMarker({ isEdited: true, updatedAt: '2026-09-04T19:22:10.000Z' })).not.toBe(marker);
  });

  it('still marks an edited photo whose update time is unknown', () => {
    expect(editMarker({ isEdited: true })).toBe('1');
    expect(editMarker({ isEdited: true, updatedAt: 'not a date' })).toBe('1');
    expect(editMarker({ isEdited: false, updatedAt: UPDATED })).toBeNull();
    expect(editMarker({})).toBeNull();
  });
});

describe('exifUrl', () => {
  it('generates an EXIF API URL with encoded token', () => {
    expect(exifUrl('my-asset')).toBe('/api/exif/ENCODED_my-asset');
  });
});

describe('assetPlaceholder', () => {
  it('returns blur data and dominant color for an asset with thumbhash', () => {
    const result = assetPlaceholder({ thumbhash: 'abc123' });
    expect(result).toEqual({
      blurDataURL: 'data:image/png;base64,mockblur',
      dominantColor: '#aabbcc',
    });
  });

  it('returns null when thumbhash is null', () => {
    expect(assetPlaceholder({ thumbhash: null })).toBeNull();
  });

  it('returns null when thumbhash is empty string', () => {
    expect(assetPlaceholder({ thumbhash: '' })).toBeNull();
  });
});

describe('assetExifSummary', () => {
  it('returns camera, lens, and focal length from exifInfo', () => {
    const result = assetExifSummary({
      exifInfo: {
        make: 'Leica',
        model: 'M11-P',
        lensModel: 'Summilux-M 50mm',
        focalLength: 50,
        fNumber: null,
        exposureTime: null,
        iso: null,
        exifImageWidth: null,
        exifImageHeight: null,
        latitude: null,
        longitude: null,
        city: null,
        state: null,
        country: null,
        dateTimeOriginal: null,
        description: null,
      },
    });
    expect(result).toEqual({
      camera: 'M11-P',
      lens: 'Summilux-M 50mm',
      focalLength: '50mm',
    });
  });

  it('returns undefined when no exifInfo exists', () => {
    expect(assetExifSummary({ exifInfo: undefined })).toBeUndefined();
  });

  it('returns undefined when all relevant fields are null', () => {
    expect(
      assetExifSummary({
        exifInfo: {
          make: null,
          model: null,
          lensModel: null,
          focalLength: null,
          fNumber: null,
          exposureTime: null,
          iso: null,
          exifImageWidth: null,
          exifImageHeight: null,
          latitude: null,
          longitude: null,
          city: null,
          state: null,
          country: null,
          dateTimeOriginal: null,
          description: null,
        },
      }),
    ).toBeUndefined();
  });
});

describe('assetAspectRatio', () => {
  it('computes width / height ratio', () => {
    const result = assetAspectRatio({
      exifInfo: {
        make: null,
        model: null,
        lensModel: null,
        focalLength: null,
        fNumber: null,
        exposureTime: null,
        iso: null,
        exifImageWidth: 3000,
        exifImageHeight: 2000,
        latitude: null,
        longitude: null,
        city: null,
        state: null,
        country: null,
        dateTimeOriginal: null,
        description: null,
      },
    });
    expect(result).toBe(1.5);
  });

  it('returns undefined when dimensions are missing', () => {
    expect(assetAspectRatio({ exifInfo: undefined })).toBeUndefined();
  });

  /**
   * #831, measured on Immich 3.2: EXIF keeps describing the stored file after
   * an edit in Immich, while `width`/`height` follow the edit.
   */
  describe('a photo edited in Immich', () => {
    const exif = (w: number, h: number, orientation: string | null = null) => ({
      make: null,
      model: null,
      lensModel: null,
      focalLength: null,
      fNumber: null,
      exposureTime: null,
      iso: null,
      exifImageWidth: w,
      exifImageHeight: h,
      orientation,
      latitude: null,
      longitude: null,
      city: null,
      state: null,
      country: null,
      dateTimeOriginal: null,
      description: null,
    });

    it('takes a quarter turn from the edited size', () => {
      // A scan stored 1076×723, rotated 270° in Immich: shown 723×1076.
      expect(
        assetAspectRatio({ isEdited: true, width: 723, height: 1076, exifInfo: exif(1076, 723) }),
      ).toBeCloseTo(723 / 1076);
    });

    it('takes a crop from the edited size', () => {
      // Stored 960×1280, cropped to 872×1132.
      expect(
        assetAspectRatio({ isEdited: true, width: 872, height: 1132, exifInfo: exif(960, 1280) }),
      ).toBeCloseTo(872 / 1132);
      // Stored 8064×6048 with orientation 6 (portrait), cropped to landscape.
      expect(
        assetAspectRatio({
          isEdited: true,
          width: 6048,
          height: 4838,
          exifInfo: exif(8064, 6048, '6'),
        }),
      ).toBeCloseTo(6048 / 4838);
    });

    it('keeps EXIF for a photo that is not edited', () => {
      expect(
        assetAspectRatio({ isEdited: false, width: 723, height: 1076, exifInfo: exif(3000, 2000) }),
      ).toBe(1.5);
    });

    it('does not fall back to EXIF, which describes the unedited file (review of #832)', () => {
      expect(assetAspectRatio({ isEdited: true, exifInfo: exif(3000, 2000) })).toBeUndefined();
      expect(
        assetAspectRatio({ isEdited: true, width: null, height: 0, exifInfo: exif(3000, 2000) }),
      ).toBeUndefined();
    });
  });

  it('returns undefined when height is 0', () => {
    expect(
      assetAspectRatio({
        exifInfo: {
          make: null,
          model: null,
          lensModel: null,
          focalLength: null,
          fNumber: null,
          exposureTime: null,
          iso: null,
          exifImageWidth: 100,
          exifImageHeight: 0,
          latitude: null,
          longitude: null,
          city: null,
          state: null,
          country: null,
          dateTimeOriginal: null,
          description: null,
        },
      }),
    ).toBeUndefined();
  });

  /**
   * A portrait frame off a Sony A7 V: the sensor is read out in landscape and
   * the quarter turn lives in the orientation flag, so the stored dimensions
   * are the displayed ones swapped.
   */
  const rotated = (orientation?: string | null) => ({
    exifInfo: {
      make: null,
      model: null,
      lensModel: null,
      focalLength: null,
      fNumber: null,
      exposureTime: null,
      iso: null,
      exifImageWidth: 7008,
      exifImageHeight: 4672,
      orientation,
      latitude: null,
      longitude: null,
      city: null,
      state: null,
      country: null,
      dateTimeOriginal: null,
      description: null,
    },
  });

  it.each([
    ['6', 'rotated 90 CW'],
    ['8', 'rotated 90 CCW'],
    ['5', 'mirrored and rotated 90 CCW'],
    ['7', 'mirrored and rotated 90 CW'],
  ])('swaps width and height for orientation %s (%s)', (orientation) => {
    expect(assetAspectRatio(rotated(orientation))).toBeCloseTo(4672 / 7008);
  });

  it.each([
    ['1', 'upright'],
    ['2', 'mirrored horizontally'],
    ['3', 'rotated 180'],
    ['4', 'mirrored vertically'],
  ])('leaves the ratio alone for orientation %s (%s)', (orientation) => {
    expect(assetAspectRatio(rotated(orientation))).toBeCloseTo(7008 / 4672);
  });

  it.each([
    ['null', null],
    ['absent', undefined],
  ])('treats a %s orientation as upright', (_label, orientation) => {
    expect(assetAspectRatio(rotated(orientation))).toBeCloseTo(7008 / 4672);
  });
});

describe('assetCaption', () => {
  /** An asset carrying nothing but the description under test. */
  const withDescription = (description: string | null) => ({
    exifInfo: {
      make: null,
      model: null,
      lensModel: null,
      focalLength: null,
      fNumber: null,
      exposureTime: null,
      iso: null,
      exifImageWidth: null,
      exifImageHeight: null,
      latitude: null,
      longitude: null,
      city: null,
      state: null,
      country: null,
      dateTimeOriginal: null,
      description,
    },
  });

  it('returns the description when captions are shown', () => {
    expect(assetCaption(withDescription('A gull over the harbour'), true)).toBe(
      'A gull over the harbour',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(assetCaption(withDescription('  Low tide\n'), true)).toBe('Low tide');
  });

  it.each([
    ['null', null],
    ['empty', ''],
    ['whitespace only', '   \n\t '],
  ])('returns undefined for a %s description, leaving alt=""', (_label, value) => {
    expect(assetCaption(withDescription(value), true)).toBeUndefined();
  });

  it('returns undefined when the asset has no exifInfo at all', () => {
    expect(assetCaption({ exifInfo: undefined }, true)).toBeUndefined();
  });

  /**
   * The point of #506: the description is the one field that can hold private
   * notes. Alt text publishes it as surely as a visible caption does, so the
   * caption switch has to gate it too.
   */
  it('withholds the description when captions are switched off', () => {
    expect(assetCaption(withDescription('Client hates this crop'), false)).toBeUndefined();
  });
});
