/**
 * Instant shell for the homepage.
 */

import styles from './loading.module.css';
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
