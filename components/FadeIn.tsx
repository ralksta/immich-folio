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
}

export function FadeIn({ children, delay = 0, direction = 'up', className, style }: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);

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
    <div
      ref={ref}
      className={`fade-in ${direction === 'up' ? 'fade-in--up' : ''} ${className ?? ''}`}
      style={{ ...style, transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
