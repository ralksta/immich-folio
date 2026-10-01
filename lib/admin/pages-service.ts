/**
 * Server-side storage for content pages (#722): `content/pages/<slug>.md`.
 *
 * Mirrors journal-service.ts — the same slug rule, the same containment check
 * on every path, atomic writes, and rotating backups in
 * `content/pages/.backups/` (ten saves per page; delete and pre-restore
 * snapshots are never pruned).
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
import { isValidSlug, parseJournalMarkdown, type ParsedJournal } from '../journal';
import type { PageSummary } from '../pages';
import { ParsedFileCache } from './parsedFileCache';

const MAX_BACKUPS = 10;

/**
 * Join a filename onto a directory, or return null if the result would escape
 * it. isValidSlug() already rejects dots and separators; this is the second
 * lock, and the barrier the taint analysis in CI can see.
 */
function containedPath(dir: string, filename: string): string | null {
  const base = path.resolve(dir);
  const resolved = path.resolve(base, filename);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

/**
 * Resolved per call rather than at import: tests point the service at a
 * temporary directory by changing the working directory.
 */
function pagesDir(): string {
  return path.join(process.cwd(), 'content', 'pages');
}
function backupDir(): string {
  return path.join(pagesDir(), '.backups');
}

/** `<slug>.md.<timestamp>[.deleted|.pre-restore].bak` — see journal-service. */
const PAGE_BACKUP_NAME = /^([\w-]+)\.md\.[\w-]+\.(?:(deleted|pre-restore)\.)?bak$/;

export interface PageBackup {
  filename: string;
  slug: string;
  kind: 'save' | 'deleted' | 'pre-restore';
}

/** The file a slug lives in, or null for a slug that is not one. */
export function resolvePageFilePath(slug: string): string | null {
  if (!isValidSlug(slug)) return null;
  return containedPath(pagesDir(), `${slug}.md`);
}

async function snapshotPage(
  filePath: string,
  filename: string,
  kind?: 'deleted' | 'pre-restore',
): Promise<void> {
  await fs.mkdir(backupDir(), { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = kind ? `.${kind}` : '';
  const backupPath = containedPath(backupDir(), `${filename}.${timestamp}${suffix}.bak`);
  if (!backupPath) {
    throw new Error(`Refusing to write a backup outside ${backupDir()}: "${filename}"`);
  }
  await fs.copyFile(filePath, backupPath);
}

async function prunePageBackups(filename: string): Promise<void> {
  const backups = (await fs.readdir(backupDir()))
    .filter((f) => {
      const match = PAGE_BACKUP_NAME.exec(f);
      return match !== null && `${match[1]}.md` === filename && match[2] === undefined;
    })
    .sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS))) {
    await fs.unlink(path.join(backupDir(), old)).catch(() => {});
  }
}

/** Every page backup on disk, newest first. */
export async function listPageBackups(): Promise<PageBackup[]> {
  let files: string[];
  try {
    files = await fs.readdir(backupDir());
  } catch {
    return [];
  }
  return files
    .map((filename) => {
      const match = PAGE_BACKUP_NAME.exec(filename);
      if (!match) return null;
      return { filename, slug: match[1], kind: (match[2] ?? 'save') as PageBackup['kind'] };
    })
    .filter((b): b is PageBackup => b !== null)
    .sort((a, b) => b.filename.localeCompare(a.filename));
}

/**
 * The listed frontmatter per file, reused while the file is unchanged: every
 * public page render lists the pages for the header nav (see
 * parsedFileCache.ts).
 */
const frontmatterCache = new ParsedFileCache<PageSummary['frontmatter']>((raw) => {
  const { title, description, password, draft } = parseJournalMarkdown(raw).frontmatter;
  return { title, description, password, draft };
});

/** Every page, sorted by title. Unparseable files are skipped with a log line. */
export async function listPages(): Promise<PageSummary[]> {
  let files: string[];
  try {
    files = await fs.readdir(pagesDir());
  } catch {
    return [];
  }
  const pages: PageSummary[] = [];
  const listed = new Set<string>();
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const slug = file.slice(0, -3);
    const filePath = resolvePageFilePath(slug);
    if (!filePath) continue;
    listed.add(filePath);
    try {
      pages.push({ slug, frontmatter: await frontmatterCache.read(filePath) });
    } catch (err) {
      console.error(`[Pages] Failed to read ${file}:`, err);
    }
  }
  frontmatterCache.retain(listed);
  return pages.sort((a, b) =>
    (a.frontmatter.title || a.slug).localeCompare(b.frontmatter.title || b.slug),
  );
}

/** Slugs of every page file, without parsing them. */
export function listPageSlugsSync(): string[] {
  try {
    return nodeFs
      .readdirSync(pagesDir())
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.slice(0, -3))
      .filter(isValidSlug);
  } catch {
    return [];
  }
}

export interface PageRecord {
  slug: string;
  rawMarkdown: string;
  parsed: ParsedJournal;
  /** Version of the file's bytes (#601), for the editor's If-Match. */
  version: string;
}

