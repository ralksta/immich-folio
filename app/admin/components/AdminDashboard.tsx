'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BackupManagerModal from './BackupManagerModal';
import type { DoctorLevel } from '@/lib/admin/doctor';
import { DOCTOR_LEVEL_EVENT, systemHealth } from './systemHealth';
import { reportIfSessionExpired } from './sessionExpiry';
import * as Icons from './Icons';
import { useNotify } from './Notifications';
import { adminGet } from './useAdminFetch';

interface Props {
  onLogout: () => void;
  /** The active route's panel — Pages, Journal Studio, Settings or Analytics. */
  children: ReactNode;
}

/**
 * The sidebar, grouped by what the owner is doing (docs/admin-ux-concept.md).
 * `match` decides the active entry; Overview only matches /admin itself.
 */
const NAV: {
  group?: string;
  items: {
    label: string;
    href: string;
    match: RegExp;
    icon: ReactNode;
    badge?: 'messages' | 'health';
  }[];
}[] = [
  {
    items: [
      {
        label: 'Overview',
        href: '/admin',
        match: /^\/admin\/?$/,
        icon: <Icons.IconHome size={16} />,
      },
    ],
  },
  {
    group: 'Content',
    items: [
      {
        label: 'Pages',
        href: '/admin/pages',
        match: /^\/admin\/pages$/,
        icon: <Icons.IconGrid size={16} />,
      },
      {
        label: 'Journal',
        href: '/admin/journal',
        match: /^\/admin\/journal/,
        icon: <Icons.IconBook size={16} />,
      },
    ],
  },
  {
    group: 'Visitors',
    items: [
      {
        label: 'Messages',
        href: '/admin/messages',
        match: /^\/admin\/messages/,
        icon: <Icons.IconFileText size={16} />,
        badge: 'messages',
      },
      {
        label: 'Analytics',
        href: '/admin/analytics',
        match: /^\/admin\/analytics/,
        icon: <Icons.IconBarChart size={16} />,
      },
    ],
  },
  {
    group: 'Site',
    items: [
      {
        label: 'Settings',
        href: '/admin/settings',
        match: /^\/admin\/settings/,
        icon: <Icons.IconGear size={16} />,
      },
    ],
  },
  {
    group: 'System',
    items: [
      {
        label: 'Diagnostics',
        href: '/admin/diagnostics',
        match: /^\/admin\/diagnostics/,
        icon: <Icons.IconShieldCheck size={16} />,
        badge: 'health',
      },
      {
        label: 'Help',
        href: '/admin/help',
        match: /^\/admin\/help/,
        icon: <Icons.IconQuote size={16} />,
      },
    ],
  },
];

const SIDEBAR_KEY = 'folio_admin_sidebar';

