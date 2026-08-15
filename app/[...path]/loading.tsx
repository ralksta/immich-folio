/**
 * Instant shell for album and subpage routes. These are force-dynamic and wait
 * on a live Immich round-trip — up to IMMICH_TIMEOUT_MS when the server is
 * struggling — so without this the viewer stares at a blank page.
 */

import styles from '../loading.module.css';
import { getServerDictionary } from '@/lib/i18n/server';

export default function Loading() {
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
