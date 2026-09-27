/**
 * The photos an essay actually shows, in reading order — the lightbox's
 * sequence. Client-safe (no `fs`).
 *
 * EssayView receives every photo of the subpage's albums, because blocks may
 * address them by 1-based index as well as by id. Walking that full list in the
 * lightbox let next/prev step through photos the story never shows; the
 * journal route already trims it (`shownAssetIds`), the subpage path cannot
 * without breaking index references, so the trimming happens here.
 *
 * Mirrors EssayView's rendering rules: a pair with a missing half renders as
 * nothing, and so does a grid left with fewer than two photos.
 */
import type { JournalBlock } from './journal';

export function essayPhotoSequence<T extends { id: string }>(
  blocks: JournalBlock[],
  coverKey: string | undefined,
  resolve: (key: string) => T | undefined,
): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  const add = (items: (T | undefined)[]) => {
    for (const item of items) {
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  };

  if (coverKey) add([resolve(coverKey)]);
  for (const block of blocks) {
    if (block.type === 'photo') {
      add([resolve(block.assetId)]);
    } else if (block.type === 'photo-pair') {
      const pair = block.assetIds.map(resolve);
      if (pair.every(Boolean)) add(pair);
    } else if (block.type === 'photo-grid') {
      const grid = block.assetIds.map(resolve).filter(Boolean);
      if (grid.length >= 2) add(grid);
    }
  }
  return out;
}
