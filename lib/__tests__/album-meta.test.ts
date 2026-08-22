import { describe, it, expect } from 'vitest';
import { albumMetaDetail } from '../albumMeta';
import type { ImmichAlbum, ImmichAsset, ImmichExifInfo } from '../immich';

function asset(fileCreatedAt: string, exif?: Partial<ImmichExifInfo>): ImmichAsset {
  return {
    id: fileCreatedAt,
    type: 'IMAGE',
    originalFileName: 'a.jpg',
    originalMimeType: 'image/jpeg',
    thumbhash: null,
    fileCreatedAt,
    isTrashed: false,
    ...(exif ? { exifInfo: exif as ImmichExifInfo } : {}),
  };
}

function album(assets: ImmichAsset[]): ImmichAlbum {
  return {
    id: 'album',
    slug: 'album',
    albumName: 'Album',
    description: '',
    albumThumbnailAssetId: null,
    assetCount: assets.length,
    assets,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    order: 'asc',
  };
}

/**
 * Both values used to come from the first asset that happened to carry EXIF, so
 * a mixed album advertised whichever camera sorted first — and changing the
 * album's sort mode changed the claim (#509).
 */
describe('albumMetaDetail', () => {
  it('names the camera when the whole album agrees', () => {
    const a = album([
      asset('2026-05-01T10:00:00.000Z', { model: 'X-T5', lensModel: '35mm F1.4' }),
      asset('2026-05-02T10:00:00.000Z', { model: 'X-T5', lensModel: '35mm F1.4' }),
    ]);

    expect(albumMetaDetail(a, true).gear).toBe('X-T5 · 35mm F1.4');
  });

  it('says nothing about gear when the album mixes bodies', () => {
    const a = album([
      asset('2026-05-01T10:00:00.000Z', { model: 'X-T5' }),
      asset('2026-05-02T10:00:00.000Z', { model: 'M11' }),
    ]);

    expect(albumMetaDetail(a, true).gear).toBeUndefined();
  });

  it('does not change its claim when the album order changes', () => {
    const shot = [
      asset('2026-05-01T10:00:00.000Z', { model: 'X-T5' }),
      asset('2026-05-02T10:00:00.000Z', { model: 'M11' }),
    ];

    expect(albumMetaDetail(album(shot), true)).toEqual(
      albumMetaDetail(album([...shot].reverse()), true),
    );
  });

  it('keeps a shared camera even when only some photos carry EXIF', () => {
    const a = album([
      asset('2026-05-01T10:00:00.000Z', { model: 'X-T5' }),
      asset('2026-05-02T10:00:00.000Z'),
    ]);

    expect(albumMetaDetail(a, true).gear).toBe('X-T5');
  });

  it('omits the gear entirely when the camera group is off', () => {
    const a = album([asset('2026-05-01T10:00:00.000Z', { model: 'X-T5' })]);

    expect(albumMetaDetail(a, false).gear).toBeUndefined();
    expect(albumMetaDetail(a, false).date).toBe('05/2026');
  });

  it('shows one month when the album was shot in one month', () => {
    const a = album([asset('2026-05-01T10:00:00.000Z'), asset('2026-05-28T10:00:00.000Z')]);

    expect(albumMetaDetail(a, true).date).toBe('05/2026');
  });

  it('spans a range when the album does', () => {
    const a = album([asset('2026-05-01T10:00:00.000Z'), asset('2025-11-02T10:00:00.000Z')]);

    expect(albumMetaDetail(a, true).date).toBe('11/2025 – 05/2026');
  });

  it('prefers the capture time over the upload time', () => {
    const a = album([
      asset('2026-08-01T10:00:00.000Z', { dateTimeOriginal: '2019-03-04T10:00:00.000Z' }),
    ]);

    expect(albumMetaDetail(a, true).date).toBe('03/2019');
  });

  it('returns nothing for an empty album', () => {
    expect(albumMetaDetail(album([]), true)).toEqual({});
  });
});
