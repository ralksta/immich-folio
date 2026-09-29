/**
 * Server-side Journal File & Storage Service.
 * Handles reading, listing, atomic writing, backups, and deletion of journal markdown files.
 */

import fs from 'fs/promises';
import nodeFs from 'fs';
import path from 'path';
import { atomicWrite } from '../atomicWrite';
import {
  assertVersion,
  needsBackup,
  readVersioned,
  serializeContentWrite,
  versionOf,
} from './contentVersion';
import { ParsedFileCache } from './parsedFileCache';
import {
  parseJournalMarkdown,
  calculateReadingTime,
  extractExcerpt,
  isValidSlug,
  type JournalEntrySummary,
  type ParsedJournal,
} from '../journal';

const JOURNAL_DIR = path.join(process.cwd(), 'content', 'journal');
const LEGACY_ESSAYS_DIR = path.join(process.cwd(), 'content', 'essays');
const BACKUP_DIR = path.join(JOURNAL_DIR, '.backups');
const MAX_BACKUPS = 10;

/**
 * Names this service writes into .backups/, and the only ones it restores from.
 *
 * `<slug>.md.<timestamp>[.deleted|.pre-restore].bak`. `[\w-]` is exactly the
 * isValidSlug alphabet and matches neither `/` nor `.`, so a traversal cannot
 * match. Group 1 is the slug, group 2 the snapshot kind.
 */
const JOURNAL_BACKUP_NAME = /^([\w-]+)\.md\.[\w-]+\.(?:(deleted|pre-restore)\.)?bak$/;

export interface JournalBackup {
  filename: string;
  slug: string;
  /** `save` rotates; `deleted` and `pre-restore` snapshots are never pruned. */
  kind: 'save' | 'deleted' | 'pre-restore';
}

/** Copy an entry into .backups/. Throws when the copy fails. */
async function snapshotEntry(
  filePath: string,
  filename: string,
  kind?: 'deleted' | 'pre-restore',
): Promise<void> {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = kind ? `.${kind}` : '';
  // `filename` is always `<slug>.md` with a validated slug, but the validation
  // lives in callers and another module; containedPath is the barrier the
  // taint analysis can see, as for every other path in this file.
  const backupPath = containedPath(BACKUP_DIR, `${filename}.${timestamp}${suffix}.bak`);
  if (!backupPath) {
    throw new Error(`Refusing to write a backup outside ${BACKUP_DIR}: "${filename}"`);
  }
  await fs.copyFile(filePath, backupPath);
}

/**
 * Keep the newest MAX_BACKUPS save backups of one entry.
 *
 * Deleted and pre-restore snapshots are left alone, as yaml-service does with
 * its pre-restore files: ten saves of a re-created entry must not push out the
 * only copy of the one that was deleted.
 */
async function pruneEntryBackups(filename: string): Promise<void> {
  const backups = (await fs.readdir(BACKUP_DIR))
    .filter((f) => {
      const match = JOURNAL_BACKUP_NAME.exec(f);
      return match !== null && `${match[1]}.md` === filename && match[2] === undefined;
    })
    .sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS))) {
    await fs.unlink(path.join(BACKUP_DIR, old)).catch(() => {});
  }
}

/** Every journal backup on disk, newest filename first per entry. */
export async function listJournalBackups(): Promise<JournalBackup[]> {
  let files: string[];
  try {
    files = await fs.readdir(BACKUP_DIR);
  } catch {
    return [];
  }
  return files
    .map((filename) => {
      const match = JOURNAL_BACKUP_NAME.exec(filename);
      if (!match) return null;
      const kind = (match[2] ?? 'save') as JournalBackup['kind'];
      return { filename, slug: match[1], kind };
    })
    .filter((b): b is JournalBackup => b !== null)
    .sort((a, b) => b.filename.localeCompare(a.filename));
}

/**
 * Restore an entry from one of its backups, returning the restored slug.
 *
 * The entry's current state, if it has one, is snapshotted first. The restore
 * always lands in content/journal/, which resolveJournalFilePath checks before
 * the legacy essays/ directory.
 */