/** One page, or null when there is no such file. */
export async function readPage(slug: string): Promise<PageRecord | null> {
  const filePath = resolvePageFilePath(slug);
  if (!filePath) return null;
  try {
    const { text: rawMarkdown, version } = await readVersioned(filePath);
    return { slug, rawMarkdown, parsed: parseJournalMarkdown(rawMarkdown), version };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** Synchronous read, for the password lookup in lib/auth.ts. */
export function readPageSync(slug: string): PageRecord | null {
  const filePath = resolvePageFilePath(slug);
  if (!filePath) return null;
  try {
    const bytes = nodeFs.readFileSync(filePath);
    const rawMarkdown = bytes.toString('utf8');
    return {
      slug,
      rawMarkdown,
      parsed: parseJournalMarkdown(rawMarkdown),
      version: versionOf(bytes),
    };
  } catch {
    return null;
  }
}

/** Write a page atomically, snapshotting the previous version first. */
export async function writePage(slug: string, rawMarkdown: string): Promise<void> {
  const filePath = resolvePageFilePath(slug);
  if (!filePath) throw new Error(`Invalid page slug: "${slug}"`);
  const filename = `${slug}.md`;
  await fs.mkdir(pagesDir(), { recursive: true });

  // Only ENOENT means "nothing to back up"; any other failure aborts the save
  // before it overwrites the live file (the journal's #630). A save that
  // changes nothing takes no backup either (needsBackup).
  if (await needsBackup(filePath, rawMarkdown)) {
    await snapshotPage(filePath, filename);
    await prunePageBackups(filename);
  }

  await atomicWrite(filePath, rawMarkdown);
  console.log(`[Pages] ✅ Saved ${filename}`);
}

/**
 * Delete a page, keeping a `.deleted.bak` copy. The snapshot is not optional:
 * when it cannot be written, the delete is refused.
 */
export async function deletePage(slug: string): Promise<boolean> {
  const filePath = resolvePageFilePath(slug);
  if (!filePath) throw new Error(`Invalid page slug: "${slug}"`);
  try {
    await fs.access(filePath);
  } catch {
    return false;
  }
  await snapshotPage(filePath, `${slug}.md`, 'deleted');
  await fs.unlink(filePath);
  console.log(`[Pages] 🗑️ Deleted ${slug}.md`);
  return true;
}

/**
 * Move a page to a new slug with new content. The old file is snapshotted
 * under the new name first, then the new file is written, then the old one
 * removed — a failure part way leaves the old page in place. The route has
 * already refused a rename onto an existing page.
 */
async function renamePage(fromSlug: string, slug: string, rawMarkdown: string): Promise<void> {
  const fromPath = resolvePageFilePath(fromSlug);
  if (!fromPath) throw new Error(`Invalid page slug: "${fromSlug}"`);
  let fromExists = true;
  try {
    await fs.access(fromPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    fromExists = false;
  }
  if (fromExists) {
    await snapshotPage(fromPath, `${slug}.md`);
    await prunePageBackups(`${slug}.md`);
  }
  await writePage(slug, rawMarkdown);
  if (fromExists) {
    await fs.unlink(fromPath);
    console.log(`[Pages] ✏️ Renamed ${fromSlug}.md to ${slug}.md`);
  }
}

/** Restore a page from one of its backups, returning the restored slug. */
export async function restorePageBackup(backupFilename: string): Promise<string> {
  const match = PAGE_BACKUP_NAME.exec(backupFilename);
  if (!match || path.basename(backupFilename) !== backupFilename || !isValidSlug(match[1])) {
    throw new Error(`Refusing to restore from an unrecognised backup name: "${backupFilename}"`);
  }
  const slug = match[1];
  const source = containedPath(backupDir(), backupFilename);
  const target = resolvePageFilePath(slug);
  if (!source || !target) {
    throw new Error(`Refusing to restore from an unrecognised backup name: "${backupFilename}"`);
  }
  const content = await fs.readFile(source, 'utf8');
  try {
    await fs.access(target);
    await snapshotPage(target, `${slug}.md`, 'pre-restore');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  await fs.mkdir(pagesDir(), { recursive: true });
  await atomicWrite(target, content);
  console.log(`[Pages] 🔄 Restored ${slug}.md from ${backupFilename}`);
  return slug;
}

/**
 * The editor's save (#601): write `slug`, refusing with a VersionConflictError
 * when the file the editor loaded — `fromSlug`'s, for a rename — is no longer
 * at `baseVersion`. A rename writes the new file and then deletes the old one.
 * Check, write and delete run in the content write queue, so another save
 * cannot land between them. Returns the version of what was written.
 *
 * A rename takes the page's history along: the version before it is kept as
 * a save backup of the new slug, not as a `.deleted` snapshot of the old one.
 * The Backup Manager used to list every rename as a deleted page, whose
 * restore brought the old slug back next to the renamed page (QA A-19).
 */
export function savePage(
  slug: string,
  rawMarkdown: string,
  options: { baseVersion?: string; fromSlug?: string } = {},
): Promise<string> {
  const fromSlug = options.fromSlug ?? slug;
  return serializeContentWrite(async () => {
    if (options.baseVersion !== undefined) {
      const loaded = resolvePageFilePath(fromSlug);
      if (!loaded) throw new Error(`Invalid page slug: "${fromSlug}"`);
      await assertVersion(loaded, options.baseVersion);
    }
    if (fromSlug === slug) {
      await writePage(slug, rawMarkdown);
    } else {
      await renamePage(fromSlug, slug, rawMarkdown);
    }
    return versionOf(rawMarkdown);
  });
}
