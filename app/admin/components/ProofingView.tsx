'use client';

/**
 * Admin → Proofing: client links, their selections and the export.
 *
 * One card per link. Creating a link picks a client name and an album — any
 * Immich album, published or not — plus optional expiry and download rights.
 * A card expands into the selected photos and the export buttons.
 */

import { useEffect, useMemo, useState } from 'react';
import PageHeader from './PageHeader';
import * as Icons from './Icons';
import { reportIfSessionExpired } from './sessionExpiry';
import { useAdminFetch } from './useAdminFetch';
import AdminLoadState from './AdminLoadState';
import type { AdminProofPick, AdminProofSession } from '@/lib/admin/proofing-view';
import { rich, useAdminDictionary } from './AdminI18n';

interface AlbumOption {
  id: string;
  albumName: string;
  assetCount: number;
}

type Download = AdminProofSession['download'];

/** In the order the download select offers them. */
const DOWNLOADS: Download[] = ['none', 'selection', 'album'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Changes; the loads go through useAdminFetch. */
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (reportIfSessionExpired(res)) throw new Error('Session expired');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const p = useAdminDictionary().visitors.proofing;
  const t = p.create;
  const albumsLoad = useAdminFetch<{ albums: AlbumOption[] }>('/api/admin/albums');
  const albums = useMemo(
    () =>
      albumsLoad.data &&
      [...albumsLoad.data.albums].sort((a, b) => a.albumName.localeCompare(b.albumName)),
    [albumsLoad.data],
  );
  const [clientName, setClientName] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [download, setDownload] = useState<Download>('none');
  const [limit, setLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/admin/proofing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          albumId,
          expiresOn: expiresOn || null,
          download,
          downloadLimit: download !== 'none' && limit ? Number(limit) : null,
        }),
      });
      setClientName('');
      setAlbumId('');
      setExpiresOn('');
      setDownload('none');
      setLimit('');
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="analytics-panel proofing-create" onSubmit={submit}>
      <div className="analytics-section-title">
        <h3>
          <Icons.IconPlus size={16} /> {t.title}
        </h3>
      </div>
      <div className="proofing-create-grid">
        <div className="admin-field">
          <label htmlFor="proof-client">{t.client}</label>
          <input
            id="proof-client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder={t.clientPlaceholder}
            maxLength={120}
            required
          />
        </div>
        <div className="admin-field">
          <label htmlFor="proof-album">{t.album}</label>
          <select
            id="proof-album"
            value={albumId}
            onChange={(e) => setAlbumId(e.target.value)}
            required
            disabled={!albums}
          >
            <option value="">{albums ? t.chooseAlbum : t.loadingAlbums}</option>
            {albums?.map((album) => (
              <option key={album.id} value={album.id}>
                {album.albumName} ({album.assetCount})
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="proof-expires">{t.validUntil}</label>
          <input
            id="proof-expires"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="proof-download">{t.downloads}</label>
          <select
            id="proof-download"
            value={download}
            onChange={(e) => setDownload(e.target.value as Download)}
          >
            {DOWNLOADS.map((key) => (
              <option key={key} value={key}>
                {p.downloads[key]}
              </option>
            ))}
          </select>
        </div>
        {download !== 'none' && (
          <div className="admin-field">
            <label htmlFor="proof-limit">{t.limit}</label>
            <input
              id="proof-limit"
              type="number"
              min={1}
              max={1000}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder={t.unlimited}
            />
          </div>
        )}
      </div>
      <AdminLoadState loading={false} error={albumsLoad.error} onRetry={albumsLoad.reload} />
      {error && <p className="admin-error">{error}</p>}
      <div>
        <button
          type="submit"
          className="admin-btn admin-btn-primary"
          disabled={busy || !clientName.trim() || !albumId}
        >
          <Icons.IconLink size={14} /> {busy ? t.creating : t.submit}
        </button>
      </div>
    </form>
  );
}

function SessionCard({
  session,
  expanded,
  onToggle,
  onChanged,
}: {
  session: AdminProofSession;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const p = useAdminDictionary().visitors.proofing;
  const t = p.card;
  // Fetched again when the client changes the selection or submits it.
  const picksLoad = useAdminFetch<{ picks: AdminProofPick[] }>(
    expanded ? `/api/admin/proofing/${session.id}` : null,
    `${session.selected}:${session.submittedAt}`,
  );
  const picks = picksLoad.data?.picks ?? null;
  const [copied, setCopied] = useState<'link' | 'lightroom' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const linkUrl = typeof window !== 'undefined' ? `${window.location.origin}${session.link}` : '';

  const copy = (kind: 'link' | 'lightroom', text: string) => {
    if (!navigator.clipboard) {
      window.prompt(t.copyPrompt, text);
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(kind);
        setTimeout(() => setCopied(null), 2000);
      },
      () => window.prompt(t.copyPrompt, text),
    );
  };

  const patch = async (body: Record<string, unknown>) => {
    setError(null);
    try {
      await api(`/api/admin/proofing/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async () => {
    if (!window.confirm(t.deleteConfirm(session.clientName))) {
      return;
    }
    try {
      await api(`/api/admin/proofing/${session.id}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const copyLightroom = async () => {
    try {
      const res = await fetch(`/api/admin/proofing/${session.id}/export?format=lightroom`);
      if (reportIfSessionExpired(res)) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      copy('lightroom', await res.text());
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const downloadsText =
    session.download === 'none'
      ? p.downloads.none
      : `${p.downloads[session.download]} · ${t.downloadsUsed(session.downloadsUsed, session.downloadLimit)}`;
  const summary = [
    session.albumName ?? t.albumMissing,
    t.selected(session.selected, session.albumAssetCount),
    t.created(formatDate(session.createdAt)),
    ...(session.expiresOn ? [t.validUntil(formatDate(session.expiresOn))] : []),
  ].join(' · ');

  return (
    <div className={`analytics-panel proofing-card proofing-card--${session.state}`}>
      <div className="proofing-card-head">
        <div>
          <h3 className="proofing-card-title">
            {session.clientName}
            <span className={`proofing-badge proofing-badge--${session.state}`}>
              {p.states[session.state]}
            </span>
          </h3>
          <p className="analytics-subtitle">{summary}</p>
          <p className="analytics-subtitle">
            {downloadsText}
            {session.submittedAt ? ` · ${t.submitted(formatDate(session.submittedAt))}` : ''}
          </p>
        </div>
        <div className="proofing-card-actions">
          <button
            type="button"
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => copy('link', linkUrl)}
          >
            {copied === 'link' ? <Icons.IconCheck size={14} /> : <Icons.IconCopy size={14} />}{' '}
            {copied === 'link' ? t.copied : t.copyLink}
          </button>
          <a
            className="admin-btn admin-btn-ghost admin-btn-sm"
            href={session.link}
            target="_blank"
            rel="noreferrer"
          >
            <Icons.IconEye size={14} /> {t.open}
          </a>
          <button
            type="button"
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={onToggle}
            aria-expanded={expanded}
          >
            {expanded ? <Icons.IconChevronUp size={14} /> : <Icons.IconChevronDown size={14} />}{' '}
            {t.selection}
          </button>
        </div>
      </div>

      {error && <p className="admin-error">{error}</p>}

      {expanded && (
        <div className="proofing-card-body">
          <div className="proofing-card-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary admin-btn-sm"
              onClick={copyLightroom}
              disabled={session.selected === 0}
              title={t.lightroomTitle}
            >
              {copied === 'lightroom' ? (
                <Icons.IconCheck size={14} />
              ) : (
                <Icons.IconCopy size={14} />
              )}{' '}
              {copied === 'lightroom' ? t.copied : t.copyLightroom}
            </button>
            <a
              className="admin-btn admin-btn-ghost admin-btn-sm"
              href={`/api/admin/proofing/${session.id}/export?format=csv`}
            >
              <Icons.IconFileText size={14} /> CSV
            </a>
            <a
              className="admin-btn admin-btn-ghost admin-btn-sm"
              href={`/api/admin/proofing/${session.id}/export?format=txt`}
            >
              <Icons.IconFileText size={14} /> TXT
            </a>
            {session.submittedAt && (
              <button
                type="button"
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => patch({ reopen: true })}
              >
                <Icons.IconRefresh size={14} /> {t.reopen}
              </button>
            )}
            {session.download !== 'none' && session.downloadsUsed > 0 && (
              <button
                type="button"
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => patch({ resetDownloads: true })}
              >
                <Icons.IconRefresh size={14} /> {t.resetDownloads}
              </button>
            )}
            <button
              type="button"
              className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon-danger"
              onClick={remove}
            >
              <Icons.IconTrash size={14} /> {t.deleteLink}
            </button>
          </div>

          {picksLoad.error ? (
            <AdminLoadState loading={false} error={picksLoad.error} onRetry={picksLoad.reload} />
          ) : picks === null ? (
            <div className="admin-spinner" />
          ) : picks.length === 0 ? (
            <p className="analytics-empty">{t.noPicks}</p>
          ) : (
            <ul className="proofing-picks">
              {picks.map((pick) => (
                <li key={pick.assetId} className="proofing-pick">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails, served by our own proxy */}
                  <img src={pick.thumbUrl} alt="" loading="lazy" />
                  <span className="proofing-pick-name" title={pick.fileName}>
                    #{pick.position} · {pick.fileName}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProofingView() {
  const v = useAdminDictionary().visitors;
  const t = v.proofing;
  const list = useAdminFetch<{ sessions: AdminProofSession[]; webhookConfigured: boolean }>(
    '/api/admin/proofing',
  );
  const sessions = list.data?.sessions ?? null;
  const webhookConfigured = list.data?.webhookConfigured ?? true;
  const load = list.reload;
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    // The webhook's admin link lands here with ?session=<id>: open that card.
    const wanted = new URLSearchParams(window.location.search).get('session');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on mount
    if (wanted) setExpanded(wanted);
  }, []);

  return (
    <div className="analytics-view proofing-view">
      <PageHeader
        kicker={v.kicker}
        title={t.title}
        description={t.description}
        actions={
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={load}>
            <Icons.IconRefresh size={14} /> {v.refresh}
          </button>
        }
      />

      {!webhookConfigured && (
        <p className="analytics-subtitle">
          {rich(t.webhookTip, { env: <code>PROOFING_WEBHOOK_URL</code> })}
        </p>
      )}

      <CreateForm onCreated={load} />

      <AdminLoadState
        loading={list.loading}
        error={list.error}
        onRetry={load}
        hasData={sessions !== null}
      />

      {sessions === null ? null : sessions.length === 0 ? (
        <p className="analytics-empty">{t.empty}</p>
      ) : (
        sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            expanded={expanded === session.id}
            onToggle={() => setExpanded((cur) => (cur === session.id ? null : session.id))}
            onChanged={load}
          />
        ))
      )}
    </div>
  );
}
