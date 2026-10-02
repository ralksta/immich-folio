// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { useState } from 'react';
import { Lightbox } from '../Lightbox';
import type { PhotoItem } from '@/app/[...path]/PhotoGrid';

/**
 * The lightbox zoom (#467), wired up: the control, the keys, Esc order,
 * double-click, swipe while zoomed, and that the full-resolution file is
 * requested only when the visitor zooms.
 *
 * jsdom does no layout, so the fit box is stubbed: every image is laid out at
 * 1000×600, at the origin. A 6000px photo on a 1× screen is 1:1 at 6×.
 */

const photo = (id: string, extra: Partial<PhotoItem> = {}): PhotoItem => ({
  id,
  type: 'image',
  thumbUrl: `/t/${id}`,
  previewUrl: `/p/${id}`,
  exifUrl: `/e/${id}`,
  aspectRatio: 5 / 3,
  ...extra,
});

const ZOOMABLE = photo('z1', { zoomUrl: '/api/zoom/a/z1', zoomWidth: 6000, zoomHeight: 3600 });
const ZOOMABLE_2 = photo('z2', { zoomUrl: '/api/zoom/a/z2', zoomWidth: 6000, zoomHeight: 3600 });
const PLAIN = photo('p1');
const VIDEO: PhotoItem = {
  ...photo('v1', { zoomUrl: '/api/zoom/a/v1', zoomWidth: 6000, zoomHeight: 3600 }),
  type: 'video',
  videoUrl: '/v/v1',
};

function Harness({
  assets,
  start = 0,
  onClose = () => {},
  onNextSpy,
}: {
  assets: PhotoItem[];
  start?: number;
  onClose?: () => void;
  onNextSpy?: () => void;
}) {
  const [index, setIndex] = useState(start);
  return (
    <Lightbox
      assets={assets}
      currentIndex={index}
      onClose={onClose}
      onNext={() => {
        onNextSpy?.();
        setIndex((i) => (i + 1) % assets.length);
      }}
      onPrev={() => setIndex((i) => (i - 1 + assets.length) % assets.length)}
    />
  );
}

const restore: Array<() => void> = [];
function stub<T extends object>(target: T, key: string, get: () => unknown) {
  const original = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, get });
  restore.push(() => {
    if (original) Object.defineProperty(target, key, original);
    else delete (target as Record<string, unknown>)[key];
  });
}

beforeEach(() => {
  stub(HTMLElement.prototype, 'offsetWidth', function (this: HTMLElement) {
    return this.tagName === 'IMG' ? 1000 : 0;
  });
  stub(HTMLElement.prototype, 'offsetHeight', function (this: HTMLElement) {
    return this.tagName === 'IMG' ? 600 : 0;
  });
  stub(window, 'devicePixelRatio', () => 1);
  window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  while (restore.length) restore.pop()!();
});

const dialog = () => screen.getByRole('dialog');
const preview = () => dialog().querySelector<HTMLImageElement>('img[src^="/p/"]')!;
const fullImage = () => dialog().querySelector<HTMLImageElement>('img[src^="/api/zoom/"]');
const zoomButton = () =>
  within(dialog()).queryByRole('button', { name: /Zoom to full resolution|Fit the photo/ });
const key = (k: string) => fireEvent.keyDown(document, { key: k });

describe('the zoom control', () => {
  it('is offered for a zoomable photo', () => {
    render(<Harness assets={[ZOOMABLE]} />);
    expect(zoomButton()).not.toBeNull();
    expect(zoomButton()!.getAttribute('aria-pressed')).toBe('false');
  });

  it('is absent without a zoom source, and for a video', () => {
    render(<Harness assets={[PLAIN, VIDEO]} />);
    expect(zoomButton()).toBeNull();
    fireEvent.click(screen.getByLabelText('Next photo'));
    expect(zoomButton()).toBeNull();
  });

  it('toggles 1:1 and back', () => {
    render(<Harness assets={[ZOOMABLE]} />);
    fireEvent.click(zoomButton()!);
    expect(zoomButton()!.getAttribute('aria-pressed')).toBe('true');
    expect(preview().style.transform).toContain('scale(6)');
    fireEvent.click(zoomButton()!);
    expect(zoomButton()!.getAttribute('aria-pressed')).toBe('false');
    expect(preview().style.transform).toContain('scale(1)');
  });
});

