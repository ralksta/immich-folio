import { describe, it, expect, vi, beforeEach } from 'vitest';

// No SITE_TITLE, so the title has to come from the locale.
vi.mock('@/lib/env', () => ({
  env: {
    IMMICH_API_URL: 'http://localhost:2283',
    IMMICH_API_KEY: 'test-key',
    SITE_TITLE: '',
    SITE_SUBTITLE: '',
    CACHE_TTL: 300,
    RATE_LIMIT_RPM: 120,
  },
  normalizeApiUrl: (raw: string) => raw.replace(/\/+$/, ''),
}));

vi.mock('@/lib/secret', () => ({
  resolveAuthSecret: () => 'test-auth-secret-32-chars-long-min',
}));

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

// With neither settings.yaml `title` nor SITE_TITLE set, the site used to be
// called "Gallery" in every language (#696).
describe('default site title', () => {
  beforeEach(() => invalidateConfigCache());

  it('uses the configured locale', () => {
    mockYamlFiles({ lang: 'de' });
    expect(getConfig().siteTitle).toBe('Galerie');
    expect(getConfig().seo.title).toBe('Galerie');
  });

  it('falls back to English for an unsupported locale', () => {
    mockYamlFiles({ lang: 'ja' });
    expect(getConfig().siteTitle).toBe('Gallery');
  });

  it('keeps an explicit title', () => {
    mockYamlFiles({ lang: 'de', title: 'Mein Folio' });
    expect(getConfig().siteTitle).toBe('Mein Folio');
  });
});
