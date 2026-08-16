import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The site-wide gate rides on the same HMAC machinery as subpage, album and
 * journal passwords — the point of these tests is that it really is the same
 * path (signed expiry, constant-time compare, opt-in when unset) and not a
 * second, weaker scheme bolted on beside it.
 */

const config = {
  authSecret: 'test-secret-that-is-at-least-32-chars-long',
  sitePassword: '',
  subpages: [] as unknown[],
  albumPasswords: {} as Record<string, string>,
};

vi.mock('@/lib/config', () => ({
  getConfig: () => config,
}));

import {
  authenticate,
  isAuthenticated,
  isSiteLocked,
  isSiteUnlocked,
  siteLockResponse,
  SITE_AUTH_COOKIE,
  SITE_AUTH_KEY,
} from '@/lib/auth';

/** Pull the cookie value back out of a Set-Cookie header. */
function cookieValue(setCookie: string): string {
  return setCookie.slice(setCookie.indexOf('=') + 1, setCookie.indexOf(';'));
}

const jar = (value?: string) => (name: string) => (name === SITE_AUTH_COOKIE ? value : undefined);

beforeEach(() => {
  config.sitePassword = '';
});

describe('an open site', () => {
  it('is not locked when no password is configured', () => {
    expect(isSiteLocked()).toBe(false);
  });

  it('serves everyone, cookie or not', () => {
    expect(isSiteUnlocked(jar())).toBe(true);
    expect(siteLockResponse(new Request('http://localhost/api/image/x'))).toBeNull();
  });

  it('refuses to issue a token — there is nothing to unlock', async () => {
    expect(await authenticate(SITE_AUTH_KEY, 'anything', 'site')).toBeNull();
  });
});

describe('a locked site', () => {
  beforeEach(() => {
    config.sitePassword = 'letmein';
  });

  it('reports itself locked', () => {
    expect(isSiteLocked()).toBe(true);
  });

  it('turns away a visitor with no cookie', () => {
    expect(isSiteUnlocked(jar())).toBe(false);
  });

  it('rejects the wrong password', async () => {
    expect(await authenticate(SITE_AUTH_KEY, 'wrong', 'site')).toBeNull();
  });

  it('issues an HttpOnly cookie for the right password', async () => {
    const setCookie = await authenticate(SITE_AUTH_KEY, 'letmein', 'site');
    expect(setCookie).toContain(`${SITE_AUTH_COOKIE}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/');
  });

  it('accepts the cookie it just issued', async () => {
    const setCookie = (await authenticate(SITE_AUTH_KEY, 'letmein', 'site'))!;
    expect(isSiteUnlocked(jar(cookieValue(setCookie)))).toBe(true);
  });

  it('rejects a token whose expiry has been pushed out by hand', async () => {
    const setCookie = (await authenticate(SITE_AUTH_KEY, 'letmein', 'site'))!;
    const [, mac] = cookieValue(setCookie).split('.');
    const forged = `${Date.now() + 10 * 365 * 24 * 3600_000}.${mac}`;
    expect(isSiteUnlocked(jar(forged))).toBe(false);
  });

  it('rejects an expired token', () => {
    // Signed with a past expiry: the signature is valid, the deadline is not.
    expect(isSiteUnlocked(jar(`${Date.now() - 1000}.deadbeef`))).toBe(false);
  });

  it('rejects garbage', () => {
    expect(isSiteUnlocked(jar(''))).toBe(false);
    expect(isSiteUnlocked(jar('not-a-token'))).toBe(false);
    expect(isSiteUnlocked(jar('...'))).toBe(false);
  });

  it('does not unlock the site with another gate’s cookie', async () => {
    config.subpages = [{ slug: 'private', password: 'letmein' }];
    const subpageCookie = (await authenticate('private', 'letmein', 'subpage'))!;
    // Same password, different key — the key is part of the signed payload.
    expect(isSiteUnlocked(jar(cookieValue(subpageCookie)))).toBe(false);
    config.subpages = [];
  });

  it('stops changing its mind once the password is rotated', async () => {
    const setCookie = (await authenticate(SITE_AUTH_KEY, 'letmein', 'site'))!;
    config.sitePassword = 'something-else';
    expect(isSiteUnlocked(jar(cookieValue(setCookie)))).toBe(false);
  });
});

describe('siteLockResponse', () => {
  beforeEach(() => {
    config.sitePassword = 'letmein';
  });

  it('answers 401 without a cookie, and does not let it be cached', async () => {
    const res = siteLockResponse(new Request('http://localhost/api/image/x'))!;
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    // A WWW-Authenticate header would make the browser pop its own dialog.
    expect(res.headers.get('WWW-Authenticate')).toBeNull();
  });

  it('reads the cookie out of the request header', async () => {
    const setCookie = (await authenticate(SITE_AUTH_KEY, 'letmein', 'site'))!;
    const req = new Request('http://localhost/api/image/x', {
      headers: { cookie: `theme=dark; ${SITE_AUTH_COOKIE}=${cookieValue(setCookie)}; other=1` },
    });
    expect(siteLockResponse(req)).toBeNull();
  });

  it('is not fooled by a cookie whose name merely ends the same way', async () => {
    const setCookie = (await authenticate(SITE_AUTH_KEY, 'letmein', 'site'))!;
    const req = new Request('http://localhost/api/image/x', {
      headers: { cookie: `not_${SITE_AUTH_COOKIE}=${cookieValue(setCookie)}` },
    });
    expect(siteLockResponse(req)).not.toBeNull();
  });
});

describe('a subpage slugged "site"', () => {
  beforeEach(() => {
    config.sitePassword = 'letmein';
  });

  it('does not write to the site gate’s cookie', async () => {
    config.subpages = [{ slug: 'site', password: 'subpage-pw' }];
    const setCookie = (await authenticate('site', 'subpage-pw', 'subpage'))!;
    expect(setCookie.startsWith(`${SITE_AUTH_COOKIE}=`)).toBe(false);
    expect(setCookie).toContain('lb_auth_site=');
    config.subpages = [];
  });

  it('does not unlock the site even when both passwords match', async () => {
    // Same key ("site"), same password — only the domain separator in the
    // signed payload keeps the two tokens apart.
    config.subpages = [{ slug: 'site', password: 'letmein' }];
    const subpageCookie = cookieValue((await authenticate('site', 'letmein', 'subpage'))!);
    expect(isSiteUnlocked(jar(subpageCookie))).toBe(false);
    config.subpages = [];
  });

  it('is not unlocked by the site cookie either', async () => {
    config.subpages = [{ slug: 'site', password: 'letmein' }];
    const siteCookie = cookieValue((await authenticate(SITE_AUTH_KEY, 'letmein', 'site'))!);
    expect(isAuthenticated('site', () => siteCookie, 'subpage')).toBe(false);
    config.subpages = [];
  });
});

describe('the other gates are untouched', () => {
  it('still protects a subpage independently of the site lock', async () => {
    config.sitePassword = 'letmein';
    config.subpages = [{ slug: 'private', password: 'other' }];

    const siteCookie = cookieValue((await authenticate(SITE_AUTH_KEY, 'letmein', 'site'))!);
    // Unlocking the site does not unlock a subpage inside it.
    expect(isAuthenticated('private', () => siteCookie, 'subpage')).toBe(false);

    config.subpages = [];
  });
});
