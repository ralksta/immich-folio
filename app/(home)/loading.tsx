/**
 * Instant shell for the homepage.
 *
 * It lives in the (home) route group, not in app/, on purpose. A loading.tsx
 * in app/ wraps every route below the root layout in a Suspense boundary, and
 * a page inside one streams its 200 before it can call notFound() — which made
 * every unknown slug the catch-all answers a soft 404. See
 * app/[...path]/page.tsx.
 */

import styles from '../loading.module.css';
import { getServerDictionary } from '@/lib/i18n/server';

export default function Loading() {
  const t = getServerDictionary();
  return (
    <div className={styles.grid} role="status" aria-label={t.common.loadingGallery}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={styles.tile} />
      ))}
    </div>
  );
}
