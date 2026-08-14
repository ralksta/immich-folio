/**
 * Server-side Journal File & Storage Service.
 * Handles reading, listing, atomic writing, backups, and deletion of journal markdown files.
 */

import fs from 'fs/promises';
import nodeFs from 'fs';
import path from 'path';
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
const MAX_BACKUPS = 10;
let tmpCounter = 0;

/** Resolve file path for a journal slug (checks content/journal/ then content/essays/) */
export function resolveJournalFilePath(slug: string): string | null {
  if (!isValidSlug(slug)) return null;
  const filename = slug.endsWith('.md') ? slug : `${slug}.md`;
  const primaryPath = path.join(JOURNAL_DIR, filename);
  if (nodeFs.existsSync(primaryPath)) return primaryPath;

  const legacyPath = path.join(LEGACY_ESSAYS_DIR, filename);
  if (nodeFs.existsSync(legacyPath)) return legacyPath;

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

/** List all journal entries */
export async function listJournalEntries(): Promise<JournalEntrySummary[]> {
  const entries: JournalEntrySummary[] = [];
  const seenSlugs = new Set<string>();

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
          const content = await fs.readFile(path.join(dir, file), 'utf8');
          const parsed = parseJournalMarkdown(content);
          const { words, minutes } = calculateReadingTime(content);
          const excerpt = extractExcerpt(parsed);

          entries.push({
            slug,
            filename: file,
            frontmatter: parsed.frontmatter,
            excerpt,
            wordCount: words,
            readingTimeMinutes: minutes,
          });
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

  // Sort: descending by date, fallback to title/slug
  return entries.sort((a, b) => {
    const dateA = a.frontmatter.date || '';
    const dateB = b.frontmatter.date || '';
    if (dateA && dateB) return dateB.localeCompare(dateA);
    if (dateA) return -1;
    if (dateB) return 1;
    return (a.frontmatter.title || a.slug).localeCompare(b.frontmatter.title || b.slug);
  });
}

/** Read a single journal entry by slug */
export async function readJournalEntry(slug: string): Promise<{
  slug: string;
  rawMarkdown: string;
  parsed: ParsedJournal;
} | null> {
  const filePath = resolveJournalFilePath(slug);
  if (!filePath) return null;

  try {
    const rawMarkdown = await fs.readFile(filePath, 'utf8');
    const parsed = parseJournalMarkdown(rawMarkdown);
    return { slug, rawMarkdown, parsed };
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
  const filename = slug.endsWith('.md') ? slug : `${slug}.md`;
  const filePath = path.join(JOURNAL_DIR, filename);

  // Create rolling backup if file already exists
  try {
    await fs.access(filePath);
    const backupDir = path.join(JOURNAL_DIR, '.backups');
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${filename}.${timestamp}.bak`;
    await fs.copyFile(filePath, path.join(backupDir, backupName));

    // Prune backups
    const backups = (await fs.readdir(backupDir))
      .filter((f) => f.startsWith(`${filename}.`) && f.endsWith('.bak'))
      .sort();
    if (backups.length > MAX_BACKUPS) {
      for (const old of backups.slice(0, backups.length - MAX_BACKUPS)) {
        await fs.unlink(path.join(backupDir, old)).catch(() => {});
      }
    }
  } catch {
    // New file, no backup needed
  }

  // Atomic write via unique temp file
  const tmpPath = `${filePath}.${process.pid}.${++tmpCounter}.tmp`;
  try {
    await fs.writeFile(tmpPath, rawMarkdown, 'utf8');
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }

  console.log(`[Journal] ✅ Saved ${filename}`);
}

/** Safely delete a journal entry */
export async function deleteJournalEntry(slug: string): Promise<boolean> {
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid journal slug: "${slug}"`);
  }

  const filePath = resolveJournalFilePath(slug);
  if (!filePath) return false;

  try {
    await fs.unlink(filePath);
    console.log(`[Journal] 🗑️ Deleted ${slug}.md`);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}