export async function restoreJournalBackup(backupFilename: string): Promise<string> {
  const match = JOURNAL_BACKUP_NAME.exec(backupFilename);
  if (!match || path.basename(backupFilename) !== backupFilename || !isValidSlug(match[1])) {
    throw new Error(`Refusing to restore from an unrecognised backup name: "${backupFilename}"`);
  }
  const slug = match[1];
  const filename = `${slug}.md`;
  const source = containedPath(BACKUP_DIR, backupFilename);
  const target = containedPath(JOURNAL_DIR, filename);
  if (!source || !target) {
    throw new Error(`Refusing to restore from an unrecognised backup name: "${backupFilename}"`);
  }

  // Read before touching anything, so a missing backup changes nothing.
  const content = await fs.readFile(source, 'utf8');

  try {
    await fs.access(target);
    await snapshotEntry(target, filename, 'pre-restore');
  } catch (err) {
    // No current file is fine — that is the deleted-entry case. A failed
    // snapshot of an existing file is not.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  await fs.mkdir(JOURNAL_DIR, { recursive: true });
  await atomicWrite(target, content);

  console.log(`[Journal] 🔄 Restored ${filename} from ${backupFilename}`);
  return slug;
}

/**
 * Join a filename onto a content directory, or return null if the result would
 * escape it.
 *
 * isValidSlug() already rejects dots and separators, so nothing should ever get
 * this far — this is the second lock on the door. It also gives the taint
 * analysis in CI a barrier it can see: the slug check lives in another module,
 * which CodeQL does not follow, so every path built from a slug was reported as
 * path injection.
 */
function containedPath(dir: string, filename: string): string | null {
  const base = path.resolve(dir);
  const resolved = path.resolve(base, filename);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

/** Resolve file path for a journal slug (checks content/journal/ then content/essays/) */
export function resolveJournalFilePath(slug: string): string | null {
  if (!isValidSlug(slug)) return null;
  // Not `slug.endsWith('.md') ? slug : ...`: isValidSlug rejects dots, so that
  // branch could never be taken.
  const filename = `${slug}.md`;

  const primaryPath = containedPath(JOURNAL_DIR, filename);
  if (!primaryPath) return null;
  if (nodeFs.existsSync(primaryPath)) return primaryPath;

  const legacyPath = containedPath(LEGACY_ESSAYS_DIR, filename);
  if (legacyPath && nodeFs.existsSync(legacyPath)) return legacyPath;

  return primaryPath; // Target path for new writes
}

/** Load and parse an essay file from content/essays/ or content/journal/ */
export function loadEssayFromFile(filename: string): ParsedJournal | null {
  try {
    const filePath = resolveJournalFilePath(filename);
    if (!filePath || !nodeFs.existsSync(filePath)) {
      console.warn(`[Essay] File not found: ${filename}`);
      return null;
    }

    const content = nodeFs.readFileSync(filePath, 'utf-8');
    return parseJournalMarkdown(content);
  } catch (error) {
    console.error(`[Essay] Failed to load essay file "${filename}":`, error);
    return null;
  }
}

/** What a listing needs from one file — everything but the name-derived fields. */
type EntryFacts = Omit<JournalEntrySummary, 'slug' | 'filename'>;

/**
 * Parsed listing facts per file, reused while the file is unchanged: every
 * public page render lists the journal for the header nav (see
 * parsedFileCache.ts).
 */
const summaryCache = new ParsedFileCache<EntryFacts>((content) => {
  const parsed = parseJournalMarkdown(content);
  const { words, minutes } = calculateReadingTime(content);
  return {
    frontmatter: parsed.frontmatter,
    excerpt: extractExcerpt(parsed),
    wordCount: words,
    readingTimeMinutes: minutes,
  };
});

/** List all journal entries */
export async function listJournalEntries(): Promise<JournalEntrySummary[]> {
  const entries: JournalEntrySummary[] = [];
  const seenSlugs = new Set<string>();
  const listed = new Set<string>();

  const scanDir = async (dir: string) => {
    try {
      await fs.access(dir);
    } catch {
      return;
    }

    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const slug = file.replace(/\.md$/, '');
        if (seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);

        try {
          const filePath = path.join(dir, file);
          listed.add(filePath);
          const summary = await summaryCache.read(filePath);
          entries.push({ slug, filename: file, ...summary });
        } catch (err) {
          console.error(`[Journal] Failed to parse ${file}:`, err);
        }
      }
    } catch (err) {
      console.error(`[Journal] Failed to read directory ${dir}:`, err);
    }
  };

  await scanDir(JOURNAL_DIR);
  await scanDir(LEGACY_ESSAYS_DIR);
  summaryCache.retain(listed);

  // Sort: descending by date, fallback to title/slug
  return entries.sort((a, b) => {
    const dateA = a.frontmatter.date || '';
    const dateB = b.frontmatter.date || '';
    if (dateA && dateB) return dateB.localeCompare(dateA) || a.slug.localeCompare(b.slug);
    if (dateA) return -1;
    if (dateB) return 1;
    return (
      (a.frontmatter.title || a.slug).localeCompare(b.frontmatter.title || b.slug) ||
      a.slug.localeCompare(b.slug)
    );
  });
}

