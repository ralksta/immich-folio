import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'fs/promises';

/**
 * Pre-restore snapshots were exempt from pruning while still being listed, so
 * every restore added a row that was never removed. After a dozen restores the
 * backup modal showed nothing but pre-restore entries and the ordinary saves
 * had dropped off the end.
 *
 * They are still counted separately from saves — ten saves must not push out
 * the one snapshot that undoes a restore — but each kind is now capped.
 *
 * The service resolves content/ from process.cwd() at import time, so each test
 * points cwd at a fresh temp directory and re-imports it.
 */
let root: string;
let contentDir: string;
let backupDir: string;
let service: typeof import('../admin/yaml-service');

const stamp = (n: number) => `2026-05-${String(n).padStart(2, '0')}T12-00-00-000Z`;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'folio-prune-'));
  contentDir = path.join(root, 'content');
  backupDir = path.join(contentDir, '.backups');
  await mkdir(backupDir, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.resetModules();
  service = await import('../admin/yaml-service');
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

const backups = async (kind?: 'pre-restore') => {
  const files = (await readdir(backupDir)).filter((f) => f.startsWith('settings.yaml'));
  return kind
    ? files.filter((f) => f.includes(kind))
    : files.filter((f) => !f.includes('pre-restore'));
};

describe('backup pruning', () => {
  it('caps pre-restore snapshots instead of letting them accumulate', async () => {
    await writeFile(path.join(contentDir, 'settings.yaml'), 'title: Folio\n');
    for (let i = 1; i <= 14; i++) {
      await writeFile(path.join(backupDir, `settings.yaml.${stamp(i)}.pre-restore.bak`), 'old');
    }

    await service.writeSettingsYaml({ title: 'Folio' });

    expect(await backups('pre-restore')).toHaveLength(10);
  });

  it('keeps the newest pre-restore snapshots, not the oldest', async () => {
    await writeFile(path.join(contentDir, 'settings.yaml'), 'title: Folio\n');
    for (let i = 1; i <= 14; i++) {
      await writeFile(path.join(backupDir, `settings.yaml.${stamp(i)}.pre-restore.bak`), 'old');
    }

    await service.writeSettingsYaml({ title: 'Folio' });

    const kept = await backups('pre-restore');
    expect(kept).toContain(`settings.yaml.${stamp(14)}.pre-restore.bak`);
    expect(kept).not.toContain(`settings.yaml.${stamp(1)}.pre-restore.bak`);
  });

  it('does not let saves push out the snapshot that undoes a restore', async () => {
    await writeFile(path.join(contentDir, 'settings.yaml'), 'title: Folio\n');
    await writeFile(path.join(backupDir, `settings.yaml.${stamp(1)}.pre-restore.bak`), 'the undo');
    for (let i = 2; i <= 13; i++) {
      await writeFile(path.join(backupDir, `settings.yaml.${stamp(i)}.bak`), 'a save');
    }

    await service.writeSettingsYaml({ title: 'Folio' });

    // Saves are capped, but the lone pre-restore snapshot survives them.
    expect(await backups()).toHaveLength(10);
    expect(await backups('pre-restore')).toEqual([`settings.yaml.${stamp(1)}.pre-restore.bak`]);
  });

  it('prunes on restore, without waiting for the next save', async () => {
    await writeFile(path.join(contentDir, 'settings.yaml'), 'title: current\n');
    await writeFile(path.join(backupDir, `settings.yaml.${stamp(1)}.bak`), 'title: old\n');
    for (let i = 2; i <= 13; i++) {
      await writeFile(path.join(backupDir, `settings.yaml.${stamp(i)}.pre-restore.bak`), 'old');
    }

    await service.restoreBackup(`settings.yaml.${stamp(1)}.bak`);

    // The restore adds one of its own, and the cap holds all the same.
    expect(await backups('pre-restore')).toHaveLength(10);
  });

  it('leaves the other file backups alone', async () => {
    await writeFile(path.join(contentDir, 'settings.yaml'), 'title: Folio\n');
    for (let i = 1; i <= 14; i++) {
      await writeFile(path.join(backupDir, `gallery.yaml.${stamp(i)}.pre-restore.bak`), 'old');
    }

    await service.writeSettingsYaml({ title: 'Folio' });

    const gallery = (await readdir(backupDir)).filter((f) => f.startsWith('gallery.yaml'));
    expect(gallery).toHaveLength(14);
  });
});
