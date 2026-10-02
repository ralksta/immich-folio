/**
 * Turn a parsed block-markdown document into what `EssayView` renders: the
 * blocks with every asset id replaced by its token, and the photo items those
 * tokens resolve to. Shared by journal entries and content pages (#722).
 *
 * Server only — it talks to Immich and encrypts asset ids.
 */

import {
  collectAssetIds,
  mapBlockAssetIds,
  type JournalBlock,
  type MapPin,
  type ParsedJournal,
} from '@/lib/journal';
import { entryMapPins } from '@/lib/journalMap';
import { expandAlbumBlocks } from '@/lib/journalAlbum';
import { getConfig } from '@/lib/config';
import { immich, type ImmichAsset } from '@/lib/immich';
import {
  imageUrl,
  videoUrl,
  exifUrl,
  assetPlaceholder,
  assetAspectRatio,
  assetCaption,
  assetExifSummary,
} from '@/lib/urls';
import { encodeAssetId } from '@/lib/tokens';
import type { PhotoItem } from './PhotoGrid';

export interface EssayPayload {
  /** Blocks and cover carry tokens, never raw asset ids. Frontmatter is left empty. */
  essay: ParsedJournal;
  images: PhotoItem[];
}

interface EssayPayloadOptions {
  /** Prefix for log lines, e.g. `journal` or `page`. */
  logTag: string;
  slug: string;
  /** Map blocks are dropped when false, whatever the site's map setting. */
  allowMap: boolean;
  /** Raw asset id of a cover photo, shown in the lightbox sequence. */
  coverAssetId?: string;
}

/**
 * The assets of every album an album block names, keyed by album id, loaded
 * concurrently. An album that fails is reported and left out, so its block
 * drops rather than the page.
 */
export async function loadAlbumBlocks(
  blocks: readonly JournalBlock[],
  onError: (albumId: string, error: unknown) => void,
): Promise<Map<string, ImmichAsset[]>> {
  const albumIds = [
    ...new Set(blocks.flatMap((b) => (b.type === 'album' && b.albumId ? [b.albumId] : []))),
  ];
  const loaded = await Promise.all(
    albumIds.map(async (albumId) => {
      try {
        return [albumId, await immich.getAlbumAssetsRaw(albumId)] as const;
      } catch (error) {
        onError(albumId, error);
        return null;
      }
    }),
  );
  return new Map(loaded.filter((entry) => entry !== null));
}