describe('on a touch device (review of #830)', () => {
  const coarse = () => {
    window.matchMedia = vi.fn((q: string) => ({
      matches: q === '(pointer: coarse)',
    })) as unknown as typeof window.matchMedia;
  };
  const HUGE = photo('h1', { zoomUrl: '/api/zoom/a/h1', zoomWidth: 9520, zoomHeight: 6336 });

  it('offers no zoom above 50 MP', () => {
    coarse();
    render(<Harness assets={[HUGE]} />);
    expect(zoomButton()).toBeNull();
    key('+');
    expect(fullImage()).toBeNull();
  });

  it('still offers it for a smaller photo', () => {
    coarse();
    render(
      <Harness
        assets={[photo('s1', { zoomUrl: '/api/zoom/a/s1', zoomWidth: 4032, zoomHeight: 3024 })]}
      />,
    );
    expect(zoomButton()).not.toBeNull();
  });

  it('keeps the large photo zoomable with a mouse', () => {
    render(<Harness assets={[HUGE]} />);
    expect(zoomButton()).not.toBeNull();
  });
});

describe('the full-resolution file', () => {
  it('is not requested on open or on the next photo', () => {
    render(<Harness assets={[ZOOMABLE, ZOOMABLE_2]} />);
    expect(fullImage()).toBeNull();
    fireEvent.click(screen.getByLabelText('Next photo'));
    expect(fullImage()).toBeNull();
  });

  it('is requested on the first zoom, under the same transform as the preview', () => {
    render(<Harness assets={[ZOOMABLE]} />);
    key('+');
    const full = fullImage();
    expect(full?.getAttribute('src')).toBe('/api/zoom/a/z1');
    expect(full!.style.transform).toBe(preview().style.transform);
  });

  it('when missing, says so, returns to fit and withdraws the control', () => {
    render(<Harness assets={[ZOOMABLE]} />);
    key('+');
    fireEvent.error(fullImage()!);
    expect(screen.getByText('Full resolution is not available for this photo.')).toBeTruthy();
    expect(zoomButton()).toBeNull();
    expect(preview().style.transform).toContain('scale(1)');
  });

  it('starts over on the next photo', () => {
    render(<Harness assets={[ZOOMABLE, ZOOMABLE_2]} />);
    key('+');
    expect(fullImage()).not.toBeNull();
    fireEvent.click(screen.getByLabelText('Next photo'));
    expect(fullImage()).toBeNull();
    expect(preview().style.transform).toBe('');
    expect(zoomButton()!.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('keys', () => {
  it('+ / = zoom in by steps up to 1:1, - out, 0 resets', () => {
    render(<Harness assets={[ZOOMABLE]} />);
    key('+');
    expect(preview().style.transform).toContain('scale(2)');
    key('=');
    expect(preview().style.transform).toContain('scale(4)');
    key('+');
    expect(preview().style.transform).toContain('scale(6)');
    key('-');
    expect(preview().style.transform).toContain('scale(3)');
    key('0');
    expect(preview().style.transform).toContain('scale(1)');
  });

  it('leave a photo without zoom alone', () => {
    render(<Harness assets={[PLAIN]} />);
    key('+');
    expect(preview().style.transform).toBe('');
  });

  it('Esc leaves the zoom first, and closes the viewer only after that', () => {
    const onClose = vi.fn();
    render(<Harness assets={[ZOOMABLE]} onClose={onClose} />);
    key('+');
    key('Escape');
    expect(onClose).not.toHaveBeenCalled();
    expect(zoomButton()!.getAttribute('aria-pressed')).toBe('false');
    key('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lists the zoom keys only where zoom is offered', () => {
    const { unmount } = render(<Harness assets={[ZOOMABLE]} />);
    key('?');
    expect(screen.queryByText('Zoom in / out')).not.toBeNull();
    unmount();
    render(<Harness assets={[PLAIN]} />);
    key('?');
    expect(screen.queryByText('Zoom in / out')).toBeNull();
  });
});

describe('gestures', () => {
  it('double-click goes to 1:1 around the cursor, and back', () => {
    render(<Harness assets={[ZOOMABLE]} />);
    const surface = preview().parentElement!;
    fireEvent.doubleClick(surface, { clientX: 600, clientY: 300 });
    // Fit box centre (500, 300); the cursor 100px right of it stays put at 6×.
    expect(preview().style.transform).toBe('translate3d(-500px, 0px, 0) scale(6)');
    fireEvent.doubleClick(surface, { clientX: 600, clientY: 300 });
    expect(preview().style.transform).toContain('scale(1)');
  });

  it('no swipe navigation while zoomed', () => {
    const onNextSpy = vi.fn();
    render(<Harness assets={[ZOOMABLE, ZOOMABLE_2]} onNextSpy={onNextSpy} />);
    const swipeLeft = () => {
      fireEvent.touchStart(dialog(), { touches: [{ clientX: 600, clientY: 300 }] });
      fireEvent.touchEnd(dialog(), {
        touches: [],
        changedTouches: [{ clientX: 300, clientY: 300 }],
      });
    };
    key('+');
    swipeLeft();
    expect(onNextSpy).not.toHaveBeenCalled();
    key('0');
    swipeLeft();
    expect(onNextSpy).toHaveBeenCalledTimes(1);
  });
});
