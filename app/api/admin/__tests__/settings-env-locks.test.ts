import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/admin/auth', () => ({
  isAdminEnabled: vi.fn(() => true),
  isAdminAuthenticated: vi.fn(async () => true),
  COOKIE_NAME: 'folio_admin_session',
}));

vi.mock('@/lib/admin/yaml-service', () => ({
  readSettingsYaml: vi.fn(async () => ({
    sitePassword: 'scrypt:stored:hash',
    contact: { enabled: true, notifyUrl: 'https://ntfy.sh/stored' },
  })),
  readSettingsYamlVersioned: vi.fn(async () => ({
    data: {
      sitePassword: 'scrypt:stored:hash',
      contact: { enabled: true, notifyUrl: 'https://ntfy.sh/stored' },
    },
    version: 'v1',
  })),
  writeSettingsYaml: vi.fn(async () => undefined),
}));

vi.mock('@/lib/config', () => ({
  invalidateConfigCache: vi.fn(),
  getConfigOrNull: vi.fn(() => null),
}));

vi.mock('@/lib/immich', () => ({ immich: { invalidateAll: vi.fn() } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const env = vi.hoisted(() => ({
  SITE_PASSWORD: 'env-secret-password' as string | undefined,
  CONTACT_NOTIFY_URL: 'https://ntfy.sh/env-secret-topic' as string | undefined,
  SITE_TITLE: 'Env Title',
}));
vi.mock('@/lib/env', () => ({ env }));

import { writeSettingsYaml } from '@/lib/admin/yaml-service';
import { GET, PUT } from '../settings/route';

/**
 * The panel renders these fields locked (#605). The payload carries only the
 * variable names: the values are a password and an ntfy topic.
 */
describe('/api/admin/settings env locks (#605)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.SITE_PASSWORD = 'env-secret-password';
    env.CONTACT_NOTIFY_URL = 'https://ntfy.sh/env-secret-topic';
  });

  it('GET names the locking variables and never their values', async () => {
    const res = await GET();
    const text = await res.text();

    expect(JSON.parse(text).envLocks).toEqual({
      sitePassword: 'SITE_PASSWORD',
      'contact.notifyUrl': 'CONTACT_NOTIFY_URL',
    });
    expect(text).not.toContain('env-secret-password');
    expect(text).not.toContain('env-secret-topic');
  });

  it('GET reports no locks when the variables are unset', async () => {
    env.SITE_PASSWORD = undefined;
    env.CONTACT_NOTIFY_URL = undefined;
    const body = await (await GET()).json();
    expect(body.envLocks).toEqual({});
  });

  it('PUT keeps the stored value of a locked field', async () => {
    const res = await PUT(
      new Request('http://localhost/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          settings: {
            title: 'Folio',
            sitePassword: 'typed-in-panel',
            contact: { enabled: true, notifyUrl: 'https://ntfy.sh/typed' },
          },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(writeSettingsYaml).mock.calls[0][0]).toMatchObject({
      title: 'Folio',
      sitePassword: 'scrypt:stored:hash',
      contact: { enabled: true, notifyUrl: 'https://ntfy.sh/stored' },
    });
  });
});
