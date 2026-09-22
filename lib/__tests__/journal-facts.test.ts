import { describe, it, expect } from 'vitest';
import { parseJournalMarkdown, serializeJournalMarkdown, calculateReadingTime } from '../journal';
import type { JournalBlock } from '../journal';

const roundTrip = (blocks: JournalBlock[]) =>
  parseJournalMarkdown(
    serializeJournalMarkdown({ frontmatter: {}, blocks, referencedAssetIds: [] }),
  );

describe('facts block', () => {
  it('parses a ::facts chunk into label/value items', () => {
    const parsed = parseJournalMarkdown('::facts\nDistance: 21 km\nElevation: 1,240 m');
    expect(parsed.blocks).toEqual([
      {
        type: 'facts',
        items: [
          { label: 'Distance', value: '21 km' },
          { label: 'Elevation', value: '1,240 m' },
        ],
      },
    ]);
  });

  it('splits at the first colon so a time keeps its value', () => {
    const parsed = parseJournalMarkdown('::facts\nStart: 08:30');
    expect(parsed.blocks[0]).toMatchObject({
      type: 'facts',
      items: [{ label: 'Start', value: '08:30' }],
    });
  });

  it('ignores lines without a colon or with an empty side', () => {
    const parsed = parseJournalMarkdown('::facts\njust words\n: no label\nNo value:\nOk: yes');
    expect(parsed.blocks[0]).toEqual({ type: 'facts', items: [{ label: 'Ok', value: 'yes' }] });
  });

  it('renders inline markdown in values and escapes the rest', () => {
    const parsed = parseJournalMarkdown(
      '::facts\nGuide: [Anna](https://example.com)\nNote: <b>x</b>',
    );
    expect(parsed.blocks[0]).toMatchObject({
      items: [
        {
          label: 'Guide',
          value: '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Anna</a>',
        },
        { label: 'Note', value: '&lt;b&gt;x&lt;/b&gt;' },
      ],
    });
  });

  it('round-trips, dropping rows the editor left empty', () => {
    const block: JournalBlock = {
      type: 'facts',
      items: [
        { label: 'Distance', value: '21 km' },
        { label: '', value: '' },
        { label: 'Weather', value: 'clear, **cold**' },
      ],
    };
    const parsed = roundTrip([block]);
    expect(parsed.blocks).toEqual([
      {
        type: 'facts',
        items: [
          { label: 'Distance', value: '21 km' },
          { label: 'Weather', value: 'clear, <strong>cold</strong>' },
        ],
      },
    ]);
    // And the serialized form is stable from here on.
    const once = serializeJournalMarkdown(parsed);
    expect(serializeJournalMarkdown(parseJournalMarkdown(once))).toBe(once);
    expect(once).toBe('::facts\nDistance: 21 km\nWeather: clear, **cold**');
  });

  it('is its own block between paragraphs', () => {
    const parsed = parseJournalMarkdown('Intro.\n\n::facts\nA: 1\n\nOutro.');
    expect(parsed.blocks.map((b) => b.type)).toEqual(['paragraph', 'facts', 'paragraph']);
  });

  it('does not count the directive line as reading', () => {
    const { words } = calculateReadingTime('::facts\nDistance: 21 km');
    expect(words).toBe(3);
  });
});
