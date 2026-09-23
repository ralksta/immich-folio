import { describe, it, expect } from 'vitest';
import type { JournalBlock } from '@/lib/journal';
import { serializeJournalMarkdown, parseJournalMarkdown } from '@/lib/journal';
import { createBlock, moveBlock, isLegacyAssetRef } from '../components/journal/blockOps';
import {
  clampSplit,
  splitFromPointer,
  splitAfterKey,
  parseStoredSplit,
  SPLIT_MIN,
  SPLIT_MAX,
  SPLIT_DEFAULT,
} from '../components/journal/splitPane';

/**
 * The logic that came out of the journal editor when it was split up (#555).
 * Inside the 2000-line component none of it could be reached by a test.
 */

const TYPES: JournalBlock['type'][] = [
  'heading',
  'paragraph',
  'quote',
  'photo',
  'photo-pair',
  'photo-grid',
  'facts',
  'map',
  'album',
];

describe('createBlock', () => {
  it.each(TYPES)('creates a %s block', (type) => {
    expect(createBlock(type).type).toBe(type);
  });

  it('hands out a fresh object each time', () => {
    const a = createBlock('facts');
    const b = createBlock('facts');
    expect(a).not.toBe(b);
    if (a.type === 'facts' && b.type === 'facts') expect(a.items).not.toBe(b.items);
  });

  /**
   * A new block is saved as soon as the author types anywhere else; one that
   * does not survive the markdown round trip would vanish on the next load.
   */
  it.each(TYPES.filter((t) => t !== 'map' && t !== 'album'))(
    'a new %s block survives a save and reload',
    (type) => {
      const md = serializeJournalMarkdown({
        frontmatter: { title: 'T' },
        blocks: [createBlock(type)],
        referencedAssetIds: [],
      });
      expect(parseJournalMarkdown(md).blocks.map((b) => b.type)).toEqual([type]);
    },
  );
});

describe('moveBlock', () => {
  const blocks = (['paragraph', 'heading', 'quote'] as const).map(createBlock);

  it('moves a block up and down', () => {
    expect(moveBlock(blocks, 1, 'up')?.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
      'quote',
    ]);
    expect(moveBlock(blocks, 1, 'down')?.map((b) => b.type)).toEqual([
      'paragraph',
      'quote',
      'heading',
    ]);
  });

  it('refuses to move past either end', () => {
    expect(moveBlock(blocks, 0, 'up')).toBeNull();
    expect(moveBlock(blocks, 2, 'down')).toBeNull();
  });

  it('leaves the original list alone', () => {
    moveBlock(blocks, 1, 'up');
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'heading', 'quote']);
  });
});

describe('isLegacyAssetRef', () => {
  it('flags positional references, not UUIDs or empty slots', () => {
    expect(isLegacyAssetRef('1')).toBe(true);
    expect(isLegacyAssetRef('')).toBe(false);
    expect(isLegacyAssetRef('0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0')).toBe(false);
  });
});

describe('split pane', () => {
  it('clamps to its bounds', () => {
    expect(clampSplit(0)).toBe(SPLIT_MIN);
    expect(clampSplit(100)).toBe(SPLIT_MAX);
    expect(clampSplit(50)).toBe(50);
  });

  it('turns a pointer position into a percentage of the view', () => {
    expect(splitFromPointer(600, 100, 1000)).toBe(50);
    expect(splitFromPointer(0, 100, 1000)).toBe(SPLIT_MIN);
    // A collapsed view has no meaningful position.
    expect(splitFromPointer(600, 100, 0)).toBeNull();
  });

  it('nudges with the arrows, further with Shift, and resets with Home', () => {
    expect(splitAfterKey(50, 'ArrowLeft', false)).toBe(48);
    expect(splitAfterKey(50, 'ArrowRight', true)).toBe(60);
    expect(splitAfterKey(SPLIT_MIN, 'ArrowLeft', true)).toBe(SPLIT_MIN);
    expect(splitAfterKey(SPLIT_MAX, 'ArrowRight', false)).toBe(SPLIT_MAX);
    expect(splitAfterKey(30, 'Home', false)).toBe(SPLIT_DEFAULT);
    // Anything else is not the divider's key — Tab must still move focus.
    expect(splitAfterKey(50, 'Tab', false)).toBeNull();
  });

  it('only restores a stored width inside the bounds', () => {
    expect(parseStoredSplit('40')).toBe(40);
    expect(parseStoredSplit(null)).toBeNull();
    expect(parseStoredSplit('90')).toBeNull();
    expect(parseStoredSplit('abc')).toBeNull();
  });
});
