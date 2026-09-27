import { describe, it, expect } from 'vitest';
import { siteNavLinks, type SiteNavInput } from '../siteNav';
import { getDictionary } from '../i18n';

const t = getDictionary('en');

const base: SiteNavInput = {
  menu: [
    { key: 'sp-travel', href: '/travel', label: 'Travel' },
    { key: 'page-prices', href: '/prices', label: 'Prices' },
    { key: 'sp-people', href: '/people', label: 'People' },
  ],
  subpageAlbumCounts: new Map([
    ['travel', 3],
    ['people', 1],
  ]),
  albums: [{ id: 'a1', slug: 'birds', albumName: 'Birds', assetCount: 12 }],
  hasJournal: true,
  aboutEnabled: true,
  map: true,
};

describe('siteNavLinks', () => {
  it('orders subpages and pages, albums, Journal, About, Map (#696)', () => {
    expect(siteNavLinks(base, t).map((l) => l.href)).toEqual([
      '/travel',
      '/prices',
      '/people',
      '/birds',
      '/journal',
      '/about',
      '/map',
    ]);
  });

  it('leaves out Journal, About and Map when they are off', () => {
    const links = siteNavLinks({ ...base, hasJournal: false, aboutEnabled: false, map: false }, t);
    expect(links.map((l) => l.href)).not.toContain('/about');
    expect(links.map((l) => l.href)).not.toContain('/journal');
    expect(links.map((l) => l.href)).not.toContain('/map');
  });

  it('attaches counts to subpages and albums only', () => {
    const byHref = new Map(siteNavLinks(base, t).map((l) => [l.href, l.count]));
    expect(byHref.get('/travel')).toBe('3 albums');
    expect(byHref.get('/people')).toBe('1 album');
    expect(byHref.get('/birds')).toBe('12 photos');
    expect(byHref.get('/prices')).toBeUndefined();
    expect(byHref.get('/about')).toBeUndefined();
  });

  it('is empty for a site with nothing to link', () => {
    expect(
      siteNavLinks({ menu: [], albums: [], hasJournal: false, aboutEnabled: false, map: false }, t),
    ).toEqual([]);
  });
});
