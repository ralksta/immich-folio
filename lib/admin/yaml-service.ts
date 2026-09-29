/**
 * YAML read/write service for the admin panel.
 * Handles atomic writes with automatic backup creation.
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { atomicWrite } from '../atomicWrite';
import type { GalleryYaml, SettingsYaml } from '../config/schema';
import {
  assertVersion,
  needsBackup,
  readVersioned,
  serializeContentWrite,
  versionOf,
} from './contentVersion';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const MAX_BACKUPS = 10; // Keep last 10 backups per file

/** A parsed YAML file and the version (#601) of the bytes it was parsed from. */
export interface VersionedYaml<T> {
  data: T | null;
  version: string;
}

async function readYamlVersioned<T>(filename: string): Promise<VersionedYaml<T>> {
  try {
    const { text, version } = await readVersioned(path.join(CONTENT_DIR, filename));
    return { data: yaml.load(text) as T, version };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { data: null, version: versionOf(null) };
    }
    throw err;
  }
}

/** Read gallery.yaml and return parsed content. */
export async function readGalleryYaml(): Promise<GalleryYaml | null> {
  return (await readGalleryYamlVersioned()).data;
}

/** gallery.yaml with its version, for the editor that will save it back. */
export function readGalleryYamlVersioned(): Promise<VersionedYaml<GalleryYaml>> {
  return readYamlVersioned<GalleryYaml>('gallery.yaml');
}

/** Read settings.yaml and return parsed content. */
export async function readSettingsYaml(): Promise<SettingsYaml | null> {
  return (await readSettingsYamlVersioned()).data;
}

/** settings.yaml with its version, for the editor that will save it back. */
export function readSettingsYamlVersioned(): Promise<VersionedYaml<SettingsYaml>> {
  return readYamlVersioned<SettingsYaml>('settings.yaml');
}

/**
 * Atomically write a YAML file with backup, returning the new version.
 *
 * With a `baseVersion`, the write is refused with a VersionConflictError when
 * the file on disk is no longer that version (#601) — checked inside the write
 * queue, so no other save can slip in between the check and the rename.
 */
function writeYamlFile(filename: string, data: unknown, baseVersion?: string): Promise<string> {
  return serializeContentWrite(() => writeYamlFileNow(filename, data, baseVersion));
}

async function writeYamlFileNow(
  filename: string,
  data: unknown,
  baseVersion: string | undefined,
): Promise<string> {
  const filePath = path.join(CONTENT_DIR, filename);
  await assertVersion(filePath, baseVersion);

  // Ensure content directory exists
  await fs.mkdir(CONTENT_DIR, { recursive: true });

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

  // "No file yet" and "the backup could not be written" used to share one
  // catch, so a `.backups/` a save couldn't write to (owned by root after a
  // first start as root, say) looked exactly like a brand-new file: the save
  // went ahead with no snapshot taken (#630). Only ENOENT means there is
  // nothing to back up; anything else aborts the save before it overwrites
  // the live file.
  // A save that changes nothing takes no backup either (needsBackup).
  if (await needsBackup(filePath, content)) {
    const backupDir = path.join(CONTENT_DIR, '.backups');
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${filename}.${timestamp}.bak`;
    await fs.copyFile(filePath, path.join(backupDir, backupName));

    // Prune old backups
    await pruneBackups(backupDir, filename);
  }

  await atomicWrite(filePath, content);

  console.log(`[Admin] ✅ Saved ${filename}`);
  return versionOf(content);
}

/** Write gallery.yaml; see writeYamlFile for `baseVersion`. Returns the new version. */
export function writeGalleryYaml(data: GalleryYaml, baseVersion?: string): Promise<string> {
  return writeYamlFile('gallery.yaml', data, baseVersion);
}

/** Write settings.yaml; see writeYamlFile for `baseVersion`. Returns the new version. */
export function writeSettingsYaml(data: SettingsYaml, baseVersion?: string): Promise<string> {
  return writeYamlFile('settings.yaml', data, baseVersion);
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
const BACKUP_FILENAME =
  /^(gallery\.yaml|settings\.yaml|about\.md|privacy\.md)\.[\w-]+\.(pre-restore\.)?bak$/;

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
