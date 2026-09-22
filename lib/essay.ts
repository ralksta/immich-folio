/**
 * Essay module (re-exports from lib/journal for full backwards compatibility).
 * Client-safe pure module.
 */

export {
  type JournalFrontmatter as EssayFrontmatter,
  type JournalBlock as EssayBlock,
  type ParsedJournal as ParsedEssay,
  type MapItem,
  isValidCoordinate,
  sanitizeHtml,
  renderInlineMarkdown,
  parseFrontmatter,
  parseJournalMarkdown as parseEssayMarkdown,
  serializeJournalMarkdown as serializeEssayMarkdown,
  collectAssetIds,
  mapBlockAssetIds,
} from './journal';
