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
import { rich, useAdminDictionary } from './AdminI18n';
import type { AdminDictionary } from '@/lib/i18n/admin';

type NavLabels = AdminDictionary['shell']['nav'];

interface Props {
  onLogout: () => void;
  /** The active route's panel — Pages, Journal Studio, Settings or Analytics. */
  children: ReactNode;
}

/**
 * The sidebar, grouped by what the owner is doing (docs/admin-ux-concept.md).
 * `match` decides the active entry; Overview only matches /admin itself.
 * `group` and `label` are keys into the shell dictionary's `nav`.
 */
const NAV: {
  group?: keyof NavLabels['groups'];
  items: {
    label: Exclude<keyof NavLabels, 'groups' | 'unread'>;
    href: string;
    match: RegExp;
    icon: ReactNode;
    badge?: 'messages' | 'health';
  }[];
}[] = [
  {
    items: [
      {
        label: 'overview',
        href: '/admin',
        match: /^\/admin\/?$/,
        icon: <Icons.IconHome size={16} />,
      },
    ],
  },
  {
    group: 'content',
    items: [
      {
        label: 'pages',
        href: '/admin/pages',
        match: /^\/admin\/pages(\/|$)/,
        icon: <Icons.IconGrid size={16} />,
      },
      {
        label: 'journal',
        href: '/admin/journal',
        match: /^\/admin\/journal/,
        icon: <Icons.IconBook size={16} />,
      },
    ],
  },
  {
    group: 'visitors',
    items: [
      {
        label: 'messages',
        href: '/admin/messages',
        match: /^\/admin\/messages/,
        icon: <Icons.IconFileText size={16} />,
        badge: 'messages',
      },
      {
        label: 'proofing',
        href: '/admin/proofing',
        match: /^\/admin\/proofing/,
        icon: <Icons.IconHeart size={16} />,
      },
      {
        label: 'analytics',
        href: '/admin/analytics',
        match: /^\/admin\/analytics/,
        icon: <Icons.IconBarChart size={16} />,
      },
    ],
  },
  {
    group: 'site',
    items: [
      {
        label: 'settings',
        href: '/admin/settings',
        match: /^\/admin\/settings/,
        icon: <Icons.IconGear size={16} />,
      },
    ],
  },
  {
    group: 'system',
    items: [
      {
        label: 'diagnostics',
        href: '/admin/diagnostics',
        match: /^\/admin\/diagnostics/,
        icon: <Icons.IconShieldCheck size={16} />,
        badge: 'health',
      },
      {
        label: 'help',
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
  const dict = useAdminDictionary();
  const t = dict.shell;
  const pathname = usePathname();
  // Phones: the sidebar folds into a header row, and the nav opens from a
  // menu button (#732) — spread out above the content, it took most of an
  // iPhone screen before anything could be edited.
  const [menuOpen, setMenuOpen] = useState(false);
  // Navigating closes the menu. Adjusted while rendering, so the new page is
  // never drawn under an open menu for a frame.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }
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
          notify('error', t.sidebar.reloadFailed(res.status));
        }
        return;
      }
      // Refresh status after reload
      await fetchStatus();
    } finally {
      setSaving(false);
    }
  }

  // A failure only makes the indicators "unknown" (below); through adminGet a
  // 401 still signs the panel out.
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    const r = await adminGet<NonNullable<typeof status>>('/api/admin/status', dict.shell);
    setStatus(r.data);
    setStatusError(r.error !== null);
    setStatusLoading(false);
  }, [dict.shell]);

  /**
   * Render one diagnostic as ok / bad / unknown. "Unknown" covers both the
   * in-flight check and a check that failed to run — neither is evidence that
   * the thing being checked is broken.
   */
  const indicator = (healthy: boolean, okLabel: string, badLabel: string) => {
    if (statusLoading) return { className: 'unknown', label: t.status.checking };
    if (statusError || !status) return { className: 'unknown', label: dict.common.unknown };
    return healthy ? { className: 'ok', label: okLabel } : { className: 'error', label: badLabel };
  };

  const fetchDoctor = useCallback(async () => {
    const r = await adminGet<{ level?: DoctorLevel }>('/api/admin/doctor', dict.shell);
    // A failed check must not colour the badge — "unknown" is not "broken".
    if (r.data) setDoctorLevel(r.data.level ?? null);
  }, [dict.shell]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- loads started on mount; a reload and the status badge call them again, so they stay functions (#821) */
    fetchStatus();
    fetchDoctor();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [fetchStatus, fetchDoctor]);

  // Re-counted on every navigation: reading a message in the inbox and moving
  // on should clear the count without a reload.
  useEffect(() => {
    let live = true;
    adminGet<{ messages: { read: boolean }[] }>('/api/admin/messages', dict.shell).then((r) => {
      if (live && r.data) setUnread(r.data.messages.filter((m) => !m.read).length);
    });
    return () => {
      live = false;
    };
  }, [pathname, dict.shell]);

  // The diagnostics page runs the doctor itself; take its answer rather than
  // asking Immich the same three questions again.
  useEffect(() => {
    const onLevel = (e: Event) => setDoctorLevel((e as CustomEvent<DoctorLevel>).detail);
    window.addEventListener(DOCTOR_LEVEL_EVENT, onLevel);
    return () => window.removeEventListener(DOCTOR_LEVEL_EVENT, onLevel);
  }, []);

  const immichIndicator = indicator(
    status?.immich?.status === 'connected',
    t.status.connected,
    t.status.disconnected,
  );
  const configIndicator =
    !statusLoading && !statusError && status?.config?.status === 'setup'
      ? { className: 'unknown', label: t.status.configNotSetUp }
      : indicator(
          status?.config?.status === 'valid',
          t.status.configValid,
          t.status.configDegraded,
        );

  // An installation that was never finished is not a fault. It used to render
  // as "System Degraded" with no further hint, which sent operators looking for
  // a network problem that did not exist (#507).
  const setupIncomplete = !statusLoading && !statusError && status?.setup?.complete === false;

  // Colour and words decided together — they used to be two separately-ordered
  // nested ternaries over the same inputs, and disagreed in two states (#539).
  const health = systemHealth(
    { statusLoading, setupIncomplete, immich: immichIndicator.className, doctorLevel },
    t.health,
  );
  const missingCredentials = status?.setup?.credentials === 'missing';

  return (
    <div
      className={`admin-dashboard admin-app${collapsed ? ' is-collapsed' : ''}${
        menuOpen ? ' menu-open' : ''
      }`}
    >
      <a href="#admin-main" className="skip-link">
        {t.sidebar.skipToContent}
      </a>
      <aside className="admin-sidebar" aria-label={t.sidebar.landmark}>
        <button
          type="button"
          className="admin-sidebar-toggle"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t.sidebar.expand : t.sidebar.collapse}
          data-tip={collapsed ? t.sidebar.expandShort : undefined}
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
            <span className="admin-brand-sub">{t.sidebar.brandSub}</span>
          </span>
        </Link>
        <button
          type="button"
          className="admin-menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="admin-sidebar-menu"
          aria-label={menuOpen ? t.sidebar.closeMenu : t.sidebar.openMenu}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          {unread > 0 && !menuOpen && <span className="admin-menu-dot" aria-hidden="true" />}
        </button>
        <div className="admin-sidebar-menu" id="admin-sidebar-menu">
          <nav className="admin-nav">
            {NAV.map((section, i) => (
              <div key={section.group ?? i} className="admin-nav-group">
                {section.group && (
                  <span className="admin-nav-label">{t.nav.groups[section.group]}</span>
                )}
                {section.items.map((item) => {
                  const active = item.match.test(pathname);
                  const label = t.nav[item.label];
                  const count = item.badge === 'messages' ? unread : 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`admin-nav-item ${active ? 'active' : ''}`}
                      data-tip={label}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="admin-nav-icon">{item.icon}</span>
                      <span className="admin-nav-text">{label}</span>
                      {count > 0 && (
                        <span className="admin-nav-count" aria-label={t.nav.unread(count)}>
                          {count}
                        </span>
                      )}
                      {item.badge === 'health' && health.tone === 'disconnected' && (
                        <span
                          className={`admin-nav-dot ${health.tone}`}
                          aria-label={health.label}
                        />
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
                title={t.status.showTitle}
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
                      <h4>{t.status.heading}</h4>
                      <button
                        className="status-refresh-btn"
                        onClick={fetchStatus}
                        disabled={statusLoading}
                        title={t.status.refreshTitle}
                      >
                        {statusLoading ? '...' : '↻'}
                      </button>
                    </div>
                    <div className="status-dropdown-body">
                      {setupIncomplete && (
                        <p className="status-setup-note">
                          {rich(
                            missingCredentials ? t.status.missingCredentials : t.status.noGallery,
                            {
                              apiUrl: 'IMMICH_API_URL',
                              apiKey: 'IMMICH_API_KEY',
                              file: 'content/gallery.yaml',
                              wizard: (
                                <a href="/install" target="_blank" rel="noopener noreferrer">
                                  {t.status.setupWizard}
                                </a>
                              ),
                            },
                          )}
                        </p>
                      )}
                      <div className="status-item">
                        <span className="status-label">{t.status.immich}</span>
                        <span className={`status-val ${immichIndicator.className}`}>
                          {immichIndicator.label}
                        </span>
                      </div>
                      <div className="status-item">
                        <span className="status-label">{t.status.config}</span>
                        <span className={`status-val ${configIndicator.className}`}>
                          {configIndicator.label}
                        </span>
                      </div>
                      <div className="status-item">
                        <span className="status-label">{t.status.backups}</span>
                        <span className="status-val">
                          {t.status.backupCount(status?.backups?.count ?? 0)}
                        </span>
                      </div>
                      <div className="status-item">
                        <span className="status-label">{t.status.latestBackup}</span>
                        <span
                          className="status-val"
                          title={status?.backups?.lastBackup || dict.common.none}
                        >
                          {status?.backups?.lastBackup
                            ? new Date(status.backups.lastBackup).toLocaleDateString()
                            : dict.common.none}
                        </span>
                      </div>
                      <div className="status-item">
                        <span className="status-label">{t.status.cache}</span>
                        <span className="status-val">
                          {t.status.cacheItems(status?.cache?.size ?? 0)}
                        </span>
                      </div>
                      {/*
                      Discreet on purpose: a row in the status list, not a
                      banner. When the check is off or could not run, the row
                      still names the running version and says nothing about
                      updates (#496).
                    */}
                      <div className="status-item">
                        <span className="status-label">{t.status.version}</span>
                        {status?.update?.updateAvailable ? (
                          <a
                            className="status-val update"
                            href="https://github.com/ralksta/immich-folio/releases/latest"
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t.status.updateAvailable(status.update.latest)}
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
                data-tip={t.sidebar.viewSite}
                title={t.sidebar.viewSiteTitle}
              >
                <Icons.IconLink size={14} />
                <span className="admin-side-label">{t.sidebar.viewSite}</span>
              </a>
              <button
                className="admin-side-action"
                data-tip={t.sidebar.backups}
                onClick={() => setShowBackupModal(true)}
                title={t.sidebar.backupsTitle}
              >
                <Icons.IconArchive size={14} />
                <span className="admin-side-label">{t.sidebar.backups}</span>
              </button>
              <button
                className="admin-side-action"
                data-tip={t.sidebar.reload}
                onClick={handleReload}
                disabled={saving}
                title={t.sidebar.reloadTitle}
              >
                <Icons.IconRefresh size={14} />
                <span className="admin-side-label">{t.sidebar.reload}</span>
              </button>
              <button
                className="admin-side-action"
                data-tip={t.sidebar.signOut}
                onClick={handleLogout}
              >
                <Icons.IconX size={14} />
                <span className="admin-side-label">{t.sidebar.signOut}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main id="admin-main" tabIndex={-1} className="admin-main admin-workspace">
        {children}
      </main>

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
