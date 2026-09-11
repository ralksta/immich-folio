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
