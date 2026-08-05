/**
 * Bitmask encoder/decoder for compact proofing URL query parameters.
 * Serializes selected asset indices in an album into a short base64url string.
 */

/**
 * Encode an array of 0-based asset indices into a compact base64url bitmask.
 */
export function encodeProofBitmask(indices: number[]): string {
  if (!indices || indices.length === 0) return '';
  const sorted = Array.from(new Set(indices)).sort((a, b) => a - b);
  const maxIndex = sorted[sorted.length - 1];
  if (maxIndex < 0) return '';

  const numBytes = Math.ceil((maxIndex + 1) / 8);
  const bytes = new Uint8Array(numBytes);

  for (const idx of sorted) {
    if (idx < 0) continue;
    const byteIdx = Math.floor(idx / 8);
    const bitIdx = idx % 8;
    bytes[byteIdx] |= 1 << bitIdx;
  }

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode a base64url bitmask string back into an array of selected asset indices.
 */
export function decodeProofBitmask(code: string, totalCount?: number): number[] {
  if (!code || typeof code !== 'string') return [];
  try {
    let base64 = code.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const result: number[] = [];

    for (let byteIdx = 0; byteIdx < binary.length; byteIdx++) {
      const byte = binary.charCodeAt(byteIdx);
      for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
        if (byte & (1 << bitIdx)) {
          const index = byteIdx * 8 + bitIdx;
          if (totalCount === undefined || index < totalCount) {
            result.push(index);
          }
        }
      }
    }

    return result;
  } catch {
    return [];
  }
}
