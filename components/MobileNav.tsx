'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { focusableIn } from '@/lib/focusTrap';
import { usePathname } from 'next/navigation';
import { useDictionary } from './I18nProvider';

/** Must match the `min-width: 641px` query in globals.css. */
const PHONE_QUERY = '(max-width: 640px)';

/**
 * MobileNav — hamburger button + dropdown panel for the header links.
 *
 * `children` — Home, subpages, standalone albums, About, Map — is the exact
 * same server-rendered markup the desktop header already used. It is never
 * duplicated: `.header__nav-links` is `display: contents` while the links fit
 * in one row, so on desktop this component is invisible and the links sit
 * directly in `.header__nav`'s flex row exactly as before. Otherwise the same
 * markup becomes the dropdown panel's content, toggled by the `data-open`
 * attribute rather than by mounting/unmounting (#590).
 *
 * "Otherwise" is two conditions. Phones always get the menu, and the CSS says
 * so on its own, before hydration. Wider viewports get it when the row is
 * wider than the header — measured here, because it depends on how many
 * subpages the site has and on the preset's type, and published as
 * `data-collapsed`. The header used to scroll sideways with the scrollbar
 * hidden instead, which on a tablet left About, Map and the theme toggle
 * off-screen with no sign they existed.
 */
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useDictionary();

  const close = useCallback(() => setOpen(false), []);

  // The root layout persists across navigations, so without this the panel
  // would still be open on the page a visitor just tapped through to. Adjusted
  // during render rather than in an effect, per React's guidance for state
  // that only needs to change alongside a prop — it resolves in this render
  // pass instead of triggering an extra one.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [collapsed, setCollapsed] = useState(false);
  // The width the inline row needs. It can only be read while the row is laid
  // out, so once collapsed this last reading is what a wider header is
  // compared against; expanding re-measures, and collapses again if the
  // reading was stale (a late web font, a different active link).
  const neededRef = useRef(0);

  // A layout effect, so a row that does not fit is swapped for the button
  // before the browser paints it.
  useLayoutEffect(() => {
    const nav = buttonRef.current?.parentElement;
    if (!nav) return;
    const phone = typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_QUERY) : null;
    const measure = () => {
      const isPhone = phone?.matches ?? false;
      if (!collapsed && !isPhone) neededRef.current = nav.scrollWidth;
      const next = isPhone || neededRef.current > nav.clientWidth;
      if (next === collapsed) return;
      setCollapsed(next);
      // A panel left open would otherwise keep its backdrop and the page's
      // scroll lock once the links are back in the row.
      if (!next) setOpen(false);
    };
    measure();
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    resize?.observe(nav);
    phone?.addEventListener('change', measure);
    let active = true;
    document.fonts?.ready.then(() => {
      if (active) measure();
    });
    return () => {
      active = false;
      resize?.disconnect();
      phone?.removeEventListener('change', measure);
    };
  }, [collapsed, pathname]);

  useEffect(() => {
    if (!open) return;
    // Focus moves into the panel when it opens (#696), so a keyboard or
    // screen-reader visitor lands on the first link rather than behind it.
    // Only when the panel is actually the dropdown — while the links sit in
    // the row the button is hidden, so this never runs.
    if (panelRef.current) focusableIn(panelRef.current)[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        // Esc returns focus to the button that opened the panel; otherwise
        // it would be left on a link that is no longer visible.
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="header__menu-btn"
        data-collapsed={collapsed}
        aria-expanded={open}
        aria-controls="header-nav-panel"
        aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>
      {open && <div className="header__nav-backdrop" onClick={close} aria-hidden="true" />}
      <div
        ref={panelRef}
        id="header-nav-panel"
        className="header__nav-links"
        data-open={open}
        data-collapsed={collapsed}
      >
        {children}
      </div>
    </>
  );
}
