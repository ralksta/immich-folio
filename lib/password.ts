/**
 * scrypt password hashing, shared by the album/subpage gate (lib/auth.ts) and
 * the admin panel (lib/admin/auth.ts).
 *
 * Stored format: `scrypt:<salt-hex>:<hash-hex>`.
 */

import crypto from 'crypto';

const SCRYPT_PREFIX = 'scrypt:';

/**
 * scrypt on the libuv threadpool rather than the main thread.
 *
 * scryptSync costs ~23ms per call, and that is 23ms during which the process
 * serves nothing else. The /api/auth rate limit (10/min) is keyed on the client
 * IP, but with the default TRUSTED_PROXY_HOPS=0 that IP comes from a spoofable
 * header (see lib/rate-limit.ts), so an attacker rotating the header gets
 * effectively unlimited buckets — each request buying 23ms of dead process.
 * Running async does not stop the spoofing, but it removes the amplification
 * that made it worth doing.
 */
export function scryptAsync(password: string, salt: string, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/** Whether a stored value is an scrypt hash rather than a plaintext password. */
export function isScryptHash(stored: string): boolean {
  return stored.startsWith(SCRYPT_PREFIX);
}

/** Verify a password against the `scrypt:salt:hash_hex` format. */
export async function verifyScrypt(password: string, stored: string): Promise<boolean> {
  if (!isScryptHash(stored)) return false;

  try {
    const [, salt, hashHex] = stored.split(':');
    const key = await scryptAsync(password, salt, 64);
    const expectedKey = Buffer.from(hashHex, 'hex');
    if (key.length !== expectedKey.length) return false;
    return crypto.timingSafeEqual(key, expectedKey);
  } catch {
    return false;
  }
}

/** Produce a storable `scrypt:salt:hash_hex` string. */
export async function generateScryptHash(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)).toString('hex');
  return `${SCRYPT_PREFIX}${salt}:${hash}`;
}
