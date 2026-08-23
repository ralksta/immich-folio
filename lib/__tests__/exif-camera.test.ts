import { describe, it, expect } from 'vitest';
import { formatCamera } from '../exif';

/**
 * The lightbox printed make and model unconditionally, so a Leica read
 * "LEICA CAMERA AG LEICA Q3" — long enough to run into its own label (#514).
 */
describe('formatCamera', () => {
  it('drops a maker the model already names', () => {
    expect(formatCamera('LEICA CAMERA AG', 'LEICA Q3')).toBe('LEICA Q3');
    expect(formatCamera('NIKON CORPORATION', 'NIKON Z 6')).toBe('NIKON Z 6');
    expect(formatCamera('Canon', 'Canon EOS R6')).toBe('Canon EOS R6');
  });

  it('keeps a maker the model does not name', () => {
    expect(formatCamera('SONY', 'ILCE-7M4')).toBe('SONY ILCE-7M4');
    expect(formatCamera('FUJIFILM', 'X-T5')).toBe('FUJIFILM X-T5');
  });

  /** The model's own separators count as word breaks. */
  it('matches a brand across a hyphen', () => {
    expect(formatCamera('OM Digital Solutions', 'OM-1')).toBe('OM-1');
    expect(formatCamera('OM Digital Solutions', 'OM1')).toBe('OM1');
  });

  /** A short brand must not match inside an unrelated word. */
  it('does not treat a substring as the brand', () => {
    expect(formatCamera('OM Digital Solutions', 'COMPACT 3')).toBe(
      'OM Digital Solutions COMPACT 3',
    );
  });

  it('copes with either side missing', () => {
    expect(formatCamera('SONY', undefined)).toBe('SONY');
    expect(formatCamera(null, 'X-T5')).toBe('X-T5');
    expect(formatCamera('  ', '  ')).toBe('');
  });
});
