import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Readable env getters, like admin-auth.test.ts, so tests can toggle which
// values come from the environment vs. the wizard file.
vi.mock('@/lib/env', () => ({
  env: {
    get IMMICH_API_URL() {
      return process.env.__T_INSTALL_URL || '';
    },
    get IMMICH_API_KEY() {
      return process.env.__T_INSTALL_KEY || '';
    },
    get AUTH_SECRET() {
      return process.env.__T_INSTALL_SECRET || '';
    },
    get ADMIN_PASSWORD() {
      return process.env.__T_INSTALL_ADMIN || '';
    },
    get INSTALL_CONTENT_DIR() {
      return process.env.INSTALL_CONTENT_DIR || '';
    },
  },
}));

/** Import fresh so the module-level install-file cache cannot leak between cases. */
async function loadInstall() {
  vi.resetModules();
  return import('@/lib/install');
}

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
  vi.stubEnv('INSTALL_CONTENT_DIR', dir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.__T_INSTALL_URL;
  delete process.env.__T_INSTALL_KEY;
  delete process.env.__T_INSTALL_SECRET;
  delete process.env.__T_INSTALL_ADMIN;
  fs.rmSync(dir, { recursive: true, force: true });
});

const ALBUM_ID = '11111111-1111-1111-1111-111111111111';

describe('getInstallCredentials', () => {
  it('returns the file values when the environment is empty', async () => {
    const { getInstallCredentials } = await loadInstall();
    fs.writeFileSync(
      path.join(dir, 'install.json'),
      JSON.stringify({
        apiUrl: 'https://file-immich:2283',
        apiKey: 'file-key',
        authSecret: 'file-secret',
        adminPassword: 'file-admin',
      }),
    );

    expect(getInstallCredentials()).toEqual({
      apiUrl: 'https://file-immich:2283',
      apiKey: 'file-key',
      authSecret: 'file-secret',
      adminPassword: 'file-admin',
    });
  });

  it('lets environment variables win over the file', async () => {
    const { getInstallCredentials } = await loadInstall();
    process.env.__T_INSTALL_URL = 'https://env-immich:2283';
    process.env.__T_INSTALL_KEY = 'env-key';
    process.env.__T_INSTALL_SECRET = 'env-secret';
    process.env.__T_INSTALL_ADMIN = 'env-admin';
    fs.writeFileSync(
      path.join(dir, 'install.json'),
      JSON.stringify({
        apiUrl: 'https://file-immich:2283',
        apiKey: 'file-key',
        authSecret: 'file-secret',
        adminPassword: 'file-admin',
      }),
    );

    expect(getInstallCredentials()).toEqual({
      apiUrl: 'https://env-immich:2283',
      apiKey: 'env-key',
      authSecret: 'env-secret',
      adminPassword: 'env-admin',
    });
  });

  it('returns empty strings when neither source has values', async () => {
    const { getInstallCredentials } = await loadInstall();
    expect(getInstallCredentials()).toEqual({
      apiUrl: '',
      apiKey: '',
      authSecret: '',
      adminPassword: '',
    });
  });
});

describe('isInstalled', () => {
  it('is false while gallery.yaml is missing', async () => {
    const { isInstalled } = await loadInstall();
    process.env.__T_INSTALL_URL = 'https://immich:2283';
    process.env.__T_INSTALL_KEY = 'key';
    expect(isInstalled()).toBe(false);
  });

  it('is false when credentials are missing even if gallery.yaml exists', async () => {
    const { isInstalled } = await loadInstall();
    fs.writeFileSync(path.join(dir, 'gallery.yaml'), 'albums: []\n');
    expect(isInstalled()).toBe(false);
  });

  it('is true once gallery.yaml exists and credentials resolve', async () => {
    const { isInstalled } = await loadInstall();
    fs.writeFileSync(path.join(dir, 'gallery.yaml'), 'albums: []\n');
    process.env.__T_INSTALL_URL = 'https://immich:2283';
    process.env.__T_INSTALL_KEY = 'key';
    expect(isInstalled()).toBe(true);
  });
});