export default function AdminDashboard({ onLogout, children }: Props) {
  const notify = useNotify();
  const pathname = usePathname();
  const [saving, setSaving] = useState(false);

  // Diagnostics & Backup state
  const [showStatus, setShowStatus] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  // The badge's job is "does anything need me?", and the doctor is the only
  // check that can answer that beyond "is Immich up" (#491).
  const [doctorLevel, setDoctorLevel] = useState<DoctorLevel | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  // Distinct from `status === null`: the check itself did not run. Without this
  // an expired session or a 500 rendered exactly like a real outage — every
  // indicator flipped to its alarming value at once (#341).
  const [statusError, setStatusError] = useState(false);
  /**
   * Icons-only sidebar, remembered per browser. The dashboard only renders
   * after the client-side session check, so reading storage in the initial
   * state cannot mismatch a server render.
   */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(SIDEBAR_KEY, c ? 'expanded' : 'collapsed');
      } catch {
        // Private mode or blocked storage: the toggle still works for this visit.
      }
      return !c;
    });
  /** Unread contact messages, for the count next to Messages. */
  const [unread, setUnread] = useState(0);

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    onLogout();
  }

  async function handleReload() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/reload', { method: 'POST' });
      // A 401 or a 500 used to be indistinguishable from success here — the
      // result was never checked at all (#596).
      if (!res.ok) {
        if (!reportIfSessionExpired(res)) {
          notify('error', `Reload failed (HTTP ${res.status}).`);
        }
        return;
      }
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

  const fetchDoctor = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/doctor');
      if (!res.ok) return;
      const data = await res.json();
      setDoctorLevel(data.level ?? null);
    } catch {
      // A failed check must not colour the badge — "unknown" is not "broken".
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchDoctor();
  }, [fetchDoctor]);

  // Re-counted on every navigation: reading a message in the inbox and moving
  // on should clear the count without a reload.
  useEffect(() => {
    let live = true;
    adminGet<{ messages: { read: boolean }[] }>('/api/admin/messages').then((r) => {
      if (live && r.data) setUnread(r.data.messages.filter((m) => !m.read).length);
    });
    return () => {
      live = false;
    };
  }, [pathname]);

  // The diagnostics page runs the doctor itself; take its answer rather than
  // asking Immich the same three questions again.
  useEffect(() => {
    const onLevel = (e: Event) => setDoctorLevel((e as CustomEvent<DoctorLevel>).detail);
    window.addEventListener(DOCTOR_LEVEL_EVENT, onLevel);
    return () => window.removeEventListener(DOCTOR_LEVEL_EVENT, onLevel);
  }, []);

  const immichIndicator = indicator(
    status?.immich?.status === 'connected',
    'Connected',
    'Disconnected',
  );
  const configIndicator =
    !statusLoading && !statusError && status?.config?.status === 'setup'
      ? { className: 'unknown', label: 'Not set up' }
      : indicator(status?.config?.status === 'valid', 'Valid', 'Degraded');

  // An installation that was never finished is not a fault. It used to render
  // as "System Degraded" with no further hint, which sent operators looking for
  // a network problem that did not exist (#507).
  const setupIncomplete = !statusLoading && !statusError && status?.setup?.complete === false;

  // Colour and words decided together — they used to be two separately-ordered
  // nested ternaries over the same inputs, and disagreed in two states (#539).
  const health = systemHealth({
    statusLoading,
    setupIncomplete,
    immich: immichIndicator.className,
    doctorLevel,
  });
  const missingCredentials = status?.setup?.credentials === 'missing';

  return (
    <div className={`admin-dashboard admin-app${collapsed ? ' is-collapsed' : ''}`}>
      <aside className="admin-sidebar" aria-label="Admin">
        <button
          type="button"
          className="admin-sidebar-toggle"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          data-tip={collapsed ? 'Expand' : undefined}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points={collapsed ? '9 6 15 12 9 18' : '15 6 9 12 15 18'} />
          </svg>
        </button>
        <Link href="/admin" className="admin-brand" data-tip="Immich Folio">
          <span className="admin-brand-mark" aria-hidden="true" />
          <span className="admin-brand-text">
            <span className="admin-brand-name">Immich Folio</span>
            <span className="admin-brand-sub">Admin</span>
          </span>
        </Link>

        <nav className="admin-nav">
          {NAV.map((section, i) => (
            <div key={section.group ?? i} className="admin-nav-group">
              {section.group && <span className="admin-nav-label">{section.group}</span>}
              {section.items.map((item) => {
                const active = item.match.test(pathname);
                const count = item.badge === 'messages' ? unread : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-nav-item ${active ? 'active' : ''}`}
                    data-tip={item.label}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="admin-nav-icon">{item.icon}</span>
                    <span className="admin-nav-text">{item.label}</span>
                    {count > 0 && (
                      <span className="admin-nav-count" aria-label={`${count} unread`}>
                        {count}
                      </span>
                    )}
                    {item.badge === 'health' && health.tone === 'disconnected' && (
                      <span className={`admin-nav-dot ${health.tone}`} aria-label={health.label} />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          {/* Diagnostics Badge */}
          <div className="status-indicator-container">
            <button
              className={`status-badge-btn sidebar-status ${health.tone}`}
              onClick={() => {
                setShowStatus(!showStatus);
                if (!showStatus) fetchStatus();
              }}
              title="Show system status"
              data-tip={health.label}
            >
              <span className="status-dot"></span>
              <span className="status-text">{health.label}</span>
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
                    {setupIncomplete && (
                      <p className="status-setup-note">
                        {missingCredentials
                          ? 'No Immich URL or API key configured. Set IMMICH_API_URL and IMMICH_API_KEY, or run the '
                          : 'No content/gallery.yaml yet — the public site has nothing to show. Add a page below, or run the '}
                        <a href="/install" target="_blank" rel="noopener noreferrer">
                          setup wizard
                        </a>
                        {missingCredentials
                          ? '.'
                          : ' (the one-time token is printed to the server log).'}
                      </p>
                    )}
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
                    {/*
                      Discreet on purpose: a row in the status list, not a
                      banner. When the check is off or could not run, the row
                      still names the running version and says nothing about
                      updates (#496).
                    */}
                    <div className="status-item">
                      <span className="status-label">Version</span>
                      {status?.update?.updateAvailable ? (
                        <a
                          className="status-val update"
                          href="https://github.com/ralksta/immich-folio/releases/latest"
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Version ${status.update.latest} is available`}
                        >
                          {status.update.current} → {status.update.latest}
                        </a>
                      ) : (
                        <span className="status-val">{status?.update?.current ?? '—'}</span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="admin-sidebar-actions">
            <a
              href="/?fresh=1"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-side-action"
              data-tip="View site"
              title="Open site in new tab (bypassing cache)"
            >
              <Icons.IconLink size={14} />
              <span className="admin-side-label">View site</span>
            </a>
            <button
              className="admin-side-action"
              data-tip="Backups"
              onClick={() => setShowBackupModal(true)}
              title="Manage config backups & restore"
            >
              <Icons.IconArchive size={14} />
              <span className="admin-side-label">Backups</span>
            </button>
            <button
              className="admin-side-action"
              data-tip="Reload"
              onClick={handleReload}
              disabled={saving}
              title="Reload config & clear cache"
            >
              <Icons.IconRefresh size={14} />
              <span className="admin-side-label">Reload</span>
            </button>
            <button className="admin-side-action" data-tip="Sign out" onClick={handleLogout}>
              <Icons.IconX size={14} />
              <span className="admin-side-label">Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-main admin-workspace">{children}</main>

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
