// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { HeroCarousel, INTERVAL_MS } from '../HeroCarousel';

vi.mock('next/image', () => ({
  default: ({ className, src }: { className?: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className={className} src={src} />
  ),
}));

const images = [{ src: '/a' }, { src: '/b' }, { src: '/c' }];

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

const activeSrc = (container: HTMLElement) =>
  container.querySelector('.hero__carousel-image--active')?.getAttribute('src');

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('HeroCarousel (#696)', () => {
  it('advances on its own by default', () => {
    mockReducedMotion(false);
    const { container } = render(<HeroCarousel images={images} />);
    expect(activeSrc(container)).toBe('/a');
    act(() => vi.advanceTimersByTime(INTERVAL_MS));
    expect(activeSrc(container)).toBe('/b');
  });

  it('does not advance under prefers-reduced-motion', () => {
    mockReducedMotion(true);
    const { container } = render(<HeroCarousel images={images} />);
    act(() => vi.advanceTimersByTime(INTERVAL_MS * 3));
    expect(activeSrc(container)).toBe('/a');
    expect(screen.getByRole('button', { name: 'Play slideshow' })).toBeTruthy();
  });

  it('stops and restarts with the pause control', () => {
    mockReducedMotion(false);
    const { container } = render(<HeroCarousel images={images} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause slideshow' }));
    act(() => vi.advanceTimersByTime(INTERVAL_MS * 2));
    expect(activeSrc(container)).toBe('/a');

    fireEvent.click(screen.getByRole('button', { name: 'Play slideshow' }));
    act(() => vi.advanceTimersByTime(INTERVAL_MS));
    expect(activeSrc(container)).toBe('/b');
  });

  it('shows no control for a single image', () => {
    mockReducedMotion(false);
    render(<HeroCarousel images={[images[0]]} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
