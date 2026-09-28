'use client';

import { createContext, useContext } from 'react';
import type { ProofingContextType } from './ProofingContext';

/**
 * The proofing context on its own, apart from the provider in
 * `ProofingContext.tsx`. The grid, the essay and the lightbox read it on every
 * album page, proofing or not; the provider, the modal and the session
 * controls are only loaded where proofing is on (`ProofingLazy.tsx`). Keeping
 * the context here is what lets them stay out of the page's first bundle.
 */
export const ProofingContext = createContext<ProofingContextType | null>(null);

/** The proofing state, or null outside a provider — proofing is off. */
export function useProofing() {
  return useContext(ProofingContext);
}
