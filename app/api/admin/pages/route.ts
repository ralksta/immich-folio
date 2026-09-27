import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAdmin } from '@/lib/admin/withAdmin';
import { sanitizeSlug, serializeJournalMarkdown } from '@/lib/journal';
import { describeCollision, pageSlugCollision } from '@/lib/pages';
import { listPages, readPage, writePage } from '@/lib/admin/pages-service';
import { takenPageSlugs } from '@/lib/admin/pageSlugs';

/**
 * Content pages (#722). GET lists every page, with the slugs a page may not
 * take so the admin can warn while the operator types; POST creates one.
 *
 * Whether a page sits in the menu is gallery.yaml's business, saved by the
 * page builder — creating a page never touches the menu.
 */
export const GET = withAdmin(async () => {
  try {
    const [pages, taken] = await Promise.all([listPages(), takenPageSlugs()]);
    return NextResponse.json({ pages, taken });
  } catch (err) {
    console.error('[Admin API] Failed to list pages:', err);
    return NextResponse.json({ error: 'Failed to list pages' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  if (!title) {
    return NextResponse.json({ error: 'A page needs a title' }, { status: 400 });
  }
  const slug = sanitizeSlug(typeof body?.slug === 'string' && body.slug ? body.slug : title);

  try {
    const collision = pageSlugCollision(slug, await takenPageSlugs());
    if (collision) {
      return NextResponse.json({ error: describeCollision(slug, collision) }, { status: 409 });
    }
    if (await readPage(slug)) {
      return NextResponse.json({ error: `A page "${slug}" already exists.` }, { status: 409 });
    }

    // Created as a draft: an empty page should not go live before it has
    // content, whatever the menu says.
    const markdown = serializeJournalMarkdown({
      frontmatter: { title, draft: true },
      blocks: [],
      referencedAssetIds: [],
    });
    await writePage(slug, markdown);
    revalidatePath('/', 'layout');
    return NextResponse.json({ success: true, page: await readPage(slug) }, { status: 201 });
  } catch (err) {
    console.error('[Admin API] Failed to create page:', err);
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 });
  }
});
