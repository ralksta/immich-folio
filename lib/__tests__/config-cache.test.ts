import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock env.ts so importing config.ts doesn't trigger Zod validation
vi.mock('@/lib/env', () => ({
  env: {
    IMMICH_API_URL: 'http://localhost:2283',
    IMMICH_API_KEY: 'test-key',
    SITE_TITLE: 'Test Gallery',
    SITE_SUBTITLE: '',
    CACHE_TTL: 300,
    RATE_LIMIT_RPM: 120,
  },
}));

vi.mock('@/lib/secret', () => ({
  resolveAuthSecret: () => 'test-auth-secret-32-chars-long-min',
}));

// Replace the filesystem-backed YAML layer. The real loadYaml() already
// revalidates by mtime, so "the file changed on disk" is modelled by the
// mock returning different content.
vi.mock('@/lib/config/parser', () => ({
  loadYaml: vi.fn(),
  clearYamlCache: vi.fn(),
  validateUuid: (id: string) => id,
}));

import { getConfig, invalidateConfigCache } from '@/lib/config';
import { loadYaml } from '@/lib/config/parser';

const ALBUM_ID = '11111111-1111-1111-1111-111111111111';

function mockYamlFiles(settings: Record<string, unknown>) {
  vi.mocked(loadYaml).mockImplementation((filename: string) => {
    if (filename === 'gallery.yaml') return { albums: [ALBUM_ID] };
    if (filename === 'settings.yaml') return settings;
    return null;
  });
}

describe('getConfig() in production', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    invalidateConfigCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('picks up settings.yaml changes without invalidateConfigCache()', () => {
    // An admin save may run in a different worker/process than page
    // rendering, so this worker never sees invalidateConfigCache().
    // getConfig() must delegate freshness to the mtime-checked YAML layer
    // instead of short-circuiting on a stale in-memory copy.
    mockYamlFiles({ title: 'Old Title' });
    expect(getConfig().siteTitle).toBe('Old Title');

    mockYamlFiles({ title: 'New Title' });
    expect(getConfig().siteTitle).toBe('New Title');
  });
});
