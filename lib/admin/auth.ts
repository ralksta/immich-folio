/**
 * Admin authentication utilities.
 * Uses HMAC-signed session tokens stored in HttpOnly cookies.
 */

import crypto from 'crypto';
import { env } from '../env';
import { resolveAuthSecret } from '../secret';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'folio_admin_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSigningKey(): Buffer {
  // Bind the key to ADMIN_PASSWORD as well, so rotating the password
  // immediately invalidates every outstanding session token.
  const secret = resolveAuthSecret();
  return crypto
    .createHash('sha256')
    .update(`admin:${secret}:${env.ADMIN_PASSWORD ?? ''}`)
    .digest();
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

  // timingSafeEqual throws on length mismatch — guard first so a malformed
  // cookie yields a clean 401 instead of an unhandled RangeError (500).
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
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

  if (password.length > 1024) return false;

  // Hash to a fixed length to prevent side-channel timing attacks on length
  const pwHash = crypto.createHash('sha256').update(password).digest();
  const expectedHash = crypto.createHash('sha256').update(adminPw).digest();

  return crypto.timingSafeEqual(pwHash, expectedHash);
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
