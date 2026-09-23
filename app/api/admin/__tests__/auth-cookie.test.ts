import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * The admin session cookie is `Secure` only when the visitor came over HTTPS
 * (#664). Keyed on NODE_ENV it was always `Secure` in the Docker image, so an
 * instance opened at `http://host:7211` logged in with a 200 and then lost the
 * cookie — every admin request after that was a 401.
 */

vi.mock('@/lib/admin/auth', () => ({
  verifyAdminPassword: vi.fn(async () => true),
  createAdminToken: vi.fn(() => 'session-token'),
  isAdminAuthenticated: vi.fn(async () => true),
  isAdminEnabled: vi.fn(() => true),
  COOKIE_NAME: 'folio_admin_session',
  SESSION_DURATION_MS: 24 * 60 * 60 * 1000,
  MAX_PASSWORD_LENGTH: 1024,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ success: true, resetAt: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  retryAfterSeconds: vi.fn(() => 60),
}));

import { POST, DELETE } from '../auth/route';

function login(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ password: 'hunter2' }),
  });
}

describe('admin session cookie', () => {
  it('is not Secure when the admin is reached over plain HTTP', async () => {
    const res = await POST(login('http://192.168.1.10:7211/api/admin/auth'));
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('folio_admin_session=session-token');
    expect(cookie.toLowerCase()).not.toContain('secure');
  });

  it('is Secure behind an HTTPS reverse proxy', async () => {
    const res = await POST(
      login('http://folio:3000/api/admin/auth', { 'x-forwarded-proto': 'https' }),
    );
    expect((res.headers.get('set-cookie') ?? '').toLowerCase()).toContain('secure');
  });

  it('clears the cookie with the same flag it was set with', async () => {
    const res = await DELETE(
      new NextRequest('http://192.168.1.10:7211/api/admin/auth', { method: 'DELETE' }),
    );
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('folio_admin_session=');
    expect(cookie.toLowerCase()).not.toContain('secure');
  });
});
