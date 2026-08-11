/**
 * Admin authentication utilities.
 * Uses HMAC-signed session tokens stored in HttpOnly cookies.
 */

import crypto from 'crypto';
import { getInstallCredentials } from '../install';
import { resolveAuthSecret } from '../secret';
import { isScryptHash, verifyScrypt } from '../password';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'folio_admin_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Longest password attempt the login endpoint will look at.
 *
 * Generous enough that no real passphrase hits it — the point is only to keep
 * an unbounded request body out of the hashing path, not to constrain what
 * users may choose.
 */
export const MAX_PASSWORD_LENGTH = 1024;

/** Admin password as configured — env wins, wizard-installed value as fallback. */
function getAdminPassword(): string {
  return getInstallCredentials().adminPassword;
}

function getSigningKey(): Buffer {
  // Bind the key to ADMIN_PASSWORD as well, so rotating the password
  // immediately invalidates every outstanding session token.
  const secret = resolveAuthSecret();
  return crypto.createHash('sha256').update(`admin:${secret}:${getAdminPassword()}`).digest();
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

/**
 * Verify admin password.
 *
 * Both sides are HMAC'd to a fixed 32 bytes before the constant-time compare.
 * Comparing the raw strings meant `timingSafeEqual` could only run when the
 * lengths already matched, so the early return on a length mismatch leaked how
 * long ADMIN_PASSWORD is. Hashing first makes every attempt take the same path.
 *
 * Keyed with AUTH_SECRET rather than a bare digest, matching how `lib/auth.ts`
 * compares subpage passwords: the intermediate values are then useless to
 * anyone who cannot also read the secret.
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const adminPw = getAdminPassword();
  if (!adminPw) return false;
  if (password.length > MAX_PASSWORD_LENGTH) return false;

  // The wizard stores a hash; ADMIN_PASSWORD as an env var stays plaintext,
  // because that is what every existing deployment has set. Both must work,
  // or an upgrade locks the owner out of their own admin panel.
  if (isScryptHash(adminPw)) {
    return verifyScrypt(password, adminPw);
  }

  const secret = resolveAuthSecret();
  const attemptHash = crypto.createHmac('sha256', secret).update(password).digest();
  const expectedHash = crypto.createHmac('sha256', secret).update(adminPw).digest();

  return crypto.timingSafeEqual(attemptHash, expectedHash);
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
  return !!getAdminPassword();
}

export { COOKIE_NAME, SESSION_DURATION_MS };
