import { describe, it, expect } from 'vitest';
import path from 'path';
import { resolveJournalFilePath } from '../admin/journal-service';
import { parseJournalMarkdown, serializeJournalMarkdown } from '../journal';

describe('resolveJournalFilePath', () => {
  it.each(['../../etc/passwd', 'foo/../../bar', '..', 'a/b', 'foo.md', '', '.'])(
    'refuses %j',
    (slug) => {
      expect(resolveJournalFilePath(slug)).toBeNull();
    },
  );

  it('keeps a valid slug inside content/', () => {
    const resolved = resolveJournalFilePath('my-entry');
    expect(resolved).not.toBeNull();
    expect(resolved!.startsWith(path.join(process.cwd(), 'content') + path.sep)).toBe(true);
    expect(path.basename(resolved!)).toBe('my-entry.md');
  });
});

describe('frontmatter escaping', () => {
  const roundTrip = (title: string) => {
    const once = serializeJournalMarkdown({
      frontmatter: { title },
      blocks: [],
      referencedAssetIds: [],
    });
    const parsedOnce = parseJournalMarkdown(once);
    const twice = serializeJournalMarkdown(parsedOnce);
    return { first: parsedOnce.frontmatter.title, stable: once === twice };
  };

  it.each([
    ['plain', 'A normal title'],
    ['quotes', 'A "quoted" title'],
    ['backslash', String.raw`Path C:\Users`],
    ['both', String.raw`C:\Users "quoted"`],
    ['colon', 'Title: with a colon'],
    ['apostrophe', "Author's title"],
  ])('survives a title with %s', (_name, title) => {
    const { first, stable } = roundTrip(title);
    expect(first).toBe(title);
    expect(stable).toBe(true);
  });
});

describe('parser behaviour is unchanged by the regex rework', () => {
  const parse = (body: string) => parseJournalMarkdown(`---\ntitle: "T"\n---\n\n${body}\n`).blocks;

  it('parses headings at every level', () => {
    expect(parse('### Third level')[0]).toEqual({
      type: 'heading',
      level: 3,
      text: 'Third level',
    });
  });

  it('splits a quote from its author on the first separator', () => {
    expect(parse('> Something quotable -- Some Author')[0]).toEqual({
      type: 'quote',
      text: 'Something quotable',
      author: 'Some Author',
    });
  });

  it('leaves a quote without a separator whole', () => {
    expect(parse('> Just a quote')[0]).toEqual({
      type: 'quote',
      text: 'Just a quote',
      author: undefined,
    });
  });

  it('still nests italic inside bold', () => {
    expect(parse('Text with **bold *and italic* inside**.')[0]).toEqual({
      type: 'paragraph',
      html: 'Text with <strong>bold <em>and italic</em> inside</strong>.',
    });
  });
});
