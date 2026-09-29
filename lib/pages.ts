/**
 * Content pages (#722): timeless pages such as pricing, workshops or a booking
 * FAQ, stored one per file in `content/pages/<slug>.md` and served at
 * `/<slug>`.
 *
 * Client-safe (no `fs`) — the admin UI imports the slug rules from here. The
 * file access lives in lib/admin/pages-service.ts.
 *
 * A page is block markdown in the journal format (lib/journal.ts), with a
 * smaller frontmatter: `title`, `description` (SEO), `password`, `draft`.
 * Whether it appears in the menu is not a property of the file: it is decided
 * by a `- page: <slug>` entry among the subpages in gallery.yaml, so the menu
 * order lives in exactly one place.
 */

import { isValidSlug, type JournalFrontmatter } from './journal';

export type PageFrontmatter = Pick<
  JournalFrontmatter,
  'title' | 'description' | 'password' | 'draft'
>;

export interface PageSummary {
  slug: string;
  frontmatter: PageFrontmatter;
}

/**
 * First path segments the app serves itself. A page slugged like one of them
 * would never be reached — the fixed route wins — so it is refused outright.
 * `proof` and `contact` are fixed routes too, beyond the list in the issue.
 */
export const RESERVED_PAGE_SLUGS: readonly string[] = [
  'about',
  'map',
  'journal',
  'impressum',
  'privacy',
  'install',
  'admin',
  'gate',
  'api',
  'proof',
  'contact',
];

/** Everything a page slug must not collide with. */
export interface SlugTakenBy {
  subpages: readonly string[];
  albums: readonly string[];
  journal: readonly string[];
}

export type SlugCollision =
  | { kind: 'invalid' }
  | { kind: 'reserved' }
  | { kind: 'subpage' }
  | { kind: 'album' }
  | { kind: 'journal' };

/**
 * Why `slug` cannot be a page's URL, or null when it can.
 *
 * Journal entries live under /journal/ and cannot shadow a page, but they are
 * checked all the same (#722): a page and an entry of the same name are two
 * things a visitor would expect at one address.
 */
export function pageSlugCollision(slug: string, taken: SlugTakenBy): SlugCollision | null {
  if (!isValidSlug(slug)) return { kind: 'invalid' };
  const wanted = slug.toLowerCase();
  if (RESERVED_PAGE_SLUGS.includes(wanted)) return { kind: 'reserved' };
  if (taken.subpages.some((s) => s.toLowerCase() === wanted)) return { kind: 'subpage' };
  if (taken.albums.some((s) => s.toLowerCase() === wanted)) return { kind: 'album' };
  if (taken.journal.some((s) => s.toLowerCase() === wanted)) return { kind: 'journal' };
  return null;
}

/** A sentence for the admin UI and the doctor. */
export function describeCollision(slug: string, collision: SlugCollision): string {
  switch (collision.kind) {
    case 'invalid':
      return `"${slug}" is not a valid slug: use letters, digits, "-" and "_" only.`;
    case 'reserved':
      return `/${slug} is a built-in route of the site.`;
    case 'subpage':
      return `/${slug} is already a subpage.`;
    case 'album':
      return `/${slug} is already a standalone album.`;
    case 'journal':
      return `A journal entry already uses the slug "${slug}".`;
  }
}

/** One entry of the header menu, in gallery.yaml order. */
export type NavEntry = { type: 'subpage'; slug: string } | { type: 'page'; slug: string };

/** The page slugs referenced from gallery.yaml, i.e. the pages shown in the menu. */
export function menuPageSlugs(nav: readonly NavEntry[]): string[] {
  return nav.filter((e) => e.type === 'page').map((e) => e.slug);
}

export interface MenuItem {
  key: string;
  href: string;
  label: string;
}

/**
 * The header menu's subpage and page links, in gallery.yaml order.
 *
 * `visibleSubpages` is what the menu may show (hidden and disabled subpages
 * already dropped). A page reference whose file is missing, or that is still a
 * draft, is left out the same way. A password-protected page stays listed, as
 * a protected subpage does: the gate is at the page, not in the menu.
 */
export function resolveMenu(
  nav: readonly NavEntry[],
  visibleSubpages: ReadonlyArray<{ slug: string; name: string; title?: string }>,
  pages: readonly PageSummary[],
): MenuItem[] {
  const subpageBySlug = new Map(visibleSubpages.map((sp) => [sp.slug, sp]));
  const pageBySlug = new Map(pages.map((p) => [p.slug, p]));
  return nav.flatMap((entry): MenuItem[] => {
    if (entry.type === 'subpage') {
      const sp = subpageBySlug.get(entry.slug);
      // The title a visitor sees on the page itself; `name` is the key the
      // slug is made from, and only stands in when no title is set.
      return sp ? [{ key: `sp-${sp.slug}`, href: `/${sp.slug}`, label: sp.title || sp.name }] : [];
    }
    const page = pageBySlug.get(entry.slug);
    if (!page || page.frontmatter.draft) return [];
    return [
      {
        key: `page-${page.slug}`,
        href: `/${page.slug}`,
        label: page.frontmatter.title || page.slug,
      },
    ];
  });
}
