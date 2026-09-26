import { describe, it, expect } from 'vitest';
import {
  checkCdn,
  checkAuthSecret,
  checkProxyHops,
  countForwardedHops,
  checkAlbumIds,
  checkAlbumSlugCollisions,
  checkAlbumsShared,
  checkPasswords,
  checkWritable,
  checkImmichCalls,
  checkLegal,
  worstLevel,
} from '../admin/doctor';

/** A stand-in for lib/config/schema.ts's slugify(), good enough to test the
 * grouping logic without doctor.ts importing anything (see its own comment). */
const testSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

describe('checkAuthSecret', () => {
  it('accepts a long secret', () => {
    expect(checkAuthSecret('a'.repeat(64)).level).toBe('ok');
  });

  it('warns about a short one', () => {
    const f = checkAuthSecret('short');
    expect(f.level).toBe('warn');
    expect(f.title).toContain('5 characters');
  });

  it('errors when absent', () => {
    expect(checkAuthSecret(undefined).level).toBe('error');
  });

  /** The report is shown in a browser and pasted into issues. */
  it('never repeats the secret itself', () => {
    const secret = 'super-secret-value-nobody-should-see';
    const f = checkAuthSecret(secret);
    expect(JSON.stringify(f)).not.toContain(secret);
  });
});

describe('countForwardedHops', () => {
  it('counts the entries of a chain', () => {
    expect(countForwardedHops('203.0.113.1, 10.0.0.1')).toBe(2);
    expect(countForwardedHops('203.0.113.1')).toBe(1);
  });

  it('treats an absent or empty header as no proxy', () => {
    expect(countForwardedHops(null)).toBe(0);
    expect(countForwardedHops('')).toBe(0);
    expect(countForwardedHops(' , ')).toBe(0);
  });
});

/**
 * Both directions fail silently today: too high and the lookup runs off the end
 * of the chain, too low and the IP comes from a header the client writes.
 */
describe('checkProxyHops', () => {
  it('is happy when the value matches what arrived', () => {
    expect(checkProxyHops(1, 1, true).level).toBe('ok');
    expect(checkProxyHops(0, 0, false).level).toBe('ok');
  });

  it('warns when a chain arrived but no hops are configured', () => {
    const f = checkProxyHops(0, 2, true);
    expect(f.level).toBe('warn');
    expect(f.detail).toContain('spoofing');
  });

  it('warns when more hops are configured than arrived', () => {
    expect(checkProxyHops(3, 2, true).level).toBe('warn');
  });

  /** An admin on the LAN legitimately sees no chain — say so, do not accuse. */
  it('explains the direct-admin case instead of calling it broken', () => {
    const f = checkProxyHops(1, 0, false);
    expect(f.level).toBe('warn');
    expect(f.detail).toContain('directly');
  });

  /**
   * Next fills X-Forwarded-For with the socket address when a request arrives
   * without one, so a lone entry is what a *direct* request looks like. Warning
   * on that would fire on every deployment that has no proxy at all.
   */
  it('does not mistake the header Next writes itself for a proxy', () => {
    const f = checkProxyHops(0, 1, false);
    expect(f.level).toBe('ok');
    expect(f.title).toContain('No reverse proxy');
  });

  it('does trust a lone entry when a real proxy header backs it up', () => {
    const f = checkProxyHops(0, 1, true);
    expect(f.level).toBe('warn');
    expect(f.detail).toContain('spoofing');
  });

  it('accepts one configured hop against one corroborated entry', () => {
    expect(checkProxyHops(1, 1, true).level).toBe('ok');
  });

  /**
   * Cloudflare (1 hop) in front of nginx (1 more, 2 total) with the value set
   * to 1 used to report "matches the observed chain" — the client IP was
   * actually read from the Cloudflare edge address, so every visitor behind
   * that PoP shared one rate-limit bucket (#629).
   */
  it('warns, not passes, when fewer hops are configured than arrived', () => {
    const f = checkProxyHops(1, 2, true);
    expect(f.level).toBe('warn');
    expect(f.title).toContain('1');
    expect(f.title).toContain('2');
  });
});

