'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useDictionary } from './I18nProvider';

/**
 * MobileNav — hamburger button + dropdown panel for the header links.
 *
 * `children` — Home, subpages, standalone albums, About, Map — is the exact
 * same server-rendered markup the desktop header already used. It is never
 * duplicated: `.header__nav-links` is `display: contents` above the mobile
 * breakpoint, so on desktop this component is invisible and the links sit
 * directly in `.header__nav`'s flex row exactly as before. Below the
 * breakpoint the same markup becomes the dropdown panel's content, toggled
 * by the `data-open` attribute rather than by mounting/unmounting (#590).
 *
 * The header used to scroll sideways with the scrollbar hidden on narrow
 * viewports, so a visitor with more subpages than fit the width had no sign
 * that any were missing.
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
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
        type="button"
        className="header__menu-btn"
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
      <div id="header-nav-panel" className="header__nav-links" data-open={open}>
        {children}
      </div>
    </>
  );
}
