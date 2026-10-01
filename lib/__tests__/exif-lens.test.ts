import { describe, it, expect } from 'vitest';
import { formatLens } from '../exif';
import { assetExifSummary } from '../urls';
import type { ImmichAsset } from '../immich';

/**
 * Phones report the device as the lens, so the tile overlay and the lightbox
 * strip read "IPHONE 14 PRO · IPHONE 14 PRO BACK TRIPLE CAMERA 6.86MM F/1.78".
 */
describe('formatLens', () => {
  it('drops a camera model the lens repeats', () => {
    expect(formatLens('iPhone 14 Pro back triple camera 6.86mm f/1.78', 'iPhone 14 Pro')).toBe(
      'back triple camera 6.86mm f/1.78',
    );
    expect(formatLens('IPHONE 14 PRO back camera', 'iPhone 14 Pro')).toBe('back camera');
  });

  it('removes the model anywhere in the lens, as a whole phrase', () => {
    expect(formatLens('Wide iPhone 14 Pro 24mm', 'iPhone 14 Pro')).toBe('Wide 24mm');
  });

  it('does not match inside another word', () => {
    expect(formatLens('Pixel 7 Pro camera', 'Pixel 7 P')).toBe('Pixel 7 Pro camera');
    expect(formatLens('XF23mmF1.4 R', 'X')).toBe('XF23mmF1.4 R');
  });

  it('leaves a separate lens alone', () => {
    expect(formatLens('RF24-70mm F2.8 L IS USM', 'Canon EOS R6')).toBe('RF24-70mm F2.8 L IS USM');
  });

  it('empties a lens that is only the model', () => {
    expect(formatLens('iPhone 14 Pro', 'iPhone 14 Pro')).toBe('');
  });

  it('keeps the lens when there is no camera to repeat', () => {
    expect(formatLens('iPhone 14 Pro back camera', null)).toBe('iPhone 14 Pro back camera');
    expect(formatLens(null, 'iPhone 14 Pro')).toBe('');
  });

  it('treats regex characters in the model literally', () => {
    expect(formatLens('Model (X) lens', 'Model (X)')).toBe('lens');
    expect(formatLens('Model X lens', 'Model (X)')).toBe('Model X lens');
  });
});

describe('assetExifSummary', () => {
  const asset = (exif: Record<string, unknown>) =>
    ({ exifInfo: exif }) as unknown as Pick<ImmichAsset, 'exifInfo'>;

  it('does not repeat the camera in the tile lens', () => {
    const summary = assetExifSummary(
      asset({
        model: 'iPhone 14 Pro',
        lensModel: 'iPhone 14 Pro back triple camera 6.86mm f/1.78',
        focalLength: 6.86,
      }),
    );
    expect(summary).toEqual({
      camera: 'iPhone 14 Pro',
      lens: 'back triple camera 6.86mm f/1.78',
      focalLength: '6.86mm',
    });
  });

  it('omits a lens that only names the camera', () => {
    const summary = assetExifSummary(asset({ model: 'iPhone 14 Pro', lensModel: 'iPhone 14 Pro' }));
    expect(summary).toEqual({ camera: 'iPhone 14 Pro', lens: undefined, focalLength: undefined });
  });
});