describe('checkAlbumIds', () => {
  const known = [
    { id: 'a', albumName: 'Japan' },
    { id: 'b', albumName: 'Poland' },
  ];

  it('passes when every configured album resolves', () => {
    expect(checkAlbumIds(['a', 'b'], known).level).toBe('ok');
  });

  it('names the ids Immich does not know', () => {
    const f = checkAlbumIds(['a', 'ghost'], known);
    expect(f.level).toBe('error');
    expect(f.detail).toContain('ghost');
    expect(f.albumIds).toEqual(['ghost']);
  });

  it('flags an empty gallery', () => {
    expect(checkAlbumIds([], known).level).toBe('warn');
  });
});

/** Never an error: publishing an unshared album has always worked (#515). */
describe('checkAlbumsShared', () => {
  const known = [
    { id: 'a', albumName: 'Japan', shared: true },
    { id: 'b', albumName: 'Private trip', shared: false },
  ];

  it('is quiet when everything published is shared', () => {
    expect(checkAlbumsShared(['a'], known).level).toBe('ok');
  });

  it('warns and names the unshared album', () => {
    const f = checkAlbumsShared(['a', 'b'], known);
    expect(f.level).toBe('warn');
    expect(f.detail).toContain('Private trip');
    expect(f.albumIds).toEqual(['b']);
  });

  /** An older Immich may not report the flag; silence beats a false alarm. */
  it('says nothing when the flag is absent', () => {
    expect(checkAlbumsShared(['x'], [{ id: 'x', albumName: 'Unknown' }]).level).toBe('ok');
  });
});

describe('checkAlbumSlugCollisions', () => {
  const known = [
    { id: 'a', albumName: 'Japan Trip' },
    { id: 'b', albumName: 'Japan-Trip' },
    { id: 'c', albumName: 'Iceland' },
  ];

  it('is quiet when nothing collides', () => {
    const f = checkAlbumSlugCollisions(
      [{ context: 'gallery.yaml albums', albumIds: ['a', 'c'] }],
      {},
      known,
      testSlug,
    );
    expect(f.level).toBe('ok');
  });

  it('flags two albums in the same group whose Immich names slugify alike', () => {
    const f = checkAlbumSlugCollisions(
      [{ context: 'gallery.yaml albums', albumIds: ['a', 'b'] }],
      {},
      known,
      testSlug,
    );
    expect(f.level).toBe('error');
    expect(f.detail).toContain('Japan Trip');
    expect(f.detail).toContain('Japan-Trip');
    expect(f.albumIds).toEqual(['a', 'b']);
  });

  it('does not flag the same collision across two different groups', () => {
    // /trips-a/japan-trip and /trips-b/japan-trip are different URLs.
    const f = checkAlbumSlugCollisions(
      [
        { context: 'subpage "Trips A"', albumIds: ['a'] },
        { context: 'subpage "Trips B"', albumIds: ['b'] },
      ],
      {},
      known,
      testSlug,
    );
    expect(f.level).toBe('ok');
  });

  it('prefers a title override over the Immich name', () => {
    const f = checkAlbumSlugCollisions(
      [{ context: 'gallery.yaml albums', albumIds: ['a', 'c'] }],
      { c: 'Japan Trip' }, // overrides "Iceland" — now collides with "a"
      known,
      testSlug,
    );
    expect(f.level).toBe('error');
  });

  it('says nothing about an id Immich does not know and has no override', () => {
    const f = checkAlbumSlugCollisions(
      [{ context: 'gallery.yaml albums', albumIds: ['a', 'ghost'] }],
      {},
      known,
      testSlug,
    );
    expect(f.level).toBe('ok');
  });
});

describe('checkPasswords', () => {
  it('passes when everything is hashed', () => {
    expect(checkPasswords([{ label: 'Site', value: 'scrypt:aa:bb' }]).level).toBe('ok');
  });

  it('warns about plaintext and names where it lives', () => {
    const f = checkPasswords([
      { label: 'Site', value: 'scrypt:aa:bb' },
      { label: 'Album japan-2024', value: 'hunter2' },
    ]);
    expect(f.level).toBe('warn');
    expect(f.detail).toContain('Album japan-2024');
  });

  /** Bcrypt cannot be verified at all any more — that is broken, not sloppy. */
  it('errors on a leftover bcrypt hash', () => {
    expect(checkPasswords([{ label: 'Site', value: '$2b$10$abcdefghijklmno' }]).level).toBe(
      'error',
    );
  });

  it('never repeats a password', () => {
    const f = checkPasswords([{ label: 'Album x', value: 'hunter2' }]);
    expect(JSON.stringify(f)).not.toContain('hunter2');
  });
});

