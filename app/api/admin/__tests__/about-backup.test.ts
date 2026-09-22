import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/admin/auth', () => ({
  isAdminEnabled: vi.fn(() => true),
  isAdminAuthenticated: vi.fn(async () => true),
  COOKIE_NAME: 'folio_admin_session',
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// The route imports from 'fs' directly; atomicWrite (used for the actual
// write) imports from 'fs/promises'. Both need the same mock functions so a
// test can see calls made through either.
const fsMock = vi.hoisted(() => ({
  mkdir: vi.fn(async () => undefined),
  access: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
  readdir: vi.fn(async () => []),
  unlink: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  readFile: vi.fn(async () => {
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  }),
}));
vi.mock('fs', () => ({ promises: fsMock }));
vi.mock('fs/promises', () => ({ default: fsMock, ...fsMock }));

const fs = fsMock;
import { PUT } from '../about/route';

const put = (body: unknown) =>
  PUT(
    new Request('http://localhost/api/admin/about', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  );

/**
 * "No file yet" and "the backup could not be written" used to share one
 * catch, so a `.backups/` this save couldn't write to looked exactly like a
 * brand-new file and the save went ahead with no snapshot (#630).
 */
describe('PUT /api/admin/about backup handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves a brand-new file with no backup', async () => {
    vi.mocked(fs.access).mockRejectedValueOnce(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );

    const res = await put({ meta: { name: 'Me' }, body: 'Hello' });

    expect(res.status).toBe(200);
    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledOnce();
  });

  it('aborts the save when the file exists but the backup copy fails', async () => {
    vi.mocked(fs.copyFile).mockRejectedValueOnce(
      Object.assign(new Error('EACCES'), { code: 'EACCES' }),
    );

    await expect(put({ meta: { name: 'Me' }, body: 'Hello' })).rejects.toThrow('EACCES');
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});
