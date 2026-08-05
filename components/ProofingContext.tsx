'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { encodeProofBitmask, decodeProofBitmask } from '@/lib/proofing';

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
  allowMailto: boolean;
}

const ProofingContext = createContext<ProofingContextType | null>(null);

export function ProofingProvider({
  children,
  albumTokens = [],
  albumName = 'Gallery',
  allowMailto = true,
}: {
  children: React.ReactNode;
  albumTokens?: string[];
  albumName?: string;
  allowMailto?: boolean;
}) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const storageKey = `folio_fav_${albumName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  // Hydrate from localStorage and URL query params on mount
  useEffect(() => {
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

      setFavorites(initialSet);
    } catch (e) {
      console.error('Failed to load favorites', e);
    }
  }, [storageKey, albumTokens]);

  const toggleFavorite = (token: string) => {
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

  const getFormattedList = () => {
    const selectedIndices: number[] = [];
    albumTokens.forEach((token, index) => {
      if (favorites.has(token)) {
        selectedIndices.push(index + 1);
      }
    });
    if (selectedIndices.length === 0) return `${albumName}: No photos selected.`;
    return `${albumName} — Selected Photos (${selectedIndices.length}): #${selectedIndices.join(', #')}`;
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
        allowMailto,
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
