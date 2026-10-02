// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSwipe } from '@/hooks/useSwipe';

/**
 * A swipe is one finger (#467). A pinch that drifts sideways used to jump to
 * the next photo, because only the first touch was ever looked at.
 */

type T = { clientX: number; clientY: number };
const at = (x: number, y = 100): T => ({ clientX: x, clientY: y });
const ev = (touches: T[], changedTouches: T[] = []) =>
  ({ touches, changedTouches }) as unknown as TouchEvent;

function setup(enabled = true) {
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  const { result, rerender } = renderHook(
    (props: { enabled: boolean }) =>
      useSwipe({ onSwipeLeft, onSwipeRight, enabled: props.enabled }),
    { initialProps: { enabled } },
  );
  return { onSwipeLeft, onSwipeRight, handlers: () => result.current, rerender };
}

describe('useSwipe', () => {
  it('turns a one-finger horizontal drag into a swipe', () => {
    const s = setup();
    s.handlers().handleTouchStart(ev([at(300)]));
    s.handlers().handleTouchEnd(ev([], [at(100)]));
    expect(s.onSwipeLeft).toHaveBeenCalledTimes(1);

    s.handlers().handleTouchStart(ev([at(100)]));
    s.handlers().handleTouchEnd(ev([], [at(300)]));
    expect(s.onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('ignores a pinch, however far it drifts', () => {
    const s = setup();
    // First finger down, second joins, both drift left, lift one by one.
    s.handlers().handleTouchStart(ev([at(400)]));
    s.handlers().handleTouchStart(ev([at(400), at(500)]));
    s.handlers().handleTouchEnd(ev([at(150)], [at(250)]));
    s.handlers().handleTouchEnd(ev([], [at(100)]));
    expect(s.onSwipeLeft).not.toHaveBeenCalled();
    expect(s.onSwipeRight).not.toHaveBeenCalled();
  });

  it('counts the next one-finger swipe again after a pinch', () => {
    const s = setup();
    s.handlers().handleTouchStart(ev([at(400), at(500)]));
    s.handlers().handleTouchEnd(ev([], [at(100)]));
    s.handlers().handleTouchStart(ev([at(300)]));
    s.handlers().handleTouchEnd(ev([], [at(100)]));
    expect(s.onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled (the lightbox is zoomed)', () => {
    const s = setup(false);
    s.handlers().handleTouchStart(ev([at(300)]));
    s.handlers().handleTouchEnd(ev([], [at(100)]));
    expect(s.onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ignores a gesture that started disabled even if it ends enabled', () => {
    // Pinched out to fit and let go: the pan that preceded it is no swipe.
    const s = setup(false);
    s.handlers().handleTouchStart(ev([at(300)]));
    s.rerender({ enabled: true });
    s.handlers().handleTouchEnd(ev([], [at(100)]));
    expect(s.onSwipeLeft).not.toHaveBeenCalled();
  });
});
