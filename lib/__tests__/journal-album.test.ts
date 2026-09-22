import { describe, it, expect } from 'vitest';
import { parseJournalMarkdown, serializeJournalMarkdown, collectAssetIds } from '../journal';
import type { JournalBlock } from '../journal';
import { expandAlbumBlocks, orderAlbumAssets } from '../journalAlbum';

const block = (md: string) => parseJournalMarkdown(md).blocks[0];

describe('album block syntax', () => {
  it('parses the id and every option', () => {
    expect(
      block(
        ['::album abc-123', 'count: 12', 'skip: 2', 'layout: pairs', 'caption: The **day**'].join(
          '\n',
        ),
      ),
    ).toEqual({
      type: 'album',
      albumId: 'abc-123',
      count: 12,
      skip: 2,
      layout: 'pairs',
      caption: 'The <strong>day</strong>',
    });
  });

  it('defaults to grid, all photos, no skip — and allows an empty id placeholder', () => {
    expect(block('::album')).toEqual({ type: 'album', albumId: '', layout: 'grid' });
    expect(block('::album abc')).toEqual({ type: 'album', albumId: 'abc', layout: 'grid' });
  });

  it('ignores malformed options', () => {
    expect(block('::album abc\ncount: many\nlayout: mosaic\nskip: -1')).toEqual({
      type: 'album',
      albumId: 'abc',
      layout: 'grid',
    });
  });

  it('round-trips byte-stable and stays out of the asset ids', () => {
    const md = ['::album abc-123', 'count: 12', 'skip: 2', 'layout: wide', 'caption: Twelve'].join(
      '\n',
    );
    const parsed = parseJournalMarkdown(md);
    expect(serializeJournalMarkdown(parsed)).toBe(md);
    expect(serializeJournalMarkdown(parseJournalMarkdown('::album'))).toBe('::album');
    expect(collectAssetIds(parsed.blocks)).toEqual([]);
  });
});

const assets = (n: number, type = 'IMAGE') =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, type }));

describe('expandAlbumBlocks', () => {
  const lookup = (id: string) => (id === 'alb' ? assets(7) : undefined);
  const albumBlock = (
    extra: Partial<Extract<JournalBlock, { type: 'album' }>> = {},
  ): JournalBlock => ({
    type: 'album',
    albumId: 'alb',
    layout: 'grid',
    ...extra,
  });

  it('turns an album into one grid, keeping the surrounding blocks', () => {
    const before: JournalBlock = { type: 'heading', level: 2, text: 'Party' };
    const { blocks, albumAssetIds } = expandAlbumBlocks(
      [before, albumBlock({ caption: 'All of it' })],
      lookup,
    );
    expect(blocks).toEqual([
      before,
      {
        type: 'photo-grid',
        assetIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
        caption: 'All of it',
      },
    ]);
    expect(albumAssetIds).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
  });

  it('slices with count and skip', () => {
    const { blocks } = expandAlbumBlocks([albumBlock({ count: 3, skip: 2 })], lookup);
    expect(blocks).toEqual([{ type: 'photo-grid', assetIds: ['p3', 'p4', 'p5'] }]);
  });

  it('lays out pairs with an odd tail and puts the caption last', () => {
    const { blocks } = expandAlbumBlocks(
      [albumBlock({ count: 5, layout: 'pairs', caption: 'c' })],
      lookup,
    );
    expect(blocks).toEqual([
      { type: 'photo-pair', assetIds: ['p1', 'p2'] },
      { type: 'photo-pair', assetIds: ['p3', 'p4'] },
      { type: 'photo', assetId: 'p5', layout: 'contained', caption: 'c' },
    ]);
  });

  it('lays out wide as one photo per row', () => {
    const { blocks } = expandAlbumBlocks([albumBlock({ count: 2, layout: 'wide' })], lookup);
    expect(blocks).toEqual([
      { type: 'photo', assetId: 'p1', layout: 'wide' },
      { type: 'photo', assetId: 'p2', layout: 'wide' },
    ]);
  });

  it('falls back to a pair or a single photo when a grid has too few', () => {
    expect(expandAlbumBlocks([albumBlock({ count: 2 })], lookup).blocks).toEqual([
      { type: 'photo-pair', assetIds: ['p1', 'p2'] },
    ]);
    expect(expandAlbumBlocks([albumBlock({ count: 1 })], lookup).blocks).toEqual([
      { type: 'photo', assetId: 'p1', layout: 'contained' },
    ]);
  });

  it('drops an empty id, an unknown album and an empty slice', () => {
    expect(expandAlbumBlocks([albumBlock({ albumId: '' })], lookup).blocks).toEqual([]);
    expect(expandAlbumBlocks([albumBlock({ albumId: 'nope' })], lookup).blocks).toEqual([]);
    expect(expandAlbumBlocks([albumBlock({ skip: 99 })], lookup).blocks).toEqual([]);
  });

  it('puts the gallery manual order first, then the album order', () => {
    const { blocks } = expandAlbumBlocks([albumBlock({ count: 4 })], lookup, {
      alb: ['p6', 'p2', 'ghost'],
    });
    expect(blocks).toEqual([{ type: 'photo-grid', assetIds: ['p6', 'p2', 'p1', 'p3'] }]);
  });

  it('keeps only images and videos', () => {
    const mixed = [...assets(2), { id: 'x', type: 'OTHER' }, { id: 'v', type: 'VIDEO' }];
    const { blocks } = expandAlbumBlocks([albumBlock()], () => mixed);
    expect(blocks).toEqual([{ type: 'photo-grid', assetIds: ['p1', 'p2', 'v'] }]);
  });

  it('orderAlbumAssets pins first occurrences only', () => {
    expect(orderAlbumAssets(assets(3), ['p3', 'p3', 'p1']).map((a) => a.id)).toEqual([
      'p3',
      'p1',
      'p2',
    ]);
  });
});
