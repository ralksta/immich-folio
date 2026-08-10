import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/admin/auth', () => ({
  isAdminEnabled: vi.fn(),
  isAdminAuthenticated: vi.fn(),
  COOKIE_NAME: 'folio_admin_session',
}));

import { isAdminEnabled, isAdminAuthenticated } from '@/lib/admin/auth';

const mockEnabled = isAdminEnabled as unknown as ReturnType<typeof vi.fn>;
const mockAuthed = isAdminAuthenticated as unknown as ReturnType<typeof vi.fn>;

/**
 * Every guarded admin route handler. Adding a new /api/admin route means
 * adding a row here — a route that forgets its guard then fails this suite
 * instead of shipping. /api/admin/auth is deliberately absent: it is the login
 * endpoint and must stay reachable without a session.
 */
const ROUTES: {
  name: string;
  path: string;
  load: () => Promise<Record<string, unknown>>;
  method: 'GET' | 'PUT' | 'POST' | 'DELETE';
  args: () => unknown[];
}[] = [
  {
    name: 'GET /api/admin/gallery',
    path: 'gallery',
    load: () => import('../gallery/route'),
    method: 'GET',
    args: () => [],
  },
  {
    name: 'PUT /api/admin/gallery',
    path: 'gallery',
    load: () => import('../gallery/route'),
    method: 'PUT',
    args: () => [new Request('http://localhost/api/admin/gallery', { method: 'PUT', body: '{}' })],
  },
  {
    name: 'GET /api/admin/settings',
    path: 'settings',
    load: () => import('../settings/route'),
    method: 'GET',
    args: () => [],
  },
  {
    name: 'PUT /api/admin/settings',
    path: 'settings',
    load: () => import('../settings/route'),
    method: 'PUT',
    args: () => [new Request('http://localhost/api/admin/settings', { method: 'PUT', body: '{}' })],
  },
  {
    name: 'GET /api/admin/albums',
    path: 'albums',
    load: () => import('../albums/route'),
    method: 'GET',
    args: () => [],
  },
  {
    name: 'POST /api/admin/reload',
    path: 'reload',
    load: () => import('../reload/route'),
    method: 'POST',
    args: () => [],
  },
  {
    name: 'GET /api/admin/status',
    path: 'status',
    load: () => import('../status/route'),
    method: 'GET',
    args: () => [],
  },
  {
    name: 'GET /api/admin/assets',
    path: 'assets',
    load: () => import('../assets/route'),
    method: 'GET',
    args: () => [new Request('http://localhost/api/admin/assets')],
  },
  {
    name: 'GET /api/admin/thumbnail/[id]',
    path: 'thumbnail/[id]',
    load: () => import('../thumbnail/[id]/route'),
    method: 'GET',
    args: () => [
      new Request('http://localhost/api/admin/thumbnail/abc'),
      { params: Promise.resolve({ id: 'abc' }) },
    ],
  },
  {
    name: 'GET /api/admin/albums/[albumId]/assets',
    path: 'albums/[albumId]/assets',
    load: () => import('../albums/[albumId]/assets/route'),
    method: 'GET',
    args: () => [
      new Request('http://localhost/api/admin/albums/a1/assets'),
      { params: Promise.resolve({ albumId: 'a1' }) },
    ],
  },
  {
    name: 'GET /api/admin/analytics',
    path: 'analytics',
    load: () => import('../analytics/route'),
    method: 'GET',
    args: () => [],
  },
  {
    name: 'GET /api/admin/backups',
    path: 'backups',
    load: () => import('../backups/route'),
    method: 'GET',
    args: () => [],
  },
  {
    name: 'POST /api/admin/backups',
    path: 'backups',
    load: () => import('../backups/route'),
    method: 'POST',
    args: () => [new Request('http://localhost/api/admin/backups', { method: 'POST', body: '{}' })],
  },
  {
    name: 'PUT /api/admin/favicon',
    path: 'favicon',
    load: () => import('../favicon/route'),
    method: 'PUT',
    args: () => [new Request('http://localhost/api/admin/favicon', { method: 'PUT' })],
  },
  {
    name: 'DELETE /api/admin/favicon',
    path: 'favicon',
    load: () => import('../favicon/route'),
    method: 'DELETE',
    args: () => [],
  },
  {
    name: 'GET /api/admin/about',
    path: 'about',
    load: () => import('../about/route'),
    method: 'GET',
    args: () => [],
  },
  {
    name: 'PUT /api/admin/about',
    path: 'about',
    load: () => import('../about/route'),
    method: 'PUT',
    args: () => [new Request('http://localhost/api/admin/about', { method: 'PUT', body: '{}' })],
  },
];

describe('admin route guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const route of ROUTES) {
    it(`${route.name} returns 403 when the admin panel is disabled`, async () => {
      mockEnabled.mockReturnValue(false);
      mockAuthed.mockResolvedValue(false);

      const mod = await route.load();
      const handler = mod[route.method] as (...a: unknown[]) => Promise<Response>;
      const res = await handler(...route.args());

      expect(res.status).toBe(403);
    });

    it(`${route.name} returns 401 without a valid session`, async () => {
      mockEnabled.mockReturnValue(true);
      mockAuthed.mockResolvedValue(false);

      const mod = await route.load();
      const handler = mod[route.method] as (...a: unknown[]) => Promise<Response>;
      const res = await handler(...route.args());

      expect(res.status).toBe(401);
    });
  }

  it('has a row for every route module under app/api/admin', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const adminDir = path.join(process.cwd(), 'app/api/admin');

    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__') continue;
          walk(full);
        } else if (entry.name === 'route.ts') {
          found.push(path.relative(adminDir, path.dirname(full)).replace(/\\/g, '/'));
        }
      }
    };
    walk(adminDir);

    const covered = new Set(ROUTES.map((r) => r.path));
    const uncovered = found.filter((p) => p !== 'auth' && !covered.has(p));

    expect(uncovered, `Admin routes with no guard test: ${uncovered.join(', ')}`).toEqual([]);
  });
});
