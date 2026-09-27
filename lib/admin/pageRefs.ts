/**
 * Keep gallery.yaml's `- page: <slug>` references in step with the page files
 * (#722): a deleted page leaves the menu, a renamed one keeps its place.
 *
 * Server only. Writes go through writeGalleryYaml(), so the previous
 * gallery.yaml is backed up first like every other admin save.
 */

import { readGalleryYamlVersioned, writeGalleryYaml } from './yaml-service';
import { VersionConflictError } from './contentVersion';
import { invalidateConfigCache, isPageRef } from '../config';

/**
 * Pure: the `subpages:` list with every reference to `from` replaced by `to`,
 * or dropped when `to` is null. Returns the same list when nothing matched.
 */
export function rewritePageRefs<T>(subpages: T[], from: string, to: string | null): T[] {
  if (!subpages.some((e) => isPageRef(e) && e.page === from)) return subpages;
  return subpages.flatMap((entry) => {
    if (!isPageRef(entry) || entry.page !== from) return [entry];
    return to === null ? [] : [{ ...entry, page: to } as T];
  });
}

/** gallery.yaml's version before and after a menu rewrite (#601). */
export interface GalleryVersionChange {
  from: string;
  to: string;
}

/**
 * Apply rewritePageRefs() to gallery.yaml on disk. Returns the version change
 * when the file changed, null when it did not.
 *
 * The page builder is open while this runs and holds gallery.yaml's version.
 * With `from` and `to` it can tell "only this rewrite happened since I loaded"
 * (take the new version) from "someone else saved too" (keep the old one, so
 * its next save is refused rather than clobbering). The write itself is
 * checked against the version read here, and re-read on a conflict, so a
 * builder save racing the rewrite is not overwritten either.
 */
export async function updatePageRefs(
  from: string,
  to: string | null,
): Promise<GalleryVersionChange | null> {
  for (let attempt = 0; ; attempt++) {
    const { data: gallery, version } = await readGalleryYamlVersioned();
    if (!gallery || !Array.isArray(gallery.subpages)) return null;
    const next = rewritePageRefs(gallery.subpages, from, to);
    if (next === gallery.subpages) return null;
    try {
      const written = await writeGalleryYaml({ ...gallery, subpages: next }, version);
      invalidateConfigCache();
      return { from: version, to: written };
    } catch (err) {
      if (!(err instanceof VersionConflictError) || attempt >= 2) throw err;
    }
  }
}