describe('checkWritable', () => {
  it('passes when nothing is blocked', () => {
    expect(checkWritable([]).level).toBe('ok');
  });

  it('errors and names the paths', () => {
    const f = checkWritable(['content/', 'content/.backups']);
    expect(f.level).toBe('error');
    expect(f.detail).toContain('content/.backups');
  });
});

describe('checkImmichCalls', () => {
  it('passes when every call came back', () => {
    expect(
      checkImmichCalls([
        { endpoint: '/server/ping', ok: true },
        { endpoint: '/albums', ok: true },
      ]).level,
    ).toBe('ok');
  });

  it('names the failing endpoint', () => {
    const f = checkImmichCalls([
      { endpoint: '/server/ping', ok: true },
      { endpoint: '/albums', ok: false },
    ]);
    expect(f.level).toBe('error');
    expect(f.detail).toContain('/albums');
  });
});

describe('worstLevel', () => {
  it('reports the most severe finding', () => {
    expect(worstLevel([{ id: 'a', level: 'ok', title: '', detail: '' }])).toBe('ok');
    expect(
      worstLevel([
        { id: 'a', level: 'ok', title: '', detail: '' },
        { id: 'b', level: 'warn', title: '', detail: '' },
      ]),
    ).toBe('warn');
    expect(
      worstLevel([
        { id: 'a', level: 'warn', title: '', detail: '' },
        { id: 'b', level: 'error', title: '', detail: '' },
      ]),
    ).toBe('error');
  });
});

describe('checkCdn', () => {
  it('stays silent without CDN_URL', () => {
    expect(checkCdn(undefined, false, 1)).toBeNull();
  });

  it('warns that a site password keeps photos off the CDN', () => {
    const finding = checkCdn('https://cdn.example.net', true, 1)!;
    expect(finding.level).toBe('warn');
    expect(finding.detail).toMatch(/password/);
  });

  it('warns when the rate limiter would count CDN edges', () => {
    const finding = checkCdn('https://cdn.example.net', false, 0)!;
    expect(finding.level).toBe('warn');
    expect(finding.title).toMatch(/TRUSTED_PROXY_HOPS/);
  });

  it('reports ok with a proxy chain configured', () => {
    const finding = checkCdn('https://cdn.example.net', false, 2)!;
    expect(finding.level).toBe('ok');
    expect(finding.detail).toContain('https://cdn.example.net');
  });
});

describe('checkLegal', () => {
  const complete = {
    enabled: true,
    name: 'Ralf',
    address: 'Street 1',
    zipCity: '10247 Berlin',
    email: 'mail@example.com',
    contactUrl: 'https://example.com/contact',
  };

  it('returns nothing while the Impressum is switched off or absent', () => {
    expect(checkLegal({ ...complete, enabled: false })).toBeNull();
    expect(checkLegal(undefined)).toBeNull();
  });

  it('passes with name, address, email and a second channel', () => {
    expect(checkLegal(complete)?.level).toBe('ok');
    expect(checkLegal({ ...complete, contactUrl: undefined, phone: '+49 30 1' })?.level).toBe('ok');
  });

  it('names the missing address fields', () => {
    const f = checkLegal({ ...complete, address: '', zipCity: ' ' })!;
    expect(f.level).toBe('warn');
    expect(f.detail).toContain('street address, ZIP and city');
  });

  it('asks for an email address', () => {
    expect(checkLegal({ ...complete, email: undefined })!.detail).toContain('No email address');
  });

  it('flags email as the only contact channel', () => {
    const f = checkLegal({ ...complete, contactUrl: undefined })!;
    expect(f.level).toBe('warn');
    expect(f.detail).toContain('only contact channel');
  });

  it('reports a contact URL the page drops, and does not count it as a channel', () => {
    const f = checkLegal({ ...complete, contactUrl: 'javascript:alert(1)' })!;
    expect(f.level).toBe('warn');
    expect(f.title).toContain('2 gaps');
    expect(f.detail).toContain('ignored');
    expect(f.detail).toContain('only contact channel');
  });

  it('tolerates hand-edited YAML with the wrong types', () => {
    const f = checkLegal({ ...complete, name: 42, email: ['a'] })!;
    expect(f.level).toBe('warn');
    expect(f.detail).toContain('Missing: name');
  });
});
