import { describe, it, expect, vi } from 'vitest';

/**
 * isAlbumZoomReachable (#467): the zoom route's gate. A route to the album the
 * visitor could have taken, with every password on it given, on which zoom
 * resolves on — asked per route, not as two separate questions.
 */

const ID = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;

const config = vi.hoisted(() => ({
  immich: { apiKey: 'k' },
  authSecret: 'test-auth-secret-32-chars-long-min',
  zoom: false,
  standaloneAlbumZoom: {} as Record<string, boolean>,
  standaloneAlbums: [] as string[],
  albumPasswords: {} as Record<string, string>,
  subpages: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/config', () => ({ getConfig: () => config }));

import { authenticate, isAlbumZoomReachable } from '@/lib/auth';

const none = () => undefined;

async function cookieFor(key: string, password: string, type: 'subpage' | 'album' = 'subpage') {
  const header = (await authenticate(key, password, type))!;
  const [name, rest] = header.split('=');
  const token = rest.split(';')[0];
  return (asked: string) => (asked === name ? token : undefined);
}

function setup(partial: Partial<typeof config>) {
  Object.assign(config, {
    zoom: false,
    standaloneAlbumZoom: {},
    standaloneAlbums: [],
    albumPasswords: {},
    subpages: [],
    ...partial,
  });
}

describe('isAlbumZoomReachable', () => {
  it('is off by default', () => {
    setup({ standaloneAlbums: [ID(1)] });
    expect(isAlbumZoomReachable(ID(1), none)).toBe(false);
  });

  it('follows the site setting for a standalone album', () => {
    setup({ zoom: true, standaloneAlbums: [ID(1)] });
    expect(isAlbumZoomReachable(ID(1), none)).toBe(true);
  });

  it('refuses an album that is not published anywhere', () => {
    setup({ zoom: true });
    expect(isAlbumZoomReachable(ID(1), none)).toBe(false);
  });

  it('lets an album switch it off against the site', () => {
    setup({ zoom: true, standaloneAlbums: [ID(1)], standaloneAlbumZoom: { [ID(1)]: false } });
    expect(isAlbumZoomReachable(ID(1), none)).toBe(false);
  });

  it('lets a subpage switch it on for its albums', () => {
    setup({ subpages: [{ name: 'S', slug: 's', albumIds: [ID(1)], zoom: true }] });
    expect(isAlbumZoomReachable(ID(1), none)).toBe(true);
  });

  it('serves a hidden (link-only) subpage like any other', () => {
    setup({ subpages: [{ name: 'S', slug: 's', albumIds: [ID(1)], zoom: true, hidden: true }] });
    expect(isAlbumZoomReachable(ID(1), none)).toBe(true);
  });

  it('refuses an album whose only subpage is offline', () => {
    setup({
      zoom: true,
      subpages: [{ name: 'S', slug: 's', albumIds: [ID(1)], enabled: false }],
    });
    expect(isAlbumZoomReachable(ID(1), none)).toBe(false);
  });

  it('asks for the subpage password', async () => {
    setup({
      zoom: true,
      subpages: [{ name: 'S', slug: 's', albumIds: [ID(1)], password: 'pw' }],
    });
    expect(isAlbumZoomReachable(ID(1), none)).toBe(false);
    expect(isAlbumZoomReachable(ID(1), await cookieFor('s', 'pw'))).toBe(true);
  });

  it('asks for the album’s own password as well', async () => {
    setup({ zoom: true, standaloneAlbums: [ID(1)], albumPasswords: { [ID(1)]: 'apw' } });
    expect(isAlbumZoomReachable(ID(1), none)).toBe(false);
    expect(isAlbumZoomReachable(ID(1), await cookieFor(ID(1), 'apw', 'album'))).toBe(true);
  });

  it('reads the album entry’s zoom on the route it is written on (review of #830)', async () => {
    // Open page: album entry says off. Password page: album entry says on.
    setup({
      subpages: [
        { name: 'Public', slug: 'public', albumIds: [ID(1)], albumZoom: { [ID(1)]: false } },
        {
          name: 'Client',
          slug: 'client',
          albumIds: [ID(1)],
          password: 'pw',
          albumZoom: { [ID(1)]: true },
        },
      ],
    });
    expect(isAlbumZoomReachable(ID(1), none)).toBe(false);
    expect(isAlbumZoomReachable(ID(1), await cookieFor('client', 'pw'))).toBe(true);
  });

  it('answers for an essay subpage’s albums like for any other page', () => {
    // Their album page, /<subpage>/<album>, offers zoom by the same rule.
    setup({
      subpages: [
        { name: 'E', slug: 'e', albumIds: [ID(1)], zoom: true, grid: { layout: 'essay' } },
      ],
    });
    expect(isAlbumZoomReachable(ID(1), none)).toBe(true);
  });

  it('does not combine an open route without zoom with a locked one that has it', async () => {
    // Open subpage, zoom off; locked subpage, zoom on. A visitor who has only
    // been through the open one gets no zoom.
    setup({
      subpages: [
        { name: 'Open', slug: 'open', albumIds: [ID(1)], zoom: false },
        { name: 'Locked', slug: 'locked', albumIds: [ID(1)], zoom: true, password: 'pw' },
      ],
    });
    expect(isAlbumZoomReachable(ID(1), none)).toBe(false);
    expect(isAlbumZoomReachable(ID(1), await cookieFor('locked', 'pw'))).toBe(true);
  });
});
