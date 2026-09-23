'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Unsaved editor state that survives leaving the editor (#592).
 *
 * `useUnsavedGuard` only covers leaving the browser. Inside the admin, a tab
 * link, the back button, Reload or Logout unmounts the page builder or the
 * journal editor and its state goes with it. Rather than guard every exit —
 * App Router has no `router.events`, and `<Link onNavigate>` does not see the
 * back button — the editor keeps a draft in `sessionStorage` and picks it up
 * again when it next mounts.
 *
 * A draft carries the `base` it was edited from: a fingerprint of what the
 * server returned. When the server still returns the same thing the draft is
 * applied on load. When it does not — the file was saved from another tab, or a
 * backup was restored — applying it would silently overwrite that change, so it
 * is held back and the editor asks.
 *
 * `sessionStorage` rather than `localStorage`: a draft belongs to the tab it was
 * typed in, and should not follow the operator into a second tab or outlive the
 * browser session.
 */

const PREFIX = 'folio_draft_';

export interface Draft<T> {
  base: string;
  value: T;
}

/**
 * Storage can throw — a private window, a full quota, blocked site data. A
 * draft is a convenience, so every failure degrades to "no draft".
 */
export function readDraft<T>(key: string): Draft<T> | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft<T>>;
    if (typeof parsed?.base !== 'string' || !('value' in parsed)) return null;
    return { base: parsed.base, value: parsed.value as T };
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, draft: Draft<T>): void {
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(draft));
  } catch {
    // Quota or blocked storage: the edit is still in memory, just not kept.
  }
}

export function clearDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

/**
 * What the editor should show after loading:
 * - `restored` — a draft was applied; offer to discard it.
 * - `conflict` — a draft exists but the server changed since; offer to apply
 *   it anyway or discard it.
 */
export type DraftStatus = 'none' | 'restored' | 'conflict';

export function useDraft<T>(key: string, value: T, dirty: boolean) {
  /** The server fingerprint the current edits started from; null until loaded. */
  const baseRef = useRef<string | null>(null);
  const [status, setStatus] = useState<DraftStatus>('none');

  // Mirror the edits while there are any, and drop the draft once there are
  // none — a save or a discard. Nothing is written before `load()` has set a
  // base, so the empty state an editor mounts with never lands in storage.
  useEffect(() => {
    if (baseRef.current === null) return;
    if (dirty) writeDraft(key, { base: baseRef.current, value });
    else clearDraft(key);
  }, [key, value, dirty]);

  /**
   * Call once the server state has loaded, with its fingerprint. Returns the
   * draft to apply, or null to keep what the server sent.
   */
  const load = useCallback(
    (base: string): T | null => {
      baseRef.current = base;
      const draft = readDraft<T>(key);
      if (!draft) {
        setStatus('none');
        return null;
      }
      if (draft.base === base) {
        setStatus('restored');
        return draft.value;
      }
      setStatus('conflict');
      return null;
    },
    [key],
  );

  /** Call after a successful save, with the fingerprint of what was saved. */
  const saved = useCallback(
    (base: string) => {
      baseRef.current = base;
      clearDraft(key);
      setStatus('none');
    },
    [key],
  );

  /** The held-back draft of a `conflict`, for "restore anyway". */
  const takeConflicting = useCallback((): T | null => {
    const draft = readDraft<T>(key);
    setStatus(draft ? 'restored' : 'none');
    return draft?.value ?? null;
  }, [key]);

  /** Forget the draft. The editor reloads the server state itself. */
  const discard = useCallback(() => {
    clearDraft(key);
    setStatus('none');
  }, [key]);

  const dismiss = useCallback(() => setStatus('none'), []);

  return { status, load, saved, takeConflicting, discard, dismiss };
}
