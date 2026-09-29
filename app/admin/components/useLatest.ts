'use client';

import { useEffect, useRef } from 'react';

/**
 * A ref that always holds the value of the latest render.
 *
 * For code that awaits a request and then has to know whether the editor moved
 * on meanwhile: a save handler closes over the state it started with, so after
 * the `await` it cannot tell "nothing changed" from "the operator kept typing".
 * Comparing what was sent with `ref.current` can (every edit replaces the state
 * value, so identity is enough).
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
