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

/**
 * Build a session token of the form `<expiryEpochMs>.<hmac>`.
 *
 * The expiry is part of the signed payload, so it cannot be extended by the
 * client. Without it the token was a pure function of (slug, password) and
 * therefore valid forever — the 24h lifetime existed only as the cookie's
 * Max-Age, which the client enforces and an attacker replaying a captured
 * token simply ignores.
 */
function authToken(key: string, passwordSecret: string, expiresAt: number): string {
  return `${expiresAt}.${hmac(`${key}:${passwordSecret}:${expiresAt}`)}`;
}

function cookieName(key: string, type: 'subpage' | 'album'): string {
  return type === 'subpage' ? `lb_auth_${key}` : `lb_auth_album_${key}`;
}

/**
 * Find the SubpageConfig for a given slug.
 */
export function findSubpageBySlug(slug: string): SubpageConfig | undefined {
  return getConfig().subpages.find((sp) => sp.slug === slug);
}

/**
 * Find the password secret for a given subpage slug or album ID.
 */
function findPassword(key: string, type: 'subpage' | 'album'): string | undefined {
  const config = getConfig();
  if (type === 'subpage') {
    return config.subpages.find((sp) => sp.slug === key)?.password;
  }
  return config.albumPasswords[key];
}

/**
 * Check if a subpage slug or album ID is password-protected.
 */
export function isProtected(key: string, type: 'subpage' | 'album' = 'subpage'): boolean {
  return !!findPassword(key, type);
}

/**
 * Validate a password attempt and return a Set-Cookie header value on success.
 * Returns null if the password is wrong.
 */
export function authenticate(
  key: string,
  password: string,
  type: 'subpage' | 'album' = 'subpage',
): string | null {
  const storedPassword = findPassword(key, type);
  if (!storedPassword) return null;

  let isValid = false;

  if (isBcryptHash(storedPassword)) {
    console.error(
      `\n❌ SECURITY ERROR: ${type === 'subpage' ? 'Subpage' : 'Album'} "${key}" is using an outdated bcrypt password hash.\n` +
        `   Bcrypt dependency has been removed to reduce bundle size.\n` +
        `   Please switch temporarily to plaintext in your gallery.yaml, log in again\n` +
        `   to see your new secure "scrypt:..." hash in the logs, and update your file.\n`,
    );
    return null;
  }

  if (storedPassword.startsWith('scrypt:')) {
    isValid = verifyScrypt(password, storedPassword);
  } else {
    // Plaintext fallback (deprecated)
    if (password.length > 1024) return null;

    // Hash both to a fixed length before constant-time comparison to prevent timing and length attacks
    const attemptHash = crypto
      .createHmac('sha256', getConfig().authSecret)
      .update(password)
      .digest();
    const storedHash = crypto
      .createHmac('sha256', getConfig().authSecret)
      .update(storedPassword)
      .digest();
    isValid = crypto.timingSafeEqual(attemptHash, storedHash);

    if (isValid) {
      const recommendedHash = generateScryptHash(storedPassword);
      console.warn(
        `\n⚠️  SECURITY WARNING: ${type === 'subpage' ? 'Subpage' : 'Album'} "${key}" is using a plaintext password in gallery.yaml.\n` +
          `   Please replace it with this native secure hash:\n\n   ${recommendedHash}\n`,
      );
    }
  }

  if (!isValid) return null;

  const maxAge = TOKEN_EXPIRY_HOURS * 60 * 60;
  const token = authToken(key, storedPassword, Date.now() + maxAge * 1000);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';

  return `${cookieName(key, type)}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Strict${secure}`;
}

/**
 * Check if the request has a valid auth cookie for the given subpage or album.
 * Works with the cookies() API from Next.js server components.
 */
export function isAuthenticated(
  key: string,
  getCookie: (name: string) => string | undefined,
  type: 'subpage' | 'album' = 'subpage',
): boolean {
  const storedPassword = findPassword(key, type);
  if (!storedPassword) return true; // not protected

  const cookie = getCookie(cookieName(key, type));
  if (!cookie) return false;

  // Legacy tokens (bare HMAC, no expiry) do not parse here and are rejected;
  // the visitor simply re-enters the password.
  const sep = cookie.indexOf('.');
  if (sep === -1) return false;

  const expiresAt = Number(cookie.slice(0, sep));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const expected = authToken(key, storedPassword, expiresAt);
  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(cookie, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
