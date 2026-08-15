/**
 * Password gating for subpages, albums, journal entries and the site as a whole.
 * Uses HMAC tokens stored in HttpOnly cookies — no database needed.
 *
 * Token = HMAC-SHA256(slug + passwordSecret, authSecret)
 * Cookie = lb_auth_<slug> = <token>
 */

import crypto from 'crypto';
import { getConfig, SubpageConfig } from './config';
import { verifyScrypt, generateScryptHash, isScryptHash } from './password';

const TOKEN_EXPIRY_HOURS = 24;

/** What a password can protect. */
export type ProtectedType = 'subpage' | 'album' | 'journal' | 'site';

/**
 * Key used for the site-wide gate. There is only ever one, so it is a constant
 * rather than a slug — but it still flows through the same token, cookie and
 * verification path as every other protected thing.
 */
export const SITE_AUTH_KEY = 'site';

const TYPE_LABELS: Record<ProtectedType, string> = {
  subpage: 'Subpage',
  album: 'Album',
  journal: 'Journal entry',
  site: 'Site',
};

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
import { parseFrontmatter } from './journal';
import { resolveJournalFilePath } from './admin/journal-service';

function cookieName(key: string, type: ProtectedType): string {
  if (type === 'subpage') return `lb_auth_${key}`;
  if (type === 'journal') return `lb_auth_journal_${key}`;
  if (type === 'site') return SITE_AUTH_COOKIE;
  return `lb_auth_album_${key}`;
}

/** Cookie carrying the site-wide session. */
export const SITE_AUTH_COOKIE = 'lb_auth_site';

/**
 * Find the SubpageConfig for a given slug.
 */
export function findSubpageBySlug(slug: string): SubpageConfig | undefined {
  return getConfig().subpages.find((sp) => sp.slug === slug);
}

/**
 * Find the password secret for a given subpage slug, album ID, or journal entry.
 */
function findPassword(key: string, type: ProtectedType): string | undefined {
  const config = getConfig();
  if (type === 'site') {
    return config.sitePassword || undefined;
  }
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
export function isProtected(key: string, type: ProtectedType = 'subpage'): boolean {
  return !!findPassword(key, type);
}

/**
 * Validate a password attempt and return a Set-Cookie header value on success.
 * Returns null if the password is wrong.
 */
export async function authenticate(
  key: string,
  password: string,
  type: ProtectedType = 'subpage',
): Promise<string | null> {
  const storedPassword = findPassword(key, type);
  if (!storedPassword) return null;

  let isValid = false;

  if (isBcryptHash(storedPassword)) {
    console.error(
      `\n❌ SECURITY ERROR: ${TYPE_LABELS[type]} "${key}" is using an outdated bcrypt password hash.\n` +
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
        `\n⚠️  SECURITY WARNING: ${TYPE_LABELS[type]} "${key}" is using a plaintext password${type === 'site' ? ' in settings.yaml' : ' in gallery.yaml'}.\n` +
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
  type: ProtectedType = 'subpage',
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

/* ── Site-wide gate ─────────────────────────────────────────────
 *
 * Opt-in: with no `sitePassword` configured, `findPassword` returns undefined
 * and every check below answers "unlocked", so an open portfolio pays nothing
 * for the feature existing.
 */

/** True when a site-wide password is configured at all. */
export function isSiteLocked(): boolean {
  return isProtected(SITE_AUTH_KEY, 'site');
}

/** Whether the caller may be served the public site. */
export function isSiteUnlocked(getCookie: (name: string) => string | undefined): boolean {
  return isAuthenticated(SITE_AUTH_KEY, getCookie, 'site');
}

/** Read one cookie out of a raw `Cookie:` header. */
function readCookieHeader(header: string, name: string): string | undefined {
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return part.slice(eq + 1).trim();
    }
  }
  return undefined;
}

/**
 * Route-handler guard. Returns a 401 to send back, or null to carry on.
 *
 * Route handlers do not go through the root layout, so the page-level gate
 * does not cover them: without this, a locked site would still stream every
 * photo to anyone holding an asset URL.
 */
export function siteLockResponse(request: Request): Response | null {
  const header = request.headers.get('cookie') ?? '';
  if (isSiteUnlocked((name) => readCookieHeader(header, name))) return null;

  return Response.json(
    { error: 'Site is password-protected' },
    // WWW-Authenticate is deliberately omitted: the credential is a form on
    // the site, not HTTP auth, and the header would make browsers pop their
    // own dialog for an image request.
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}
