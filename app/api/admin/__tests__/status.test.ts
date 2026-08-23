import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/admin/auth', () => ({
  isAdminEnabled: () => true,
  isAdminAuthenticated: async () => true,
  COOKIE_NAME: 'folio_admin_session',
}));

vi.mock('@/lib/immich', () => ({
  immich: { ping: vi.fn(async () => true) },
}));

vi.mock('@/lib/cache', () => ({
  cache: { size: 0 },
}));

vi.mock('@/lib/admin/yaml-service', () => ({
  readGalleryYaml: vi.fn(),
  readSettingsYaml: vi.fn(),
  listBackups: vi.fn(async () => []),
}));

vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(() => ({
    needsSetup: false,
    needsCredentials: false,
    needsGallery: false,
  })),
}));

import { GET } from '../status/route';
import { readGalleryYaml, readSettingsYaml } from '@/lib/admin/yaml-service';
import { getConfig } from '@/lib/config';

const mockGallery = readGalleryYaml as unknown as ReturnType<typeof vi.fn>;
const mockSettings = readSettingsYaml as unknown as ReturnType<typeof vi.fn>;
const mockConfig = getConfig as unknown as ReturnType<typeof vi.fn>;

async function status() {
  return (await GET()).json();
}

describe('GET /api/admin/status — config integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGallery.mockResolvedValue({ albums: ['a'] });
    mockSettings.mockResolvedValue({ title: 'Site' });
    mockConfig.mockReturnValue({
      needsSetup: false,
      needsCredentials: false,
      needsGallery: false,
    });
  });

  it('reports a fully configured install as valid', async () => {
    expect((await status()).config).toMatchObject({ status: 'valid', settings: 'valid' });
  });

  /**
   * settings.yaml is optional — getConfig() falls back to defaults when it is
   * absent. Reporting that install as "Degraded" sent people hunting for a
   * fault that did not exist (#341).
   */
  it('treats a missing settings.yaml as valid, not as a fault', async () => {
    mockSettings.mockResolvedValue(null); // what readSettingsYaml returns on ENOENT

    expect((await status()).config).toMatchObject({ status: 'valid', settings: 'valid' });
  });

  it('still reports a settings.yaml that cannot be parsed', async () => {
    mockSettings.mockRejectedValue(new Error('bad indentation'));

    expect((await status()).config).toMatchObject({ status: 'invalid', settings: 'invalid' });
  });

  /**
   * gallery.yaml, unlike settings.yaml, is genuinely required — but a file that
   * was never created is a pending setup step, not a corrupt config. Reporting
   * both as "invalid" told a fresh deployment its config was broken and offered
   * a backup restore as the cure (#507).
   */
  it('reports a missing gallery.yaml as pending setup, not as invalid', async () => {
    mockGallery.mockResolvedValue(null);

    expect((await status()).config).toMatchObject({ status: 'setup', gallery: 'missing' });
  });

  it('still reports a gallery.yaml that cannot be parsed as invalid', async () => {
    mockGallery.mockRejectedValue(new Error('bad indentation'));

    expect((await status()).config).toMatchObject({ status: 'invalid', gallery: 'invalid' });
  });
});

describe('GET /api/admin/status — setup state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGallery.mockResolvedValue({ albums: ['a'] });
    mockSettings.mockResolvedValue({ title: 'Site' });
  });

  it('reports a finished install as complete', async () => {
    mockConfig.mockReturnValue({
      needsSetup: false,
      needsCredentials: false,
      needsGallery: false,
    });

    expect((await status()).setup).toEqual({
      complete: true,
      credentials: 'present',
      gallery: 'present',
    });
  });

  /**
   * The case from #507: credentials from the environment, no gallery.yaml. The
   * admin panel must be able to tell those apart to say what is actually left
   * to do instead of "System Degraded".
   */
  it('separates missing credentials from a missing gallery.yaml', async () => {
    mockConfig.mockReturnValue({
      needsSetup: true,
      needsCredentials: false,
      needsGallery: true,
    });

    expect((await status()).setup).toEqual({
      complete: false,
      credentials: 'present',
      gallery: 'missing',
    });
  });

  it('reports absent credentials', async () => {
    mockConfig.mockReturnValue({
      needsSetup: true,
      needsCredentials: true,
      needsGallery: true,
    });

    expect((await status()).setup).toEqual({
      complete: false,
      credentials: 'missing',
      gallery: 'missing',
    });
  });
});
