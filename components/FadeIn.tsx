/**
 * FadeIn — scroll-reveal wrapper using IntersectionObserver.
 *
 * Wraps children in a div that fades/slides in when it enters the viewport.
 * Supports an optional stagger delay for grid items.
 * On the homepage (no scroll), acts as a simple load-in animation.
 */

'use client';

import { useRef, useEffect, useCallback } from 'react';

interface FadeInProps {
  children: React.ReactNode;
  /** Stagger delay in ms (e.g. index * 60) */
  delay?: number;
  /** Slide direction */
  direction?: 'up' | 'none';
  /** CSS class name for the wrapper */
  className?: string;
  /** Extra inline styles for the wrapper (e.g. flex sizing in justified grids) */
  style?: React.CSSProperties;
  /**
   * The wrapper element. `figure` lets a photo grid hang a figcaption next to
   * the photo; the reset in tokens.css removes its default margins, so it
   * lays out exactly like the div.
   */
  as?: 'div' | 'figure';
}

export function FadeIn({
  children,
  delay = 0,
  direction = 'up',
  className,
  style,
  as: Wrapper = 'div',
}: FadeInProps) {
  // HTMLElement, not HTMLDivElement: the wrapper may be a <figure>. Set
  // through a callback, which either element's ref accepts.
  const ref = useRef<HTMLElement | null>(null);
  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el;
  }, []);

  const reveal = useCallback(() => {
    ref.current?.classList.add('fade-in--visible');
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced-motion preference — reveal immediately
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('fade-in--visible');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [reveal]);

  return (
    <Wrapper
      ref={setRef}
      className={`fade-in ${direction === 'up' ? 'fade-in--up' : ''} ${className ?? ''}`}
      style={{ ...style, transitionDelay: `${delay}ms` }}
    >
      {children}
    </Wrapper>
  );
}
