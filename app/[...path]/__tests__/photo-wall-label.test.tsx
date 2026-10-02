// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PhotoGrid, type PhotoItem } from '../PhotoGrid';

/**
 * Kunsthalle's wall label was the EXIF overlay with a CSS-counter number in
 * front of it, so a photo without camera or lens got no label and no number.
 * Each photo is now a <figure> with a figcaption that always carries its
 * number; globals.css hides it outside the presets that show it.
 */

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}));
vi.mock('@/components/FadeIn', () => ({
  FadeIn: ({
    children,
    as: Wrapper = 'div',
  }: {
    children: React.ReactNode;
    as?: 'div' | 'figure';
  }) => <Wrapper>{children}</Wrapper>,
}));

const photo = (id: string, extra: Partial<PhotoItem> = {}): PhotoItem => ({
  id,
  type: 'image',
  thumbUrl: `/t/${id}`,
  previewUrl: `/p/${id}`,
  exifUrl: `/e/${id}`,
  aspectRatio: 1.5,
  ...extra,
});

const ASSETS = [
  photo('a1', { camera: 'Leica M11', lens: 'Summicron 35', focalLength: '35mm' }),
  photo('a2'),
  photo('a3', { caption: 'Cloister at dusk' }),
  photo('a4', { focalLength: '50mm' }),
];

let store: Map<string, string>;

beforeEach(() => {
  store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  window.history.replaceState(null, '', '/kloster');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const labels = (container: HTMLElement) =>
  [...container.querySelectorAll('figure > figcaption.photo-grid__label')] as HTMLElement[];

describe('photo wall label', () => {
  it('numbers every photo, with or without EXIF', () => {
    const { container } = render(<PhotoGrid assets={ASSETS} />);
    const numbers = labels(container).map(
      (l) => l.querySelector('.photo-grid__label-no')?.textContent,
    );
    expect(numbers).toEqual(['01', '02', '03', '04']);
  });

  it('sits next to the tile, not inside its clipped box', () => {
    const { container } = render(<PhotoGrid assets={ASSETS} />);
    for (const label of labels(container)) {
      expect(label.closest('.photo-grid__item')).toBeNull();
      expect(label.previousElementSibling?.classList.contains('photo-grid__item')).toBe(true);
    }
  });

  it('carries the caption only where one is published, and names the figure with it', () => {
    const { container } = render(<PhotoGrid assets={ASSETS} />);
    const titles = labels(container).map(
      (l) => l.querySelector('.photo-grid__label-title')?.textContent ?? null,
    );
    expect(titles).toEqual([null, null, 'Cloister at dusk', null]);
    // The same text the photo already publishes as its alt text.
    expect(container.querySelector('img[alt="Cloister at dusk"]')).not.toBeNull();
    // What assistive tech reads off the label (the figure's name, by HTML-AAM)
    // is the caption alone.
    const spoken = (l: HTMLElement) =>
      [...l.children]
        .filter((c) => c.getAttribute('aria-hidden') !== 'true')
        .map((c) => c.textContent)
        .join('');
    expect(labels(container).map(spoken)).toEqual(['', '', 'Cloister at dusk', '']);
  });

  it('prints the EXIF line only for a camera or lens, as the tile does', () => {
    const { container } = render(<PhotoGrid assets={ASSETS} />);
    const exif = labels(container).map(
      (l) => l.querySelector('.photo-grid__label-exif')?.textContent ?? null,
    );
    expect(exif).toEqual(['Leica M11 · Summicron 35 · 35mm', null, null, null]);
  });

  it('keeps the number and EXIF, which repeat the tile and lightbox, out of the figure name', () => {
    const { container } = render(<PhotoGrid assets={ASSETS} />);
    const [first] = labels(container);
    expect(first.querySelector('.photo-grid__label-no')?.getAttribute('aria-hidden')).toBe('true');
    expect(first.querySelector('.photo-grid__label-exif')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('keeps a photo’s album number when the favourites filter hides the others', async () => {
    store.set('folio_fav_kloster', JSON.stringify(['a3']));
    const { container } = render(<PhotoGrid assets={ASSETS} proofing albumName="Kloster" />);
    fireEvent.click(await screen.findByText('❤️ 1 Selected'));
    const numbers = labels(container).map(
      (l) => l.querySelector('.photo-grid__label-no')?.textContent,
    );
    expect(numbers).toEqual(['03']);
  });
});
