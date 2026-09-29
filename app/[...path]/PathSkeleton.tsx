/**
 * Placeholder for album and subpage content while Immich answers. These routes
 * are force-dynamic and wait on a live Immich round-trip — up to
 * IMMICH_TIMEOUT_MS when the server is struggling — so without this the viewer
 * stares at a blank page.
 *
 * This used to be app/[...path]/loading.tsx. It is a Suspense fallback inside
 * the page now, placed after the page has decided whether the path exists: a
 * loading.tsx wraps the whole page, so the skeleton went out with a 200 before
 * the page could call notFound().
 */

import styles from '../loading.module.css';
import { getServerDictionary } from '@/lib/i18n/server';

export function PathSkeleton() {
  const t = getServerDictionary();
  return (
    <>
      <div className={styles.heading} aria-hidden="true" />
      <div className={styles.grid} role="status" aria-label={t.common.loadingPhotos}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={styles.tile} />
        ))}
      </div>
    </>
  );
}
