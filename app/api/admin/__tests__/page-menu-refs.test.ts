import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';

/**
 * A page rename or delete moves the file first and then follows up the menu
 * reference in gallery.yaml (#722). When that follow-up fails — gallery.yaml
 * edited by hand into invalid YAML, a write error — the page has already been
 * renamed or deleted. Answering 500 then told the admin nothing was saved: the
 * panel kept the old slug, and every retry hit a 404 for a file that was gone.
 *
 * Real services on a temp content/ directory, as in concurrent-edits.test.ts.
 */

vi.mock('@/lib/admin/auth', () => ({
  isAdminEnabled: vi.fn(() => true),
  isAdminAuthenticated: vi.fn(async () => true),
  COOKIE_NAME: 'folio_admin_session',
}));
vi.mock('@/lib/config', () => ({
  invalidateConfigCache: vi.fn(),
  isPageRef: (e: unknown) => !!e && typeof e === 'object' && 'page' in e,
}));
vi.mock('@/lib/admin/pageSlugs', () => ({
  takenPageSlugs: vi.fn(async () => ({ subpages: [], albums: [], journal: [] })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let root: string;
let content: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'folio-page-refs-'));
  content = path.join(root, 'content');
  await mkdir(path.join(content, 'pages'), { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.resetModules();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

const req = (method: string, body?: unknown) =>
  new Request('http://localhost/api/admin/pages/x', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const md = (title: string) => `---\ntitle: "${title}"\n---\n\nBody of ${title}\n`;
const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const BROKEN_YAML = 'subpages:\n  - page: faq\n  bad: [unclosed\n';

describe('page rename when the menu cannot be updated', () => {
  it('reports the rename as done, with a warning about the menu', async () => {
    await writeFile(path.join(content, 'pages/faq.md'), md('FAQ'));
    await writeFile(path.join(content, 'gallery.yaml'), BROKEN_YAML);
    const { PUT } = await import('../pages/[slug]/route');

    const res = await PUT(req('PUT', { rawMarkdown: md('FAQ'), newSlug: 'help' }), slugCtx('faq'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.page.slug).toBe('help');
    expect(data.menuRenamed).toBe(false);
    expect(data.galleryVersion).toBeNull();
    expect(data.warning).toMatch(/gallery\.yaml/);
    // The rename itself happened, and gallery.yaml was left alone.
    await expect(readFile(path.join(content, 'pages/help.md'), 'utf8')).resolves.toBe(md('FAQ'));
    await expect(readFile(path.join(content, 'pages/faq.md'))).rejects.toThrow();
    await expect(readFile(path.join(content, 'gallery.yaml'), 'utf8')).resolves.toBe(BROKEN_YAML);
  });

  it('a plain save does not touch the menu and carries no warning', async () => {
    await writeFile(path.join(content, 'pages/faq.md'), md('FAQ'));
    await writeFile(path.join(content, 'gallery.yaml'), BROKEN_YAML);
    const { PUT } = await import('../pages/[slug]/route');

    const res = await PUT(req('PUT', { rawMarkdown: md('FAQ 2') }), slugCtx('faq'));
    expect(res.status).toBe(200);
    expect((await res.json()).warning).toBeUndefined();
  });
});

describe('page delete when the menu cannot be updated', () => {
  it('reports the delete as done, with a warning about the menu', async () => {
    await writeFile(path.join(content, 'pages/faq.md'), md('FAQ'));
    await writeFile(path.join(content, 'gallery.yaml'), BROKEN_YAML);
    const { DELETE } = await import('../pages/[slug]/route');

    const res = await DELETE(req('DELETE'), slugCtx('faq'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.deletedSlug).toBe('faq');
    expect(data.removedFromMenu).toBe(false);
    expect(data.galleryVersion).toBeNull();
    expect(data.warning).toMatch(/gallery\.yaml/);
    await expect(readFile(path.join(content, 'pages/faq.md'))).rejects.toThrow();
  });
});
