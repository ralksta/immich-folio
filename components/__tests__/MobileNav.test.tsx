// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MobileNav } from '../MobileNav';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

// jsdom lays nothing out, so the header's geometry is stubbed: `navWidth` is
// the space the header offers, `rowWidth` what the links need in one row.
let navWidth = 1440;
let rowWidth = 900;
let phone = false;
let resize: (() => void) | null = null;

beforeEach(() => {
  navWidth = 1440;
  rowWidth = 900;
  phone = false;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.tagName === 'NAV' ? navWidth : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.tagName === 'NAV' ? Math.max(rowWidth, navWidth) : 0;
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        resize = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return phone;
    },
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resize = null;
});

function header() {
  render(
    <nav>
      <MobileNav>
        <a href="#home">Home</a>
        <a href="#about">About</a>
      </MobileNav>
    </nav>,
  );
  return {
    button: screen.getByRole('button', { name: 'Open menu' }),
    panel: document.getElementById('header-nav-panel')!,
  };
}

describe('MobileNav collapse (QA P-5)', () => {
  it('keeps the links in the row while they fit', () => {
    const { button, panel } = header();
    expect(button.dataset.collapsed).toBe('false');
    expect(panel.dataset.collapsed).toBe('false');
  });

  it('collapses into the menu when the row is wider than the header', () => {
    navWidth = 820;
    rowWidth = 1080;
    const { button, panel } = header();
    expect(button.dataset.collapsed).toBe('true');
    expect(panel.dataset.collapsed).toBe('true');
  });

  it('follows the header width in both directions', () => {
    const { button } = header();
    expect(button.dataset.collapsed).toBe('false');

    navWidth = 820;
    rowWidth = 1080;
    act(() => resize?.());
    expect(button.dataset.collapsed).toBe('true');

    // Collapsed, the row is not laid out and cannot be measured; the width
    // read before collapsing decides when it fits again.
    navWidth = 1440;
    act(() => resize?.());
    expect(button.dataset.collapsed).toBe('false');
  });

  it('closes an open panel when the links return to the row', () => {
    navWidth = 820;
    rowWidth = 1080;
    const { button } = header();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');

    navWidth = 1440;
    act(() => resize?.());
    expect(button.dataset.collapsed).toBe('false');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.header__nav-backdrop')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('always collapses on a phone, whatever the row measures', () => {
    phone = true;
    rowWidth = 100;
    const { button } = header();
    expect(button.dataset.collapsed).toBe('true');
  });
});
