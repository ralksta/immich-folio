/**
 * Content pages at `/<slug>` (#722): content/pages/<slug>.md rendered through
 * the journal's EssayView, without a date, reading time or journal index.
 *
 * Draft and password behave as on a journal entry: a draft is a 404 for
 * everyone but a signed-in admin, and a password shows the gate until the
 * `lb_auth_page_<slug>` cookie is set. The site password is enforced before
 * any of this runs, in proxy.ts.
 */

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { readPage, type PageRecord } from '@/lib/admin/pages-service';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import { isAuthenticated } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { getServerDictionary } from '@/lib/i18n/server';
import { ogImageUrl } from '@/lib/ogImage';
import PasswordGate from '@/components/PasswordGate';
import { EssayView } from './EssayView';
import { buildEssayPayload } from './essayPayload';

type Access = 'open' | 'draft' | 'locked';

async function accessFor(page: PageRecord): Promise<Access> {
  const { draft, password } = page.parsed.frontmatter;
  if (draft && !(await isAdminAuthenticated())) return 'draft';
  if (password) {
    const cookieStore = await cookies();
    if (!isAuthenticated(page.slug, (name) => cookieStore.get(name)?.value, 'page')) {
      return 'locked';
    }
  }
  return 'open';
}

/**
 * Metadata for `/<slug>` when it is a page, or null when it is not.
 *
 * A draft is described as not found, and a locked page by a generic
 * title only: generateMetadata runs ahead of the page's own gate, so the real
 * title and description must not reach the `<head>` (GHSA-fvgv-97g3-wjr7).
 */
export async function contentPageMetadata(slug: string): Promise<Metadata | null> {
  const page = await readPage(slug).catch(() => null);
  if (!page) return null;
  const access = await accessFor(page);
  const t = getServerDictionary();
  // A draft answers 404 to everyone but an admin, so it gets the not-found
  // title, and no robots tag that would contradict Next's own noindex.
  if (access === 'draft') return { title: t.error.notFoundTitle, robots: null };
  if (access === 'locked') {
    return { title: t.password.protectedPage, robots: { index: false } };
  }
  const { title: rawTitle, description } = page.parsed.frontmatter;
  const title = rawTitle || slug;
  const ogImage = ogImageUrl(title);
  return {
    title,
    ...(description ? { description } : {}),
    openGraph: { title, ...(description ? { description } : {}), images: [ogImage] },
    twitter: {
      card: 'summary_large_image',
      title,
      ...(description ? { description } : {}),
      images: [ogImage],
    },
  };
}

/**
 * The rendered page, `'not-found'` for a draft a visitor may not see, or null
 * when no page has this slug (the caller then tries a standalone album).
 */
export async function renderContentPage(
  slug: string,
): Promise<React.ReactElement | 'not-found' | null> {
  const page = await readPage(slug).catch(() => null);
  if (!page) return null;

  const access = await accessFor(page);
  if (access === 'draft') return 'not-found';
  const { frontmatter, blocks } = page.parsed;
  if (access === 'locked') {
    return <PasswordGate slug={slug} title={frontmatter.title || slug} type="page" />;
  }

  // No map block in v1 (#722): it is dropped before any of its photos are
  // fetched, so a hand-written `::map` cannot publish positions either.
  const { essay, images } = await buildEssayPayload(blocks, {
    logTag: 'page',
    slug,
    allowMap: false,
  });

  return (
    <div className="content-page" style={{ paddingTop: '2rem' }}>
      <EssayView
        // Only the title crosses to the client: the frontmatter also holds
        // the password, stored hashed but still not the visitor's business.
        essay={{ ...essay, frontmatter: { title: frontmatter.title } }}
        assets={images}
        title={frontmatter.title}
        watermark={getConfig().watermark}
      />
    </div>
  );
}
