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

function hmac(data: string): string {
  return crypto.createHmac('sha256', getConfig().authSecret).update(data).digest('hex');
}

function authToken(key: string, passwordSecret: string): string {
  // Use the hash/password as part of the HMAC for a secure, unique session token
  return hmac(`${key}:${passwordSecret}`);
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
    // Plaintext fallback has been removed for security
    console.error(
      `\n❌ SECURITY ERROR: ${type === 'subpage' ? 'Subpage' : 'Album'} "${key}" is using a plaintext password.\n` +
        `   Plaintext passwords are no longer supported.\n` +
        `   Generate a secure scrypt hash using this command:\n\n` +
        `   node -e "const c=require('crypto');const s=c.randomBytes(16).toString('hex');console.log('scrypt:'+s+':'+c.scryptSync('YOUR_PASSWORD',s,64).toString('hex'))"\n`,
    );
    return null;
  }

  if (!isValid) return null;

  const token = authToken(key, storedPassword);
  const maxAge = TOKEN_EXPIRY_HOURS * 60 * 60;
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

  const expected = authToken(key, storedPassword);
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(cookie, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
