import { describe, it, expect } from 'vitest';
import { zoomDimensions, zoomSourceFor } from '../zoomSource';

/**
 * Which file the zoom may show (#467). The rule that matters most is the
 * negative one: a format whose metadata the scrubber does not edit must never
 * be served, whatever a browser could display.
 */
describe('zoomSourceFor', () => {
  const image = (originalMimeType: string | null, originalFileName = 'x') => ({
    type: 'IMAGE',
    originalMimeType,
    originalFileName,
  });

  it('serves JPEG and AVIF originals, which the scrubber cleans', () => {
    expect(zoomSourceFor(image('image/jpeg'))).toBe('original');
    expect(zoomSourceFor(image('image/jpg'))).toBe('original');
    expect(zoomSourceFor(image('image/avif'))).toBe('original');
    expect(zoomSourceFor(image('IMAGE/JPEG; charset=binary'))).toBe('original');
  });

  it('uses Immich’s rendition for what a browser cannot show', () => {
    for (const mime of [
      'image/heic',
      'image/heif',
      'image/x-adobe-dng',
      'image/x-sony-arw',
      'image/tiff',
      'image/jxl',
      'image/bmp',
    ]) {
      expect(zoomSourceFor(image(mime)), mime).toBe('fullsize');
    }
  });

  it('never zooms PNG, WebP or GIF: their metadata would go out unscrubbed', () => {
    for (const mime of ['image/png', 'image/webp', 'image/gif', 'image/svg+xml']) {
      expect(zoomSourceFor(image(mime)), mime).toBeNull();
    }
  });

  it('never zooms a video', () => {
    expect(
      zoomSourceFor({
        type: 'VIDEO',
        originalMimeType: 'video/quicktime',
        originalFileName: 'a.mov',
      }),
    ).toBeNull();
    // Even one mislabelled as an image type.
    expect(zoomSourceFor({ type: 'VIDEO', originalMimeType: 'image/jpeg' })).toBeNull();
  });

  it('falls back to the file extension without a MIME type', () => {
    expect(zoomSourceFor(image(null, 'L1001783.JPG'))).toBe('original');
    expect(zoomSourceFor(image(null, 'export.avif'))).toBe('original');
    expect(zoomSourceFor(image(null, 'IMG_6109.HEIC'))).toBe('fullsize');
    expect(zoomSourceFor(image(null, 'scan.png'))).toBeNull();
    expect(zoomSourceFor(image(null, 'no-extension'))).toBeNull();
  });

  it('refuses a non-image MIME type on an image asset', () => {
    expect(zoomSourceFor(image('application/octet-stream'))).toBeNull();
  });
});

describe('zoomDimensions', () => {
  it('prefers Immich’s upright width and height', () => {
    expect(
      zoomDimensions({
        width: 3024,
        height: 4032,
        exifInfo: { exifImageWidth: 4032, exifImageHeight: 3024, orientation: '6' },
      }),
    ).toEqual({ width: 3024, height: 4032 });
  });

  it('turns EXIF dimensions for a quarter-turn orientation', () => {
    expect(
      zoomDimensions({
        exifInfo: { exifImageWidth: 4032, exifImageHeight: 3024, orientation: '6' },
      }),
    ).toEqual({ width: 3024, height: 4032 });
    expect(
      zoomDimensions({
        exifInfo: { exifImageWidth: 7242, exifImageHeight: 4294, orientation: null },
      }),
    ).toEqual({ width: 7242, height: 4294 });
  });

  it('is undefined when nothing is known', () => {
    expect(zoomDimensions({})).toBeUndefined();
    expect(
      zoomDimensions({ exifInfo: { exifImageWidth: 0, exifImageHeight: 10 } }),
    ).toBeUndefined();
  });
});
