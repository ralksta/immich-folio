import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// next/headers is only used by isAdminAuthenticated(), which we do not exercise here.
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));

const ADMIN_PASSWORD = 'correct-horse-battery-staple';
const AUTH_SECRET = 'test-auth-secret-32-chars-long-min';

vi.mock('../env', () => ({
  env: {
    IMMICH_API_URL: '',
    IMMICH_API_KEY: '',
    SITE_TITLE: 'Test',
    SITE_SUBTITLE: '',
    CACHE_TTL: 300,
    IMAGE_CACHE_VERSION: '',
    IMMICH_TIMEOUT_MS: 15000,
    RATE_LIMIT_RPM: 1500,
    TRUSTED_PROXY_HOPS: 0,
    get AUTH_SECRET() {
      return process.env.__TEST_AUTH_SECRET;
    },
    get ADMIN_PASSWORD() {
      return process.env.__TEST_ADMIN_PASSWORD;
    },
  },
}));

vi.mock('../install', () => ({
  getInstallCredentials() {
    return {
      apiUrl: '',
      apiKey: '',
      authSecret: process.env.__TEST_AUTH_SECRET || '',
      adminPassword: process.env.__TEST_ADMIN_PASSWORD || '',
    };
  },
  isInstalled: () => false,
  isInstallPath: () => false,
  normalizeApiBase: (): string => '',
  completeInstall: () => {},
}));

/** Import fresh so module-level state cannot leak between cases. */
async function loadAuth() {
  vi.resetModules();
  return import('../admin/auth');
}

function forgeToken(signingKey: Buffer, payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', signingKey).update(data).digest('base64url');
  return `${data}.${sig}`;
}

beforeEach(() => {
  process.env.__TEST_AUTH_SECRET = AUTH_SECRET;
  process.env.__TEST_ADMIN_PASSWORD = ADMIN_PASSWORD;
});

afterEach(() => {
  delete process.env.__TEST_AUTH_SECRET;
  delete process.env.__TEST_ADMIN_PASSWORD;
  vi.unstubAllEnvs();
});

describe('admin session tokens', () => {
  it('accepts a token it just issued', async () => {
    const { createAdminToken, verifyAdminToken } = await loadAuth();
    expect(verifyAdminToken(createAdminToken())).toBe(true);
  });

  it('rejects a token forged with the old hardcoded dev fallback secret', async () => {
    const { verifyAdminToken } = await loadAuth();
    // The exact key an attacker could derive from the public source before the fix.
    const legacyKey = crypto.createHash('sha256').update('admin:dev-fallback-secret').digest();
    const forged = forgeToken(legacyKey, {
      role: 'admin',
      iat: Date.now(),
      exp: Date.now() + 60_000,
    });
    expect(verifyAdminToken(forged)).toBe(false);
  });

  it('does not fall back to a guessable secret when AUTH_SECRET is unset in dev', async () => {
    delete process.env.__TEST_AUTH_SECRET;
    const { verifyAdminToken } = await loadAuth();
    const legacyKey = crypto.createHash('sha256').update('admin:dev-fallback-secret').digest();
    const forged = forgeToken(legacyKey, {
      role: 'admin',
      iat: Date.now(),
      exp: Date.now() + 60_000,
    });
    expect(verifyAdminToken(forged)).toBe(false);
  });

  it('throws rather than signing with a guessable secret when AUTH_SECRET is unset in production', async () => {
    delete process.env.__TEST_AUTH_SECRET;
    const prevNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    try {
      const { createAdminToken } = await loadAuth();
      expect(() => createAdminToken()).toThrow(/AUTH_SECRET/);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
    }
  });

  it('returns false (not throw) for a malformed cookie with a short signature', async () => {
    const { verifyAdminToken } = await loadAuth();
    // Pre-fix this hit crypto.timingSafeEqual outside the try block -> RangeError -> HTTP 500.
    expect(() => verifyAdminToken('a.b')).not.toThrow();
    expect(verifyAdminToken('a.b')).toBe(false);
    expect(verifyAdminToken('not-a-token')).toBe(false);
    expect(verifyAdminToken('')).toBe(false);
  });

  it('rejects an expired token', async () => {
    const { verifyAdminToken } = await loadAuth();
    const key = crypto
      .createHash('sha256')
      .update(`admin:${AUTH_SECRET}:${ADMIN_PASSWORD}`)
      .digest();
    const expired = forgeToken(key, { role: 'admin', iat: 0, exp: Date.now() - 1000 });
    expect(verifyAdminToken(expired)).toBe(false);
  });

  it('rejects a validly signed token whose role is not admin', async () => {
    const { verifyAdminToken } = await loadAuth();
    const key = crypto
      .createHash('sha256')
      .update(`admin:${AUTH_SECRET}:${ADMIN_PASSWORD}`)
      .digest();
    const wrongRole = forgeToken(key, { role: 'viewer', iat: 0, exp: Date.now() + 60_000 });
    expect(verifyAdminToken(wrongRole)).toBe(false);
  });

  it('invalidates existing sessions when ADMIN_PASSWORD is rotated', async () => {
    const first = await loadAuth();
    const token = first.createAdminToken();
    expect(first.verifyAdminToken(token)).toBe(true);

    process.env.__TEST_ADMIN_PASSWORD = 'a-brand-new-password';
    const second = await loadAuth();
    expect(second.verifyAdminToken(token)).toBe(false);
  });
});

describe('verifyAdminPassword', () => {
  it('accepts the configured password and rejects others', async () => {
    const { verifyAdminPassword } = await loadAuth();
    expect(verifyAdminPassword(ADMIN_PASSWORD)).toBe(true);
    expect(verifyAdminPassword('wrong')).toBe(false);
    expect(verifyAdminPassword(`${ADMIN_PASSWORD}x`)).toBe(false);
    expect(verifyAdminPassword('')).toBe(false);
  });

  it('rejects everything when no ADMIN_PASSWORD is configured', async () => {
    delete process.env.__TEST_ADMIN_PASSWORD;
    const { verifyAdminPassword, isAdminEnabled } = await loadAuth();
    expect(isAdminEnabled()).toBe(false);
    expect(verifyAdminPassword('')).toBe(false);
    expect(verifyAdminPassword('anything')).toBe(false);
  });

  // The comparison used to run on the raw strings, so a length mismatch
  // returned before timingSafeEqual could. That early exit is what leaked the
  // length of ADMIN_PASSWORD; a wrong password of the *right* length has to be
  // rejected by the same code path as any other.
  it('rejects a wrong password of exactly the right length', async () => {
    const { verifyAdminPassword } = await loadAuth();
    const sameLength = 'x'.repeat(ADMIN_PASSWORD.length);
    expect(sameLength).toHaveLength(ADMIN_PASSWORD.length);
    expect(sameLength).not.toBe(ADMIN_PASSWORD);
    expect(verifyAdminPassword(sameLength)).toBe(false);
  });

  it('rejects an oversized attempt without hashing it', async () => {
    const { verifyAdminPassword, MAX_PASSWORD_LENGTH } = await loadAuth();
    expect(verifyAdminPassword('x'.repeat(MAX_PASSWORD_LENGTH + 1))).toBe(false);
  });

  // A cap that a real passphrase could hit would be a lockout, not a fix.
  it('still accepts the configured password when it is long', async () => {
    const { verifyAdminPassword, MAX_PASSWORD_LENGTH } = await loadAuth();
    expect(ADMIN_PASSWORD.length).toBeLessThanOrEqual(MAX_PASSWORD_LENGTH);
    expect(verifyAdminPassword(ADMIN_PASSWORD)).toBe(true);
  });
});
