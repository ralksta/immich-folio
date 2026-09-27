/**
 * Focus helpers for modal UI (lightbox) and the mobile nav panel (#696).
 * Client-only: every function works on live DOM nodes.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Keyboard-reachable elements inside `container`, in DOM order. */
export function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      !el.closest('[hidden], [inert], [aria-hidden="true"]') &&
      el.tabIndex >= 0 &&
      // A `display: none` control (the shortcut panel on touch devices) cannot
      // take focus; wrapping onto it would strand the visitor.
      (typeof el.checkVisibility !== 'function' || el.checkVisibility()),
  );
}

/**
 * Keeps Tab and Shift+Tab inside `container`: from the last element Tab wraps
 * to the first, and the other way round. Focus that has escaped (or never
 * entered) is pulled back in. Returns true when it moved focus itself.
 */
export function trapTabKey(container: HTMLElement, e: KeyboardEvent): boolean {
  if (e.key !== 'Tab') return false;
  const items = focusableIn(container);
  if (items.length === 0) {
    e.preventDefault();
    return true;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement as HTMLElement | null;
  const inside = active !== null && container.contains(active);

  if (e.shiftKey && (!inside || active === first)) {
    e.preventDefault();
    last.focus();
    return true;
  }
  if (!e.shiftKey && (!inside || active === last)) {
    e.preventDefault();
    first.focus();
    return true;
  }
  return false;
}
