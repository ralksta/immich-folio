'use client';

/**
 * Loading, data and a typed error for an admin screen (#609).
 *
 * Every screen used to write this by hand: set loading, fetch, check res.ok,
 * set data, catch, set error, clear loading. The copies disagreed on errors:
 * `err: any` with `err.message`, a silent `catch {}`, a boolean flag. A silent
 * catch is how a failed load turns into an empty form. Here a failure is
 * always a message, and a 401 always goes through reportIfSessionExpired.
 *
 * Pair it with <AdminLoadState> for the spinner and the error-with-retry.
 */

import { useCallback, useEffect, useState } from 'react';
import { reportIfSessionExpired } from './sessionExpiry';

export type AdminResult<T> = { data: T; error: null } | { data: null; error: string };

/** One GET, with the admin's error conventions. Usable outside the hook too. */
export async function adminGet<T>(url: string): Promise<AdminResult<T>> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (reportIfSessionExpired(res)) {
        return { data: null, error: 'Your session expired. Sign in again.' };
      }
      const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
      const detail = typeof body?.error === 'string' ? `: ${body.error}` : '';
      return { data: null, error: `Could not load (HTTP ${res.status})${detail}.` };
    }
    return { data: (await res.json()) as T, error: null };
  } catch {
    return { data: null, error: 'Could not reach the server.' };
  }
}

export interface AdminFetch<T> {
  data: T | null;
  /** Only the latest attempt's error; cleared while a reload is in flight. */
  error: string | null;
  /** True until the current URL has answered, including after reload(). */
  loading: boolean;
  reload: () => void;
  /** Local edit after a successful mutation, without a round trip. */
  mutate: (update: (data: T) => T) => void;
}

/**
 * `url === null` fetches nothing (a closed modal, say). Data from the previous
 * answer stays visible while a reload runs.
 */
export function useAdminFetch<T>(url: string | null): AdminFetch<T> {
  const [attempt, setAttempt] = useState(0);
  const key = url === null ? null : `${attempt}:${url}`;
  const [result, setResult] = useState<(AdminResult<T> & { key: string }) | null>(null);

  useEffect(() => {
    if (key === null || url === null) return;
    let live = true;
    // State is set in the callback, never synchronously in the effect.
    adminGet<T>(url).then((r) => {
      if (live) setResult({ ...r, key });
    });
    return () => {
      live = false;
    };
  }, [key, url]);

  const loading = key !== null && result?.key !== key;
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const mutate = useCallback((update: (data: T) => T) => {
    setResult((r) =>
      r && r.error === null ? { key: r.key, data: update(r.data), error: null } : r,
    );
  }, []);

  return {
    data: result?.data ?? null,
    error: loading ? null : (result?.error ?? null),
    loading,
    reload,
    mutate,
  };
}
