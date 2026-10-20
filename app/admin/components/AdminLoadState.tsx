'use client';

import * as Icons from './Icons';
import { useAdminDictionary } from './AdminI18n';

/**
 * The one spinner and the one error-with-retry for admin screens (#609), so a
 * failed load looks the same everywhere and always offers a way out.
 *
 * Renders nothing once there is data and no error; the caller renders the
 * content then.
 */
export default function AdminLoadState({
  loading,
  error,
  onRetry,
  hasData,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** With data already on screen, a reload shows no spinner over it. */
  hasData?: boolean;
}) {
  const t = useAdminDictionary().shell.loadState;
  if (error) {
    return (
      <div className="admin-load-error" role="alert">
        <p>{error}</p>
        <button type="button" className="admin-btn admin-btn-primary" onClick={onRetry}>
          <Icons.IconRefresh size={14} /> {t.retry}
        </button>
      </div>
    );
  }
  if (loading && !hasData) {
    return (
      <div className="admin-loading-container" role="status" aria-label={t.loading}>
        <div className="admin-spinner" />
      </div>
    );
  }
  return null;
}
