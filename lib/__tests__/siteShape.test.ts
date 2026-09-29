import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  getConfig: () => ({
    subpages: [],
    standaloneAlbums: [],
    aboutEnabled: false,
    map: false,
  }),
}));

vi.mock('@/lib/immich', () => ({
  immich: { getAlbums: async () => [] },
}));

vi.mock('@/lib/auth', () => ({
  isProtected: () => false,
  isSiteLocked: () => false,
}));

vi.mock('@/lib/admin/journal-service', () => ({
  listJournalEntries: async () => [
    { slug: 'open', frontmatter: { title: 'Open' } },
    { slug: 'locked', frontmatter: { title: 'Locked', password: 'scrypt:salt:hash' } },
    { slug: 'wip', frontmatter: { title: 'Draft', draft: true } },
  ],
}));

vi.mock('@/lib/admin/pages-service', () => ({
  listPages: async () => [],
}));

import { buildSiteShape } from '@/lib/siteShape';
import { publicPaths } from '@/lib/publicPages';

describe('buildSiteShape → publicPaths (the sitemap)', () => {
  it('lists a public journal entry', async () => {
    expect(publicPaths(await buildSiteShape())).toContain('/journal/open');
  });

  it('leaves out a password-protected journal entry, as /journal does', async () => {
    expect(publicPaths(await buildSiteShape())).not.toContain('/journal/locked');
  });

  it('leaves out a journal draft', async () => {
    expect(publicPaths(await buildSiteShape())).not.toContain('/journal/wip');
  });
});
