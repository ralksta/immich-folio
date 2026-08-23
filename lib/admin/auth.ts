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

/**
 * Derived session signing key, kept for the process lifetime.
 *
 * scrypt is deliberately slow, and getSigningKey() runs on every admin request
 * — deriving per call would put ~24ms in front of each one. The cache holds the
 * inputs it was derived from, so a rotated password or secret misses the cache
 * and derives again.
 *
 * Those inputs are compared directly rather than through a digest of them: a
 * digest here would be a fast hash of the admin password sitting in memory for
 * the life of the process, which is the very thing scrypt was introduced below
 * to avoid. Holding the strings costs nothing extra — they are the same objects
 * the env and install caches already hold, whereas building a digest input
 * allocates a fresh copy of the password.
 */
let cachedSigningKey: { secret: string; password: string; key: Buffer } | null = null;

function getSigningKey(): Buffer {
  // Bind the key to ADMIN_PASSWORD as well, so rotating the password
  // immediately invalidates every outstanding session token.
  const secret = resolveAuthSecret();
  const password = getAdminPassword();

  if (cachedSigningKey?.secret === secret && cachedSigningKey.password === password) {
    return cachedSigningKey.key;
  }

  /*
   * scrypt rather than a plain SHA-256 digest: the admin password is an input
   * here, and a single fast hash would make it cheap to recover by brute force
   * if the derived key ever leaked. The salt has to be stable — a random one
   * would change the key on every call and invalidate every session — so it is
   * derived from AUTH_SECRET, which is deployment-specific.
   */
  const key = crypto.scryptSync(password, `folio-admin-session:${secret}`, 32);
  cachedSigningKey = { secret, password, key };
  return key;
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

/**
 * Upper bound on a session token, well above the ~200 characters a real one
 * needs. A token that long is not one we issued, so rejecting it early costs a
 * legitimate visitor nothing.
 *
 * The work being avoided is modest and worth stating honestly: the base64url
 * decode below only runs once the HMAC matches, which an attacker cannot
 * produce — so the unbounded part is the HMAC over the token itself, and the
 * server's own header limit already caps how much of it can arrive. This is
 * hygiene at the boundary rather than a fix for a reachable exhaustion.
 * Reported as #505.
 */
const MAX_TOKEN_LENGTH = 512;

/** Verify a session token. Returns true if valid. */
export function verifyAdminToken(token: string): boolean {
  if (token.length > MAX_TOKEN_LENGTH) return false;

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
