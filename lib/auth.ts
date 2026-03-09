/**
 * Album authentication helpers.
 * Uses HMAC tokens stored in HttpOnly cookies — no database needed.
 *
 * Token = HMAC-SHA256(slug + passwordSecret, authSecret)
 * Cookie = lb_auth_<slug> = <token>
 */

import crypto from 'crypto';
import { getConfig, SubpageConfig } from './config';

const TOKEN_EXPIRY_HOURS = 24;

/**
 * Check if a string looks like a legacy bcrypt hash.
 */
function isBcryptHash(str: string): boolean {
  return str.startsWith('$2a$') || str.startsWith('$2b$') || str.startsWith('$2y$');
}

/**
 * Native SCrypt verify (format: 'scrypt:salt:hash_hex')
 */
function verifyScrypt(password: string, stored: string): boolean {
  if (!stored.startsWith('scrypt:')) return false;

  try {
    const [, salt, hashHex] = stored.split(':');
    const key = crypto.scryptSync(password, salt, 64);
    const expectedKey = Buffer.from(hashHex, 'hex');
    if (key.length !== expectedKey.length) return false;
    return crypto.timingSafeEqual(key, expectedKey);
  } catch {
    return false;
  }
}

/**
 * Helper to generate an scrypt string to print in logs.
 */
function generateScryptHash(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function hmac(data: string): string {
  return crypto.createHmac('sha256', getConfig().authSecret).update(data).digest('hex');
}

function authToken(slug: string, passwordSecret: string): string {
  // Use the hash/password as part of the HMAC for a secure, unique session token
  return hmac(`${slug}:${passwordSecret}`);
}

function cookieName(slug: string): string {
  return `lb_auth_${slug}`;
}

/**
 * Find the SubpageConfig for a given slug.
 */
export function findSubpageBySlug(slug: string): SubpageConfig | undefined {
  return getConfig().subpages.find((sp) => sp.slug === slug);
}

/**
 * Check if a slug corresponds to a password-protected subpage.
 */
export function isProtected(slug: string): boolean {
  const sp = findSubpageBySlug(slug);
  return !!sp?.password;
}

/**
 * Validate a password attempt and return a Set-Cookie header value on success.
 * Returns null if the password is wrong.
 */
export function authenticate(slug: string, password: string): string | null {
  const sp = findSubpageBySlug(slug);
  if (!sp?.password) return null;

  let isValid = false;

  if (isBcryptHash(sp.password)) {
    console.error(
      `\n❌ SECURITY ERROR: Subpage "${slug}" is using an outdated bcrypt password hash.\n` +
        `   Bcrypt dependency has been removed to reduce bundle size.\n` +
        `   Please switch temporarily to plaintext in your gallery.yaml, log in again\n` +
        `   to see your new secure "scrypt:..." hash in the logs, and update your file.\n`,
    );
    return null;
  }

  if (sp.password.startsWith('scrypt:')) {
    isValid = verifyScrypt(password, sp.password);
  } else {
    // Plaintext fallback (deprecated)
    isValid = password === sp.password;
    if (isValid) {
      const recommendedHash = generateScryptHash(sp.password);
      console.warn(
        `\n⚠️  SECURITY WARNING: Subpage "${slug}" is using a plaintext password in gallery.yaml.\n` +
          `   Please replace it with this native secure hash:\n\n   ${recommendedHash}\n`,
      );
    }
  }

  if (!isValid) return null;

  const token = authToken(slug, sp.password);
  const maxAge = TOKEN_EXPIRY_HOURS * 60 * 60;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';

  return `${cookieName(slug)}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Strict${secure}`;
}

/**
 * Check if the request has a valid auth cookie for the given slug.
 * Works with the cookies() API from Next.js server components.
 */
export function isAuthenticated(
  slug: string,
  getCookie: (name: string) => string | undefined,
): boolean {
  const sp = findSubpageBySlug(slug);
  if (!sp?.password) return true; // not protected

  const cookie = getCookie(cookieName(slug));
  if (!cookie) return false;

  const expected = authToken(slug, sp.password);
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(cookie, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
