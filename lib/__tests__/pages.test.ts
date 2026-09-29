import { describe, it, expect } from 'vitest';
import {
  RESERVED_PAGE_SLUGS,
  describeCollision,
  menuPageSlugs,
  pageSlugCollision,
  resolveMenu,
  type NavEntry,
  type PageSummary,
} from '../pages';
import { deriveGallery, type GalleryYaml } from '../config';
import { rewritePageRefs } from '../admin/pageRefs';

const A1 = '11111111-1111-4111-8111-111111111111';
const A2 = '22222222-2222-4222-8222-222222222222';

const none = { subpages: [], albums: [], journal: [] };

describe('pageSlugCollision (#722)', () => {
  it('accepts a free slug', () => {
    expect(pageSlugCollision('pricing', none)).toBeNull();
  });

  it.each(RESERVED_PAGE_SLUGS)('refuses the built-in route /%s', (slug) => {
    expect(pageSlugCollision(slug, none)).toEqual({ kind: 'reserved' });
  });

  it('refuses a slug taken by a subpage, an album or a journal entry', () => {
    const taken = { subpages: ['travel'], albums: ['iceland'], journal: ['trip'] };
    expect(pageSlugCollision('travel', taken)).toEqual({ kind: 'subpage' });
    expect(pageSlugCollision('iceland', taken)).toEqual({ kind: 'album' });
    expect(pageSlugCollision('trip', taken)).toEqual({ kind: 'journal' });
  });

  it('compares without regard to case', () => {
    expect(pageSlugCollision('Travel', { ...none, subpages: ['travel'] })).toEqual({
      kind: 'subpage',
    });
    expect(pageSlugCollision('ADMIN', none)).toEqual({ kind: 'reserved' });
  });

  it('refuses what is not a slug at all', () => {
    expect(pageSlugCollision('a/b', none)).toEqual({ kind: 'invalid' });
    expect(pageSlugCollision('', none)).toEqual({ kind: 'invalid' });
  });

  it('describes each collision in a sentence naming the slug', () => {
    for (const kind of ['invalid', 'reserved', 'subpage', 'album', 'journal'] as const) {
      expect(describeCollision('x', { kind })).toContain('x');
    }
  });
});

describe('deriveGallery: `- page:` references (#722)', () => {
  const gallery = (subpages: NonNullable<GalleryYaml['subpages']>): GalleryYaml => ({ subpages });

  it('keeps pages and subpages in one menu order', () => {
    const { nav, subpages } = deriveGallery(
      gallery([
        { page: 'pricing' },
        { name: 'Travel', albums: [A1] },
        { page: 'faq' },
        { name: 'Weddings', albums: [A2] },
      ]),
    );
    expect(subpages.map((s) => s.slug)).toEqual(['travel', 'weddings']);
    expect(nav).toEqual([
      { type: 'page', slug: 'pricing' },
      { type: 'subpage', slug: 'travel' },
      { type: 'page', slug: 'faq' },
      { type: 'subpage', slug: 'weddings' },
    ]);
    expect(menuPageSlugs(nav)).toEqual(['pricing', 'faq']);
  });

  it('allows a gallery whose menu holds only pages', () => {
    expect(deriveGallery(gallery([{ page: 'pricing' }])).nav).toEqual([
      { type: 'page', slug: 'pricing' },
    ]);
  });

  it('rejects an invalid page slug and a page listed twice', () => {
    expect(() => deriveGallery(gallery([{ page: '../x' }]))).toThrow(/not a valid page slug/);
    expect(() => deriveGallery(gallery([{ page: 'a' }, { page: 'a' }]))).toThrow(/more than once/);
  });

  it('builds the menu from the map form of subpages too', () => {
    const { nav } = deriveGallery({ subpages: { Travel: [A1] } });
    expect(nav).toEqual([{ type: 'subpage', slug: 'travel' }]);
  });
});

describe('resolveMenu (#722)', () => {
  const nav: NavEntry[] = [
    { type: 'subpage', slug: 'travel' },
    { type: 'page', slug: 'pricing' },
    { type: 'subpage', slug: 'hidden' },
    { type: 'page', slug: 'draft' },
    { type: 'page', slug: 'missing' },
    { type: 'page', slug: 'locked' },
  ];
  const pages: PageSummary[] = [
    { slug: 'pricing', frontmatter: { title: 'Pricing' } },
    { slug: 'draft', frontmatter: { title: 'Soon', draft: true } },
    { slug: 'locked', frontmatter: { password: 'scrypt:a:b' } },
  ];

  it('interleaves visible subpages and published pages in gallery.yaml order', () => {
    const menu = resolveMenu(nav, [{ slug: 'travel', name: 'Travel' }], pages);
    expect(menu.map((m) => [m.href, m.label])).toEqual([
      ['/travel', 'Travel'],
      ['/pricing', 'Pricing'],
      // A protected page stays listed; its title falls back to the slug.
      ['/locked', 'locked'],
    ]);
  });

  // `name` is the gallery.yaml key the slug is built from ("south-korea");
  // `title` is what the page itself shows ("South Korea"). The menu showed
  // the key.
  it('labels a subpage with its title, falling back to its name', () => {
    const menu = resolveMenu(
      [
        { type: 'subpage', slug: 'south-korea' },
        { type: 'subpage', slug: 'travel' },
      ],
      [
        { slug: 'south-korea', name: 'south-korea', title: 'South Korea' },
        { slug: 'travel', name: 'Travel' },
      ],
      [],
    );
    expect(menu.map((m) => m.label)).toEqual(['South Korea', 'Travel']);
  });
});

describe('rewritePageRefs (#722)', () => {
  const list = [{ name: 'Travel' }, { page: 'pricing' }, { page: 'faq' }];

  it('renames a reference in place', () => {
    expect(rewritePageRefs(list, 'pricing', 'rates')).toEqual([
      { name: 'Travel' },
      { page: 'rates' },
      { page: 'faq' },
    ]);
  });

  it('removes a reference', () => {
    expect(rewritePageRefs(list, 'faq', null)).toEqual([{ name: 'Travel' }, { page: 'pricing' }]);
  });

  it('returns the same list when nothing matches', () => {
    expect(rewritePageRefs(list, 'nothing', null)).toBe(list);
  });
});
