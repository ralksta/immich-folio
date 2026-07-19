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
}

type RevealCallback = () => void;
// Shared WeakMap to track per-element callbacks, preventing memory leaks when elements are removed
const callbackMap = new WeakMap<Element, RevealCallback>();
// Singleton IntersectionObserver to reduce instantiation overhead for large lists/grids
let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver() {
  if (typeof window === 'undefined') return null;
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const callback = callbackMap.get(entry.target);
            if (callback) {
              callback();
              sharedObserver?.unobserve(entry.target);
              callbackMap.delete(entry.target);
            }
          }
        });
      },
      { threshold: 0.1 },
    );
  }
  return sharedObserver;
}

export function FadeIn({ children, delay = 0, direction = 'up', className }: FadeInProps) {
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

    const observer = getSharedObserver();
    if (observer) {
      callbackMap.set(el, reveal);
      observer.observe(el);
    }

    return () => {
      if (observer) {
        observer.unobserve(el);
        callbackMap.delete(el);
      }
    };
  }, [reveal]);

  return (
    <div
      ref={ref}
      className={`fade-in ${direction === 'up' ? 'fade-in--up' : ''} ${className ?? ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
