import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import { revalidatePath } from 'next/cache';
import {
  readGalleryYaml,
  readGalleryYamlVersioned,
  writeGalleryYaml,
} from '@/lib/admin/yaml-service';
import {
  VersionConflictError,
  baseVersionFrom,
  conflictResponse,
  etag,
} from '@/lib/admin/contentVersion';
import { invalidateConfigCache, deriveGallery } from '@/lib/config';
import type { GalleryYaml } from '@/lib/config/schema';
import { hashPasswordKeys } from '@/lib/admin/passwordHashing';
import { listPageSlugsSync } from '@/lib/admin/pages-service';

const PASSWORD_KEY = new Set(['password']);

/** GET: Read current gallery.yaml config. */
export const GET = withAdmin(async () => {
  const { data: gallery, version } = await readGalleryYamlVersioned();
  // `version` goes back in If-Match on save (#601).
  return NextResponse.json(
    { gallery: gallery || { hero: [], albums: [], subpages: [] }, version },
    { headers: { ETag: etag(version) } },
  );
});

/** PUT: Write gallery.yaml config. */
export const PUT = withAdmin(async (request: Request) => {
  const body = await request.json().catch(() => null);
  if (!body?.gallery) {
    return NextResponse.json({ error: 'Missing gallery data' }, { status: 400 });
  }

  // Validate basic structure
  const gallery = body.gallery as GalleryYaml;
  if (!Array.isArray(gallery.hero) && typeof gallery.hero !== 'string' && gallery.hero != null) {
    return NextResponse.json({ error: 'Invalid hero format' }, { status: 400 });
  }

  // Run the *real* derivation before writing. getConfig() throws on a gallery
  // with no albums and no subpages, a subpage with no name, or a subpage with
  // neither albums nor sections — all of which the page builder can produce.
  // Writing one used to report "Saved successfully" and then take the public
  // site down until someone noticed.
  //
  // Calling deriveGallery rather than re-checking those conditions here is
  // deliberate: a second copy of the rules would drift from the first. So is
  // validating before the write rather than rolling back after — a rollback
  // leaves a window in which other requests read the broken config.
  try {
    const derived = deriveGallery(gallery);
    // A subpage renamed onto a content page's slug would shadow the page
    // (#722). The page side of the same rule is enforced where pages save.
    const pageSlugs = new Set(listPageSlugsSync());
    const clash = derived.subpages.find((sp) => pageSlugs.has(sp.slug));
    if (clash) {
      throw new Error(
        `Subpage "${clash.name}" would take /${clash.slug}, which is already a content page. ` +
          `Rename one of them.`,
      );
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Invalid gallery structure';
    console.warn('[Admin] Rejected an unloadable gallery.yaml:', reason);
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  try {
    // Subpage and album passwords, wherever the entry sits (#690).
    const toWrite = await hashPasswordKeys(
      gallery,
      PASSWORD_KEY,
      await readGalleryYaml().catch(() => null),
    );
    const version = await writeGalleryYaml(toWrite, baseVersionFrom(request));
    invalidateConfigCache();
    // No immich.invalidateAll(): the Immich cache holds Immich's data only, and
    // the gallery.yaml side (allowlist, titles, order) is applied per request
    // from the new config. Clearing it made the next visitor refetch every
    // album although nothing in Immich had changed.
    // Revalidate all pages so the homepage picks up new hero images immediately
    revalidatePath('/', 'layout');
    revalidatePath('/[...path]', 'page');
    return NextResponse.json({
      success: true,
      message: 'Saved successfully. Backup of previous version created.',
      // What was written, passwords hashed, so the editor can take it over.
      gallery: toWrite,
      version,
    });
  } catch (err) {
    if (err instanceof VersionConflictError) return conflictResponse(err.currentVersion);
    console.error('[Admin] Failed to write gallery.yaml:', err);
    return NextResponse.json({ error: 'Failed to save gallery config' }, { status: 500 });
  }
});
