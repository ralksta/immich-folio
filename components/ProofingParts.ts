'use client';

/**
 * Everything `ProofingLazy.tsx` loads, behind one import so the three share a
 * single chunk — a page with proofing on needs the provider and a control
 * together, and separate imports would each carry their own copy of the
 * provider.
 */
export { ProofingProvider } from './ProofingContext';
export { ProofingModal } from './ProofingModal';
export { ProofSessionControls } from './ProofSessionControls';