export async function buildEssayPayload(
  authoredBlocks: JournalBlock[],
  { logTag, slug, allowMap, coverAssetId }: EssayPayloadOptions,
): Promise<EssayPayload & { coverToken?: string }> {
  const config = getConfig();
  const mapAllowed = allowMap && config.map;
  const sourceBlocks = allowMap ? authoredBlocks : authoredBlocks.filter((b) => b.type !== 'map');
  const referencedAssetIds = [
    ...new Set([...(coverAssetId ? [coverAssetId] : []), ...collectAssetIds(sourceBlocks)]),
  ];

  const fetchedAssets = (
    await Promise.all(
      referencedAssetIds.map((assetId) => immich.getAssetInfo(assetId).catch(() => null)),
    )
  ).filter((a): a is ImmichAsset => a !== null);

  // Album blocks become photo blocks here. The raw fetch bypasses the album
  // allowlist on purpose: an entry may already show any single photo by id,
  // and the author's pick is the gate for a whole album just the same. An
  // album Immich cannot deliver drops its block rather than the page.
  // All albums at once, not one round trip after the other.
  const albumAssetsById = await loadAlbumBlocks(sourceBlocks, (albumId, error) => {
    // eslint-disable-next-line no-console
    console.warn(`[${logTag}] ${slug}: album ${albumId} could not be loaded:`, error);
  });
  const { blocks } = expandAlbumBlocks(
    sourceBlocks,
    (albumId) => albumAssetsById.get(albumId),
    config.albumManualOrders,
  );
  const knownIds = new Set(fetchedAssets.map((a) => a.id));
  const rawAssets = [...fetchedAssets];
  for (const list of albumAssetsById.values()) {
    for (const asset of list) {
      if (knownIds.has(asset.id)) continue;
      knownIds.add(asset.id);
      rawAssets.push(asset);
    }
  }

  // EssayView drops photo blocks it cannot resolve, which is right for visitors
  // but leaves no trace of *why* a photo vanished. Legacy positional references
  // ("1", "2") are the usual cause: they only resolved against a subpage album.
  if (fetchedAssets.length < referencedAssetIds.length) {
    const resolved = new Set(fetchedAssets.map((a) => a.id));
    const missing = referencedAssetIds.filter((id) => !resolved.has(id));
    // eslint-disable-next-line no-console
    console.warn(
      `[${logTag}] ${slug}: ${missing.length} photo reference(s) could not be resolved and will not render: ${missing.join(', ')}`,
    );
  }

  /*
   * EssayView resolves a block's photo through PhotoItem.id, and those ids are
   * encrypted tokens — while the blocks coming out of the Markdown carry raw
   * asset UUIDs. Translating here also keeps raw UUIDs out of the client
   * payload. Unresolvable references collapse to an empty string, which
   * EssayView skips.
   */
  const tokenByAssetId = new Map(rawAssets.map((a) => [a.id, encodeAssetId(a.id)]));
  const toToken = (assetId: string) => tokenByAssetId.get(assetId) ?? '';

  // A map block's pins are computed here, from the photos fetched above and
  // under each photo's `location:` precision, and only when the site
  // publishes a map at all. The client gets pins only — never the items,
  // which carry raw asset ids.
  const entryPhotoIds = collectAssetIds(blocks.filter((b) => b.type !== 'map'));
  const pinsByBlock = new Map<JournalBlock, MapPin[]>();
  if (mapAllowed) {
    for (const block of blocks) {
      if (block.type === 'map') {
        pinsByBlock.set(block, await entryMapPins(block.items, rawAssets, entryPhotoIds));
      }
    }
  }

  // Photos that only anchor a map pin are fetched for their EXIF but are not
  // part of the story, so they stay out of the lightbox sequence.
  const shownAssetIds = new Set([...entryPhotoIds, ...(coverAssetId ? [coverAssetId] : [])]);

  const essay: ParsedJournal = {
    frontmatter: {},
    blocks: blocks.flatMap((block): JournalBlock[] => {
      if (block.type === 'map') {
        const pins = pinsByBlock.get(block);
        return pins
          ? [{ type: 'map', caption: block.caption, line: block.line, items: [], pins }]
          : [];
      }
      return [mapBlockAssetIds(block, toToken)];
    }),
    referencedAssetIds: rawAssets.map((a) => encodeAssetId(a.id)),
  };

  const images: PhotoItem[] = rawAssets
    .filter((a) => shownAssetIds.has(a.id) && (a.type === 'IMAGE' || a.type === 'VIDEO'))
    .map((a) => {
      const ph = assetPlaceholder(a);
      const exif =
        config.exif.onHover && config.exif.camera && a.type === 'IMAGE'
          ? assetExifSummary(a)
          : undefined;
      const caption = assetCaption(a, config.exif.caption);
      const isVideo = a.type === 'VIDEO';
      return {
        id: encodeAssetId(a.id),
        type: isVideo ? 'video' : 'image',
        thumbUrl: imageUrl(a, 'preview'),
        previewUrl: imageUrl(a, 'preview'),
        ...(isVideo ? { videoUrl: videoUrl(a.id) } : {}),
        exifUrl: exifUrl(a.id),
        ...(ph ? { blurDataURL: ph.blurDataURL, dominantColor: ph.dominantColor } : {}),
        ...(exif ?? {}),
        ...(caption ? { caption } : {}),
        aspectRatio: assetAspectRatio(a),
      };
    });

  return {
    essay,
    images,
    ...(coverAssetId ? { coverToken: toToken(coverAssetId) || undefined } : {}),
  };
}
