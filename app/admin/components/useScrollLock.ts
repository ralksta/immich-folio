'use client';

import { useEffect } from 'react';

/**
 * Freezes the page behind a modal for as long as `active` is true.
 *
 * An overlay covers the page but does not absorb wheel events: a scroll that
 * starts over the backdrop — or one that continues past the end of the modal's
 * own scroll container — reaches the document and moves the page underneath.
 * `overscroll-behavior` alone cannot fix that, because it only applies to
 * scroll containers, and the backdrop is not one.
 *
 * Nesting works without a counter: each lock captures whatever inline value it
 * found and restores exactly that, so a picker opened from the album drawer
 * restores the drawer's `hidden` rather than clearing it.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    // Hiding the scrollbar widens the viewport and shifts the page under the
    // overlay. Pad by exactly the width it gave up so nothing moves. Overlay
    // scrollbars (most touch devices) measure 0 and need no compensation.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${current + scrollbarWidth}px`;
    }
    body.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [active]);
}
