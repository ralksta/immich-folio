import { describe, it, expect } from 'vitest';
import {
  parseAboutMarkdown,
  serializeAboutMarkdown,
  type AboutContent,
} from '../admin/about-service';

describe('parseAboutMarkdown', () => {
  it('parses frontmatter and body', () => {
    const raw = [
      '---',
      'portrait: 0a084a84-a958-48fe-826b-9c9f1bb42fb1',
      'name: John Doe',
      'location: Anytown, USA',
      'gear:',
      '  - Leica Q3',
      '  - Summicron 50mm f/2',
      '---',
      '',
      'Photographer based in Anytown, USA.',
      'Obsessed with light.',
      '',
    ].join('\n');

    expect(parseAboutMarkdown(raw)).toEqual({
      portrait: '0a084a84-a958-48fe-826b-9c9f1bb42fb1',
      name: 'John Doe',
      location: 'Anytown, USA',
      gear: ['Leica Q3', 'Summicron 50mm f/2'],
      body: 'Photographer based in Anytown, USA.\nObsessed with light.',
      enabled: true,
    });
  });

  it('returns an empty default for a bare body', () => {
    expect(parseAboutMarkdown('Just some text.')).toEqual({
      portrait: undefined,
      name: undefined,
      location: undefined,
      gear: undefined,
      body: 'Just some text.',
      enabled: true,
    });
  });

  it('reads an explicit disabled flag', () => {
    const raw = '---\nenabled: false\n---\n\nHidden page.\n';
    expect(parseAboutMarkdown(raw).enabled).toBe(false);
  });

  it('accepts CRLF line endings', () => {
    const raw = '---\r\nname: Jane\r\n---\r\n\r\nHello.\r\n';
    expect(parseAboutMarkdown(raw).name).toBe('Jane');
    expect(parseAboutMarkdown(raw).body).toBe('Hello.');
  });
});

describe('serializeAboutMarkdown', () => {
  it('round-trips every field', () => {
    const about: AboutContent = {
      portrait: '0a084a84-a958-48fe-826b-9c9f1bb42fb1',
      name: 'John "JD" Doe',
      location: 'Anytown: USA',
      gear: ['Leica Q3', 'Summicron 50mm f/2'],
      body: 'First paragraph.\nSecond paragraph.',
      enabled: true,
    };

    expect(parseAboutMarkdown(serializeAboutMarkdown(about))).toEqual(about);
  });

  it('round-trips the disabled flag', () => {
    const about: AboutContent = { body: 'Hidden.', enabled: false };
    const markdown = serializeAboutMarkdown(about);
    expect(markdown).toContain('enabled: false');
    expect(parseAboutMarkdown(markdown).enabled).toBe(false);
  });

  it('omits empty frontmatter fields', () => {
    const markdown = serializeAboutMarkdown({ body: 'Only a bio.', enabled: true });
    expect(markdown).not.toContain('name:');
    expect(markdown).not.toContain('gear:');
    expect(markdown).not.toContain('enabled:');
    expect(parseAboutMarkdown(markdown).body).toBe('Only a bio.');
  });
});
