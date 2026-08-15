import { describe, it, expect } from 'vitest';

// Imported from the schema module directly: it is client-safe (no `fs`), and
// going through '@/lib/config' would pull the filesystem loader into the test.
import {
  buildCoverGridVars,
  COVER_GRID_COLUMNS_MAX,
  COVER_GRID_GAP_MAX,
} from '@/lib/config/schema';

describe('buildCoverGridVars', () => {
  it('falls back to the site-wide column count', () => {
    expect(buildCoverGridVars(undefined, 3)).toEqual({
      '--subpage-columns': 3,
      '--subpage-columns-tablet': 2,
    });
  });

  it('lets a per-subpage column count win over the site-wide one', () => {
    expect(buildCoverGridVars({ columns: 4 }, 3)['--subpage-columns']).toBe(4);
  });

  it('clamps a hand-edited column count into range', () => {
    // `repeat(0, 1fr)` would collapse the grid, `repeat(99, 1fr)` shred it.
    expect(buildCoverGridVars({ columns: 0 }, 3)['--subpage-columns']).toBe(1);
    expect(buildCoverGridVars({ columns: 99 }, 3)['--subpage-columns']).toBe(
      COVER_GRID_COLUMNS_MAX,
    );
  });

  it('falls back to the minimum for a non-numeric column count', () => {
    // YAML happily yields NaN for `columns: none`, and repeat(NaN, 1fr) drops
    // the whole declaration.
    expect(buildCoverGridVars({ columns: Number.NaN }, 3)['--subpage-columns']).toBe(1);
  });

  it('never puts more than two covers per row on tablet widths', () => {
    expect(buildCoverGridVars({ columns: 1 }, 3)['--subpage-columns-tablet']).toBe(1);
    expect(buildCoverGridVars({ columns: 2 }, 3)['--subpage-columns-tablet']).toBe(2);
    expect(buildCoverGridVars({ columns: 6 }, 3)['--subpage-columns-tablet']).toBe(2);
  });

  it('omits the gap unless the subpage sets one', () => {
    // Without the variable the theme preset's own --subpage-gap stands, which
    // is the whole point of not letting the global grid.gap through.
    expect(buildCoverGridVars({ columns: 4 }, 3)).not.toHaveProperty('--subpage-gap');
    expect(buildCoverGridVars(undefined, 3)).not.toHaveProperty('--subpage-gap');
  });

  it('emits an explicit gap, including zero', () => {
    expect(buildCoverGridVars({ gap: 24 }, 3)['--subpage-gap']).toBe('24px');
    // 0 is a deliberate choice (flush covers), not an absent value.
    expect(buildCoverGridVars({ gap: 0 }, 3)['--subpage-gap']).toBe('0px');
  });

  it('clamps the gap on both ends', () => {
    expect(buildCoverGridVars({ gap: -10 }, 3)['--subpage-gap']).toBe('0px');
    expect(buildCoverGridVars({ gap: 5000 }, 3)['--subpage-gap']).toBe(`${COVER_GRID_GAP_MAX}px`);
  });
});
