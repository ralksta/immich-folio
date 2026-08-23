import { describe, it, expect } from 'vitest';
import {
  checkAuthSecret,
  checkProxyHops,
  countForwardedHops,
  checkAlbumIds,
  checkAlbumsShared,
  checkPasswords,
  checkWritable,
  checkImmichCalls,
  worstLevel,
} from '../admin/doctor';

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
  });

  /** An older Immich may not report the flag; silence beats a false alarm. */
  it('says nothing when the flag is absent', () => {
    expect(checkAlbumsShared(['x'], [{ id: 'x', albumName: 'Unknown' }]).level).toBe('ok');
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
