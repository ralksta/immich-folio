import { describe, it, expect } from 'vitest';
import { essayPhotoSequence } from '../essaySequence';
import type { JournalBlock } from '../journal';

// Six photos in the subpage's albums; the essay shows only some of them.
const photos = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
const resolve = (key: string) => {
  const byIndex = Number(key);
  if (Number.isInteger(byIndex) && byIndex >= 1) return photos[byIndex - 1];
  return photos.find((p) => p.id === key);
};
const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe('essayPhotoSequence', () => {
  it('lists only the photos the blocks show, in reading order', () => {
    const blocks: JournalBlock[] = [
      { type: 'photo', assetId: 'c', layout: 'wide' },
      { type: 'paragraph', html: 'text' },
      { type: 'photo-pair', assetIds: ['a', 'e'] },
    ];
    expect(ids(essayPhotoSequence(blocks, undefined, resolve))).toEqual(['c', 'a', 'e']);
  });

  it('puts the cover first and does not repeat it', () => {
    const blocks: JournalBlock[] = [{ type: 'photo', assetId: 'b', layout: 'wide' }];
    expect(ids(essayPhotoSequence(blocks, 'b', resolve))).toEqual(['b']);
    expect(ids(essayPhotoSequence(blocks, 'd', resolve))).toEqual(['d', 'b']);
  });

  it('resolves 1-based index references', () => {
    const blocks: JournalBlock[] = [{ type: 'photo', assetId: '6', layout: 'contained' }];
    expect(ids(essayPhotoSequence(blocks, undefined, resolve))).toEqual(['f']);
  });

  it('skips a pair with a missing half, like the renderer', () => {
    const blocks: JournalBlock[] = [{ type: 'photo-pair', assetIds: ['a', 'missing'] }];
    expect(essayPhotoSequence(blocks, undefined, resolve)).toEqual([]);
  });

  it('keeps a grid only while two photos resolve', () => {
    const one: JournalBlock[] = [{ type: 'photo-grid', assetIds: ['a', 'x', 'y'] }];
    const two: JournalBlock[] = [{ type: 'photo-grid', assetIds: ['a', 'x', 'b'] }];
    expect(essayPhotoSequence(one, undefined, resolve)).toEqual([]);
    expect(ids(essayPhotoSequence(two, undefined, resolve))).toEqual(['a', 'b']);
  });
});
