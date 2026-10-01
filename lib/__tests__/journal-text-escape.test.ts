import { describe, it, expect } from 'vitest';
import {
  parseJournalMarkdown,
  serializeJournalMarkdown,
  type JournalBlock,
  type ParsedJournal,
} from '../journal';

const journal = (blocks: JournalBlock[]): ParsedJournal => ({
  frontmatter: { title: 'T' },
  blocks,
  referencedAssetIds: [],
});

const roundTrip = (blocks: JournalBlock[]) =>
  parseJournalMarkdown(serializeJournalMarkdown(journal(blocks))).blocks;

/**
 * A text block whose markdown began with `![` was written verbatim and came
 * back from the next load as a photo block — its text gone, a broken photo in
 * its place. The serializer now escapes such a line and the parser takes the
 * escape off again.
 */
describe('text blocks that start like a photo', () => {
  it('stay text across a save and a reload', () => {
    const blocks = roundTrip([{ type: 'paragraph', html: '![draft] placeholder' }]);
    expect(blocks).toEqual([{ type: 'paragraph', html: '![draft] placeholder' }]);
  });

  it('survive a second round trip unchanged', () => {
    const once = roundTrip([{ type: 'paragraph', html: '![todo] <em>pick</em> a photo' }]);
    expect(once).toEqual([{ type: 'paragraph', html: '![todo] <em>pick</em> a photo' }]);
    expect(roundTrip(once)).toEqual(once);
  });

  it('keep a backslash that was really typed in front', () => {
    const blocks = roundTrip([{ type: 'paragraph', html: '\\![not escaped] by accident' }]);
    expect(blocks).toEqual([{ type: 'paragraph', html: '\\![not escaped] by accident' }]);
  });

  it('writes the escape into the file, and leaves real photos alone', () => {
    const md = serializeJournalMarkdown(
      journal([
        { type: 'paragraph', html: '![draft]' },
        { type: 'photo', assetId: 'abc', layout: 'wide' },
      ]),
    );
    expect(md).toContain('\\![draft]');
    expect(md).toContain('![abc:wide]()');
    expect(parseJournalMarkdown(md).blocks.map((b) => b.type)).toEqual(['paragraph', 'photo']);
  });

  it('does not touch `![` in the middle of a paragraph', () => {
    const md = serializeJournalMarkdown(journal([{ type: 'paragraph', html: 'see ![x]' }]));
    expect(md).toContain('see ![x]');
    expect(md).not.toContain('\\!');
  });
});
