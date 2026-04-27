import { describe, it, expect, vi } from 'vitest';

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
        password: 'scrypt:f1f58b70cdb41c088fa7732409aa68ba:025c02d3436d6c71cc24044909a56a26cfe2083133caaf395c2cf3a2cbd43b1f9ed75ef68aa4eb2a53912f9550e61a28dce63ada9ddab25f683039e678c1e1e5',
      },
      {
        name: 'Public',
        slug: 'public',
        albumIds: ['00000000-0000-0000-0000-000000000002'],
        // no password
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
  it('returns a Set-Cookie string for the correct password', () => {
    const cookie = authenticate('private', 'secret123');
    expect(cookie).toBeTruthy();
    expect(cookie).toContain('lb_auth_private=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('returns null for the wrong password', () => {
    expect(authenticate('private', 'wrongpass')).toBeNull();
  });

  it('returns null for a non-protected slug', () => {
    expect(authenticate('public', 'anything')).toBeNull();
  });
});

describe('isAuthenticated', () => {
  it('returns true when a valid cookie is present', () => {
    // First authenticate to get the expected token
    const cookie = authenticate('private', 'secret123')!;
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
