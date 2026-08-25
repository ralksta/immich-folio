import { describe, it, expect } from 'vitest';
import { publicPaths, type SiteShape } from '@/lib/publicPages';

const site = (over: Partial<SiteShape> = {}): SiteShape => ({
  siteLocked: false,
  subpages: [],
  standaloneAlbums: [],
  journal: [],
  isAlbumProtected: () => false,
  aboutEnabled: false,
  mapEnabled: false,
  journalEnabled: false,
  ...over,
});

const openSubpage = (slug: string, albums: { id: string; slug: string }[] = []) => ({
  slug,
  enabled: true,
  hidden: false,
  isProtected: false,
  albums,
});

describe('publicPaths', () => {
  it('always lists the home page', () => {
    expect(publicPaths(site())).toEqual(['/']);
  });

  it('lists the static pages that are switched on', () => {
    const paths = publicPaths(site({ aboutEnabled: true, mapEnabled: true, journalEnabled: true }));
    expect(paths).toEqual(['/', '/about', '/map', '/journal']);
  });

  it('lists a subpage and its albums', () => {
    const paths = publicPaths(
      site({ subpages: [openSubpage('travel', [{ id: 'a', slug: 'iceland' }])] }),
    );
    expect(paths).toEqual(['/', '/travel', '/travel/iceland']);
  });

  it('lists standalone albums at the root', () => {
    expect(publicPaths(site({ standaloneAlbums: [{ id: 'a', slug: 'portraits' }] }))).toEqual([
      '/',
      '/portraits',
    ]);
  });

  // ── Exclusions ────────────────────────────────────────────────

  it('yields nothing at all for a locked site', () => {
    const paths = publicPaths(
      site({
        siteLocked: true,
        aboutEnabled: true,
        subpages: [openSubpage('travel', [{ id: 'a', slug: 'iceland' }])],
        standaloneAlbums: [{ id: 'b', slug: 'portraits' }],
      }),
    );
    expect(paths).toEqual([]);
  });

  it('omits a disabled subpage', () => {
    const sp = { ...openSubpage('travel', [{ id: 'a', slug: 'iceland' }]), enabled: false };
    expect(publicPaths(site({ subpages: [sp] }))).toEqual(['/']);
  });

  it('omits a hidden subpage — a listing is the opposite of a direct link', () => {
    const sp = { ...openSubpage('travel', [{ id: 'a', slug: 'iceland' }]), hidden: true };
    expect(publicPaths(site({ subpages: [sp] }))).toEqual(['/']);
  });

  it('omits a password-protected subpage', () => {
    const sp = { ...openSubpage('clients', [{ id: 'a', slug: 'wedding' }]), isProtected: true };
    expect(publicPaths(site({ subpages: [sp] }))).toEqual(['/']);
  });

  it('omits a protected album inside an open subpage', () => {
    const paths = publicPaths(
      site({
        subpages: [
          openSubpage('travel', [
            { id: 'open', slug: 'iceland' },
            { id: 'locked', slug: 'private' },
          ]),
        ],
        isAlbumProtected: (id) => id === 'locked',
      }),
    );
    expect(paths).toEqual(['/', '/travel', '/travel/iceland']);
  });

  it('omits a protected standalone album', () => {
    const paths = publicPaths(
      site({
        standaloneAlbums: [
          { id: 'open', slug: 'portraits' },
          { id: 'locked', slug: 'clients' },
        ],
        isAlbumProtected: (id) => id === 'locked',
      }),
    );
    expect(paths).toEqual(['/', '/portraits']);
  });

  /**
   * Inheritance — the case the issue calls out. The album itself has no
   * password, but it can only be reached through a subpage that does.
   */
  it('omits a public album that sits under a protected subpage', () => {
    const sp = { ...openSubpage('clients', [{ id: 'open', slug: 'wedding' }]), isProtected: true };
    const paths = publicPaths(site({ subpages: [sp] }));
    expect(paths).not.toContain('/clients/wedding');
    expect(paths).toEqual(['/']);
  });

  it('omits a public album under a hidden subpage for the same reason', () => {
    const sp = { ...openSubpage('secret', [{ id: 'open', slug: 'wedding' }]), hidden: true };
    expect(publicPaths(site({ subpages: [sp] }))).not.toContain('/secret/wedding');
  });

  it('omits journal drafts', () => {
    const paths = publicPaths(
      site({
        journalEnabled: true,
        journal: [
          { slug: 'published', draft: false },
          { slug: 'wip', draft: true },
        ],
      }),
    );
    expect(paths).toEqual(['/', '/journal', '/journal/published']);
  });

  it('omits journal entries entirely when the journal is off', () => {
    const paths = publicPaths(
      site({ journalEnabled: false, journal: [{ slug: 'published', draft: false }] }),
    );
    expect(paths).toEqual(['/']);
  });

  // ── Shape ─────────────────────────────────────────────────────

  it('emits no duplicates when a subpage and an album share a slug', () => {
    const paths = publicPaths(
      site({
        subpages: [openSubpage('travel')],
        standaloneAlbums: [{ id: 'a', slug: 'travel' }],
      }),
    );
    expect(paths).toEqual([...new Set(paths)]);
  });

  it('emits only absolute-looking, single-slash paths', () => {
    const paths = publicPaths(
      site({
        aboutEnabled: true,
        journalEnabled: true,
        journal: [{ slug: 'story', draft: false }],
        subpages: [openSubpage('travel', [{ id: 'a', slug: 'iceland' }])],
        standaloneAlbums: [{ id: 'b', slug: 'portraits' }],
      }),
    );
    for (const p of paths) {
      expect(p.startsWith('/')).toBe(true);
      expect(p).not.toMatch(/\/\//);
    }
  });
});
