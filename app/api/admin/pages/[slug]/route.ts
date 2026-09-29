import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAdmin } from '@/lib/admin/withAdmin';
import { isValidSlug, parseJournalMarkdown, sanitizeSlug } from '@/lib/journal';
import { describeCollision, pageSlugCollision } from '@/lib/pages';
import { hashFrontmatterPassword } from '@/lib/admin/passwordHashing';
import { deletePage, readPage, savePage } from '@/lib/admin/pages-service';
import {
  VersionConflictError,
  baseVersionFrom,
  conflictResponse,
  etag,
} from '@/lib/admin/contentVersion';
import { takenPageSlugs } from '@/lib/admin/pageSlugs';
import { updatePageRefs, type GalleryVersionChange } from '@/lib/admin/pageRefs';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * Follow a page rename or delete in gallery.yaml's menu. Runs after the page
 * file already moved, so a failure here (gallery.yaml edited into invalid
 * YAML, a write error) must not turn the answer into a 500: the admin would be
 * told nothing was saved, keep the old slug, and hit a 404 on every retry.
 * The page change stands; the menu is left as it was and the admin is told.
 */
async function followInMenu(
  from: string,
  to: string | null,
): Promise<{ galleryVersion: GalleryVersionChange | null; warning?: string }> {
  try {
    return { galleryVersion: await updatePageRefs(from, to) };
  } catch (err) {
    console.error(`[Admin API] Page "${from}" changed, but gallery.yaml was not updated:`, err);
    return {
      galleryVersion: null,
      warning:
        to === null
          ? `Page deleted, but its menu entry could not be removed from gallery.yaml. Remove "page: ${from}" there by hand.`
          : `Page renamed, but the menu in gallery.yaml could not be updated. Change "page: ${from}" to "page: ${to}" there by hand.`,
    };
  }
}

export const GET = withAdmin(async (_request: Request, context: RouteContext) => {
  const { slug } = await context.params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }
  try {
    const page = await readPage(slug);
    if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    // `version` goes back in If-Match on save (#601).
    const version = page.version;
    return NextResponse.json({ page, version }, { headers: { ETag: etag(version) } });
  } catch (err) {
    console.error(`[Admin API] Failed to read page "${slug}":`, err);
    return NextResponse.json({ error: 'Failed to read page' }, { status: 500 });
  }
});

/**
 * Save a page. `newSlug` renames it: the slug is checked like a new one, the
 * menu reference in gallery.yaml follows, and old links break — the admin
 * says so before sending it. There are no automatic redirects (#722).
 */
export const PUT = withAdmin(async (request: Request, context: RouteContext) => {
  const { slug } = await context.params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const rawMarkdown = body?.rawMarkdown;
  if (typeof rawMarkdown !== 'string') {
    return NextResponse.json({ error: 'Missing rawMarkdown content' }, { status: 400 });
  }

  try {
    const current = await readPage(slug);
    if (!current) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

    // Refuse what the parser cannot read before anything is written.
    parseJournalMarkdown(rawMarkdown);

    const targetSlug =
      typeof body.newSlug === 'string' && body.newSlug ? sanitizeSlug(body.newSlug) : slug;
    if (targetSlug !== slug) {
      const collision = pageSlugCollision(targetSlug, await takenPageSlugs());
      if (collision) {
        return NextResponse.json(
          { error: describeCollision(targetSlug, collision) },
          { status: 409 },
        );
      }
      if (await readPage(targetSlug)) {
        return NextResponse.json(
          { error: `A page "${targetSlug}" already exists.` },
          { status: 409 },
        );
      }
    }

    // Stored hashed (#690); the current file supplies the hash to keep.
    const markdown = await hashFrontmatterPassword(rawMarkdown, current.rawMarkdown);

    // A rename is checked against the file the editor loaded, the old slug.
    const version = await savePage(targetSlug, markdown, {
      baseVersion: baseVersionFrom(request),
      fromSlug: slug,
    });
    const { galleryVersion, warning } =
      targetSlug !== slug
        ? await followInMenu(slug, targetSlug)
        : { galleryVersion: null, warning: undefined };

    revalidatePath('/', 'layout');
    return NextResponse.json({
      success: true,
      page: await readPage(targetSlug),
      menuRenamed: galleryVersion !== null,
      // So the open page builder can follow the menu rewrite (#601).
      galleryVersion,
      version,
      ...(warning ? { warning } : {}),
    });
  } catch (err) {
    if (err instanceof VersionConflictError) return conflictResponse(err.currentVersion);
    console.error(`[Admin API] Failed to save page "${slug}":`, err);
    return NextResponse.json({ error: 'Failed to save page' }, { status: 500 });
  }
});

/**
 * Delete a page. A `.deleted.bak` copy is kept, and a menu reference is
 * removed from gallery.yaml (backed up as well), so the menu does not keep
 * pointing at nothing.
 */
export const DELETE = withAdmin(async (_request: Request, context: RouteContext) => {
  const { slug } = await context.params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }
  try {
    const deleted = await deletePage(slug);
    if (!deleted) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    const { galleryVersion, warning } = await followInMenu(slug, null);
    revalidatePath('/', 'layout');
    return NextResponse.json({
      success: true,
      deletedSlug: slug,
      removedFromMenu: galleryVersion !== null,
      galleryVersion,
      ...(warning ? { warning } : {}),
    });
  } catch (err) {
    console.error(`[Admin API] Failed to delete page "${slug}":`, err);
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 });
  }
});
