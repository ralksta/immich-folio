/**
 * Admin authentication utilities.
 * Uses HMAC-signed session tokens stored in HttpOnly cookies.
 */

import crypto from 'crypto';
import { env } from '../env';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'folio_admin_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSigningKey(): Buffer {
  const secret = env.AUTH_SECRET || 'dev-fallback-secret';
  return crypto.createHash('sha256').update(`admin:${secret}`).digest();
}

/** Create a signed session token. */
export function createAdminToken(): string {
  const payload = {
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + SESSION_DURATION_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const key = getSigningKey();
  const sig = crypto.createHmac('sha256', key).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/** Verify a session token. Returns true if valid. */
export function verifyAdminToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [data, sig] = parts;
  const key = getSigningKey();
  const expectedSig = crypto.createHmac('sha256', key).update(data).digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.role !== 'admin') return false;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

/** Verify admin password. */
export function verifyAdminPassword(password: string): boolean {
  const adminPw = env.ADMIN_PASSWORD;
  if (!adminPw) return false;

  // Constant-time comparison
  const pwBuf = Buffer.from(password);
  const expectedBuf = Buffer.from(adminPw);
  if (pwBuf.length !== expectedBuf.length) {
    // Still do a comparison to prevent timing attacks on length
    crypto.timingSafeEqual(pwBuf, Buffer.alloc(pwBuf.length));
    return false;
  }
  return crypto.timingSafeEqual(pwBuf, expectedBuf);
}

/** Check if the current request has a valid admin session. */
export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}

/** Check if admin panel is enabled (password is set). */
export function isAdminEnabled(): boolean {
  return !!env.ADMIN_PASSWORD;
}

export { COOKIE_NAME, SESSION_DURATION_MS };
