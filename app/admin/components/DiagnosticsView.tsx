'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import BackupManagerModal from './BackupManagerModal';
import * as Icons from './Icons';
import { DOCTOR_LEVEL_EVENT } from './systemHealth';
import type { DoctorFinding, DoctorLevel } from '@/lib/admin/doctor';
import type { AltTextReport } from '@/lib/admin/alt-text';
import PageHeader from './PageHeader';
import { rich, useAdminDictionary } from './AdminI18n';
import type { AdminDictionary } from '@/lib/i18n/admin';

type DiagnosticsText = AdminDictionary['diagnostics'];

/**
 * Diagnostics as a page (/admin/diagnostics).
 *
 * It started as a modal (#491), which was fine for seven one-line findings and
 * nothing else: a photo list does not fit in 640px, a modal cannot be linked
 * from an issue, and backups and the cache lived in two further places. This
 * page holds all of it, worst news first.
 *
 * The status badge in the top bar still answers only from the doctor. Alt text
 * is shown here but kept out of the badge on purpose: most libraries have some
 * photos without a description, and a badge that is never green stops being
 * read.
 */

interface StatusData {
  immich?: { status: 'connected' | 'disconnected' };
  config?: { status: 'valid' | 'invalid' | 'setup'; gallery: string; settings: string };
  cache?: { size: number };
  backups?: { count: number; lastBackup: string | null };
  update?: { current: string; latest?: string; updateAvailable?: boolean };
}

type AltTextData = AltTextReport & {
  unreadable: number;
  immichUrl: string;
  /** `external-domain` is Immich's own public address; `api-url` may be internal. */
  immichUrlSource: 'external-domain' | 'api-url';
};

/** Which group a doctor check belongs to. An unknown id lands in Content. */
const GROUPS: { id: keyof DiagnosticsText['groups']; checks: string[] }[] = [
  { id: 'connection', checks: ['immich-api', 'album-ids'] },
  {
    id: 'security',
    checks: ['auth-secret', 'passwords', 'proxy-hops', 'cdn', 'download-metadata'],
  },
  {
    id: 'content',
    checks: [
      'albums-shared',
      'content-pages',
      'content-writable',
      'alt-text',
      'legal',
      'contact',
      'privacy',
      'settings-values',
      'zoom-renditions',
    ],
  },
];

const LEVEL_RANK: Record<DoctorLevel, number> = { error: 0, warn: 1, ok: 2 };

const DOCS = 'https://github.com/ralksta/immich-folio/blob/main';

/**
 * Where each doctor finding is fixed. Admin paths are in-app links; `label`
 * names the button's text in `diagnostics.fixes`.
 */
const FIXES: Record<string, { label: keyof DiagnosticsText['fixes']; href: string }> = {
  'auth-secret': {
    label: 'howToSetIt',
    href: `${DOCS}/docs/deployment.md#environment-variables`,
  },
  'proxy-hops': { label: 'howToSetIt', href: `${DOCS}/docs/security.md#trusted-proxies` },
  cdn: { label: 'cdnSetup', href: `${DOCS}/docs/deployment.md#cdn-mode` },
  passwords: { label: 'openSettings', href: '/admin/settings/security' },
  'album-ids': { label: 'openPages', href: '/admin/pages' },
  'albums-shared': { label: 'openPages', href: '/admin/pages' },
  'content-pages': { label: 'openPages', href: '/admin/pages' },
  'download-metadata': { label: 'openPages', href: '/admin/pages' },
  legal: { label: 'openSettings', href: '/admin/settings/legal' },
  contact: { label: 'openSettings', href: '/admin/settings/legal' },
  privacy: { label: 'openSettings', href: '/admin/settings/legal' },
  // The href is replaced by the finding's own settingsSection.
  'settings-values': { label: 'openSettings', href: '/admin/settings/general' },
  'content-writable': { label: 'howToFix', href: `${DOCS}/docs/admin-panel.md#docker-usage` },
  'zoom-renditions': {
    label: 'howToSetUp',
    href: `${DOCS}/docs/gallery-features.md#photo-zoom`,
  },
  'immich-api': {
    label: 'apiKeyPermissions',
    href: `${DOCS}/docs/immich-setup.md#api-key-permissions`,
  },
};

