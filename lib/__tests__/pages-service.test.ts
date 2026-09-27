import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';

/**
 * content/pages/ storage (#722): the journal's rules — valid slugs only, a
 * backup before every overwrite, ten saves kept, a `.deleted.bak` on delete.
 */
let root: string;
let pagesDir: string;
let backupDir: string;
let service: typeof import('../admin/pages-service');

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'folio-pages-'));
  pagesDir = path.join(root, 'content', 'pages');
  backupDir = path.join(pagesDir, '.backups');
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.resetModules();
  service = await import('../admin/pages-service');
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

const page = (title: string, extra = '') =>
  `---\ntitle: "${title}"\n${extra}---\n\nAbout ${title}\n`;

describe('pages-service', () => {
  it('writes, reads and lists a page', async () => {
    await service.writePage('pricing', page('Pricing', 'draft: true\n'));

    const read = await service.readPage('pricing');
    expect(read?.parsed.frontmatter).toMatchObject({ title: 'Pricing', draft: true });
    expect(service.readPageSync('pricing')?.rawMarkdown).toBe(read?.rawMarkdown);

    const list = await service.listPages();
    expect(list).toEqual([
      { slug: 'pricing', frontmatter: expect.objectContaining({ title: 'Pricing' }) },
    ]);
    expect(service.listPageSlugsSync()).toEqual(['pricing']);
  });

  it('keeps the SEO description in the frontmatter', async () => {
    await service.writePage('faq', page('FAQ', 'description: "Questions, answered"\n'));
    expect((await service.readPage('faq'))?.parsed.frontmatter.description).toBe(
      'Questions, answered',
    );
  });

  it('refuses a slug that is not one, and never touches a path outside', async () => {
    await expect(service.writePage('../escape', 'x')).rejects.toThrow(/Invalid page slug/);
    await expect(service.writePage('a/b', 'x')).rejects.toThrow(/Invalid page slug/);
    expect(await service.readPage('../gallery')).toBeNull();
    expect(service.resolvePageFilePath('..')).toBeNull();
  });

  it('answers null for a page that does not exist', async () => {
    expect(await service.readPage('nothing')).toBeNull();
    expect(await service.listPages()).toEqual([]);
  });

  it('backs up the previous version before an overwrite, keeping ten', async () => {
    await mkdir(pagesDir, { recursive: true });
    await writeFile(path.join(pagesDir, 'pricing.md'), page('v0'));
    for (let i = 1; i <= 12; i++) {
      await service.writePage('pricing', page(`v${i}`));
      // Distinct timestamps in the backup names.
      await new Promise((r) => setTimeout(r, 2));
    }
    const backups = await readdir(backupDir);
    expect(backups).toHaveLength(10);
    expect(await readFile(path.join(pagesDir, 'pricing.md'), 'utf8')).toBe(page('v12'));
  });

  it('keeps a .deleted.bak copy on delete, and restores from it', async () => {
    await service.writePage('workshops', page('Workshops'));
    await expect(service.deletePage('workshops')).resolves.toBe(true);
    await expect(service.deletePage('workshops')).resolves.toBe(false);
    expect(await service.readPage('workshops')).toBeNull();

    const [backup] = await service.listPageBackups();
    expect(backup).toMatchObject({ slug: 'workshops', kind: 'deleted' });

    await expect(service.restorePageBackup(backup.filename)).resolves.toBe('workshops');
    expect((await service.readPage('workshops'))?.parsed.frontmatter.title).toBe('Workshops');
  });

  it('refuses to restore from a name it did not write', async () => {
    await expect(service.restorePageBackup('../gallery.yaml')).rejects.toThrow(/unrecognised/);
    await expect(service.restorePageBackup('pricing.md')).rejects.toThrow(/unrecognised/);
  });
});
