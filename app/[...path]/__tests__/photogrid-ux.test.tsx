// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PhotoGrid, type PhotoItem } from '../PhotoGrid';

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

const ASSETS = [photo('a1'), photo('a2')];

let store: Map<string, string>;

beforeEach(() => {
  store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  window.history.replaceState(null, '', '/gallery');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PhotoGrid lightbox history and proofing semantics', () => {
  it('pops its pushed history entry via history.back() on close instead of pushing again', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {
      window.history.replaceState(null, '', '/gallery');
    });

    render(<PhotoGrid assets={ASSETS} />);

    fireEvent.click(screen.getByLabelText('View photo 1'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(pushSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('replaces the URL without calling history.back() when closing a deep-linked lightbox', () => {
    window.history.replaceState(null, '', '/gallery?photo=a2');
    const backSpy = vi.spyOn(window.history, 'back');
    const replaceSpy = vi.spyOn(window.history, 'replaceState');

    render(<PhotoGrid assets={ASSETS} />);
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(backSpy).not.toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalled();
    expect(new URLSearchParams(window.location.search).get('photo')).toBeNull();
  });

  it('renders the proofing favourite button as a sibling (not nested) with aria-pressed', async () => {
    render(<PhotoGrid assets={ASSETS} proofing albumName="Gallery" />);

    const trigger = await screen.findByLabelText('View photo 1');
    const favBtn = screen.getAllByLabelText('Add favorite')[0];

    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.contains(favBtn)).toBe(false);
    expect(favBtn.closest('[role="button"]')).toBeNull();
    expect(favBtn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(favBtn);
    expect(screen.getByLabelText('Remove favorite').getAttribute('aria-pressed')).toBe('true');
  });
});
