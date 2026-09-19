'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import BackupManagerModal from './BackupManagerModal';
import * as Icons from './Icons';
import { DOCTOR_LEVEL_EVENT } from './systemHealth';
import type { DoctorFinding, DoctorLevel } from '@/lib/admin/doctor';
import type { AltTextReport } from '@/lib/admin/alt-text';

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

type AltTextData = AltTextReport & { unreadable: number; immichUrl: string };

/** Which group a doctor check belongs to. An unknown id lands in Content. */
const GROUPS: { id: string; title: string; checks: string[] }[] = [
  { id: 'connection', title: 'Connection', checks: ['immich-api', 'album-ids'] },
  { id: 'security', title: 'Security', checks: ['auth-secret', 'passwords', 'proxy-hops'] },
  { id: 'content', title: 'Content', checks: ['albums-shared', 'content-writable', 'alt-text'] },
];

const LEVEL_LABEL: Record<DoctorLevel, string> = { ok: 'OK', warn: 'Check', error: 'Problem' };
const LEVEL_RANK: Record<DoctorLevel, number> = { error: 0, warn: 1, ok: 2 };

/** Photos shown per album before the "+n more" tile. */
const PREVIEW_COUNT = 12;

function groupOf(id: string): string {
  return GROUPS.find((g) => g.checks.includes(id))?.id ?? 'content';
}

/** The alt-text report, phrased as one more finding so it sorts with the rest. */
function altTextFinding(report: AltTextData): DoctorFinding {
  if (!report.captionsEnabled) {
    return {
      id: 'alt-text',
      level: 'warn',
      title: 'Photo descriptions are not used as alt text',
      detail:
        '“Photo Description” is switched off in Settings → General, so every photo on the site has an empty alt text, whatever Immich holds.',
    };
  }
  const missing = report.total - report.described;
  const unread = report.unreadable
    ? ` ${report.unreadable} ${report.unreadable === 1 ? 'album' : 'albums'} could not be read and are not counted.`
    : '';
  if (!missing) {
    return {
      id: 'alt-text',
      level: 'ok',
      title: `All ${report.total} published photos have alt text`,
      detail: `Every photo carries its Immich description.${unread}`,
    };
  }
  return {
    id: 'alt-text',
    level: 'warn',
    title: `${missing} published ${missing === 1 ? 'photo has' : 'photos have'} no alt text`,
    detail: `Folio uses the Immich description as alt text. Without one, screen readers announce nothing and search engines index nothing for the photo.${unread}`,
  };
}