/** Photos shown per album before the "+n more" tile. */
const PREVIEW_COUNT = 12;

function groupOf(id: string): keyof DiagnosticsText['groups'] {
  return GROUPS.find((g) => g.checks.includes(id))?.id ?? 'content';
}

/** The alt-text report, phrased as one more finding so it sorts with the rest. */
function altTextFinding(report: AltTextData, text: DiagnosticsText): DoctorFinding {
  const t = text.altText;
  if (!report.captionsEnabled) {
    return {
      id: 'alt-text',
      level: 'warn',
      title: t.captionsOffTitle,
      detail: t.captionsOffDetail,
    };
  }
  const missing = report.total - report.described;
  const unread = report.unreadable ? t.unreadable(report.unreadable) : '';
  if (!missing) {
    return {
      id: 'alt-text',
      level: 'ok',
      title: t.allTitle(report.total),
      detail: t.allDetail(unread),
    };
  }
  return {
    id: 'alt-text',
    level: 'warn',
    title: t.missingTitle(missing),
    detail: t.missingDetail(unread),
  };
}

export default function DiagnosticsView() {
  const t = useAdminDictionary().diagnostics;
  const [status, setStatus] = useState<StatusData | null>(null);
  const [findings, setFindings] = useState<DoctorFinding[] | null>(null);
  const [altText, setAltText] = useState<AltTextData | null>(null);
  const [altTextFailed, setAltTextFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ranAt, setRanAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const [showBackups, setShowBackups] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [altTextOpen, setAltTextOpen] = useState(false);
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/status');
      setStatus(res.ok ? await res.json() : null);
    } catch {
      setStatus(null);
    }
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);

    // The alt-text report reads every published album and is the slow one, so
    // it arrives on its own and does not hold up the rest of the page.
    setAltTextFailed(false);
    fetch('/api/admin/alt-text')
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setAltText(await res.json());
      })
      .catch(() => {
        setAltText(null);
        setAltTextFailed(true);
      });

    try {
      const [doctorRes] = await Promise.all([fetch('/api/admin/doctor'), fetchStatus()]);
      if (!doctorRes.ok) throw new Error(t.errors.failedStatus(doctorRes.status));
      const data = await doctorRes.json();
      setFindings(data.findings || []);
      setRanAt(new Date());
      if (data.level) {
        window.dispatchEvent(new CustomEvent(DOCTOR_LEVEL_EVENT, { detail: data.level }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.failed);
    } finally {
      setLoading(false);
    }
  }, [fetchStatus, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a load started on mount; moves to useAdminFetch in #821
    run();
  }, [run]);

  async function clearCache() {
    setClearing(true);
    try {
      await fetch('/api/admin/reload', { method: 'POST' });
      await fetchStatus();
    } finally {
      setClearing(false);
    }
  }

  const all: DoctorFinding[] = [
    ...(findings ?? []),
    ...(altText ? [altTextFinding(altText, t)] : []),
  ];
  const attention = all
    .filter((f) => f.level !== 'ok')
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);

  /** Markdown, so it can be pasted straight into a GitHub issue. */
  async function copyReport() {
    const body = all
      .map((f) => `- **${t.levels[f.level]}** — ${f.title}\n  ${f.detail}`)
      .join('\n');
    const version = status?.update?.current ? `\n${t.report.version(status.update.current)}\n` : '';
    try {
      await navigator.clipboard.writeText(`### ${t.report.heading}\n${version}\n${body}\n`);
      setCopied(true);
    } catch {
      setError(t.errors.copyFailed);
    }
  }

  function toggleAlbum(id: string) {
    setExpandedAlbums((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const headline = loading
    ? t.header.checking
    : attention.length === 0
      ? t.header.allClear
      : t.header.attention(attention.length, all.length);

  const renderAltTextList = (report: AltTextData) => (
    <div className="diag-alt" id="diag-alt-list">
      <div className="diag-coverage">
        <div className="diag-coverage-bar" aria-hidden="true">
          <span style={{ width: `${Math.round((report.described / report.total) * 100)}%` }} />
        </div>
        <span>
          {t.altText.coverage(
            report.described,
            report.total,
            Math.round((report.described / report.total) * 100),
          )}
        </span>
      </div>

      {report.albums.map((album) => {
        const expanded = expandedAlbums.has(album.albumId);
        const shown = expanded ? album.missing : album.missing.slice(0, PREVIEW_COUNT);
        const hidden = album.missing.length - shown.length;
        return (
          <div className="diag-album" key={album.albumId}>
            <div className="diag-album-head">
              <span className="diag-album-name">
                {album.albumName}
                <span className="diag-album-path">{album.path}</span>
              </span>
              <span className="diag-album-count">
                {t.altText.albumMissing(album.missing.length, album.total)}
              </span>
            </div>
            <div className="diag-thumbs">
              {shown.map((gap) => (
                <a
                  key={gap.assetId}
                  className="diag-thumb"
                  href={`${report.immichUrl}/photos/${gap.assetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t.altText.openInImmich(gap.fileName)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail proxy, not an optimisable image */}
                  <img src={`/api/admin/thumbnail/${gap.assetId}`} alt="" loading="lazy" />
                  <span className="diag-thumb-name">{gap.fileName}</span>
                </a>
              ))}
              {hidden > 0 && (
                <button
                  type="button"
                  className="diag-thumb-more"
                  onClick={() => toggleAlbum(album.albumId)}
                >
                  {t.altText.more(hidden)}
                </button>
              )}
            </div>
          </div>
        );
      })}

      <p className="diag-note">
        {t.altText.noteAdd}{' '}
        {report.immichUrlSource === 'external-domain'
          ? rich(t.altText.noteExternal, { url: <code>{report.immichUrl}</code> })
          : rich(t.altText.noteInternal, {
              url: <code>{report.immichUrl}</code>,
              setting: <strong>{t.altText.externalDomain}</strong>,
            })}
      </p>
    </div>
  );

  /**
   * The way to the fix, for a finding that wants one. Where the fix lives in
   * the admin the button goes there; where it is an environment variable or a
   * volume, it goes to the part of the docs that explains it. A finding with
   * no entry gets no button rather than a label that looks like one.
   */
  const renderFix = (f: DoctorFinding) => {
    const id = f.id;
    // A finding about exactly one album opens the page it is published on.
    if (f.albumIds?.length === 1) {
      return (
        <Link
          href={`/admin/pages?album=${encodeURIComponent(f.albumIds[0])}`}
          className="admin-btn admin-btn-sm"
        >
          {t.fixes.openInPages}
        </Link>
      );
    }
    if (id === 'alt-text') {
      if (altText && !altText.captionsEnabled) {
        return (
          <Link href="/admin/settings/general" className="admin-btn admin-btn-sm">
            {t.fixes.openSettings}
          </Link>
        );
      }
      return null; // The photo list toggle is rendered separately.
    }
    const known = FIXES[id];
    if (!known) return null;
    // A finding that knows which settings section holds its fix goes there.
    const fix = f.settingsSection
      ? { ...known, href: `/admin/settings/${f.settingsSection}` }
      : known;
    return fix.href.startsWith('/') ? (
      <Link href={fix.href} className="admin-btn admin-btn-sm">
        {t.fixes[fix.label]}
      </Link>
    ) : (
      <a
        href={fix.href}
        target="_blank"
        rel="noopener noreferrer"
        className="admin-btn admin-btn-sm"
      >
        {t.fixes[fix.label]} ↗
      </a>
    );
  };

  const renderFinding = (f: DoctorFinding) => {
    const isAltText = f.id === 'alt-text' && altText && altText.captionsEnabled;
    const hasList = isAltText && altText.albums.length > 0;
    return (
      <li key={f.id} className={`diag-check diag-check--${f.level}`}>
        <div className="diag-check-row">
          <span className="diag-dot" aria-hidden="true" />
          <div className="diag-check-body">
            <span className="diag-check-title">
              {f.level !== 'ok' && <span className="sr-only">{t.levels[f.level]}: </span>}
              {f.title}
            </span>
            <span className="diag-check-detail">{f.detail}</span>
          </div>
          <div className="diag-check-side">
            {f.level !== 'ok' && renderFix(f)}
            {hasList && (
              <button
                type="button"
                className="admin-btn admin-btn-sm"
                aria-expanded={altTextOpen}
                aria-controls="diag-alt-list"
                onClick={() => setAltTextOpen(!altTextOpen)}
              >
                {altTextOpen ? t.altText.hidePhotos : t.altText.showPhotos}
              </button>
            )}
          </div>
        </div>
        {hasList && altTextOpen && renderAltTextList(altText)}
      </li>
    );
  };

  const okIn = (groupId: string) =>
    all.filter((f) => f.level === 'ok' && groupOf(f.id) === groupId);

  const immichOk = status?.immich?.status === 'connected';
  const configState = status?.config?.status;

  return (
    <div className="diag-page">
      <PageHeader
        kicker={t.header.kicker}
        title={headline}
        description={ranAt ? t.header.lastRun(ranAt.toLocaleString()) : t.header.running}
        actions={
          <>
            <button className="admin-btn admin-btn-sm" onClick={run} disabled={loading}>
              <Icons.IconRefresh size={14} /> {loading ? t.header.checking : t.header.runAgain}
            </button>
            <button
              className="admin-btn admin-btn-sm"
              onClick={copyReport}
              disabled={loading || !all.length}
              title={t.header.copyTitle}
            >
              <Icons.IconCopy size={14} /> {copied ? t.header.copied : t.header.copy}
            </button>
          </>
        }
      />

      {error && <div className="admin-error">{error}</div>}

      <section className="diag-vitals" aria-label={t.vitals.aria}>
        <div className="diag-vital">
          <span className="diag-vital-label">{t.vitals.immich}</span>
          <span className="diag-vital-val">
            <span
              className={`diag-dot diag-dot--${status ? (immichOk ? 'ok' : 'error') : 'unknown'}`}
            />
            {status ? (immichOk ? t.vitals.connected : t.vitals.disconnected) : '—'}
          </span>
        </div>
        <div className="diag-vital">
          <span className="diag-vital-label">{t.vitals.config}</span>
          <span className="diag-vital-val">
            <span
              className={`diag-dot diag-dot--${
                configState === 'valid' ? 'ok' : configState === 'invalid' ? 'error' : 'unknown'
              }`}
            />
            {configState === 'valid'
              ? t.vitals.valid
              : configState === 'invalid'
                ? t.vitals.invalid
                : configState === 'setup'
                  ? t.vitals.notSetUp
                  : '—'}
          </span>
        </div>
        <div className="diag-vital">
          <span className="diag-vital-label">{t.vitals.backups}</span>
          <span className="diag-vital-val">{status?.backups?.count ?? '—'}</span>
          <span className="diag-vital-meta">
            {status?.backups?.lastBackup
              ? t.vitals.latest(new Date(status.backups.lastBackup).toLocaleDateString())
              : t.vitals.noneYet}
          </span>
        </div>
        <div className="diag-vital">
          <span className="diag-vital-label">{t.vitals.version}</span>
          <span className="diag-vital-val">{status?.update?.current ?? '—'}</span>
          <span className="diag-vital-meta">
            {status?.update?.updateAvailable ? (
              <a
                href="https://github.com/ralksta/immich-folio/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.vitals.available(status.update.latest ?? '')}
              </a>
            ) : status?.update?.current ? (
              t.vitals.upToDate
            ) : (
              ''
            )}
          </span>
        </div>
      </section>

      {loading && !findings ? (
        <div className="admin-loading">
          <div className="admin-spinner" />
        </div>
      ) : (
        <>
          {attention.length > 0 && (
            <section className="diag-group" aria-labelledby="diag-attention">
              <h3 id="diag-attention" className="diag-group-title">
                {t.needsAttention}
              </h3>
              <ul className="diag-checks">{attention.map(renderFinding)}</ul>
            </section>
          )}

          {GROUPS.map((group) => {
            const ok = okIn(group.id);
            const pendingAltText = group.id === 'content' && !altText && !altTextFailed;
            const failedAltText = group.id === 'content' && altTextFailed;
            if (!ok.length && !pendingAltText && !failedAltText) {
              return null;
            }
            return (
              <section key={group.id} className="diag-group" aria-labelledby={`diag-${group.id}`}>
                <h3 id={`diag-${group.id}`} className="diag-group-title">
                  {t.groups[group.id]}
                </h3>
                <ul className="diag-checks">
                  {ok.map(renderFinding)}
                  {pendingAltText && (
                    <li className="diag-check diag-check--unknown">
                      <div className="diag-check-row">
                        <span className="diag-dot" aria-hidden="true" />
                        <div className="diag-check-body">
                          <span className="diag-check-title">{t.altText.pendingTitle}</span>
                          <span className="diag-check-detail">{t.altText.pendingDetail}</span>
                        </div>
                      </div>
                    </li>
                  )}
                  {failedAltText && (
                    <li className="diag-check diag-check--unknown">
                      <div className="diag-check-row">
                        <span className="diag-dot" aria-hidden="true" />
                        <div className="diag-check-body">
                          <span className="diag-check-title">{t.altText.failedTitle}</span>
                          <span className="diag-check-detail">{t.altText.failedDetail}</span>
                        </div>
                      </div>
                    </li>
                  )}
                </ul>
              </section>
            );
          })}

          <section className="diag-group" aria-labelledby="diag-storage">
            <h3 id="diag-storage" className="diag-group-title">
              {t.storage.title}
            </h3>
            <ul className="diag-checks">
              <li className="diag-check diag-check--ok">
                <div className="diag-check-row">
                  <span className="diag-dot" aria-hidden="true" />
                  <div className="diag-check-body">
                    <span className="diag-check-title">
                      {t.storage.backupsTitle(status?.backups?.count ?? 0)}
                    </span>
                    <span className="diag-check-detail">{t.storage.backupsDetail}</span>
                  </div>
                  <div className="diag-check-side">
                    <button className="admin-btn admin-btn-sm" onClick={() => setShowBackups(true)}>
                      <Icons.IconArchive size={14} /> {t.storage.manageBackups}
                    </button>
                  </div>
                </div>
              </li>
              <li className="diag-check diag-check--ok">
                <div className="diag-check-row">
                  <span className="diag-dot" aria-hidden="true" />
                  <div className="diag-check-body">
                    <span className="diag-check-title">
                      {t.storage.cacheTitle(status?.cache?.size ?? 0)}
                    </span>
                    <span className="diag-check-detail">{t.storage.cacheDetail}</span>
                  </div>
                  <div className="diag-check-side">
                    <button
                      className="admin-btn admin-btn-sm"
                      onClick={clearCache}
                      disabled={clearing}
                    >
                      <Icons.IconRefresh size={14} />{' '}
                      {clearing ? t.storage.clearing : t.storage.clearCache}
                    </button>
                  </div>
                </div>
              </li>
            </ul>
          </section>
        </>
      )}

      <BackupManagerModal
        isOpen={showBackups}
        onClose={() => setShowBackups(false)}
        onRestoreSuccess={fetchStatus}
      />
    </div>
  );
}
