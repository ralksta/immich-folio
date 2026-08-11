/**
 * Per-album asset ordering.
 *
 * Album order is Immich's by default — a Folio album mirrors the Immich
 * timeline. A portfolio often needs something else: a curated series has a
 * narrative order that has nothing to do with capture time, and changing the
 * sort on the Immich album would change it for the archive too.
 *
 * Everything here is pure and never sorts in place. `lib/immich.ts` applies
 * these *after* the cache read, so the LRU keeps exactly one canonical
 * Immich-ordered copy per album; sorting the cached array directly would
 * reorder the shared entry, and the next reader with a different mode would
 * then sort an already-sorted array.
 */

/**
 * The fields ordering actually needs. Deliberately structural rather than
 * `ImmichAsset`: the admin reorder endpoint works on a lighter projection and
 * must produce a baseline byte-identical to the site's, and depending on the
 * narrow shape keeps this module free of any import from `lib/immich.ts`.
 */
export interface SortableAsset {
  id: string;
  originalFileName: string;
  fileCreatedAt: string;
  localDateTime?: string;
}

export const ALBUM_SORT_MODES = ['immich', 'newest', 'oldest', 'filename', 'manual'] as const;

export type AlbumSortMode = (typeof ALBUM_SORT_MODES)[number];

export const DEFAULT_ALBUM_SORT: AlbumSortMode = 'immich';

export function isAlbumSortMode(value: unknown): value is AlbumSortMode {
  return typeof value === 'string' && (ALBUM_SORT_MODES as readonly string[]).includes(value);
}

/**
 * Mirrors Immich's own timeline query: primary key `localDateTime` (capture
 * time in the photographer's local zone), tie-broken by `fileCreatedAt` (the
 * same instant in UTC). The two only diverge for albums spanning time zones,
 * and there local time is what the Immich UI shows. Sorting on
 * `exifInfo.dateTimeOriginal` instead would be near-pointless: Immich already
 * derives `fileCreatedAt` from that same EXIF chain, and it is null for assets
 * without EXIF.
 *
 * Compare parsed instants, not strings — string order breaks on fractional
 * seconds ('.' collates before '+'), which misorders bursts where only some
 * frames carry sub-second precision. Unparseable dates fall back to 0 rather
 * than NaN, which would make sort() incoherent.
 */
export function compareByCaptureTime(dir: 1 | -1) {
  const ts = (value: string | undefined) => Date.parse(value ?? '') || 0;
  return (a: SortableAsset, b: SortableAsset): number =>
    dir * (ts(a.localDateTime) - ts(b.localDateTime)) ||
    dir * (ts(a.fileCreatedAt) - ts(b.fileCreatedAt));
}

/**
 * Natural collation, so `IMG_2.jpg` precedes `IMG_10.jpg` — this is the point
 * of the mode, and it is what scanned-film and camera-export workflows encode
 * their intended order in.
 */
const filenameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareByFilename(a: SortableAsset, b: SortableAsset): number {
  // Tie-break on id: `sensitivity: 'base'` treats "a.jpg" and "A.jpg" as equal,
  // and duplicate filenames across import batches are common. Without this the
  // order of a tie would depend on the input order and drift between requests.
  return filenameCollator.compare(a.originalFileName, b.originalFileName) || (a.id < b.id ? -1 : 1);
}

export interface AlbumSortOptions {
  mode: AlbumSortMode;
  /** The Immich album's own sort direction, used by `immich` and as the fallback. */
  immichOrder?: 'asc' | 'desc';
  /** Pinned asset IDs for `manual`, in the order they should appear. */
  manualOrder?: string[];
}

/**
 * `manual` is a pinned *prefix*, not a full permutation: `manualOrder` lists
 * only the assets the owner placed by hand, and everything else follows in the
 * album's Immich order.
 *
 * That keeps `gallery.yaml` small — a full permutation of a 2,000-photo album
 * is ~80 KB of UUIDs in a file that is rewritten and copied to `content/.backups/`
 * on every admin save — and it makes drift handling fall out for free: assets
 * removed from the album in Immich simply never match, and new ones land in the
 * tail rather than being hidden.
 *
 * New assets go last, not first. Choosing `manual` is an explicit opt-out of
 * chronology, and prepending would silently change position 1 — the featured
 * tile in the showcase layout, and the album's visual opener. A surprise at the
 * end of a curated sequence is recoverable; one at the top is a regression the
 * owner sees on the homepage.
 */
export function sortAlbumAssets<T extends SortableAsset>(
  assets: T[],
  { mode, immichOrder, manualOrder }: AlbumSortOptions,
): T[] {
  const dir: 1 | -1 = immichOrder === 'asc' ? 1 : -1;

  switch (mode) {
    case 'newest':
      return [...assets].sort(compareByCaptureTime(-1));

    case 'oldest':
      return [...assets].sort(compareByCaptureTime(1));

    case 'filename':
      return [...assets].sort(compareByFilename);

    case 'manual': {
      if (!manualOrder?.length) return [...assets].sort(compareByCaptureTime(dir));

      // Rank lookup rather than indexOf-per-comparison: an album with a few
      // thousand assets would otherwise be quadratic. First occurrence wins, so
      // a duplicated id in the YAML pins the asset once instead of dropping it.
      const rank = new Map<string, number>();
      manualOrder.forEach((id, i) => {
        if (!rank.has(id)) rank.set(id, i);
      });

      const pinned: T[] = [];
      const rest: T[] = [];
      for (const asset of assets) {
        (rank.has(asset.id) ? pinned : rest).push(asset);
      }

      pinned.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
      // Order the tail explicitly rather than trusting the caller to hand over
      // an already-canonical array. `getAlbum()` does, but the guarantee should
      // not live outside this function.
      rest.sort(compareByCaptureTime(dir));
      return [...pinned, ...rest];
    }

    // `immich` is not a fourth algorithm — Immich albums only carry an
    // asc/desc flag, so inheriting it is capture-time order in that direction.
    // It means "inherit from Immich", not "the drag order in the Immich web
    // UI": that order is not exposed by the metadata search this client uses.
    case 'immich':
    default:
      return [...assets].sort(compareByCaptureTime(dir));
  }
}
