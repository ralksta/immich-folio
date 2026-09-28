import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * A slug without a password must be indistinguishable from a wrong password.
 * A separate "not password-protected" answer let anyone probing slugs tell
 * which ones exist behind a lock — drafts and offline subpages included, whose
 * pages answer 404 and give nothing away themselves.
 */

const config = {
  authSecret: 'test-secret-that-is-at-least-32-chars-long',
  subpages: [
    { slug: 'private', name: 'Private', password: 'letmein', albumIds: [] },
    { slug: 'public', name: 'Public', albumIds: [] },
  ],
  albumPasswords: {},
  sitePassword: undefined,
};

vi.mock('@/lib/config', () => ({
  getConfig: () => config,
  getConfigOrNull: () => config,
}));

const { POST } = await import('../route');

async function attempt(slug: string, password: string, type = 'subpage') {
  // Eight attempts in all, inside the route's limit of ten per minute.
  const res = await POST(
    new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, password, type }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

describe('POST /api/auth', () => {
  it('unlocks a protected subpage with its password', async () => {
    const res = await attempt('private', 'letmein');
    expect(res.status).toBe(200);
  });

  it('answers a slug without a password like a wrong password', async () => {
    const wrong = await attempt('private', 'nope');
    expect(wrong.status).toBe(401);

    for (const [slug, type] of [
      ['public', 'subpage'],
      ['does-not-exist', 'subpage'],
      ['does-not-exist', 'journal'],
      ['does-not-exist', 'page'],
      ['00000000-0000-0000-0000-000000000000', 'album'],
      ['__site__', 'site'],
    ]) {
      expect(await attempt(slug, 'nope', type)).toEqual(wrong);
    }
  });
});
