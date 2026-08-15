import { describe, it, expect, vi } from 'vitest';

// Mock env.ts so importing config.ts doesn't trigger validation
vi.mock('@/lib/env', () => ({
  env: {
    IMMICH_API_URL: 'http://localhost:2283',
    IMMICH_API_KEY: 'test-key',
    SITE_TITLE: 'Test Gallery',
    SITE_SUBTITLE: '',
    CACHE_TTL: 300,
    IMMICH_TIMEOUT_MS: 15000,
    RATE_LIMIT_RPM: 120,
    TRUSTED_PROXY_HOPS: 0,
  },
}));

import { resolveProofing } from '@/lib/config';

/**
 * Client proofing hands a gallery to a client and takes their picks back, so
 * whether it is on is a delivery decision, not a cosmetic one. The controls
 * were previously mounted unconditionally and these settings were inert; these
 * cover the precedence now that they are honoured.
 */
describe('resolveProofing', () => {
  it('falls back to the global setting when the subpage says nothing', () => {
    expect(resolveProofing(undefined, true)).toBe(true);
    expect(resolveProofing(undefined, false)).toBe(false);
    expect(resolveProofing({}, true)).toBe(true);
    expect(resolveProofing({}, false)).toBe(false);
  });

  it('lets a subpage switch proofing on against a global off', () => {
    // The client-handover case: proofing off across a public portfolio, on for
    // the one subpage that is a delivery.
    expect(resolveProofing({ proofing: true }, false)).toBe(true);
  });

  it('lets a subpage switch proofing off against a global on', () => {
    // The regression guard: `||` instead of `??` would silently discard this,
    // leaving hearts on a page that explicitly asked for none.
    expect(resolveProofing({ proofing: false }, true)).toBe(false);
  });

  it('treats an explicit false as a decision, not as absence', () => {
    // Same distinction stated directly — `proofing: false` must not read as
    // "unset" and inherit the global default.
    expect(resolveProofing({ proofing: false }, true)).not.toBe(resolveProofing(undefined, true));
  });
});
