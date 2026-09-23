'use client';

import { useEffect, useRef } from 'react';

/**
 * A backup restore rewrote a content file behind the editors' backs.
 *
 * The page builder, settings and journal editors stay mounted in their
 * layouts, holding what they loaded before the restore. Left alone, the next
 * save wrote that older state straight over the restored file. So the backup
 * manager announces the restore and each editor reloads the file it owns —
 * through its draft, so unsaved edits come back as a `conflict` the operator
 * decides on instead of vanishing or winning silently.
 *
 * Same pattern as SESSION_EXPIRED_EVENT in sessionExpiry.ts.
 */
export const CONTENT_RESTORED_EVENT = 'folio:admin-content-restored';

export interface ContentRestored {
  target: 'gallery' | 'settings' | 'about' | 'journal';
  /** The journal entry, for `journal`. */
  slug?: string;
}

export function reportContentRestored(detail: ContentRestored): void {
  window.dispatchEvent(new CustomEvent<ContentRestored>(CONTENT_RESTORED_EVENT, { detail }));
}

export function useContentRestored(handler: (detail: ContentRestored) => void): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    const onRestored = (e: Event) => handlerRef.current((e as CustomEvent<ContentRestored>).detail);
    window.addEventListener(CONTENT_RESTORED_EVENT, onRestored);
    return () => window.removeEventListener(CONTENT_RESTORED_EVENT, onRestored);
  }, []);
}
