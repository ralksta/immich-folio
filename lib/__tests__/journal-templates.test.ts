import { describe, it, expect } from 'vitest';
import { parseJournalMarkdown, serializeJournalMarkdown } from '../journal';
import { JOURNAL_TEMPLATES } from '../journalTemplates';

describe('journal templates', () => {
  it('has at least one template and unique ids', () => {
    expect(JOURNAL_TEMPLATES.length).toBeGreaterThan(0);
    const ids = JOURNAL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const template of JOURNAL_TEMPLATES) {
    it(`round-trips "${template.id}" without losing or reshaping blocks`, () => {
      const serialized = serializeJournalMarkdown({
        frontmatter: {},
        blocks: template.blocks,
        referencedAssetIds: [],
      });
      const parsed = parseJournalMarkdown(serialized);
      expect(parsed.blocks).toEqual(template.blocks);
      // Placeholders must not surface as assets to probe or render.
      expect(parsed.referencedAssetIds).toEqual([]);
    });

    it(`"${template.id}" never flags a placeholder as a legacy asset reference`, () => {
      for (const block of template.blocks) {
        if (block.type === 'photo') expect(block.assetId).toBe('');
        if (block.type === 'photo-pair') {
          expect(block.assetIds[0]).toBe('');
          expect(block.assetIds[1]).toBe('');
        }
      }
    });
  }
});
