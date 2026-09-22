import { describe, it, expect } from 'vitest';
import {
  parseJournalMarkdown,
  serializeJournalMarkdown,
  collectAssetIds,
  mapBlockAssetIds,
} from '../journal';
import type { JournalBlock } from '../journal';

const roundTrip = (blocks: JournalBlock[]) =>
  parseJournalMarkdown(
    serializeJournalMarkdown({ frontmatter: {}, blocks, referencedAssetIds: [] }),
  );

describe('photo grid block', () => {
  it('parses three or more ids as a grid and keeps them all', () => {
    const parsed = parseJournalMarkdown('![a1, b2, c3](Three)');
    expect(parsed.blocks).toEqual([
      { type: 'photo-grid', assetIds: ['a1', 'b2', 'c3'], caption: 'Three' },
    ]);
    expect(parsed.referencedAssetIds).toEqual(['a1', 'b2', 'c3']);
  });

  it('no longer drops the third id on a save (pair used to keep two)', () => {
    const once = serializeJournalMarkdown(parseJournalMarkdown('![a1, b2, c3]()'));
    expect(once).toBe('![a1, b2, c3]()');
  });

  it('keeps two ids a pair', () => {
    const parsed = parseJournalMarkdown('![a1, b2](Two)');
    expect(parsed.blocks[0]).toMatchObject({ type: 'photo-pair', assetIds: ['a1', 'b2'] });
  });

  it('round-trips five ids with a markdown caption', () => {
    const block: JournalBlock = {
      type: 'photo-grid',
      assetIds: ['a', 'b', 'c', 'd', 'e'],
      caption: 'A <strong>bold</strong> caption',
    };
    expect(roundTrip([block]).blocks).toEqual([block]);
  });

  it('round-trips unfilled placeholders without referencing them', () => {
    const block: JournalBlock = { type: 'photo-grid', assetIds: ['', '', ''], caption: undefined };
    const parsed = roundTrip([block]);
    expect(parsed.blocks).toEqual([block]);
    expect(parsed.referencedAssetIds).toEqual([]);
  });

  it('references only the filled ids of a half-filled grid, once each', () => {
    const blocks: JournalBlock[] = [
      { type: 'photo-grid', assetIds: ['a', '', 'b', 'a'], caption: undefined },
    ];
    expect(collectAssetIds(blocks)).toEqual(['a', 'b']);
    expect(roundTrip(blocks).referencedAssetIds).toEqual(['a', 'b']);
  });

  it('maps every id of a grid through the token function', () => {
    const block: JournalBlock = { type: 'photo-grid', assetIds: ['a', 'b', 'c'] };
    expect(mapBlockAssetIds(block, (id) => `t:${id}`)).toEqual({
      type: 'photo-grid',
      assetIds: ['t:a', 't:b', 't:c'],
    });
  });

  it('leaves blocks without ids untouched when mapping', () => {
    const block: JournalBlock = { type: 'heading', level: 2, text: 'Hi' };
    expect(mapBlockAssetIds(block, () => 'x')).toBe(block);
  });
});
