import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/admin/auth', () => ({
  isAdminEnabled: vi.fn(() => true),
  isAdminAuthenticated: vi.fn(async () => true),
  COOKIE_NAME: 'folio_admin_session',
}));

vi.mock('@/lib/admin/yaml-service', () => ({
  readSettingsYaml: vi.fn(async () => ({})),
  writeSettingsYaml: vi.fn(async () => undefined),
}));

vi.mock('@/lib/config', () => ({
  invalidateConfigCache: vi.fn(),
  getConfigOrNull: vi.fn(() => null),
}));

vi.mock('@/lib/immich', () => ({
  immich: { invalidateAll: vi.fn() },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { writeSettingsYaml } from '@/lib/admin/yaml-service';
import { PUT } from '../settings/route';

const put = (settings: unknown) =>
  PUT(
    new Request('http://localhost/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    }),
  );

/**
 * The point of the check is not that a bad payload is reported — it is that
 * nothing is written. settings.yaml is read by every public page, so a
 * malformed save is discovered by visitors rather than by the person who made
 * it (#599).
 */
describe('PUT /api/admin/settings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes a valid payload', async () => {
    const res = await put({ title: 'Folio', theme: 'minimal' });

    expect(res.status).toBe(200);
    expect(writeSettingsYaml).toHaveBeenCalledOnce();
  });

  it('leaves the file untouched when the payload is malformed', async () => {
    const res = await put({ title: { de: 'Folio' }, grid: 3 });

    expect(res.status).toBe(400);
    expect(writeSettingsYaml).not.toHaveBeenCalled();
  });

  it('answers with the offending fields, so the panel can point at them', async () => {
    const res = await put({ title: 1, theme: { fonts: { heading: 42 } } });
    const body = await res.json();

    expect(body.fields.map((f: { field: string }) => f.field).sort()).toEqual([
      'theme.fonts.heading',
      'title',
    ]);
  });

  it('still writes settings carrying keys this version does not know', async () => {
    // Older and newer configs are both in the wild, and there is no
    // schemaVersion to tell them apart.
    const res = await put({ title: 'Folio', fromALaterRelease: { nested: true } });

    expect(res.status).toBe(200);
    expect(writeSettingsYaml).toHaveBeenCalledOnce();
  });
});
