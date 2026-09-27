/**
 * Keep gallery.yaml's `- page: <slug>` references in step with the page files
 * (#722): a deleted page leaves the menu, a renamed one keeps its place.
 *
 * Server only. Writes go through writeGalleryYaml(), so the previous
 * gallery.yaml is backed up first like every other admin save.
 */

import { readGalleryYaml, writeGalleryYaml } from './yaml-service';
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

/** Apply rewritePageRefs() to gallery.yaml on disk. True when the file changed. */
export async function updatePageRefs(from: string, to: string | null): Promise<boolean> {
  const gallery = await readGalleryYaml();
  if (!gallery || !Array.isArray(gallery.subpages)) return false;
  const next = rewritePageRefs(gallery.subpages, from, to);
  if (next === gallery.subpages) return false;
  await writeGalleryYaml({ ...gallery, subpages: next });
  invalidateConfigCache();
  return true;
}
