'use client';

import dynamic from 'next/dynamic';

/**
 * The proofing provider, modal and session controls, loaded on demand.
 *
 * Proofing is off on most album pages, and these three are only rendered when
 * it is on — yet imported statically they shipped in every album, essay and
 * journal bundle. Through `next/dynamic` they become their own chunk: still
 * rendered on the server (`ssr` stays on, so the hearts and the session bar
 * are in the HTML as before) and preloaded by the page that renders them.
 *
 * All three come from `ProofingParts.ts`, so they arrive as one chunk.
 * `useProofing()` itself lives in `useProofing.ts` so the grid and the
 * lightbox can ask for it without pulling the provider back in.
 */

export const ProofingProvider = dynamic(() =>
  import('./ProofingParts').then((m) => ({ default: m.ProofingProvider })),
);

export const ProofingModal = dynamic(() =>
  import('./ProofingParts').then((m) => ({ default: m.ProofingModal })),
);

export const ProofSessionControls = dynamic(() =>
  import('./ProofingParts').then((m) => ({ default: m.ProofSessionControls })),
);
