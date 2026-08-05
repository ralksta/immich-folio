/**
 * YAML read/write service for the admin panel.
 * Handles atomic writes with automatic backup creation.
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import type { GalleryYaml, SettingsYaml } from '../config/schema';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const MAX_BACKUPS = 10; // Keep last 10 backups per file

/** Disambiguates temp files within one process; the pid covers across them. */
let tmpCounter = 0;

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

  // Create backup if file exists
  try {
    await fs.access(filePath);
    const backupDir = path.join(CONTENT_DIR, '.backups');
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${filename}.${timestamp}.bak`;
    await fs.copyFile(filePath, path.join(backupDir, backupName));

    // Prune old backups
    await pruneBackups(backupDir, filename);
  } catch {
    // File doesn't exist yet, no backup needed
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

  // Atomic write: write to a *unique* temp file, then rename.
  //
  // The rename is what makes this atomic; the temp filename is what did not.
  // With a constant `${filePath}.tmp`, two saves of the same file in flight at
  // once shared it — the second writeFile could interleave with the first's
  // rename, leaving one save's bytes published under the other's, or a
  // truncated mix. A double-clicked Save in the page builder is enough.
  const tmpPath = `${filePath}.${process.pid}.${++tmpCounter}.tmp`;
  try {
    await fs.writeFile(tmpPath, content, 'utf8');
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Do not leave litter in content/ behind a failed save. Cleanup failure is
    // not worth masking the real error with.
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }

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
const BACKUP_FILENAME = /^(gallery|settings)\.yaml\.[\w-]+\.(pre-restore\.)?bak$/;

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
  const originalFilename = `${match[1]}.yaml`;
  const targetPath = path.join(CONTENT_DIR, originalFilename);

  // Create a backup of current state first
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const preRestoreBackup = `${originalFilename}.${timestamp}.pre-restore.bak`;
  try {
    await fs.copyFile(targetPath, path.join(backupDir, preRestoreBackup));
  } catch {
    // Original might not exist
  }

  await fs.copyFile(backupPath, targetPath);
  console.log(`[Admin] 🔄 Restored ${originalFilename} from ${backupFilename}`);
}

/** Remove old backups, keeping only MAX_BACKUPS most recent. */
async function pruneBackups(backupDir: string, filename: string): Promise<void> {
  try {
    const files = await fs.readdir(backupDir);
    const relevant = files
      .filter((f) => f.startsWith(filename) && !f.includes('pre-restore'))
      .sort();

    if (relevant.length > MAX_BACKUPS) {
      const toDelete = relevant.slice(0, relevant.length - MAX_BACKUPS);
      for (const f of toDelete) {
        await fs.unlink(path.join(backupDir, f));
      }
    }
  } catch {
    // Ignore errors during pruning
  }
}
