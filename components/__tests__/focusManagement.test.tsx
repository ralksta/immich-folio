// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { trapTabKey } from '@/lib/focusTrap';
import { MobileNav } from '../MobileNav';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

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
