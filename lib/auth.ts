/**
 * Album authentication helpers.
 * Uses HMAC tokens stored in HttpOnly cookies — no database needed.
 *
 * Token = HMAC-SHA256(slug + passwordSecret, authSecret)
 * Cookie = lb_auth_<slug> = <token>
 */

import crypto from 'crypto';
import { getConfig, SubpageConfig } from './config';
import { verifyScrypt, generateScryptHash, isScryptHash } from './password';

const TOKEN_EXPIRY_HOURS = 24;

/**
 * Check if a string looks like a legacy bcrypt hash.
 */
function isBcryptHash(str: string): boolean {
  return str.startsWith('$2a$') || str.startsWith('$2b$') || str.startsWith('$2y$');
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

import nodeFs from 'fs';
import { resolveJournalFilePath, parseFrontmatter } from './journal';

function cookieName(key: string, type: 'subpage' | 'album' | 'journal'): string {
  if (type === 'subpage') return `lb_auth_${key}`;
  if (type === 'journal') return `lb_auth_journal_${key}`;
  return `lb_auth_album_${key}`;
}

/**
 * Find the SubpageConfig for a given slug.
 */
export function findSubpageBySlug(slug: string): SubpageConfig | undefined {
  return getConfig().subpages.find((sp) => sp.slug === slug);
}

/**
 * Find the password secret for a given subpage slug, album ID, or journal entry.
 */
function findPassword(key: string, type: 'subpage' | 'album' | 'journal'): string | undefined {
  const config = getConfig();
  if (type === 'subpage') {
    return config.subpages.find((sp) => sp.slug === key)?.password;
  }
  if (type === 'album') {
    return config.albumPasswords[key];
  }
  if (type === 'journal') {
    try {
      const filePath = resolveJournalFilePath(key);
      if (filePath && nodeFs.existsSync(filePath)) {
        const raw = nodeFs.readFileSync(filePath, 'utf8');
        return parseFrontmatter(raw).frontmatter.password;
      }
    } catch {}
    return undefined;
  }
  return undefined;
}

/**
 * Check if a subpage slug, album ID, or journal entry is password-protected.
 */
export function isProtected(key: string, type: 'subpage' | 'album' | 'journal' = 'subpage'): boolean {
  return !!findPassword(key, type);
}

/**
 * Validate a password attempt and return a Set-Cookie header value on success.
 * Returns null if the password is wrong.
 */
export async function authenticate(
  key: string,
  password: string,
  type: 'subpage' | 'album' | 'journal' = 'subpage',
): Promise<string | null> {
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

  if (isScryptHash(storedPassword)) {
    isValid = await verifyScrypt(password, storedPassword);
  } else {
    // Plaintext fallback (deprecated)
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
      const recommendedHash = await generateScryptHash(storedPassword);
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
  type: 'subpage' | 'album' | 'journal' = 'subpage',
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
