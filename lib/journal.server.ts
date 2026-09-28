/**
 * Journal reads for server rendering, memoised for the length of one request.
 *
 * A journal page reads the same files from several places in one render: the
 * header nav (`loadSiteNav()` in the root layout) lists every entry to decide
 * whether Journal belongs in the menu, the page lists them again for its
 * index or its prev/next links, and an entry's `generateMetadata()` reads the
 * entry the page body reads a moment later. React's `cache()` hands all of
 * them one result per request — each request still reads the files afresh,
 * so an edit shows on the next page load as before.
 *
 * Render only: outside a React server render `cache()` does not memoise, and
 * admin routes, which read back what they just wrote, keep calling
 * `lib/admin/journal-service` directly. Callers must not mutate the results,
 * which are shared.
 */

import { cache } from 'react';
import { listJournalEntries, readJournalEntry } from './admin/journal-service';

export const listJournalEntriesForRequest = cache(listJournalEntries);

export const readJournalEntryForRequest = cache(readJournalEntry);
