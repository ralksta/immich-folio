// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';
import { useState } from 'react';
import { Lightbox } from '../Lightbox';
import type { PhotoItem } from '@/app/[...path]/PhotoGrid';

/**
 * What belongs to the photo on screen starts over with the next one, and the
 * fullscreen key is offered only where the browser supports it (#864: these
 * used to be set from effects; they are now derived while rendering).
 */

const photo = (id: string): PhotoItem => ({
  id,
  type: 'image',
  thumbUrl: `/t/${id}`,
  previewUrl: `/p/${id}`,
  exifUrl: `/e/${id}`,
  aspectRatio: 1.5,
});

function Harness({ assets }: { assets: PhotoItem[] }) {
  const [index, setIndex] = useState(0);
  return (
    <Lightbox
      assets={assets}
      currentIndex={index}
      onClose={() => {}}
      onNext={() => setIndex((i) => (i + 1) % assets.length)}
      onPrev={() => setIndex((i) => (i - 1 + assets.length) % assets.length)}
    />
  );
}

const ASSETS = [photo('a1'), photo('a2')];
const dialog = () => screen.getByRole('dialog');
const preview = () => dialog().querySelector<HTMLImageElement>('img[src^="/p/"]')!;
const copyButton = () => within(dialog()).getByRole('button', { name: 'Copy link to this photo' });
const next = () => fireEvent.click(screen.getByLabelText('Next photo'));

const originalFullscreen = Object.getOwnPropertyDescriptor(Document.prototype, 'fullscreenEnabled');
const setFullscreenEnabled = (value: boolean) =>
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => value });

beforeEach(() => {
  window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) },
  });
});

afterEach(() => {
  cleanup();
  delete (document as unknown as Record<string, unknown>).fullscreenEnabled;
  if (originalFullscreen)
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', originalFullscreen);
});

describe('moving to the next photo', () => {
  it('shows the new photo as not loaded yet, never with the old one’s state', () => {
    render(<Harness assets={ASSETS} />);
    fireEvent.load(preview());
    expect(preview().className).toContain('imageLoaded');

    next();
    expect(preview().getAttribute('src')).toContain('/p/a2');
    expect(preview().className).not.toContain('imageLoaded');
  });

  it('drops a "Copied" that was about the previous photo', async () => {
    render(<Harness assets={ASSETS} />);
    await act(async () => {
      fireEvent.click(copyButton());
    });
    expect(copyButton().textContent).toContain('Copied');

    next();
    expect(copyButton().textContent).not.toContain('Copied');
  });
});

describe('the fullscreen key', () => {
  const shortcutList = () => {
    fireEvent.keyDown(document, { key: '?' });
    return dialog().textContent ?? '';
  };

  it('is listed where the browser can go fullscreen', () => {
    setFullscreenEnabled(true);
    render(<Harness assets={ASSETS} />);
    expect(shortcutList()).toContain('Fullscreen');
  });

  it('is absent where it cannot, as on iPhone Safari', () => {
    setFullscreenEnabled(false);
    render(<Harness assets={ASSETS} />);
    expect(shortcutList()).not.toContain('Fullscreen');
  });
});
