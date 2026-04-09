import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the config module so tokens.ts can resolve getConfig().immich.apiKey
vi.mock('@/lib/config', () => ({
  getConfig: () => ({
    immich: { apiKey: 'test-api-key-for-vitest-unit-tests' },
    authSecret: 'test-auth-secret-32-chars-long-min',
  }),
}));

import { encodeAssetId, decodeAssetId } from '@/lib/tokens';

const SAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('encodeAssetId', () => {
    it('produces a non-empty base64url string', () => {
      const token = encodeAssetId(SAMPLE_UUID);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      // base64url characters only
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('is deterministic — same input yields same token', () => {
      const t1 = encodeAssetId(SAMPLE_UUID);
      const t2 = encodeAssetId(SAMPLE_UUID);
      expect(t1).toBe(t2);
    });

    it('produces different tokens for different UUIDs', () => {
      const t1 = encodeAssetId(SAMPLE_UUID);
      const t2 = encodeAssetId('12345678-aaaa-bbbb-cccc-123456789abc');
      expect(t1).not.toBe(t2);
    });
  });

  describe('decodeAssetId', () => {
    it('round-trips a valid UUID (aes-256-gcm)', () => {
      const token = encodeAssetId(SAMPLE_UUID);
      const decoded = decodeAssetId(token);
      expect(decoded).toBe(SAMPLE_UUID);
    });

    it('correctly decodes legacy aes-256-cbc tokens', () => {
      // This token was generated with aes-256-cbc for SAMPLE_UUID with the mock authSecret
      // 'test-auth-secret-32-chars-long-min'
      const legacyToken = 'o6nh7ZcyyrKIaBJ74A8c6RIsO99JKNIh96zjIqE8bl9VLmdQBiqVXAbjpZvJ9-d1beN1PCjzeeyhFcewCM8Szw';
      const decoded = decodeAssetId(legacyToken);
      expect(decoded).toBe(SAMPLE_UUID);
    });

    it('returns null for an invalid gcm token (bad tag/ciphertext)', () => {
      const token = encodeAssetId(SAMPLE_UUID);
      // Mangle the last character
      const badToken = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
      expect(decodeAssetId(badToken)).toBeNull();
    });

    it('returns null for a garbage string', () => {
      expect(decodeAssetId('not-a-valid-token')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(decodeAssetId('')).toBeNull();
    });

    it('returns null for a token that is too short', () => {
      // less than 17 bytes when decoded
      const short = Buffer.from('shortdata').toString('base64url');
      expect(decodeAssetId(short)).toBeNull();
    });
  });
});
