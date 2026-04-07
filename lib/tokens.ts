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
 * Note: The AES-CBC deterministic IV causes the identical input asset ID
 * to encrypt to the exact same cipher token. This provides URL obfuscation
 * and caching consistency, but it does NOT provide k-anonymous cryptographic
 * security guarantees against recognizing identical items if intercepted.
 */
export function encodeAssetId(assetId: string): string {
  const key = getKey();
  // Deterministic IV from asset ID (same input → same token).
  // SHA-256 slice → first 12 bytes. MD5 was deprecated for cryptographic use.
  const iv = crypto.createHash('sha256').update(assetId).digest().subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(assetId, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Compact: base64url(iv + authTag + ciphertext)
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

/**
 * Decode a token back into an asset ID.
 * Returns null if the token is invalid.
 */
export function decodeAssetId(token: string): string | null {
  try {
    const key = getKey();
    const data = Buffer.from(token, 'base64url');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Try GCM first (iv: 12, authTag: 16, encrypted: >=1)
    if (data.length >= 29) {
      try {
        const iv = data.subarray(0, 12);
        const authTag = data.subarray(12, 28);
        const encrypted = data.subarray(28);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
          'utf8',
        );
        if (uuidRegex.test(decrypted)) return decrypted;
      } catch {
        // Fall back to CBC if GCM fails
      }
    }

    // Legacy fallback: CBC (iv: 16, encrypted: >=1)
    if (data.length >= 17) {
      const iv = data.subarray(0, 16);
      const encrypted = data.subarray(16);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
        'utf8',
      );
      if (uuidRegex.test(decrypted)) return decrypted;
    }

    return null;
  } catch {
    return null;
  }
}
