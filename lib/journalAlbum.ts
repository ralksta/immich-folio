/**
 * Album blocks — "x photos from an album" — expanded into ordinary photo
 * blocks. Pure and client-safe: the caller supplies the album's assets (the
 * server from `immich.getAlbumAssetsRaw()`, the studio from the admin assets
 * route), so the same expansion runs on the page and in the preview.
 */

import type { AlbumBlockLayout, JournalBlock } from './journal';

export interface AlbumAssetRef {
  id: string;
  type: string;
}

/**
 * The gallery's `assetOrder` is a pinned prefix, not a permutation (see
 * lib/albumSort.ts): pinned ids first in their order, everything else in the
 * order given — which for a raw album fetch is Immich's own.
 */
export function orderAlbumAssets<T extends { id: string }>(
  assets: T[],
  manualOrder?: string[],
): T[] {
  if (!manualOrder?.length) return assets;
  const rank = new Map<string, number>();
  manualOrder.forEach((id, i) => {
    if (!rank.has(id)) rank.set(id, i);
  });
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const asset of assets) (rank.has(asset.id) ? pinned : rest).push(asset);
  pinned.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  return [...pinned, ...rest];
}

function photoBlocks(ids: string[], layout: AlbumBlockLayout, caption?: string): JournalBlock[] {
  if (layout === 'wide') {
    return ids.map((assetId, i) => ({
      type: 'photo',
      assetId,
      layout: 'wide',
      ...(caption && i === ids.length - 1 ? { caption } : {}),
    }));
  }
  if (layout === 'pairs') {
    const out: JournalBlock[] = [];
    for (let i = 0; i < ids.length; i += 2) {
      const last = i + 2 >= ids.length;
      if (i + 1 < ids.length) {
        out.push({
          type: 'photo-pair',
          assetIds: [ids[i], ids[i + 1]],
          ...(caption && last ? { caption } : {}),
        });
      } else {
        out.push({
          type: 'photo',
          assetId: ids[i],
          layout: 'contained',
          ...(caption ? { caption } : {}),
        });
      }
    }
    return out;
  }
  // grid — a grid needs three; fewer fall back to what the count allows.
  if (ids.length >= 3)
    return [{ type: 'photo-grid', assetIds: ids, ...(caption ? { caption } : {}) }];
  if (ids.length === 2) {
    return [{ type: 'photo-pair', assetIds: [ids[0], ids[1]], ...(caption ? { caption } : {}) }];
  }
  return [{ type: 'photo', assetId: ids[0], layout: 'contained', ...(caption ? { caption } : {}) }];
}

/**
 * Replace every album block with photo blocks. An album the lookup does not
 * know (not fetched, unreachable, or the studio still loading it), an empty
 * id, or a selection that leaves no photos removes the block. Returns the
 * ids the expansion introduced so the caller can fetch or measure them.
 */
export function expandAlbumBlocks(
  blocks: readonly JournalBlock[],
  lookup: (albumId: string) => readonly AlbumAssetRef[] | undefined,
  manualOrders?: Record<string, string[]>,
): { blocks: JournalBlock[]; albumAssetIds: string[] } {
  const albumAssetIds: string[] = [];
  const out = blocks.flatMap((block): JournalBlock[] => {
    if (block.type !== 'album') return [block];
    if (!block.albumId) return [];
    const assets = lookup(block.albumId);
    if (!assets) return [];

    const ordered = orderAlbumAssets(
      assets.filter((a) => a.type === 'IMAGE' || a.type === 'VIDEO'),
      manualOrders?.[block.albumId],
    );
    const skip = block.skip ?? 0;
    const ids = ordered
      .slice(skip, block.count !== undefined ? skip + block.count : undefined)
      .map((a) => a.id);
    if (ids.length === 0) return [];

    albumAssetIds.push(...ids);
    return photoBlocks(ids, block.layout, block.caption);
  });
  return { blocks: out, albumAssetIds: Array.from(new Set(albumAssetIds)) };
}
