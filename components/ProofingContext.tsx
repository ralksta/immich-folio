'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { encodeProofBitmask, decodeProofBitmask } from '@/lib/proofing';
import { useDictionary } from './I18nProvider';

/** What the server tells a client proofing page about its session. */
export interface ProofSessionInit {
  /** The link token — the capability for this session's API routes. */
  token: string;
  /** Asset tokens already selected, from the server. */
  selected: string[];
  submitted: boolean;
  download: 'none' | 'selection' | 'album';
  /** ZIP downloads left, or null for unlimited. */
  downloadsRemaining: number | null;
}

export type ProofSaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Session mode: a client proofing link (/proof/<token>). The selection lives on
 * the server instead of localStorage and the URL, and can be submitted once.
 */
export interface ProofSessionState {
  saveState: ProofSaveState;
  submitted: boolean;
  /** Save anything pending, then lock the selection. Resolves to success. */
  submit: () => Promise<boolean>;
  download: ProofSessionInit['download'];
  downloadsRemaining: number | null;
  /** The ZIP route for this session. */
  archiveUrl: string;
}

/** How long the selection may sit unsaved after the last heart. */
const SAVE_DEBOUNCE_MS = 600;

interface ProofingContextType {
  favorites: Set<string>;
  toggleFavorite: (token: string) => void;
  isFavorite: (token: string) => boolean;
  clearFavorites: () => void;
  isFilterActive: boolean;
  setIsFilterActive: React.Dispatch<React.SetStateAction<boolean>>;
  isModalOpen: boolean;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  getProofingUrl: () => string;
  getFormattedList: () => string;
  /** Selected asset tokens in album order — the payload for a ZIP download. */
  getSelectedTokens: () => string[];
  allowMailto: boolean;
  /** The ZIP endpoint when the album offers downloads; undefined otherwise. */
  downloadArchiveUrl?: string;
  /** Present on a client proofing link only. */
  session?: ProofSessionState;
}

const ProofingContext = createContext<ProofingContextType | null>(null);

