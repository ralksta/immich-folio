/**
 * Whether the catch-all has anything to show for a path — asked before the
 * page streams, so that a miss can still answer with a real 404.
 *
 * Next commits to the status with the first byte. The page used to sit inside
 * a loading.tsx Suspense boundary, so the skeleton went out as a 200 and the
 * notFound() that followed could only add a noindex tag: every unknown slug, an
 * offline subpage, a draft content page and `/<subpage>/<unknown>` were soft
 * 404s. The page now calls this first, outside any boundary, and only then
 * streams the skeleton around the part that fetches photos.
 *
 * Cost: it reads the config, the album list and content/pages/. The album list
 * is the one the header nav already waits for before the first byte, so this
 * adds no Immich request and no latency; the album's assets — the slow part —
 * are still fetched behind the skeleton.
 *
 * It mirrors the order of gates and 404s in the page body, and may be looser
 * than the body, never stricter. A path it passes that the body then rejects
 * only loses the status (an album that vanished from Immich between the list
 * and the asset fetch stays a soft 404); a path it rejects that the body would
 * render is a page nobody can open.
 *
 * Errors propagate. An Immich outage with no stale list to fall back on must
 * surface as an error, never as "this album does not exist".
 */

import { cookies } from 'next/headers';
import { immich } from '@/lib/immich';
import { isAuthenticated, isProtected } from '@/lib/auth';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import { contentPageAccess } from './contentPage';

/** Whether `key` is password-protected and this request has not unlocked it. */
export async function isLocked(key: string, type: 'subpage' | 'album'): Promise<boolean> {
  if (!isProtected(key, type)) return false;
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  return !isAuthenticated(key, getCookie, type);
}

/** `path` is already slug-normalised, as the page hands it over. */
export async function routeExists(path: readonly string[] | undefined): Promise<boolean> {
  // One segment or two: nothing on this site lives deeper, for anyone.
  if (!path || path.length === 0 || path.length > 2) return false;
  if (await exists(path)) return true;
  // Where a visitor gets the 404, a signed-in admin gets a diagnostic banner
  // (or the draft content page).
  return isAdminAuthenticated();
}

async function exists([first, second]: readonly string[]): Promise<boolean> {
  if (second !== undefined) {
    // A locked subpage shows its gate for any album slug below it. Answering
    // 404 for the unknown ones would tell a visitor without the password which
    // albums are behind it.
    if (await isLocked(first, 'subpage')) return true;
    return (await immich.findAlbumBySlug(second, first)) !== null;
  }

  if (immich.isSubpageSlug(first)) {
    if (await isLocked(first, 'subpage')) return true;
    const result = await immich.getSubpageAlbums(first);
    return !!result && result.albums.length > 0;
  }

  const page = await contentPageAccess(first);
  if (page) return page !== 'draft';

  return (await immich.findAlbumBySlug(first)) !== null;
}
