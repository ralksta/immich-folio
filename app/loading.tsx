/**
 * Instant shell for the homepage.
 */

import styles from './loading.module.css';

export default function Loading() {
  return (
    <div className={styles.grid} role="status" aria-label="Loading gallery">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={styles.tile} />
      ))}
    </div>
  );
}