/** Read a single journal entry by slug */
export async function readJournalEntry(slug: string): Promise<{
  slug: string;
  rawMarkdown: string;
  parsed: ParsedJournal;
  /** Version of the file's bytes (#601), for the editor's If-Match. */
  version: string;
} | null> {
  const filePath = resolveJournalFilePath(slug);
  if (!filePath) return null;

  try {
    const { text: rawMarkdown, version } = await readVersioned(filePath);
    const parsed = parseJournalMarkdown(rawMarkdown);
    return { slug, rawMarkdown, parsed, version };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** Atomically write/save a journal entry with backup rotation */
export async function writeJournalEntry(slug: string, rawMarkdown: string): Promise<void> {
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid journal slug: "${slug}"`);
  }

  await fs.mkdir(JOURNAL_DIR, { recursive: true });
  const filename = `${slug}.md`;
  const filePath = containedPath(JOURNAL_DIR, filename);
  if (!filePath) {
    throw new Error(`Invalid journal slug: "${slug}"`);
  }

  // "No file yet" and "the backup could not be written" used to share one
  // catch, so a `.backups/` a save couldn't write to looked exactly like a
  // brand-new entry: the save went ahead with no snapshot taken (#630). Only
  // ENOENT means there is nothing to back up; anything else aborts the save
  // before it overwrites the live file. A save that changes nothing takes no
  // backup either (needsBackup).
  if (await needsBackup(filePath, rawMarkdown)) {
    await snapshotEntry(filePath, filename);
    await pruneEntryBackups(filename);
  }

  await atomicWrite(filePath, rawMarkdown);

  // An entry that started in content/essays/ now has a copy in both
  // directories; resolveJournalFilePath would keep favouring this new one,
  // but deleteJournalEntry used to only ever see one path at a time and could
  // leave the legacy copy behind to resurface on the next listing (#631).
  // Retiring it here, once the new content is safely on disk, means delete
  // never has to reconcile two files for one slug.
  const legacyPath = containedPath(LEGACY_ESSAYS_DIR, filename);
  if (legacyPath) {
    try {
      await fs.access(legacyPath);
      await snapshotEntry(legacyPath, filename);
      await fs.unlink(legacyPath);
      console.log(`[Journal] 🧹 Retired legacy copy of ${filename} in content/essays/`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  console.log(`[Journal] ✅ Saved ${filename}`);
}

/**
 * Delete a journal entry, keeping a `.deleted.bak` copy the Backup Manager can
 * restore.
 *
 * Saving always rotated a backup; deleting did not, so the one irreversible
 * action in the journal was the one without a way back. The snapshot is taken
 * first and is not optional: if it cannot be written, the delete is refused
 * rather than carried out unprotected.
 */
export async function deleteJournalEntry(slug: string): Promise<boolean> {
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid journal slug: "${slug}"`);
  }

  const filename = `${slug}.md`;
  const primaryPath = containedPath(JOURNAL_DIR, filename);
  const legacyPath = containedPath(LEGACY_ESSAYS_DIR, filename);
  if (!primaryPath || !legacyPath) return false;

  // Check both directories, not just whichever resolveJournalFilePath would
  // pick: an entry that was saved once while still in content/essays/ used to
  // leave a copy there, which listJournalEntries would bring back as soon as
  // the content/journal/ copy was deleted (#631). writeJournalEntry now
  // retires the legacy copy on every save, but a legacy entry that was never
  // edited still lives there alone, so both paths must be checked here too.
  let deletedAny = false;
  for (const filePath of [primaryPath, legacyPath]) {
    try {
      await fs.access(filePath);
    } catch {
      continue;
    }
    await snapshotEntry(filePath, filename, 'deleted');
    try {
      await fs.unlink(filePath);
      deletedAny = true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  if (deletedAny) console.log(`[Journal] 🗑️ Deleted ${filename}`);
  return deletedAny;
}

/**
 * Move an entry to a new slug with new content: snapshot the old file under
 * the new name, write the new file, then remove the old one from both
 * content/journal/ and the legacy content/essays/. The route has already
 * refused a rename onto an existing entry.
 */
async function renameJournalEntry(
  fromSlug: string,
  slug: string,
  rawMarkdown: string,
): Promise<void> {
  if (!isValidSlug(fromSlug)) throw new Error(`Invalid journal slug: "${fromSlug}"`);
  const fromFilename = `${fromSlug}.md`;
  const fromPaths = [
    containedPath(JOURNAL_DIR, fromFilename),
    containedPath(LEGACY_ESSAYS_DIR, fromFilename),
  ].filter((p): p is string => p !== null);
  const existing: string[] = [];
  for (const p of fromPaths) {
    try {
      await fs.access(p);
      existing.push(p);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
  // The copy resolveJournalFilePath reads — content/journal/ over essays/.
  if (existing.length > 0) {
    await snapshotEntry(existing[0], `${slug}.md`);
    await pruneEntryBackups(`${slug}.md`);
  }
  await writeJournalEntry(slug, rawMarkdown);
  for (const p of existing) {
    await fs.unlink(p).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }
  if (existing.length > 0) console.log(`[Journal] ✏️ Renamed ${fromFilename} to ${slug}.md`);
}

/**
 * The editor's save (#601): write `slug`, refusing with a VersionConflictError
 * when the file the editor loaded — `fromSlug`'s, for a rename — is no longer
 * at `baseVersion`. A rename writes the new file and then deletes the old one.
 * Check, write and delete run in the content write queue, so another save
 * cannot land between them. Returns the version of what was written.
 *
 * A rename takes the entry's history along: the version before it is kept as
 * a save backup of the new slug, not as a `.deleted` snapshot of the old one,
 * which the Backup Manager listed as a deleted entry (QA A-19).
 */
export function saveJournalEntry(
  slug: string,
  rawMarkdown: string,
  options: { baseVersion?: string; fromSlug?: string } = {},
): Promise<string> {
  const fromSlug = options.fromSlug ?? slug;
  return serializeContentWrite(async () => {
    if (options.baseVersion !== undefined) {
      const loaded = resolveJournalFilePath(fromSlug);
      if (!loaded) throw new Error(`Invalid journal entry slug: "${fromSlug}"`);
      await assertVersion(loaded, options.baseVersion);
    }
    if (fromSlug === slug) {
      await writeJournalEntry(slug, rawMarkdown);
    } else {
      await renameJournalEntry(fromSlug, slug, rawMarkdown);
    }
    return versionOf(rawMarkdown);
  });
}
