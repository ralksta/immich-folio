/**
 * The gallery.yaml ↔ page-builder translation for album entries.
 *
 * Extracted from PageBuilder.tsx so it can be tested on its own: this is the
 * code that decides what survives a save, and a field it does not know about
 * is discarded silently rather than failing (#614).
 */

import { DEFAULT_ALBUM_SORT, isAlbumSortMode } from '@/lib/albumSort';
import { type AlbumEntryObject } from '@/lib/config/schema';
import type { AlbumEntry } from './types';

export type RawAlbumEntry = string | Record<string, string | AlbumEntryObject>;

/**
 * Whether an entry carries anything beyond its ID.
 *
 * Both collapse rules below depend on this, and they are the reason every new
 * per-album option has to be listed here: an entry that looks "empty" is
 * serialized back to a bare UUID string, so a field missing from this check is
 * silently dropped on the next save.
 */
export function hasAlbumOptions(entry: AlbumEntry): boolean {
  return Boolean(
    entry.description ||
    entry.password ||
    entry.heroImage ||
    (entry.sort && entry.sort !== DEFAULT_ALBUM_SORT) ||
    entry.assetOrder?.length ||
    entry.grid ||
    entry.coverPosition ||
    entry.location ||
    entry.download,
  );
}

export function parseAlbumEntries(raw: RawAlbumEntry[] | undefined): AlbumEntry[] {
  if (!raw) return [];
  return raw.map((entry) => {
    if (typeof entry === 'string') return { id: entry };
    const [id, value] = Object.entries(entry)[0];
    if (typeof value === 'string') return { id, title: value };
    return {
      id,
      title: value.title,
      description: value.description,
      password: value.password,
      heroImage: value.heroImage,
      sort: isAlbumSortMode(value.sort) ? value.sort : undefined,
      assetOrder: value.assetOrder,
      grid: value.grid,
      coverPosition: value.coverPosition,
      location: value.location,
      download: value.download,
    };
  });
}

export function serializeAlbumEntries(entries: AlbumEntry[]): RawAlbumEntry[] {
  return entries.map((entry) => {
    const extras = hasAlbumOptions(entry);
    if (!entry.title && !extras) return entry.id;
    if (entry.title && !extras) return { [entry.id]: entry.title };

    const val: AlbumEntryObject = {};
    // Only when set: a sort-only entry would otherwise be written with an empty
    // title, which deriveGallery ignores but which still lands in the YAML.
    if (entry.title) val.title = entry.title;
    if (entry.description) val.description = entry.description;
    if (entry.password) val.password = entry.password;
    if (entry.heroImage) val.heroImage = entry.heroImage;
    if (entry.sort && entry.sort !== DEFAULT_ALBUM_SORT) val.sort = entry.sort;
    // Persisted regardless of the mode, so manual → newest → manual does not
    // throw away a hand-curated order.
    if (entry.assetOrder?.length) val.assetOrder = entry.assetOrder;
    if (entry.grid) val.grid = entry.grid;
    if (entry.coverPosition) val.coverPosition = entry.coverPosition;
    // No UI sets this yet; it is preserved so that saving an unrelated change
    // cannot quietly republish exact coordinates for an album deliberately
    // placed at city level or hidden from the map (#469).
    if (entry.location) val.location = entry.location;
    // Same story as location: set by hand in YAML since #475, with no UI, so
    // the builder was turning original downloads back off on the next save.
    if (entry.download) val.download = entry.download;
    return { [entry.id]: val };
  });
}
