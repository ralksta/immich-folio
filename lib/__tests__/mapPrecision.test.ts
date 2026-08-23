import { describe, it, expect } from 'vitest';
import {
  isLocationPrecision,
  strictestPrecision,
  quantiseCoordinate,
  applyPrecision,
  LOCATION_PRECISIONS,
  type LocationPrecision,
} from '@/lib/mapPrecision';

describe('isLocationPrecision', () => {
  it.each(LOCATION_PRECISIONS)('accepts %s', (level) => {
    expect(isLocationPrecision(level)).toBe(true);
  });

  it.each(['', 'EXACT', 'town', 'precise', 'none'])('rejects %s', (value) => {
    expect(isLocationPrecision(value)).toBe(false);
  });
});

describe('strictestPrecision', () => {
  it.each([
    [['exact', 'city'], 'city'],
    [['city', 'country'], 'country'],
    [['exact', 'hidden'], 'hidden'],
    [['country', 'city', 'exact'], 'country'],
    [['exact'], 'exact'],
    [['exact', 'exact'], 'exact'],
  ] as [LocationPrecision[], LocationPrecision][])('%s → %s', (levels, expected) => {
    expect(strictestPrecision(levels)).toBe(expected);
  });

  it('is order-independent', () => {
    expect(strictestPrecision(['country', 'exact'])).toBe(strictestPrecision(['exact', 'country']));
  });

  /** Nothing contributed, so there is nothing to place. */
  it('treats an empty list as hidden', () => {
    expect(strictestPrecision([])).toBe('hidden');
  });
});

describe('quantiseCoordinate', () => {
  it('leaves an exact coordinate untouched', () => {
    expect(quantiseCoordinate(52.516272, 'exact')).toBe(52.516272);
  });

  it('snaps to 0.05° for city', () => {
    expect(quantiseCoordinate(52.516272, 'city')).toBe(52.5);
    expect(quantiseCoordinate(13.377704, 'city')).toBe(13.4);
  });

  it('snaps to 1° for country', () => {
    expect(quantiseCoordinate(52.516272, 'country')).toBe(53);
    expect(quantiseCoordinate(13.377704, 'country')).toBe(13);
  });

  it('leaves no floating-point tail', () => {
    for (const value of [52.9123, 13.0001, -3.3333, 0.049]) {
      const quantised = quantiseCoordinate(value, 'city');
      expect(String(quantised)).toMatch(/^-?\d+(\.\d{1,2})?$/);
    }
  });

  it('works south and west of zero', () => {
    expect(quantiseCoordinate(-33.918861, 'city')).toBe(-33.9);
    expect(quantiseCoordinate(-118.24368, 'country')).toBe(-118);
  });

  /**
   * The property that matters: the output is a fixed grid, so asking twice
   * cannot average back to the true position.
   */
  it('is stable across repeated calls', () => {
    const value = 47.376887;
    const answers = new Set(Array.from({ length: 50 }, () => quantiseCoordinate(value, 'city')));
    expect(answers.size).toBe(1);
  });

  it('places nearby points on the same grid node, so one album does not stand out', () => {
    const garden = [52.5161, 52.5169, 52.5152].map((v) => quantiseCoordinate(v, 'city'));
    expect(new Set(garden).size).toBe(1);
  });

  it('moves a coordinate far enough to stop naming a property', () => {
    const exact = 52.516272;
    expect(Math.abs(quantiseCoordinate(exact, 'city') - exact)).toBeGreaterThan(0.01);
  });
});

describe('applyPrecision', () => {
  const berlin = { lat: 52.516272, lng: 13.377704 };

  it('quantises both axes', () => {
    expect(applyPrecision(berlin, 'city')).toEqual({ lat: 52.5, lng: 13.4 });
  });

  it('passes an exact position through', () => {
    expect(applyPrecision(berlin, 'exact')).toEqual(berlin);
  });

  /** Not {0,0} — the caller must drop the marker, not place it in the Atlantic. */
  it('returns null for hidden', () => {
    expect(applyPrecision(berlin, 'hidden')).toBeNull();
  });
});
