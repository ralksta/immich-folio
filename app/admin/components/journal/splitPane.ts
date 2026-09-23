'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

/**
 * The draggable divider between the journal editor's authoring pane and its
 * preview (#555). The arithmetic is plain functions; `useSplitPane` owns the
 * state, the drag listeners and persistence.
 */

/** Width of the authoring pane, in percent of the split view. */
export const SPLIT_STORAGE_KEY = 'folio-journal-split';
export const SPLIT_MIN = 25;
export const SPLIT_MAX = 70;
export const SPLIT_DEFAULT = 46;

export function clampSplit(pct: number): number {
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct));
}

/** The width for a pointer at `clientX` over a split view at `left`/`width`. */
export function splitFromPointer(clientX: number, left: number, width: number): number | null {
  if (width === 0) return null;
  return clampSplit(((clientX - left) / width) * 100);
}

/**
 * Keyboard access for the divider: arrows nudge (Shift for bigger steps), Home
 * resets. Null for any other key, which the divider then leaves alone.
 */
export function splitAfterKey(pct: number, key: string, shiftKey: boolean): number | null {
  const step = shiftKey ? 10 : 2;
  if (key === 'ArrowLeft') return Math.max(SPLIT_MIN, pct - step);
  if (key === 'ArrowRight') return Math.min(SPLIT_MAX, pct + step);
  if (key === 'Home') return SPLIT_DEFAULT;
  return null;
}

/** A stored width, or null when it is missing or out of range. */
export function parseStoredSplit(raw: string | null): number | null {
  const stored = Number(raw);
  return stored >= SPLIT_MIN && stored <= SPLIT_MAX ? stored : null;
}

export function useSplitPane() {
  const splitRef = useRef<HTMLDivElement>(null);
  const [splitPct, setSplitPct] = useState(SPLIT_DEFAULT);
  const [dragging, setDragging] = useState(false);

  // Restore the last width after mount (localStorage is unavailable on the server,
  // and reading it in the initial state would not match the server render).
  useEffect(() => {
    const stored = parseStoredSplit(window.localStorage.getItem(SPLIT_STORAGE_KEY));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored !== null) setSplitPct(stored);
  }, []);

  const applySplit = useCallback((clientX: number) => {
    const rect = splitRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = splitFromPointer(clientX, rect.left, rect.width);
    if (pct !== null) setSplitPct(pct);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      applySplit(e.clientX);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, applySplit]);

  // Persist once the drag ends, not on every pixel.
  useEffect(() => {
    if (dragging) return;
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(Math.round(splitPct)));
  }, [dragging, splitPct]);

  const onResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onResizerDoubleClick = () => setSplitPct(SPLIT_DEFAULT);

  const onResizerKeyDown = (e: React.KeyboardEvent) => {
    const next = splitAfterKey(splitPct, e.key, e.shiftKey);
    if (next === null) return;
    e.preventDefault();
    setSplitPct(next);
  };

  return {
    splitRef,
    splitPct,
    dragging,
    onResizerMouseDown,
    onResizerDoubleClick,
    onResizerKeyDown,
  };
}
