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
    it('produces a non-empty base64url string with v2 prefix', () => {
      const token = encodeAssetId(SAMPLE_UUID);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.startsWith('v2:')).toBe(true);
      // base64url characters only for the payload
      expect(token.slice(3)).toMatch(/^[A-Za-z0-9_-]+$/);
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
    it('round-trips a valid UUID', () => {
      const token = encodeAssetId(SAMPLE_UUID);
      const decoded = decodeAssetId(token);
      expect(decoded).toBe(SAMPLE_UUID);
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