export default function DiagnosticsView() {
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
  const [altTextOpen, setAltTextOpen] = useState(true);
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
      if (!doctorRes.ok) throw new Error(`Diagnostics failed (${doctorRes.status})`);
      const data = await doctorRes.json();
      setFindings(data.findings || []);
      setRanAt(new Date());
      if (data.level) {
        window.dispatchEvent(new CustomEvent(DOCTOR_LEVEL_EVENT, { detail: data.level }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnostics failed');
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  useEffect(() => {
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

  const all: DoctorFinding[] = [...(findings ?? []), ...(altText ? [altTextFinding(altText)] : [])];
  const attention = all
    .filter((f) => f.level !== 'ok')
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);

  /** Markdown, so it can be pasted straight into a GitHub issue. */
  async function copyReport() {
    const body = all
      .map((f) => `- **${LEVEL_LABEL[f.level]}** — ${f.title}\n  ${f.detail}`)
      .join('\n');
    const version = status?.update?.current ? `\nVersion ${status.update.current}\n` : '';
    try {
      await navigator.clipboard.writeText(`### Immich Folio diagnostics\n${version}\n${body}\n`);
      setCopied(true);
    } catch {
      setError('Could not copy — your browser refused clipboard access.');
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
    ? 'Checking…'
    : attention.length === 0
      ? 'Nothing needs your attention'
      : `${attention.length} of ${all.length} checks want a look`;

  const renderAltTextList = (report: AltTextData) => (
    <div className="diag-alt" id="diag-alt-list">
      <div className="diag-coverage">
        <div className="diag-coverage-bar" aria-hidden="true">
          <span style={{ width: `${Math.round((report.described / report.total) * 100)}%` }} />
        </div>
        <span>
          {report.described} of {report.total} described ·{' '}
          {Math.round((report.described / report.total) * 100)}%
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
                {album.missing.length} of {album.total} missing
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
                  title={`${gap.fileName} — open in Immich`}
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
                  +{hidden} more
                </button>
              )}
            </div>
          </div>
        );
      })}

      <p className="diag-note">
        Add the description in Immich, then press Reload in the top bar. Photos open in Immich at{' '}
        <code>{report.immichUrl}</code> — the address Folio reaches it at. If your browser cannot
        open that, search Immich for the file name instead.
      </p>
    </div>
  );

  const renderFinding = (f: DoctorFinding) => {
    const isAltText = f.id === 'alt-text' && altText && altText.captionsEnabled;
    const hasList = isAltText && altText.albums.length > 0;
    return (
      <li key={f.id} className={`diag-check diag-check--${f.level}`}>
        <div className="diag-check-row">
          <span className="diag-dot" aria-hidden="true" />
          <div className="diag-check-body">
            <span className="diag-check-title">{f.title}</span>
            <span className="diag-check-detail">{f.detail}</span>
          </div>
          <div className="diag-check-side">
            {f.level !== 'ok' && (
              <span className={`diag-pill diag-pill--${f.level}`}>{LEVEL_LABEL[f.level]}</span>
            )}
            {f.id === 'alt-text' && altText && !altText.captionsEnabled && (
              <Link href="/admin/settings/general" className="admin-btn admin-btn-sm">
                Open settings
              </Link>
            )}
            {hasList && (
              <button
                type="button"
                className="admin-btn admin-btn-sm"
                aria-expanded={altTextOpen}
                aria-controls="diag-alt-list"
                onClick={() => setAltTextOpen(!altTextOpen)}
              >
                {altTextOpen ? 'Hide photos' : 'Show photos'}
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
      <div className="diag-head">
        <div>
          <h2>{headline}</h2>
          <p className="diag-sub">
            {ranAt ? `Last run ${ranAt.toLocaleString()}` : 'Running the checks…'}
          </p>
        </div>
        <div className="diag-actions">
          <button className="admin-btn admin-btn-sm" onClick={run} disabled={loading}>
            <Icons.IconRefresh size={14} /> {loading ? 'Checking…' : 'Run again'}
          </button>
          <button
            className="admin-btn admin-btn-sm"
            onClick={copyReport}
            disabled={loading || !all.length}
            title="Markdown, ready to paste into an issue"
          >
            <Icons.IconCopy size={14} /> {copied ? 'Copied' : 'Copy report'}
          </button>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <section className="diag-vitals" aria-label="Overview">
        <div className="diag-vital">
          <span className="diag-vital-label">Immich</span>
          <span className="diag-vital-val">
            <span
              className={`diag-dot diag-dot--${status ? (immichOk ? 'ok' : 'error') : 'unknown'}`}
            />
            {status ? (immichOk ? 'Connected' : 'Disconnected') : '—'}
          </span>
        </div>
        <div className="diag-vital">
          <span className="diag-vital-label">Config</span>
          <span className="diag-vital-val">
            <span
              className={`diag-dot diag-dot--${
                configState === 'valid' ? 'ok' : configState === 'invalid' ? 'error' : 'unknown'
              }`}
            />
            {configState === 'valid'
              ? 'Valid'
              : configState === 'invalid'
                ? 'Invalid'
                : configState === 'setup'
                  ? 'Not set up'
                  : '—'}
          </span>
        </div>
        <div className="diag-vital">
          <span className="diag-vital-label">Backups</span>
          <span className="diag-vital-val">{status?.backups?.count ?? '—'}</span>
          <span className="diag-vital-meta">
            {status?.backups?.lastBackup
              ? `latest ${new Date(status.backups.lastBackup).toLocaleDateString()}`
              : 'none yet'}
          </span>
        </div>
        <div className="diag-vital">
          <span className="diag-vital-label">Version</span>
          <span className="diag-vital-val">{status?.update?.current ?? '—'}</span>
          <span className="diag-vital-meta">
            {status?.update?.updateAvailable ? (
              <a
                href="https://github.com/ralksta/immich-folio/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
              >
                {status.update.latest} available
              </a>
            ) : status?.update?.current ? (
              'up to date'
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
                Needs attention
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
                  {group.title}
                </h3>
                <ul className="diag-checks">
                  {ok.map(renderFinding)}
                  {pendingAltText && (
                    <li className="diag-check diag-check--unknown">
                      <div className="diag-check-row">
                        <span className="diag-dot" aria-hidden="true" />
                        <div className="diag-check-body">
                          <span className="diag-check-title">Checking alt text…</span>
                          <span className="diag-check-detail">
                            Reading every published album; large libraries take a moment.
                          </span>
                        </div>
                      </div>
                    </li>
                  )}
                  {failedAltText && (
                    <li className="diag-check diag-check--unknown">
                      <div className="diag-check-row">
                        <span className="diag-dot" aria-hidden="true" />
                        <div className="diag-check-body">
                          <span className="diag-check-title">Alt text could not be checked</span>
                          <span className="diag-check-detail">
                            The albums did not load. If Immich is disconnected, that is the reason —
                            try again once it is back.
                          </span>
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
              Storage &amp; cache
            </h3>
            <ul className="diag-checks">
              <li className="diag-check diag-check--ok">
                <div className="diag-check-row">
                  <span className="diag-dot" aria-hidden="true" />
                  <div className="diag-check-body">
                    <span className="diag-check-title">
                      {status?.backups?.count ?? 0} config backups
                    </span>
                    <span className="diag-check-detail">
                      Written before every admin save, ten per file.
                    </span>
                  </div>
                  <div className="diag-check-side">
                    <button className="admin-btn admin-btn-sm" onClick={() => setShowBackups(true)}>
                      <Icons.IconArchive size={14} /> Manage backups
                    </button>
                  </div>
                </div>
              </li>
              <li className="diag-check diag-check--ok">
                <div className="diag-check-row">
                  <span className="diag-dot" aria-hidden="true" />
                  <div className="diag-check-body">
                    <span className="diag-check-title">
                      In-memory cache holds {status?.cache?.size ?? 0} items
                    </span>
                    <span className="diag-check-detail">
                      Album lists and photo metadata from Immich. Clearing it makes the next page
                      views slower, nothing else.
                    </span>
                  </div>
                  <div className="diag-check-side">
                    <button
                      className="admin-btn admin-btn-sm"
                      onClick={clearCache}
                      disabled={clearing}
                    >
                      <Icons.IconRefresh size={14} /> {clearing ? 'Clearing…' : 'Clear cache'}
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
