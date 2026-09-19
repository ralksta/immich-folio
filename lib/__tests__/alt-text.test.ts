import { describe, it, expect } from 'vitest';
import {
  albumPaths,
  buildAltTextReport,
  immichWebUrl,
  type AltTextAssetInput,
} from '../admin/alt-text';

const photo = (id: string, description: string | null = null): AltTextAssetInput => ({
  id,
  type: 'IMAGE',
  originalFileName: `${id}.jpg`,
  exifInfo: { description },
});

describe('buildAltTextReport', () => {
  it('lists photos without a description, per album', () => {
    const report = buildAltTextReport(
      [
        {
          id: 'a1',
          name: 'Island',
          path: '/travel',
          assets: [photo('p1', 'A fjord'), photo('p2')],
        },
      ],
      true,
    );
    expect(report.total).toBe(2);
    expect(report.described).toBe(1);
    expect(report.albums).toEqual([
      {
        albumId: 'a1',
        albumName: 'Island',
        path: '/travel',
        total: 2,
        missing: [{ assetId: 'p2', fileName: 'p2.jpg' }],
      },
    ]);
  });

  /** A description of spaces renders as an empty alt all the same. */
  it('treats a blank description as missing', () => {
    const report = buildAltTextReport(
      [{ id: 'a1', name: 'A', path: '/', assets: [photo('p1', '   ')] }],
      true,
    );
    expect(report.described).toBe(0);
    expect(report.albums[0].missing).toHaveLength(1);
  });

  /** Videos have no alt attribute to fill. */
  it('does not count videos', () => {
    const report = buildAltTextReport(
      [
        {
          id: 'a1',
          name: 'A',
          path: '/',
          assets: [{ id: 'v1', type: 'VIDEO', originalFileName: 'v1.mp4' }, photo('p1', 'x')],
        },
      ],
      true,
    );
    expect(report.total).toBe(1);
    expect(report.albums).toEqual([]);
  });

  it('counts a photo that sits in two albums once', () => {
    const shared = photo('p1');
    const report = buildAltTextReport(
      [
        { id: 'a1', name: 'A', path: '/', assets: [shared] },
        { id: 'a2', name: 'B', path: '/', assets: [shared] },
      ],
      true,
    );
    expect(report.total).toBe(1);
    expect(report.albums).toHaveLength(2);
  });

  it('puts the album with the most gaps first and leaves out complete ones', () => {
    const report = buildAltTextReport(
      [
        { id: 'few', name: 'Few', path: '/', assets: [photo('p1')] },
        { id: 'done', name: 'Done', path: '/', assets: [photo('p2', 'x')] },
        { id: 'many', name: 'Many', path: '/', assets: [photo('p3'), photo('p4')] },
      ],
      true,
    );
    expect(report.albums.map((a) => a.albumId)).toEqual(['many', 'few']);
  });

  it('passes the caption setting through', () => {
    expect(buildAltTextReport([], false).captionsEnabled).toBe(false);
  });
});

describe('albumPaths', () => {
  it('uses the first subpage that lists an album', () => {
    const paths = albumPaths([
      { slug: 'travel', albumIds: ['a1'] },
      { slug: 'best-of', albumIds: ['a1', 'a2'] },
    ]);
    expect(paths.get('a1')).toBe('/travel');
    expect(paths.get('a2')).toBe('/best-of');
    expect(paths.get('a3')).toBeUndefined();
  });
});

describe('immichWebUrl', () => {
  it('drops the /api suffix Folio appends', () => {
    expect(immichWebUrl('http://immich:2283/api')).toBe('http://immich:2283');
    expect(immichWebUrl('https://photos.example.com/api/')).toBe('https://photos.example.com');
  });
});
