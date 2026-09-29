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

/**
 * A well-formed hash with a random salt and a random digest, drawn once per
 * process. No password matches it (the odds are 2^-512), so verifying against
 * it costs exactly what a real verification costs and always fails.
 */
const DUMMY_HASH = `${SCRYPT_PREFIX}${crypto.randomBytes(16).toString('hex')}:${crypto
  .randomBytes(64)
  .toString('hex')}`;

/**
 * Spend one scrypt verification on nothing.
 *
 * A password check that returns early — no such key, a key without a password,
 * a plaintext password compared by HMAC — answers in a couple of milliseconds,
 * while a real scrypt hash takes tens. That gap tells anyone who times the
 * replies which keys hold a hashed password, even when the reply bodies are
 * identical. Callers run this on every path that would otherwise skip scrypt,
 * so every attempt costs the same.
 */
export async function burnScrypt(password: string): Promise<void> {
  await verifyScrypt(password, DUMMY_HASH);
}

/** Produce a storable `scrypt:salt:hash_hex` string. */
export async function generateScryptHash(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)).toString('hex');
  return `${SCRYPT_PREFIX}${salt}:${hash}`;
}
