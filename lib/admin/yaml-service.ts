/**
 * YAML read/write service for the admin panel.
 * Handles atomic writes with automatic backup creation.
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { atomicWrite } from '../atomicWrite';
import type { GalleryYaml, SettingsYaml } from '../config/schema';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const MAX_BACKUPS = 10; // Keep last 10 backups per file

/** Read gallery.yaml and return parsed content. */
export async function readGalleryYaml(): Promise<GalleryYaml | null> {
  try {
    const raw = await fs.readFile(path.join(CONTENT_DIR, 'gallery.yaml'), 'utf8');
    return yaml.load(raw) as GalleryYaml;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** Read settings.yaml and return parsed content. */
export async function readSettingsYaml(): Promise<SettingsYaml | null> {
  try {
    const raw = await fs.readFile(path.join(CONTENT_DIR, 'settings.yaml'), 'utf8');
    return yaml.load(raw) as SettingsYaml;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** Atomically write a YAML file with backup. */
async function writeYamlFile(filename: string, data: unknown): Promise<void> {
  const filePath = path.join(CONTENT_DIR, filename);

  // Ensure content directory exists
  await fs.mkdir(CONTENT_DIR, { recursive: true });

  // "No file yet" and "the backup could not be written" used to share one
  // catch, so a `.backups/` a save couldn't write to (owned by root after a
  // first start as root, say) looked exactly like a brand-new file: the save
  // went ahead with no snapshot taken (#630). Only ENOENT means there is
  // nothing to back up; anything else aborts the save before it overwrites
  // the live file.
  let fileExists = true;
  try {
    await fs.access(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    fileExists = false;
  }

  if (fileExists) {
    const backupDir = path.join(CONTENT_DIR, '.backups');
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${filename}.${timestamp}.bak`;
    await fs.copyFile(filePath, path.join(backupDir, backupName));

    // Prune old backups
    await pruneBackups(backupDir, filename);
  }

  // Generate YAML content with header comment
  const header =
    filename === 'gallery.yaml'
      ? '# ── Gallery Structure (managed by Immich Folio Admin) ──────────────\n'
      : '# ── Site Settings (managed by Immich Folio Admin) ─────────────────\n';

  const content =
    header +
    yaml.dump(data, {
      lineWidth: 120,
      quotingType: '"',
      noRefs: true,
      sortKeys: false,
    });

  await atomicWrite(filePath, content);

  console.log(`[Admin] ✅ Saved ${filename}`);
}

/** Write gallery.yaml. */
export async function writeGalleryYaml(data: GalleryYaml): Promise<void> {
  await writeYamlFile('gallery.yaml', data);
}

/** Write settings.yaml. */
export async function writeSettingsYaml(data: SettingsYaml): Promise<void> {
  await writeYamlFile('settings.yaml', data);
}

/** List available backups for a file. */
export async function listBackups(filename: string): Promise<string[]> {
  const backupDir = path.join(CONTENT_DIR, '.backups');
  try {
    const files = await fs.readdir(backupDir);
    return files
      .filter((f) => f.startsWith(filename))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Names this service actually produces, and the only ones it will restore from.
 *
 * `[\w-]` matches neither `/` nor `.`, and the anchors leave no room for a
 * prefix, so a `..` segment cannot match. Without this, `path.join` happily
 * resolves `../../../../etc/passwd` and the copy below writes an arbitrary
 * readable file over content/settings.yaml — which the admin GET endpoints then
 * hand straight back.
 */
const BACKUP_FILENAME = /^(gallery\.yaml|settings\.yaml|about\.md)\.[\w-]+\.(pre-restore\.)?bak$/;

/** Restore a specific backup. */
export async function restoreBackup(backupFilename: string): Promise<void> {
  const match = BACKUP_FILENAME.exec(backupFilename);
  // The basename check is redundant against the regex above, and kept
  // deliberately: it keeps the guarantee if that pattern is ever loosened.
  if (!match || path.basename(backupFilename) !== backupFilename) {
    throw new Error(`Refusing to restore from an unrecognised backup name: "${backupFilename}"`);
  }

  const backupDir = path.join(CONTENT_DIR, '.backups');
  const backupPath = path.join(backupDir, backupFilename);

  // Derived from the matched group, never from a substring search on the input:
  // `includes('gallery.yaml')` would let the caller pick the destination.
  // about.md shares this directory: the about route writes its backups here.
  const originalFilename = match[1];
  const targetPath = path.join(CONTENT_DIR, originalFilename);

  // Read before touching anything, so a missing or unreadable backup changes
  // nothing on disk.
  const content = await fs.readFile(backupPath);

  // Create a backup of current state first. A failed safety copy aborts the
  // restore rather than being swallowed: `fs.copyFile` below would otherwise
  // truncate `targetPath` before writing it, so on a full disk or a container
  // killed mid-copy the live file could be lost with no snapshot to fall back
  // on (#630). Only ENOENT — there is no current file to snapshot, which is
  // the normal case for a deleted entry — is not an abort.
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const preRestoreBackup = `${originalFilename}.${timestamp}.pre-restore.bak`;
  try {
    await fs.copyFile(targetPath, path.join(backupDir, preRestoreBackup));
    // Bound them here rather than waiting for the next save: restoring twice in
    // a row is exactly when these pile up, and a save may be a long way off.
    await pruneBackups(backupDir, originalFilename);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  // atomicWrite rather than fs.copyFile: a copy truncates the destination
  // before writing, so a failure partway through (full disk, killed
  // container) leaves targetPath empty. Temp-file-then-rename means the old
  // content stays in place until the new content is fully on disk.
  await atomicWrite(targetPath, content);
  console.log(`[Admin] 🔄 Restored ${originalFilename} from ${backupFilename}`);
}

/**
 * Remove old backups, keeping the newest MAX_BACKUPS of each kind.
 *
 * The two kinds are counted separately on purpose: ten ordinary saves must not
 * push out the snapshot taken just before a restore, which is the only way back
 * from one. That is why pre-restore files were exempt from pruning.
 *
 * Exempting them entirely was the bug, though. listBackups() returns them and
 * the modal lists them, so every restore added a row that was never removed
 * until the useful backups were off the end of the list. A cap of their own
 * keeps the undo without letting it crowd out everything else.
 */
async function pruneBackups(backupDir: string, filename: string): Promise<void> {
  try {
    const files = await fs.readdir(backupDir);

    const saves: string[] = [];
    const preRestores: string[] = [];
    for (const f of files.filter((f) => f.startsWith(filename))) {
      (f.includes('pre-restore') ? preRestores : saves).push(f);
    }

    // The timestamp is fixed-width and lexically ordered, so sorting by name
    // sorts by age.
    for (const group of [saves, preRestores]) {
      group.sort();
      for (const old of group.slice(0, Math.max(0, group.length - MAX_BACKUPS))) {
        await fs.unlink(path.join(backupDir, old));
      }
    }
  } catch {
    // Ignore errors during pruning
  }
}
