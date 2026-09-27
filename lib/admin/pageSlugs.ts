/**
 * The slugs a content page must not take (#722), gathered from the live
 * configuration: subpages, standalone albums and journal entries. The fixed
 * routes are checked by pageSlugCollision() itself.
 *
 * Server only. Album slugs need Immich; when it cannot answer, the album list
 * is empty rather than the whole check failing — a save during an Immich
 * outage should not be refused for a reason nobody can see.
 */

import { getConfig } from '../config';
import { immich } from '../immich';
import { listJournalEntries } from './journal-service';
import type { SlugTakenBy } from '../pages';

export async function takenPageSlugs(): Promise<SlugTakenBy> {
  const config = getConfig();
  const [albums, journal] = await Promise.all([
    immich.getStandaloneAlbums().catch(() => []),
    listJournalEntries().catch(() => []),
  ]);
  return {
    subpages: config.subpages.map((sp) => sp.slug),
    albums: albums.map((a) => a.slug),
    journal: journal.map((e) => e.slug),
  };
}
