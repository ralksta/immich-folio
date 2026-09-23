import type { JournalBlock } from '@/lib/journal';

/**
 * Block-list operations of the journal editor, as plain functions so they can
 * be tested without rendering the editor (#555).
 */

/**
 * Photo blocks may carry a legacy positional reference ("1", "2") instead of an
 * asset UUID. Those only ever resolved against a subpage's album; on a
 * standalone journal page there is no album, so the photo silently disappears.
 * Flag them in the editor so the author can re-pick before publishing.
 */
const ASSET_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLegacyAssetRef(assetId: string): boolean {
  return assetId.length > 0 && !ASSET_UUID.test(assetId);
}

/** The block the "Add Block" toolbar inserts for each type. */
export function createBlock(type: JournalBlock['type']): JournalBlock {
  switch (type) {
    case 'heading':
      return { type: 'heading', level: 2, text: 'New Heading' };
    case 'paragraph':
      return { type: 'paragraph', html: 'Enter paragraph text here...' };
    case 'quote':
      return { type: 'quote', text: 'Enter quote text...', author: '' };
    case 'photo':
      return { type: 'photo', assetId: '', caption: '', layout: 'contained' };
    case 'photo-pair':
      return { type: 'photo-pair', assetIds: ['', ''], caption: '' };
    case 'photo-grid':
      return { type: 'photo-grid', assetIds: ['', '', ''], caption: '' };
    case 'facts':
      return {
        type: 'facts',
        items: [
          { label: '', value: '' },
          { label: '', value: '' },
        ],
      };
    case 'map':
      return { type: 'map', caption: '', line: true, items: [] };
    case 'album':
      return { type: 'album', albumId: '', layout: 'grid' };
  }
}

/**
 * The blocks with the one at `index` moved a step up or down, or null when it
 * is already at that end — the arrow buttons are disabled there, but a stale
 * click must not reorder anything.
 */
export function moveBlock(
  blocks: JournalBlock[],
  index: number,
  direction: 'up' | 'down',
): JournalBlock[] | null {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= blocks.length) return null;
  const next = [...blocks];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}
