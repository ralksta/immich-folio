import { describe, it, expect, vi } from 'vitest';

/**
 * Content page passwords (#722): their own cookie, `lb_auth_page_<slug>`,
 * through the same authenticate()/isAuthenticated() path as every other gate,
 * and a token that no other gate of the same slug and password accepts.
 */
vi.mock('@/lib/config', () => ({
  getConfig: () => ({
    authSecret: 'test-auth-secret-32-chars-long-min',
    standaloneAlbums: [],
    albumPasswords: {},
    subpages: [{ name: 'Pricing', slug: 'pricing', albumIds: [], password: 'shared' }],
  }),
}));

vi.mock('@/lib/admin/pages-service', () => ({
  readPageSync: (slug: string) =>
    slug === 'pricing' || slug === 'open'
      ? {
          slug,
          rawMarkdown: '',
          parsed: {
            frontmatter: slug === 'pricing' ? { password: 'shared' } : {},
            blocks: [],
            referencedAssetIds: [],
          },
        }
      : null,
}));

vi.spyOn(console, 'warn').mockImplementation(() => {});

import { authenticate, isAuthenticated, isProtected } from '@/lib/auth';

function cookieFrom(setCookie: string): [string, string] {
  const [pair] = setCookie.split(';');
  const eq = pair.indexOf('=');
  return [pair.slice(0, eq), pair.slice(eq + 1)];
}

describe('content page passwords', () => {
  it('knows which pages are protected', () => {
    expect(isProtected('pricing', 'page')).toBe(true);
    expect(isProtected('open', 'page')).toBe(false);
    expect(isProtected('missing', 'page')).toBe(false);
  });

  it('sets lb_auth_page_<slug> and accepts it back', async () => {
    const setCookie = await authenticate('pricing', 'shared', 'page');
    expect(setCookie).not.toBeNull();
    const [name, value] = cookieFrom(setCookie!);
    expect(name).toBe('lb_auth_page_pricing');
    expect(isAuthenticated('pricing', (n) => (n === name ? value : undefined), 'page')).toBe(true);
  });

  it('refuses a wrong password', async () => {
    expect(await authenticate('pricing', 'nope', 'page')).toBeNull();
  });

  it('does not accept a subpage token of the same slug and password', async () => {
    const [, subpageValue] = cookieFrom((await authenticate('pricing', 'shared', 'subpage'))!);
    expect(
      isAuthenticated(
        'pricing',
        (n) => (n === 'lb_auth_page_pricing' ? subpageValue : undefined),
        'page',
      ),
    ).toBe(false);
  });
});
