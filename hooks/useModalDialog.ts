import { useEffect, useRef } from 'react';

/**
 * Turns a plain overlay `<div>` into something that behaves like a dialog.
 *
 * The admin modals (asset picker, album picker, backup manager) and the
 * proofing modal were all built the same way: an overlay div whose `onClick`
 * closes it, and a card inside that stops the click from bubbling. That works
 * with a mouse and with nothing else. There was no Escape key, the focus
 * stayed on whatever had opened the modal, Tab walked straight out of the
 * dialog into the page behind it, and on close the focus was left nowhere at
 * all — a screen reader user landed back at the top of the document.
 *
 * This hook supplies the four pieces that were missing, so the markup only
 * has to add `role="dialog"`, `aria-modal="true"` and a label:
 *
 *   1. Escape closes.
 *   2. The focus moves into the dialog when it opens — onto the element
 *      carrying `autoFocus`, if there is one, otherwise the first thing that
 *      can take it.
 *   3. Tab and Shift+Tab cycle inside the dialog instead of leaving it.
 *   4. On close the focus returns to whatever had it before.
 *
 * Returns the ref to put on the dialog card (not the overlay).
 *
 * `active` exists for the modals that render `null` while closed but still
 * have to call the hook — hooks may not run conditionally. Without it the
 * effect would run once against an unmounted card, bail out, and never run
 * again, because `onClose` alone does not change when the modal opens.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    // offsetParent is null for anything display:none — a hidden tab panel
    // inside the dialog must not swallow the focus.
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function useModalDialog(onClose: () => void, active = true) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!active || !card) return;

    const zurueck = document.activeElement as HTMLElement | null;

    // React has already applied `autoFocus` by the time the effect runs, so
    // an existing focus inside the card is respected rather than overridden.
    if (!card.contains(document.activeElement)) {
      (card.querySelector<HTMLElement>('[autofocus]') ?? focusable(card)[0])?.focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !card) return;

      const items = focusable(card);
      if (items.length === 0) {
        // Nothing to land on — keep the focus in the dialog rather than
        // letting Tab escape into the page behind it.
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      if (e.shiftKey && (current === first || !card.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Only take the focus back if it is still inside the closing dialog.
      // Something else may legitimately have claimed it in the meantime.
      if (zurueck && document.contains(zurueck)) zurueck.focus();
    };
  }, [onClose, active]);

  return cardRef;
}
