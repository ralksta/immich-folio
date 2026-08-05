import { describe, it, expect, vi, afterEach } from 'vitest';
import crypto from 'crypto';

// Mock config to provide a predictable API key and subpage config
vi.mock('@/lib/config', () => ({
  getConfig: () => ({
    immich: { apiKey: 'test-api-key-for-auth-tests' },
    authSecret: 'test-auth-secret-32-chars-long-min',
    subpages: [
      {
        name: 'Private',
        slug: 'private',
        albumIds: ['00000000-0000-0000-0000-000000000001'],
        password: 'secret123',
      },
      {
        name: 'Public',
        slug: 'public',
        albumIds: ['00000000-0000-0000-0000-000000000002'],
        // no password
      },
      {
        name: 'Hashed',
        slug: 'hashed',
        albumIds: ['00000000-0000-0000-0000-000000000003'],
        // scrypt hash of 'scrypted-pass' with a fixed salt — exercises the
        // verifyScrypt path rather than the deprecated plaintext fallback.
        password:
          'scrypt:0123456789abcdef0123456789abcdef:4850eef18a09612ef11fdcd943bf64ce98d0eca2b0f677f9c0c51d1f648b8a101cf7ea36b6f94cfc05236b2fda6fffabd0929dc7e14c07626522fba68bf26de5',
      },
    ],
  }),
}));

import { isProtected, authenticate, isAuthenticated, findSubpageBySlug } from '@/lib/auth';

describe('findSubpageBySlug', () => {
  it('returns the subpage config for a known slug', () => {
    const sp = findSubpageBySlug('private');
    expect(sp).toBeDefined();
    expect(sp?.name).toBe('Private');
  });

  it('returns undefined for an unknown slug', () => {
    expect(findSubpageBySlug('nonexistent')).toBeUndefined();
  });
});

describe('isProtected', () => {
  it('returns true for a password-protected subpage', () => {
    expect(isProtected('private')).toBe(true);
  });

  it('returns false for a non-protected subpage', () => {
    expect(isProtected('public')).toBe(false);
  });

  it('returns false for an unknown slug', () => {
    expect(isProtected('unknown')).toBe(false);
  });
});

describe('authenticate', () => {
  it('returns a Set-Cookie string for the correct password', async () => {
    const cookie = await authenticate('private', 'secret123');
    expect(cookie).toBeTruthy();
    expect(cookie).toContain('lb_auth_private=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('returns null for the wrong password', async () => {
    await expect(authenticate('private', 'wrongpass')).resolves.toBeNull();
  });

  it('returns null for a non-protected slug', async () => {
    await expect(authenticate('public', 'anything')).resolves.toBeNull();
  });

  it('accepts a correct scrypt-hashed password', async () => {
    await expect(authenticate('hashed', 'scrypted-pass')).resolves.toContain('lb_auth_hashed=');
  });

  it('rejects a wrong password against a scrypt hash', async () => {
    await expect(authenticate('hashed', 'wrong')).resolves.toBeNull();
  });
});

/**
 * scryptSync costs ~23ms of blocked main thread per call. The /api/auth limit
 * is keyed on the client IP, and at the default TRUSTED_PROXY_HOPS=0 that IP
 * comes from a spoofable header — so unlimited buckets, each buying 23ms of
 * dead process. The async variant runs on the libuv threadpool instead.
 */
describe('password hashing does not stall the process', () => {
  it('never calls the synchronous scrypt', async () => {
    const sync = vi.spyOn(crypto, 'scryptSync');
    await authenticate('hashed', 'scrypted-pass');
    expect(sync).not.toHaveBeenCalled();
    sync.mockRestore();
  });

  it('leaves timers free to fire while hashing', async () => {
    let ticks = 0;
    const interval = setInterval(() => ticks++, 2);

    await authenticate('hashed', 'scrypted-pass');
    clearInterval(interval);

    // The synchronous variant yields to nothing for the whole hash, so a 2ms
    // interval gets at most one tick after it finishes. Async leaves room for
    // many. A slower machine makes the hash longer, i.e. more ticks — so this
    // fails on a blocked loop, not on a busy one.
    expect(ticks).toBeGreaterThan(3);
  });
});

describe('isAuthenticated', () => {
  it('returns true when a valid cookie is present', async () => {
    // First authenticate to get the expected token
    const cookie = (await authenticate('private', 'secret123'))!;
    const token = cookie.split('=')[1].split(';')[0];

    const getCookie = (name: string) => (name === 'lb_auth_private' ? token : undefined);
    expect(isAuthenticated('private', getCookie)).toBe(true);
  });

  it('returns false when no cookie is present', () => {
    const getCookie = () => undefined;
    expect(isAuthenticated('private', getCookie)).toBe(false);
  });

  it('returns false for an invalid token', () => {
    const getCookie = (name: string) => (name === 'lb_auth_private' ? 'badtoken' : undefined);
    expect(isAuthenticated('private', getCookie)).toBe(false);
  });

  it('returns true for non-protected pages (no auth needed)', () => {
    const getCookie = () => undefined;
    expect(isAuthenticated('public', getCookie)).toBe(true);
  });
});

describe('token expiry', () => {
  async function tokenFor(slug: string, password: string): Promise<string> {
    return (await authenticate(slug, password))!.split('=')[1].split(';')[0];
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects a token once its embedded expiry has passed', async () => {
    const token = await tokenFor('private', 'secret123');
    const getCookie = (name: string) => (name === 'lb_auth_private' ? token : undefined);
    expect(isAuthenticated('private', getCookie)).toBe(true);

    // Previously the 24h lifetime lived only in the cookie's Max-Age, so a
    // captured token replayed via curl worked forever.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    expect(isAuthenticated('private', getCookie)).toBe(false);
  });

  it('still accepts a token just before it expires', async () => {
    const token = await tokenFor('private', 'secret123');
    const getCookie = (name: string) => (name === 'lb_auth_private' ? token : undefined);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 23 * 60 * 60 * 1000);
    expect(isAuthenticated('private', getCookie)).toBe(true);
  });

  it('rejects a token whose expiry was tampered with', async () => {
    const token = await tokenFor('private', 'secret123');
    const [, sig] = token.split('.');
    const farFuture = Date.now() + 365 * 24 * 60 * 60 * 1000;

    // The expiry is covered by the HMAC, so extending it invalidates the token.
    const getCookie = (name: string) =>
      name === 'lb_auth_private' ? `${farFuture}.${sig}` : undefined;
    expect(isAuthenticated('private', getCookie)).toBe(false);
  });

  it('rejects malformed and legacy tokens without throwing', () => {
    for (const value of ['', '.', 'abc', 'abc.def', `${Date.now() + 1000}.`, 'deadbeef']) {
      const getCookie = (name: string) => (name === 'lb_auth_private' ? value : undefined);
      expect(() => isAuthenticated('private', getCookie)).not.toThrow();
      expect(isAuthenticated('private', getCookie)).toBe(false);
    }
  });

  it('sets a cookie Max-Age consistent with the embedded expiry', async () => {
    const cookie = (await authenticate('private', 'secret123'))!;
    const maxAge = Number(cookie.match(/Max-Age=(\d+)/)![1]);
    const exp = Number(cookie.split('=')[1].split(';')[0].split('.')[0]);
    expect(Math.abs(exp - (Date.now() + maxAge * 1000))).toBeLessThan(2000);
  });
});
