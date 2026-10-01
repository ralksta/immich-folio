import { describe, it, expect } from 'vitest';
import { justifiedTileStyle, JUSTIFIED_FALLBACK_RATIO } from '../justifiedRow';

/**
 * Evaluates a flex-basis calc() the way the browser would, with the custom
 * properties a frame sets (or their fallbacks when it sets none).
 */
function basisPx(basis: string, vars: Record<string, number>): number {
  const expr = basis
    .replace(/var\(--([\w-]+),\s*([\d.]+)px\)/g, (_, name: string, fallback: string) =>
      String(vars[name] ?? Number(fallback)),
    )
    .replace(/^calc/, '');
  expect(expr).toMatch(/^[\d.\s()*+-]+$/);
  return Function(`return ${expr}`)() as number;
}

/**
 * Lays out one row the way `flex-wrap` does for a row that fits: every tile
 * starts at its basis and the leftover width is shared by flex-grow.
 */
function layoutRow(ratios: number[], rowWidth: number, vars: Record<string, number>) {
  const tiles = ratios.map((r) => justifiedTileStyle(r));
  const bases = tiles.map((t) => basisPx(t.flexBasis, vars));
  const free = rowWidth - bases.reduce((a, b) => a + b, 0);
  const grow = tiles.reduce((a, t) => a + t.flexGrow, 0);
  const rowHeight = vars['grid-row-height'] ?? 300;
  return tiles.map((t, i) => {
    const width = bases[i] + (free * t.flexGrow) / grow;
    // The photo inside the tile, once the mat around it is taken off.
    const photoW = width - (vars['photo-mat-x'] ?? 0);
    const photoH = rowHeight - (vars['photo-mat-y'] ?? 0);
    return { width, photoW, photoH };
  });
}

describe('justifiedTileStyle', () => {
  it('grows by the aspect ratio', () => {
    expect(justifiedTileStyle(0.75).flexGrow).toBe(0.75);
  });

  it('falls back to ~3:2 for assets without dimensions', () => {
    for (const ar of [undefined, 0, -1, NaN, Infinity]) {
      expect(justifiedTileStyle(ar).flexGrow).toBe(JUSTIFIED_FALLBACK_RATIO);
    }
  });

  it('is unchanged without a frame: row height times the ratio', () => {
    const basis = justifiedTileStyle(1.5).flexBasis;
    expect(basisPx(basis, {})).toBe(450);
    expect(basisPx(basis, { 'grid-row-height': 240 })).toBe(360);
  });

  it('sizes the photo inside a passepartout mat, not the whole tile', () => {
    // 8px mat, 32px caption band, 1px border: 18px across, 42px down.
    const vars = { 'grid-row-height': 300, 'photo-mat-x': 18, 'photo-mat-y': 42 };
    const basis = basisPx(justifiedTileStyle(1.5).flexBasis, vars);
    expect(basis).toBe((300 - 42) * 1.5 + 18);
  });

  it('keeps every photo in a filled row at its own aspect ratio, scaled alike', () => {
    const vars = { 'grid-row-height': 300, 'photo-mat-x': 18, 'photo-mat-y': 42 };
    const ratios = [1.5, 0.6667, 1.7778];
    // A row with no leftover width: every photo shows at exactly its ratio.
    const exact = ratios.reduce((a, r) => a + (300 - 42) * r + 18, 0);
    for (const tile of layoutRow(ratios, exact, vars).map(
      (t, i) => t.photoW / t.photoH / ratios[i],
    )) {
      expect(tile).toBeCloseTo(1, 10);
    }
    // A row with leftover width: every photo widens by the same factor, so a
    // portrait is not cropped harder than the landscapes beside it.
    const stretched = layoutRow(ratios, exact + 120, vars).map(
      (t, i) => t.photoW / t.photoH / ratios[i],
    );
    for (const s of stretched) expect(s).toBeCloseTo(stretched[0], 10);
  });

  it('would crop unevenly if the tile, mat included, were sized from the row height', () => {
    // Regression guard for the formula itself: the old basis (row height ×
    // ratio, no mat terms) gives photos in the same row different stretch.
    const vars = { 'grid-row-height': 300, 'photo-mat-x': 18, 'photo-mat-y': 42 };
    const ratios = [1.5, 0.6667];
    const oldBases = ratios.map((r) => 300 * r);
    const rowWidth = oldBases.reduce((a, b) => a + b, 0);
    const oldStretch = oldBases.map((w, i) => (w - 18) / (300 - 42) / ratios[i]);
    expect(Math.abs(oldStretch[0] - oldStretch[1])).toBeGreaterThan(0.05);
    const nowStretch = layoutRow(ratios, rowWidth, vars).map(
      (t, i) => t.photoW / t.photoH / ratios[i],
    );
    expect(nowStretch[0]).toBeCloseTo(nowStretch[1], 10);
  });
});
