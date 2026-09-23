import { describe, it, expect } from 'vitest';
import { baseName, formatExport } from '../proofExport';

const picks = [
  { position: 3, fileName: 'IMG_0412.JPG', takenAt: '2026-05-01T10:00:00' },
  { position: 7, fileName: 'IMG_0412.CR3' },
  { position: 9, fileName: 'wedding "first", look.jpg' },
];

describe('baseName', () => {
  it('drops only the last extension', () => {
    expect(baseName('IMG_0412.JPG')).toBe('IMG_0412');
    expect(baseName('a.b.tif')).toBe('a.b');
    expect(baseName('.hidden')).toBe('.hidden');
    expect(baseName('noext')).toBe('noext');
  });
});

describe('formatExport', () => {
  it('lists de-duplicated base names for a Lightroom filter', () => {
    expect(formatExport(picks, 'lightroom')).toBe('IMG_0412, wedding "first", look');
  });

  it('lists full names one per line', () => {
    expect(formatExport(picks, 'txt')).toBe(
      'IMG_0412.JPG\nIMG_0412.CR3\nwedding "first", look.jpg\n',
    );
    expect(formatExport([], 'txt')).toBe('');
  });

  it('writes RFC 4180 CSV', () => {
    expect(formatExport(picks, 'csv').split('\r\n')).toEqual([
      'position,file_name,taken_at',
      '3,IMG_0412.JPG,2026-05-01T10:00:00',
      '7,IMG_0412.CR3,',
      '9,"wedding ""first"", look.jpg",',
      '',
    ]);
  });

  it('never lets a file name become a spreadsheet formula', () => {
    const csv = formatExport([{ position: 1, fileName: '=HYPERLINK("x")' }], 'csv');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
