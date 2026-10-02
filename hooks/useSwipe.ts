import { useRef, useCallback } from 'react';

interface UseSwipeProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
  /**
   * False while a swipe must not navigate — the lightbox while zoomed, where
   * one finger pans the photo (#467). Read when the touch starts and when it
   * ends, so a gesture that began zoomed never turns into a swipe.
   */
  enabled?: boolean;
}

/**
 * A one-finger horizontal swipe.
 *
 * Anything with a second finger is not a swipe: a pinch that drifts sideways
 * used to be read as one and jump to the next photo, because only the first
 * touch was ever looked at. Once a second finger lands, the whole touch
 * sequence is ignored, up to the moment the last finger lifts.
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 60,
  enabled = true,
}: UseSwipeProps) {
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  /** The current touch sequence is out: multi-touch, or started while disabled. */
  const ignored = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent | TouchEvent) => {
      if (e.touches.length > 1) {
        ignored.current = true;
        return;
      }
      ignored.current = !enabled;
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    },
    [enabled],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent | TouchEvent) => {
      // Fingers still down: the sequence is not over yet.
      if (e.touches.length > 0) return;
      const skip = ignored.current || !enabled;
      ignored.current = false;
      if (skip) return;

      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;

      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) onSwipeRight();
        else onSwipeLeft();
      }
    },
    [onSwipeLeft, onSwipeRight, threshold, enabled],
  );

  return { handleTouchStart, handleTouchEnd };
}
