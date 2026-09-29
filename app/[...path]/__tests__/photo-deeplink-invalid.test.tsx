// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PhotoGrid, type PhotoItem } from '../PhotoGrid';

/**
 * A `?photo=` that names no photo in the album opened nothing and stayed in
 * the address bar, to be copied and shared on (P-16). It is removed now; a
 * valid deep link still opens its photo.
 */

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}));
vi.mock('@/components/FadeIn', () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const photo = (id: string): PhotoItem => ({
  id,
  type: 'image',
  thumbUrl: `/t/${id}`,
  previewUrl: `/p/${id}`,
  exifUrl: `/e/${id}`,
  aspectRatio: 1.5,
});

const ASSETS = [photo('a1'), photo('a2'), photo('a3')];

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('?photo= on load', () => {
  it('opens the photo a valid token names', () => {
    window.history.replaceState(null, '', '/wedding?photo=a2');
    render(<PhotoGrid assets={ASSETS} albumName="Wedding" />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(window.location.search).toBe('?photo=a2');
  });

  it('drops a token that names no photo, keeping other parameters', () => {
    window.history.replaceState(null, '', '/wedding?preview=true&photo=bogus');
    render(<PhotoGrid assets={ASSETS} albumName="Wedding" />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.pathname + window.location.search).toBe('/wedding?preview=true');
  });

  it('drops a position-style ?photo=5, which was never a format', () => {
    window.history.replaceState(null, '', '/wedding?photo=5');
    render(<PhotoGrid assets={ASSETS} albumName="Wedding" />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('still honours a legacy #photo-N hash next to a bad token', () => {
    window.history.replaceState(null, '', '/wedding?photo=bogus#photo-3');
    render(<PhotoGrid assets={ASSETS} albumName="Wedding" />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get('photo')).toBe('a3');
  });
});
