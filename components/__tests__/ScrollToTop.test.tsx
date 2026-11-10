// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { ScrollToTop } from '../ScrollToTop';

vi.mock('../I18nProvider', () => ({
  useDictionary: () => ({
    theme: {
      scrollToTop: 'Back to top',
    },
  }),
}));

beforeEach(() => {
  window.scrollY = 0;
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => {
    fn();
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
  }));
});

afterEach(() => {
  cleanup();
  document.body.className = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ScrollToTop (#899)', () => {
  it('marks body with has-scroll-to-top while mounted so the footer reserves clearance', () => {
    expect(document.body.classList.contains('has-scroll-to-top')).toBe(false);
    const { unmount } = render(<ScrollToTop />);
    expect(document.body.classList.contains('has-scroll-to-top')).toBe(true);

    unmount();
    expect(document.body.classList.contains('has-scroll-to-top')).toBe(false);
  });

  it('becomes visible after scrolling down', () => {
    render(<ScrollToTop />);
    const button = screen.getByRole('button', { hidden: true });
    expect(button.className).not.toContain('scroll-to-top--visible');

    window.scrollY = 500;
    act(() => {
      fireEvent.scroll(window);
    });

    expect(button.className).toContain('scroll-to-top--visible');
  });

  it('scrolls back to top on click', () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;
    render(<ScrollToTop />);
    const button = screen.getByRole('button', { hidden: true });

    fireEvent.click(button);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
