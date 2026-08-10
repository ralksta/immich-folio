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

import { GET } from '../status/route';
import { readGalleryYaml, readSettingsYaml } from '@/lib/admin/yaml-service';

const mockGallery = readGalleryYaml as unknown as ReturnType<typeof vi.fn>;
const mockSettings = readSettingsYaml as unknown as ReturnType<typeof vi.fn>;

async function status() {
  return (await GET()).json();
}

describe('GET /api/admin/status — config integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGallery.mockResolvedValue({ albums: ['a'] });
    mockSettings.mockResolvedValue({ title: 'Site' });
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

  // gallery.yaml, unlike settings.yaml, is genuinely required.
  it('reports a missing gallery.yaml as invalid', async () => {
    mockGallery.mockResolvedValue(null);

    expect((await status()).config).toMatchObject({ status: 'invalid', gallery: 'invalid' });
  });
});
