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

import { resolveProofing, resolveProofingEmail } from '@/lib/config';

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

/**
 * The proofing dialog's "email to photographer" needs a recipient (#736): the
 * footer contact email by default, overridable with `proofing.email`. Neither
 * set means no recipient, and the dialog hides the button rather than opening
 * a compose with an empty To:.
 */
describe('resolveProofingEmail', () => {
  it('prefers the proofing address over the footer contact email', () => {
    expect(resolveProofingEmail('proofs@example.com', 'hello@example.com')).toBe(
      'proofs@example.com',
    );
  });

  it('falls back to the footer contact email', () => {
    expect(resolveProofingEmail(undefined, 'hello@example.com')).toBe('hello@example.com');
    expect(resolveProofingEmail('', 'hello@example.com')).toBe('hello@example.com');
    expect(resolveProofingEmail('   ', 'hello@example.com')).toBe('hello@example.com');
  });

  it('is undefined when neither is set, so the button is hidden', () => {
    expect(resolveProofingEmail(undefined, undefined)).toBeUndefined();
    expect(resolveProofingEmail('', '')).toBeUndefined();
    expect(resolveProofingEmail('  ', '  ')).toBeUndefined();
  });

  it('trims surrounding whitespace', () => {
    expect(resolveProofingEmail('  proofs@example.com  ', undefined)).toBe('proofs@example.com');
  });
});
