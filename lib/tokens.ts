/**
 * Token encoding/decoding for asset IDs.
 * Obfuscates Immich UUIDs in public-facing URLs using AES encryption.
 *
 * Uses deterministic encryption (IV derived from asset ID) so the same
 * asset always produces the same token — essential for browser caching.
 */

import crypto from 'crypto';
import { getConfig } from './config';

let _key: Buffer | null = null;

function getKey(): Buffer {
  if (!_key) {
    const authSecret = getConfig().authSecret;
    _key = crypto.createHash('sha256').update(authSecret).digest();
  }
  return _key;
}

/**
 * Encode an asset ID into an opaque URL-safe token.
 * Note: The AES-GCM deterministic IV causes the identical input asset ID
 * to encrypt to the exact same cipher token. This provides URL obfuscation
 * and caching consistency, but it does NOT provide k-anonymous cryptographic
 * security guarantees against recognizing identical items if intercepted.
 */
export function encodeAssetId(assetId: string): string {
  const key = getKey();
  // Deterministic IV from asset ID (same input → same token).
  // SHA-256 slice → first 12 bytes for GCM.
  const iv = crypto.createHash('sha256').update(assetId).digest().subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(assetId, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Compact: base64url(iv + authTag + ciphertext)
  const tokenString = Buffer.concat([iv, authTag, encrypted]).toString('base64url');
  // Prepend version identifier to prevent downgrade attacks
  return `v2:${tokenString}`;
}

/**
 * Decode a token back into an asset ID.
 * Returns null if the token is invalid.
 */
export function decodeAssetId(token: string): string | null {
  try {
    const key = getKey();
    let decrypted: string | null = null;

    if (token.startsWith('v2:')) {
      // Secure GCM decoding
      const data = Buffer.from(token.slice(3), 'base64url');
      if (data.length >= 29) {
        // iv: 12, authTag: 16, encrypted: >=1
        try {
          const iv = data.subarray(0, 12);
          const authTag = data.subarray(12, 28);
          const encrypted = data.subarray(28);
          const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
          decipher.setAuthTag(authTag);
          decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
            'utf8',
          );
        } catch (_e) {
          return null; // Strict failure for v2 tokens
        }
      }
    } else {
      // Legacy CBC decoding
      const data = Buffer.from(token, 'base64url');
      if (data.length >= 17) {
        // iv: 16, encrypted: >=1
        try {
          const iv = data.subarray(0, 16);
          const encrypted = data.subarray(16);
          const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
          decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
            'utf8',
          );
        } catch (_e) {
          return null;
        }
      }
    }

    if (!decrypted) return null;

    // Validate it looks like a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(decrypted) ? decrypted : null;
  } catch {
    return null;
  }
}
