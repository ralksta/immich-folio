'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BackupManagerModal from './BackupManagerModal';
import * as Icons from './Icons';

interface Props {
  onLogout: () => void;
  /** The active route's panel — Pages, Journal Studio, Settings or Analytics. */
  children: ReactNode;
}

const TABS = [
  { label: 'Pages', href: '/admin/pages', match: /^\/admin(\/pages)?$/ },
  { label: 'Journal', href: '/admin/journal', match: /^\/admin\/journal/ },
  { label: 'Settings', href: '/admin/settings', match: /^\/admin\/settings/ },
  { label: 'Analytics', href: '/admin/analytics', match: /^\/admin\/analytics/ },
];

export default function AdminDashboard({ onLogout, children }: Props) {
  const pathname = usePathname();
  const [saving, setSaving] = useState(false);

  // Diagnostics & Backup state
  const [showStatus, setShowStatus] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  // Distinct from `status === null`: the check itself did not run. Without this
  // an expired session or a 500 rendered exactly like a real outage — every
  // indicator flipped to its alarming value at once (#341).
  const [statusError, setStatusError] = useState(false);

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    onLogout();
  }

  async function handleReload() {
    setSaving(true);
    try {
      await fetch('/api/admin/reload', { method: 'POST' });
      // Refresh status after reload
      await fetchStatus();
    } finally {
      setSaving(false);
    }
  }

  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/admin/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setStatusError(false);
      } else {
        setStatus(null);
        setStatusError(true);
      }
    } catch {
      setStatus(null);
      setStatusError(true);
    } finally {
      setStatusLoading(false);
    }
  };

  /**
   * Render one diagnostic as ok / bad / unknown. "Unknown" covers both the
   * in-flight check and a check that failed to run — neither is evidence that
   * the thing being checked is broken.
   */
  const indicator = (healthy: boolean, okLabel: string, badLabel: string) => {
    if (statusLoading) return { className: 'unknown', label: 'Checking…' };
    if (statusError || !status) return { className: 'unknown', label: 'Unknown' };
    return healthy ? { className: 'ok', label: okLabel } : { className: 'error', label: badLabel };
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const immichIndicator = indicator(
    status?.immich?.status === 'connected',
    'Connected',
    'Disconnected',
  );
  const configIndicator = indicator(status?.config?.status === 'valid', 'Valid', 'Degraded');

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-left">
          <h1>Immich Folio</h1>
          <nav className="admin-tabs">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`admin-tab ${t.match.test(pathname) ? 'active' : ''}`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="admin-header-right">
          {/* Diagnostics Badge */}
          <div className="status-indicator-container">
            <button
              className={`status-badge-btn ${immichIndicator.className === 'ok' ? 'connected' : immichIndicator.className === 'error' ? 'disconnected' : 'unknown'}`}
              onClick={() => {
                setShowStatus(!showStatus);
                if (!showStatus) fetchStatus();
              }}
              title="Show system status"
            >
              <span className="status-dot"></span>
              <span className="status-text">
                {statusLoading
                  ? 'Checking...'
                  : immichIndicator.className === 'ok'
                    ? 'System OK'
                    : immichIndicator.className === 'error'
                      ? 'System Degraded'
                      : 'Status Unknown'}
              </span>
            </button>

            {showStatus && (
              <>
                <div className="status-dropdown-backdrop" onClick={() => setShowStatus(false)} />
                <div className="status-dropdown">
                  <div className="status-dropdown-header">
                    <h4>System Diagnostics</h4>
                    <button
                      className="status-refresh-btn"
                      onClick={fetchStatus}
                      disabled={statusLoading}
                      title="Refresh diagnostics"
                    >
                      {statusLoading ? '...' : '↻'}
                    </button>
                  </div>
                  <div className="status-dropdown-body">
                    <div className="status-item">
                      <span className="status-label">Immich Connection</span>
                      <span className={`status-val ${immichIndicator.className}`}>
                        {immichIndicator.label}
                      </span>
                    </div>
                    <div className="status-item">
                      <span className="status-label">Config Integrity</span>
                      <span className={`status-val ${configIndicator.className}`}>
                        {configIndicator.label}
                      </span>
                    </div>
                    <div className="status-item">
                      <span className="status-label">Config Backups</span>
                      <span className="status-val">{status?.backups?.count ?? 0} Backups</span>
                    </div>
                    <div className="status-item">
                      <span className="status-label">Latest Backup</span>
                      <span className="status-val" title={status?.backups?.lastBackup || 'None'}>
                        {status?.backups?.lastBackup
                          ? new Date(status.backups.lastBackup).toLocaleDateString()
                          : 'None'}
                      </span>
                    </div>
                    <div className="status-item">
                      <span className="status-label">In-Memory Cache</span>
                      <span className="status-val">{status?.cache?.size ?? 0} items</span>
                    </div>
                  </div>
                  <div className="status-dropdown-footer">
                    <button
                      className="admin-btn admin-btn-sm"
                      onClick={() => {
                        setShowStatus(false);
                        setShowBackupModal(true);
                      }}
                    >
                      <Icons.IconArchive size={14} /> Manage Backups
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <span className="admin-header-divider" aria-hidden="true" />

          <a
            href="/?fresh=1"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn-ghost"
            title="Open site in new tab (bypassing cache)"
          >
            <Icons.IconLink size={14} /> Site
          </a>
          <button
            className="admin-btn admin-btn-ghost"
            onClick={() => setShowBackupModal(true)}
            title="Manage config backups & restore"
          >
            <Icons.IconArchive size={14} /> Backups
          </button>
          <button
            className="admin-btn admin-btn-ghost"
            onClick={handleReload}
            disabled={saving}
            title="Reload config & clear cache"
          >
            <Icons.IconRefresh size={14} /> Reload
          </button>
          <button className="admin-btn admin-btn-ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="admin-main">{children}</main>

      <BackupManagerModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        onRestoreSuccess={() => {
          fetchStatus();
        }}
      />
    </div>
  );
}
