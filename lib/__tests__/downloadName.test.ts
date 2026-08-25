import { describe, it, expect } from 'vitest';
import { safeDownloadName, contentDisposition } from '@/lib/downloadName';

const LF = String.fromCharCode(10);
const CRLF = String.fromCharCode(13, 10);
const NUL = String.fromCharCode(0);
const QUOTE = String.fromCharCode(34);

/** True if the string holds any control character. */
const hasControlChar = (value: string) =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });

describe('safeDownloadName', () => {
  it('passes an ordinary camera filename through', () => {
    expect(safeDownloadName('DSCF1234.JPG')).toBe('DSCF1234.JPG');
  });

  it('keeps non-ASCII letters, which are a legitimate part of a name', () => {
    expect(safeDownloadName('Fr\u00fchling am Meer.jpg')).toBe('Fr\u00fchling am Meer.jpg');
  });

  /** The header injection this exists to prevent. */
  it.each([
    ['a newline', `a${LF}X-Evil: 1.jpg`],
    ['a CRLF', `a${CRLF}X-Evil: 1.jpg`],
    ['a null byte', `a${NUL}b.jpg`],
  ])('strips %s', (_label, raw) => {
    expect(hasControlChar(safeDownloadName(raw))).toBe(false);
  });

  it('neutralises path separators and traversal', () => {
    expect(safeDownloadName('../../etc/passwd')).not.toContain('/');
    expect(safeDownloadName('..\\..\\secret.jpg')).not.toContain('\\');
    expect(safeDownloadName('../evil.jpg').startsWith('.')).toBe(false);
  });

  it('removes the quotes and semicolons that delimit header parameters', () => {
    expect(safeDownloadName(`a${QUOTE};b.jpg`)).toBe('ab.jpg');
  });

  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace', '   '],
    ['only dots', '...'],
  ])('falls back to a generic name for %s', (_label, raw) => {
    expect(safeDownloadName(raw)).toBe('photo');
  });

  it('never returns an empty name', () => {
    for (const raw of ['///', QUOTE.repeat(3), '..', ' . ', NUL]) {
      expect(safeDownloadName(raw).length).toBeGreaterThan(0);
    }
  });

  it('bounds the length', () => {
    expect(safeDownloadName('x'.repeat(5000)).length).toBeLessThanOrEqual(200);
  });
});

describe('contentDisposition', () => {
  it('marks the response as an attachment', () => {
    expect(contentDisposition('DSCF1234.JPG')).toMatch(/^attachment; /);
  });

  it('carries both a plain and a percent-encoded filename', () => {
    const header = contentDisposition('Fr\u00fchling.jpg');
    expect(header).toContain('filename="Fr_hling.jpg"');
    expect(header).toContain("filename*=UTF-8''Fr%C3%BChling.jpg");
  });

  it('never emits a control character, whatever it is given', () => {
    expect(hasControlChar(contentDisposition(`a${CRLF}X-Evil: 1.jpg`))).toBe(false);
  });

  it('never emits an unbalanced quote', () => {
    const header = contentDisposition(`a${QUOTE}b.jpg`);
    expect((header.match(/"/g) ?? []).length % 2).toBe(0);
  });

  it('survives a missing name', () => {
    expect(contentDisposition(undefined)).toContain('filename="photo"');
  });
});
