import { describe, it, expect } from 'vitest';
import { isValidSlug, sanitizeSlug, slugFieldValue } from '../journal';

/** What a controlled slug input shows after each keystroke of `text`. */
function typeInto(text: string): string {
  let value = '';
  for (const ch of text) value = slugFieldValue(value + ch);
  return value;
}

describe('slugFieldValue — a slug field while it is typed', () => {
  it('lets a hyphen be typed between two words', () => {
    // sanitizeSlug() on every keystroke dropped the trailing "-", so the next
    // letter was glued on: "about-us" came out as "aboutus".
    expect(typeInto('about-us')).toBe('about-us');
    expect(typeInto('about us')).toBe('about-us');
  });

  it('can be emptied instead of jumping to "untitled"', () => {
    expect(slugFieldValue('')).toBe('');
  });

  it('still refuses what a slug cannot hold', () => {
    expect(slugFieldValue('Preise & Pakete!')).toBe('preise-pakete-');
    expect(slugFieldValue('--a//b')).toBe('a-b');
  });

  it('becomes the stored slug through sanitizeSlug()', () => {
    for (const input of ['about-', 'About Us ', '  a--b  ', 'x_y']) {
      const finished = sanitizeSlug(slugFieldValue(input));
      expect(finished).toBe(sanitizeSlug(input));
      expect(isValidSlug(finished)).toBe(true);
    }
  });
});

describe('sanitizeSlug — accented letters', () => {
  it('keeps the base letter instead of splitting the word', () => {
    // "für" used to become "f-r": every non-ASCII letter turned into a hyphen.
    expect(sanitizeSlug('Preise für Hochzeiten')).toBe('preise-fur-hochzeiten');
    expect(sanitizeSlug('Über mich')).toBe('uber-mich');
    expect(sanitizeSlug('Café Olé')).toBe('cafe-ole');
    expect(sanitizeSlug('Straße')).toBe('strasse');
  });

  it('agrees with the slug field', () => {
    expect(typeInto('Über mich')).toBe('uber-mich');
  });

  it('still falls back for a title without any Latin letter', () => {
    expect(sanitizeSlug('家族')).toBe('untitled');
  });
});