describe('completeInstall', () => {
  it('writes gallery.yaml, settings.yaml and install.json', async () => {
    const { completeInstall, getInstallCredentials } = await loadInstall();

    await completeInstall({
      apiUrl: 'https://immich.example',
      apiKey: 'api-key-123',
      siteTitle: 'My Portfolio',
      siteSubtitle: 'A visual journal',
      theme: 'noir',
      albums: [ALBUM_ID],
      adminPassword: 'hunter2',
    });

    const gallery = fs.readFileSync(path.join(dir, 'gallery.yaml'), 'utf8');
    expect(gallery).toContain('albums');
    expect(gallery).toContain(ALBUM_ID);

    const settings = fs.readFileSync(path.join(dir, 'settings.yaml'), 'utf8');
    expect(settings).toContain('My Portfolio');
    expect(settings).toContain('noir');

    const creds = JSON.parse(fs.readFileSync(path.join(dir, 'install.json'), 'utf8'));
    expect(creds.apiUrl).toBe('https://immich.example');
    expect(creds.apiKey).toBe('api-key-123');
    // Stored as a hash, never as typed — an admin password is the one
    // credential here a person picked and may have reused elsewhere.
    expect(creds.adminPassword).not.toBe('hunter2');
    expect(creds.adminPassword).toMatch(/^scrypt:[0-9a-f]+:[0-9a-f]+$/);
    const { verifyScrypt } = await import('@/lib/password');
    expect(await verifyScrypt('hunter2', creds.adminPassword)).toBe(true);
    expect(await verifyScrypt('wrong', creds.adminPassword)).toBe(false);
    // A fresh, unguessable site secret is generated.
    expect(creds.authSecret).toBeTruthy();
    expect(creds.authSecret.length).toBeGreaterThanOrEqual(32);

    // The generated secret resolves through getInstallCredentials.
    expect(getInstallCredentials().authSecret).toBe(creds.authSecret);
  });

  it('writes an empty albums list when no albums are selected', async () => {
    const { completeInstall } = await loadInstall();
    await completeInstall({
      apiUrl: 'https://immich.example',
      apiKey: 'api-key-123',
      albums: [],
    });

    const gallery = fs.readFileSync(path.join(dir, 'gallery.yaml'), 'utf8');
    expect(gallery).toContain('albums: []');
  });

  it('does not set an admin password when none is given', async () => {
    const { completeInstall } = await loadInstall();
    await completeInstall({
      apiUrl: 'https://immich.example',
      apiKey: 'api-key-123',
    });

    const creds = JSON.parse(fs.readFileSync(path.join(dir, 'install.json'), 'utf8'));
    expect(creds.adminPassword).toBeUndefined();
  });

  it('makes isInstalled() true immediately — no restart required', async () => {
    const { completeInstall, isInstalled } = await loadInstall();
    expect(isInstalled()).toBe(false);

    await completeInstall({
      apiUrl: 'https://immich.example',
      apiKey: 'api-key-123',
    });

    expect(isInstalled()).toBe(true);
  });
});

describe('normalizeApiBase', () => {
  it('appends /api to a base URL', async () => {
    const { normalizeApiBase } = await loadInstall();
    expect(normalizeApiBase('https://photos.example.com')).toBe('https://photos.example.com/api');
  });

  it('strips a trailing slash', async () => {
    const { normalizeApiBase } = await loadInstall();
    expect(normalizeApiBase('https://photos.example.com/')).toBe('https://photos.example.com/api');
  });

  it('does not double-append /api', async () => {
    const { normalizeApiBase } = await loadInstall();
    expect(normalizeApiBase('https://photos.example.com/api')).toBe(
      'https://photos.example.com/api',
    );
  });

  it('rejects non-http(s) schemes and garbage', async () => {
    const { normalizeApiBase } = await loadInstall();
    expect(normalizeApiBase('ftp://photos.example.com')).toBeNull();
    expect(normalizeApiBase('not a url')).toBeNull();
    expect(normalizeApiBase('')).toBeNull();
  });
});

describe('isInstallPath', () => {
  it('matches the wizard route only', async () => {
    const { isInstallPath } = await loadInstall();
    expect(isInstallPath('/install')).toBe(true);
    expect(isInstallPath('/install/')).toBe(true);
    expect(isInstallPath('/api/install')).toBe(false);
    expect(isInstallPath('/admin')).toBe(false);
    expect(isInstallPath('/')).toBe(false);
    expect(isInstallPath(null)).toBe(false);
  });
});

describe('setup token', () => {
  /**
   * The reason this is a file and not a module variable: Next.js bundles the
   * install page and the install route handlers separately, so each gets its
   * own instance of lib/install.ts. A module-level token made /install render
   * the wizard and /api/install reject that same token, inside one process —
   * the wizard could not get past step 1. Two freshly imported module
   * instances reproduce exactly that split.
   */
  it('agrees across separate module instances', async () => {
    const pageSide = await loadInstall();
    const token = pageSide.getSetupToken();

    const apiSide = await loadInstall(); // fresh instance, as a second bundle would be
    expect(apiSide.validateSetupToken(token)).toBe(true);
  });

  it('persists across a restart, so the operator keeps the logged token', async () => {
    const first = await loadInstall();
    const token = first.getSetupToken();

    const afterRestart = await loadInstall();
    expect(afterRestart.getSetupToken()).toBe(token);
  });

  it('writes the token 0600 — it is a credential, not a config value', async () => {
    const { getSetupToken } = await loadInstall();
    getSetupToken();

    const mode = fs.statSync(path.join(dir, '.setup-token')).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('rejects a wrong or missing token', async () => {
    const { getSetupToken, validateSetupToken } = await loadInstall();
    getSetupToken();

    expect(validateSetupToken('nope')).toBe(false);
    expect(validateSetupToken('')).toBe(false);
    expect(validateSetupToken(null)).toBe(false);
  });

  // Once install is done every install route answers 403, so the token guards
  // nothing — leaving it on disk would just be a stray credential.
  it('is removed once the install completes', async () => {
    const { getSetupToken, completeInstall } = await loadInstall();
    getSetupToken();
    expect(fs.existsSync(path.join(dir, '.setup-token'))).toBe(true);

    await completeInstall({ apiUrl: 'http://immich.local', apiKey: 'k', albums: [] });
    expect(fs.existsSync(path.join(dir, '.setup-token'))).toBe(false);
  });
});
