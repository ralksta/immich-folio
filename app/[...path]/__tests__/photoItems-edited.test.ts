import { describe, it, expect, vi } from 'vitest';
import type { ImmichAsset } from '@/lib/immich';

/**
 * #831: a photo edited in Immich (crop, rotate) reaches the grid, the
 * lightbox and the zoom as edited — an image URL with the edit marker, the
 * edited proportions, and the edited full-size rendition behind the zoom.
 */

vi.mock('@/lib/config', () => ({
  getConfig: () => ({ authSecret: 'test-auth-secret-32-chars-long-min' }),
  getConfigOrNull: () => null,
}));

const { toPhotoItems } = await import('../photoItems');

const exif = (w: number, h: number, orientation: string | null = null) =>
  ({ exifImageWidth: w, exifImageHeight: h, orientation }) as ImmichAsset['exifInfo'];

const asset = (over: Partial<ImmichAsset>): ImmichAsset => ({
  id: '11111111-1111-1111-1111-111111111111',
  type: 'IMAGE',
  originalFileName: 'scan.jpg',
  originalMimeType: 'image/jpeg',
  thumbhash: null,
  fileCreatedAt: '2020-07-24T11:13:27.000Z',
  isTrashed: false,
  ...over,
});

const ALBUM = '22222222-2222-2222-2222-222222222222';

describe('toPhotoItems for photos edited in Immich (#831)', () => {
  // Measured on Immich 3.2: a scan stored 1076×723, rotated 270° in Immich.
  const rotated = asset({
    isEdited: true,
    updatedAt: '2026-09-04T19:22:09.220Z',
    width: 723,
    height: 1076,
    exifInfo: exif(1076, 723),
  });

  it('marks the edited photo’s URLs and gives it the edited proportions', () => {
    const [item] = toPhotoItems([rotated], false, false);
    expect(item.thumbUrl).toMatch(/[?&]e=[0-9a-z]+(&|$)/);
    expect(item.previewUrl).toBe(item.thumbUrl);
    expect(item.aspectRatio).toBeCloseTo(723 / 1076);
  });

  it('leaves a photo that is not edited exactly as it was', () => {
    const [item] = toPhotoItems(
      [asset({ width: 1076, height: 723, exifInfo: exif(1076, 723) })],
      false,
      false,
    );
    expect(item.thumbUrl).toMatch(/\?size=preview$/);
    expect(item.aspectRatio).toBeCloseTo(1076 / 723);
  });

  it('offers zoom at the edited size', () => {
    const [item] = toPhotoItems([rotated], false, false, undefined, ALBUM);
    expect(item.zoomUrl).toMatch(/^\/api\/zoom\//);
    expect([item.zoomWidth, item.zoomHeight]).toEqual([723, 1076]);
  });
});
