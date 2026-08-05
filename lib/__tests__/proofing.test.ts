import { describe, it, expect } from 'vitest';
import { encodeProofBitmask, decodeProofBitmask } from '../proofing';

describe('lib/proofing', () => {
  it('returns empty string for empty or invalid indices', () => {
    expect(encodeProofBitmask([])).toBe('');
    expect(encodeProofBitmask([-1])).toBe('');
  });

  it('encodes and decodes simple asset indices', () => {
    const indices = [0, 3, 5, 12];
    const encoded = encodeProofBitmask(indices);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = decodeProofBitmask(encoded);
    expect(decoded).toEqual([0, 3, 5, 12]);
  });

  it('handles duplicate and unsorted indices gracefully', () => {
    const indices = [15, 2, 2, 7, 0];
    const encoded = encodeProofBitmask(indices);
    const decoded = decodeProofBitmask(encoded);
    expect(decoded).toEqual([0, 2, 7, 15]);
  });

  it('clamps indices to totalCount if provided', () => {
    const indices = [1, 5, 10];
    const encoded = encodeProofBitmask(indices);
    const decoded = decodeProofBitmask(encoded, 6);
    expect(decoded).toEqual([1, 5]);
  });

  it('returns empty array for invalid bitmask strings', () => {
    expect(decodeProofBitmask('invalid-junk-!!!')).toEqual([]);
    expect(decodeProofBitmask('')).toEqual([]);
  });
});