export function ProofingProvider({
  children,
  albumTokens = [],
  albumName = 'Gallery',
  allowMailto = true,
  downloadArchiveUrl,
  session: sessionInit,
}: {
  children: React.ReactNode;
  albumTokens?: string[];
  albumName?: string;
  allowMailto?: boolean;
  downloadArchiveUrl?: string;
  session?: ProofSessionInit;
}) {
  const t = useDictionary();
  // A session's selection comes from the server, so it can be rendered on the
  // first pass; the anonymous mode hydrates from the browser in an effect below.
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(sessionInit?.selected ?? []),
  );
  const [saveState, setSaveState] = useState<ProofSaveState>('idle');
  const [submitted, setSubmitted] = useState(Boolean(sessionInit?.submitted));
  /**
   * Edits made vs. edits the server has confirmed. A counter rather than a
   * dirty flag, so a heart clicked while a save is in flight is not marked
   * saved by that earlier request.
   */
  const [edits, setEdits] = useState(0);
  const editsRef = useRef(0);
  const savedEdits = useRef(0);
  useEffect(() => {
    editsRef.current = edits;
  }, [edits]);
  /** The selection as the save callbacks see it; kept current by the effect below. */
  const favoritesRef = useRef(favorites);
  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const storageKey = `folio_fav_${albumName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  // Hydrate from localStorage and URL query params on mount. This has to stay in
  // an effect: both sources are browser-only, so reading them during render would
  // break SSR and produce a hydration mismatch.
  useEffect(() => {
    if (sessionInit) return;
    try {
      const saved = localStorage.getItem(storageKey);
      const initialSet = new Set<string>();
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((t) => initialSet.add(t));
        }
      }

      // Check URL query param ?proof=...
      const urlParams = new URLSearchParams(window.location.search);
      const proofCode = urlParams.get('proof');
      if (proofCode && albumTokens.length > 0) {
        const decodedIndices = decodeProofBitmask(proofCode, albumTokens.length);
        decodedIndices.forEach((idx) => {
          if (albumTokens[idx]) {
            initialSet.add(albumTokens[idx]);
          }
        });
      }

      // Mount-time hydration from an external store, not a render cascade:
      // the state lands in the same commit and never re-triggers this effect.
      setFavorites(initialSet);
    } catch (e) {
      console.error('Failed to load favorites', e);
    }
  }, [storageKey, albumTokens, sessionInit]);

  const sessionToken = sessionInit?.token;

  /** Send the current selection, in album order. Resolves to success. */
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (!sessionToken) return true;
    const version = editsRef.current;
    setSaveState('saving');
    const selected = albumTokens.filter((token) => favoritesRef.current.has(token));
    try {
      const res = await fetch(`/api/proof/${encodeURIComponent(sessionToken)}/selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: selected }),
      });
      if (res.status === 409) {
        // Submitted from another tab or device: show the locked state here too.
        setSubmitted(true);
        setSaveState('saved');
        return false;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      savedEdits.current = Math.max(savedEdits.current, version);
      // A heart clicked while this request was in flight has its own save queued.
      if (editsRef.current <= savedEdits.current) setSaveState('saved');
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }, [sessionToken, albumTokens]);

  // Debounced autosave: a burst of hearts becomes one request.
  useEffect(() => {
    if (!sessionToken || edits <= savedEdits.current) return;
    const timer = setTimeout(() => void saveNow(), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [edits, sessionToken, saveNow]);

  // Leaving with an unsaved heart: send it anyway. keepalive lets the request
  // outlive the page, which a normal fetch in `pagehide` would not.
  useEffect(() => {
    if (!sessionToken) return;
    const flush = () => {
      if (editsRef.current <= savedEdits.current) return;
      const selected = albumTokens.filter((token) => favoritesRef.current.has(token));
      void fetch(`/api/proof/${encodeURIComponent(sessionToken)}/selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: selected }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [sessionToken, albumTokens]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!sessionToken) return false;
    if (editsRef.current > savedEdits.current && !(await saveNow())) return false;
    try {
      const res = await fetch(`/api/proof/${encodeURIComponent(sessionToken)}/submit`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitted(true);
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }, [sessionToken, saveNow]);

  /** A session edit: counted for autosave, refused once submitted. */
  const editSelection = (update: (prev: Set<string>) => Set<string>) => {
    // A submitted selection is the photographer's to reopen, not the client's.
    if (submitted) return;
    setEdits((n) => n + 1);
    setFavorites(update);
  };

  const toggleFavorite = (token: string) => {
    if (sessionInit) {
      editSelection((prev) => {
        const next = new Set(prev);
        if (next.has(token)) next.delete(token);
        else next.add(token);
        return next;
      });
      return;
    }
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(token)) {
        next.delete(token);
      } else {
        next.add(token);
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error('Failed to save favorites', e);
      }
      return next;
    });
  };

  const isFavorite = (token: string) => favorites.has(token);

  const clearFavorites = () => {
    if (sessionInit) {
      editSelection(() => new Set());
      return;
    }
    setFavorites(new Set());
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error('Failed to clear favorites', e);
    }
  };

  const getProofingUrl = () => {
    if (albumTokens.length === 0 || favorites.size === 0) {
      return typeof window !== 'undefined' ? window.location.href : '';
    }
    const indices: number[] = [];
    albumTokens.forEach((token, index) => {
      if (favorites.has(token)) {
        indices.push(index);
      }
    });
    const code = encodeProofBitmask(indices);
    const url = new URL(typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    if (code) {
      url.searchParams.set('proof', code);
    } else {
      url.searchParams.delete('proof');
    }
    return url.toString();
  };

  const getSelectedTokens = () => albumTokens.filter((token) => favorites.has(token));

  const getFormattedList = () => {
    const selectedIndices: number[] = [];
    albumTokens.forEach((token, index) => {
      if (favorites.has(token)) {
        selectedIndices.push(index + 1);
      }
    });
    if (selectedIndices.length === 0) return t.proofing.listEmpty(albumName);
    return t.proofing.listSummary(
      albumName,
      selectedIndices.length,
      `#${selectedIndices.join(', #')}`,
    );
  };

  return (
    <ProofingContext.Provider
      value={{
        favorites,
        toggleFavorite,
        isFavorite,
        clearFavorites,
        isFilterActive,
        setIsFilterActive,
        isModalOpen,
        setIsModalOpen,
        getProofingUrl,
        getFormattedList,
        getSelectedTokens,
        allowMailto,
        downloadArchiveUrl,
        session: sessionInit
          ? {
              saveState,
              submitted,
              submit,
              download: sessionInit.download,
              downloadsRemaining: sessionInit.downloadsRemaining,
              archiveUrl: `/api/proof/${encodeURIComponent(sessionInit.token)}/archive`,
            }
          : undefined,
      }}
    >
      {children}
    </ProofingContext.Provider>
  );
}

export function useProofing() {
  const context = useContext(ProofingContext);
  return context;
}
