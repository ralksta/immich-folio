// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PhotoGrid, type PhotoItem } from '../PhotoGrid';
import { readGlobalsCss } from '@/lib/__tests__/fixtures/globalsCss';

/**
 * The photo grid's children are the FadeIn wrappers, with the tile inside
 * each one. editorial-flow counted `:nth-child` on the tile, which is always
 * the first child of its wrapper, and showcase spanned columns on the tile,
 * which is not a grid cell — so neither layout ever showed its shape (#825).
 */

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}));
vi.mock('@/components/FadeIn', () => ({
  FadeIn: ({
    children,
    className,
    as: Wrapper = 'div',
  }: {
    children: React.ReactNode;
    className?: string;
    as?: 'div' | 'figure';
  }) => <Wrapper className={className}>{children}</Wrapper>,
}));

const photo = (id: string, aspectRatio: number): PhotoItem => ({
  id,
  type: 'image',
  thumbUrl: `/t/${id}`,
  previewUrl: `/p/${id}`,
  exifUrl: `/e/${id}`,
  aspectRatio,
});

// A portrait lead photo: spanning the full width at its own 2:3 would make it
// several screens tall, which is what the stylesheet's 16:9 is there to stop.
const ASSETS = [photo('a1', 2 / 3), photo('a2', 1.5), photo('a3', 1.5), photo('a4', 1.5)];

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('showcase lead photo', () => {
  it('marks the grid cell, not only the tile, as featured', () => {
    const { container } = render(<PhotoGrid assets={ASSETS} layout="showcase" />);
    const cells = [...container.querySelectorAll('.photo-grid--showcase > *')];

    expect(cells).toHaveLength(4);
    expect(cells[0].classList.contains('photo-grid__cell--featured')).toBe(true);
    expect(cells.slice(1).some((c) => c.classList.contains('photo-grid__cell--featured'))).toBe(
      false,
    );
    expect(cells[0].querySelector('.photo-grid__item.photo-grid__featured')).not.toBeNull();
  });

  it('leaves the lead tile’s shape to the stylesheet', () => {
    const { container } = render(<PhotoGrid assets={ASSETS} layout="showcase" />);
    const tiles = [...container.querySelectorAll<HTMLElement>('.photo-grid__item')];

    expect(tiles[0].style.aspectRatio).toBe('');
    expect(tiles[1].style.aspectRatio).not.toBe('');
  });
});

describe('grid layout rules in globals.css', () => {
  const css = readGlobalsCss();
  // Comments mention the old selectors to explain the fix.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('never count siblings on the tile', () => {
    expect(rules).not.toMatch(/\.photo-grid__item:nth-child/);
  });

  it('span columns on the grid cell', () => {
    expect(rules).toMatch(
      /\.photo-grid--editorial-flow > :nth-child\(3n \+ 1\)\s*\{[^}]*grid-column: 1 \/ -1/,
    );
    expect(rules).toMatch(
      /\.photo-grid--showcase > \.photo-grid__cell--featured\s*\{[^}]*grid-column: 1 \/ -1/,
    );
    expect(rules).not.toMatch(/\.photo-grid__featured\s*\{[^}]*grid-column/);
  });
});
