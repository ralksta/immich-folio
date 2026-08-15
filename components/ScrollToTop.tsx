/**
 * ScrollToTop — fixed back-to-top button that fades in after scrolling down.
 * Toggled site-wide via `scrollToTop` in settings.yaml.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useDictionary } from './I18nProvider';

const SHOW_THRESHOLD = 300;

export function ScrollToTop() {
  const t = useDictionary();
  const [visible, setVisible] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const measure = () => {
      frame.current = null;
      setVisible(window.scrollY > SHOW_THRESHOLD);
    };

    // rAF-throttled: one state update per frame, not one per scroll event.
    const onScroll = () => {
      if (frame.current === null) frame.current = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const scrollToTop = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <button
      className={`scroll-to-top ${visible ? 'scroll-to-top--visible' : ''}`}
      onClick={scrollToTop}
      aria-label={t.theme.scrollToTop}
      title={t.theme.scrollToTop}
      type="button"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
    >
      <svg
        className="scroll-to-top__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 18.75V6.25" />
        <path d="m6.5 11.75 5.5-5.5 5.5 5.5" />
      </svg>
    </button>
  );
}
