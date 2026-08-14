/**
 * Essay module (re-exports from lib/journal for full backwards compatibility).
 */

export {
  type JournalFrontmatter as EssayFrontmatter,
  type JournalBlock as EssayBlock,
  type ParsedJournal as ParsedEssay,
  sanitizeHtml,
  renderInlineMarkdown,
  parseFrontmatter,
  parseJournalMarkdown as parseEssayMarkdown,
  serializeJournalMarkdown as serializeEssayMarkdown,
  resolveJournalFilePath,
} from './journal';

import {
  parseJournalMarkdown,
  resolveJournalFilePath,
  type ParsedJournal,
} from './journal';

import nodeFs from 'fs';

/** Load and parse an essay file from content/essays/ or content/journal/ */
export function loadEssayFromFile(filename: string): ParsedJournal | null {
  if (typeof window !== 'undefined') return null;
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
