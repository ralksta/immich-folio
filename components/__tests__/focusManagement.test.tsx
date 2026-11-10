// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { trapTabKey } from '@/lib/focusTrap';
import { MobileNav } from '../MobileNav';
import { Lightbox } from '../Lightbox';
import type { PhotoItem } from '@/app/[...path]/PhotoGrid';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const photo = (id: string): PhotoItem => ({
  id,
  type: 'image',
  thumbUrl: `/t/${id}`,
  previewUrl: `/p/${id}`,
  exifUrl: `/e/${id}`,
  aspectRatio: 1.5,
});

function GalleryWithLightbox() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const assets = [photo('p1'), photo('p2')];

  return (
    <div>
      <div data-lightbox-group>
        <button
          id="tile-0"
          data-lightbox-index={0}
          onClick={() => {
            setIndex(0);
            setOpen(true);
          }}
        >
          Photo 0
        </button>
        <button
          id="tile-1"
          data-lightbox-index={1}
          onClick={() => {
            setIndex(1);
            setOpen(true);
          }}
        >
          Photo 1
        </button>
      </div>
      {open && (
        <Lightbox
          assets={assets}
          currentIndex={index}
          onClose={() => setOpen(false)}
          onNext={() => setIndex((i) => (i + 1) % assets.length)}
          onPrev={() => setIndex((i) => (i - 1 + assets.length) % assets.length)}
        />
      )}
    </div>
  );
}

beforeEach(() => {
  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function tab(container: HTMLElement, shiftKey = false) {
  const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });
  const moved = trapTabKey(container, e);
  return { moved, prevented: e.defaultPrevented };
}

describe('trapTabKey (#696)', () => {
  function dialog() {
    document.body.innerHTML = `
      <button id="outside">outside</button>
      <div id="dlg">
        <button id="a">a</button>
        <button id="hidden" aria-hidden="true">x</button>
        <a id="b" href="#">b</a>
      </div>`;
    return document.getElementById('dlg')!;
  }

  it('wraps Tab from the last element to the first', () => {
    const dlg = dialog();
    document.getElementById('b')!.focus();
    expect(tab(dlg)).toEqual({ moved: true, prevented: true });
    expect(document.activeElement?.id).toBe('a');
  });

  it('wraps Shift+Tab from the first element to the last', () => {
    const dlg = dialog();
    document.getElementById('a')!.focus();
    tab(dlg, true);
    expect(document.activeElement?.id).toBe('b');
  });

  it('leaves Tab between inner elements to the browser', () => {
    const dlg = dialog();
    document.getElementById('a')!.focus();
    expect(tab(dlg)).toEqual({ moved: false, prevented: false });
  });

  it('pulls escaped focus back in', () => {
    const dlg = dialog();
    document.getElementById('outside')!.focus();
    tab(dlg);
    expect(document.activeElement?.id).toBe('a');
  });
});

describe('MobileNav focus (#696)', () => {
  it('moves focus into the panel and back to the button on Esc', () => {
    render(
      <MobileNav>
        <a href="#home">Home</a>
        <a href="#about">About</a>
      </MobileNav>,
    );
    const button = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(button);
    expect(document.activeElement?.textContent).toBe('Home');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Lightbox focus return (#696, #900)', () => {
  it('returns focus to the photo tile that opened the lightbox on close', () => {
    render(<GalleryWithLightbox />);
    const tile0 = document.getElementById('tile-0')!;
    tile0.focus();
    expect(document.activeElement).toBe(tile0);

    fireEvent.click(tile0);
    expect(screen.getByRole('dialog')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(tile0);
  });

  it('returns focus to the tile of the photo shown last after navigating', () => {
    render(<GalleryWithLightbox />);
    const tile0 = document.getElementById('tile-0')!;
    tile0.focus();
    expect(document.activeElement).toBe(tile0);

    fireEvent.click(tile0);
    expect(screen.getByRole('dialog')).toBeDefined();

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.keyDown(document, { key: 'Escape' });

    const tile1 = document.getElementById('tile-1')!;
    expect(document.activeElement).toBe(tile1);
  });
});
