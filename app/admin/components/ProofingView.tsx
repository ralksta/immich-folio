'use client';

/**
 * Admin → Proofing: client links, their selections and the export.
 *
 * One card per link. Creating a link picks a client name and an album — any
 * Immich album, published or not — plus optional expiry and download rights.
 * A card expands into the selected photos and the export buttons.
 */

import { useCallback, useEffect, useState } from 'react';
import * as Icons from './Icons';
import { reportIfSessionExpired } from './sessionExpiry';
import type { AdminProofPick, AdminProofSession } from '@/lib/admin/proofing-view';

interface AlbumOption {
  id: string;
  albumName: string;
  assetCount: number;
}

type Download = AdminProofSession['download'];

const STATE_LABEL: Record<AdminProofSession['state'], string> = {
  open: 'Open',
  submitted: 'Submitted',
  expired: 'Expired',
};

const DOWNLOAD_LABEL: Record<Download, string> = {
  none: 'No downloads',
  selection: 'Selection as ZIP',
  album: 'Whole album as ZIP',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (reportIfSessionExpired(res)) throw new Error('Session expired');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [albums, setAlbums] = useState<AlbumOption[] | null>(null);
  const [clientName, setClientName] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [download, setDownload] = useState<Download>('none');
  const [limit, setLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ albums: AlbumOption[] }>('/api/admin/albums')
      .then((data) =>
        setAlbums([...data.albums].sort((a, b) => a.albumName.localeCompare(b.albumName))),
      )
      .catch((err: Error) => setError(err.message));
  }, []);

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
          <Icons.IconPlus size={16} /> New client link
        </h3>
      </div>
      <div className="proofing-create-grid">
        <div className="admin-field">
          <label htmlFor="proof-client">Client</label>
          <input
            id="proof-client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Anna & Ben"
            maxLength={120}
            required
          />
        </div>
        <div className="admin-field">
          <label htmlFor="proof-album">Album</label>
          <select
            id="proof-album"
            value={albumId}
            onChange={(e) => setAlbumId(e.target.value)}
            required
            disabled={!albums}
          >
            <option value="">{albums ? 'Choose an Immich album…' : 'Loading albums…'}</option>
            {albums?.map((album) => (
              <option key={album.id} value={album.id}>
                {album.albumName} ({album.assetCount})
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="proof-expires">Valid until (optional)</label>
          <input
            id="proof-expires"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="proof-download">Downloads</label>
          <select
            id="proof-download"
            value={download}
            onChange={(e) => setDownload(e.target.value as Download)}
          >
            {(Object.keys(DOWNLOAD_LABEL) as Download[]).map((key) => (
              <option key={key} value={key}>
                {DOWNLOAD_LABEL[key]}
              </option>
            ))}
          </select>
        </div>
        {download !== 'none' && (
          <div className="admin-field">
            <label htmlFor="proof-limit">Download limit (optional)</label>
            <input
              id="proof-limit"
              type="number"
              min={1}
              max={1000}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="Unlimited"
            />
          </div>
        )}
      </div>
      {error && <p className="admin-error">{error}</p>}
      <div>
        <button
          type="submit"
          className="admin-btn admin-btn-primary"
          disabled={busy || !clientName.trim() || !albumId}
        >
          <Icons.IconLink size={14} /> {busy ? 'Creating…' : 'Create link'}
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
  const [picks, setPicks] = useState<AdminProofPick[] | null>(null);
  const [copied, setCopied] = useState<'link' | 'lightroom' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const linkUrl = typeof window !== 'undefined' ? `${window.location.origin}${session.link}` : '';

  useEffect(() => {
    if (!expanded) return;
    api<{ picks: AdminProofPick[] }>(`/api/admin/proofing/${session.id}`)
      .then((data) => setPicks(data.picks))
      .catch((err: Error) => setError(err.message));
  }, [expanded, session.id, session.selected, session.submittedAt]);

  const copy = (kind: 'link' | 'lightroom', text: string) => {
    if (!navigator.clipboard) {
      window.prompt('Copy:', text);
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(kind);
        setTimeout(() => setCopied(null), 2000);
      },
      () => window.prompt('Copy:', text),
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
    if (!window.confirm(`Delete the link for ${session.clientName}? It stops working at once.`)) {
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
      ? DOWNLOAD_LABEL.none
      : `${DOWNLOAD_LABEL[session.download]} · ${session.downloadsUsed}${
          session.downloadLimit !== null ? ` / ${session.downloadLimit}` : ''
        } used`;

  return (
    <div className={`analytics-panel proofing-card proofing-card--${session.state}`}>
      <div className="proofing-card-head">
        <div>
          <h3 className="proofing-card-title">
            {session.clientName}
            <span className={`proofing-badge proofing-badge--${session.state}`}>
              {STATE_LABEL[session.state]}
            </span>
          </h3>
          <p className="analytics-subtitle">
            {session.albumName ?? 'Album not found in Immich'} · {session.selected}
            {session.albumAssetCount !== null ? ` of ${session.albumAssetCount}` : ''} selected ·
            created {formatDate(session.createdAt)}
            {session.expiresOn ? ` · valid until ${formatDate(session.expiresOn)}` : ''}
          </p>
          <p className="analytics-subtitle">
            {downloadsText}
            {session.submittedAt ? ` · submitted ${formatDate(session.submittedAt)}` : ''}
          </p>
        </div>
        <div className="proofing-card-actions">
          <button
            type="button"
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => copy('link', linkUrl)}
          >
            {copied === 'link' ? <Icons.IconCheck size={14} /> : <Icons.IconCopy size={14} />}{' '}
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </button>
          <a
            className="admin-btn admin-btn-ghost admin-btn-sm"
            href={session.link}
            target="_blank"
            rel="noreferrer"
          >
            <Icons.IconEye size={14} /> Open
          </a>
          <button
            type="button"
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={onToggle}
            aria-expanded={expanded}
          >
            {expanded ? <Icons.IconChevronUp size={14} /> : <Icons.IconChevronDown size={14} />}{' '}
            Selection
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
              title="File names without extension, comma-separated — paste into Lightroom's or Capture One's filename filter to find the RAW files too"
            >
              {copied === 'lightroom' ? (
                <Icons.IconCheck size={14} />
              ) : (
                <Icons.IconCopy size={14} />
              )}{' '}
              {copied === 'lightroom' ? 'Copied' : 'Copy file names (Lightroom)'}
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
                <Icons.IconRefresh size={14} /> Reopen for changes
              </button>
            )}
            {session.download !== 'none' && session.downloadsUsed > 0 && (
              <button
                type="button"
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => patch({ resetDownloads: true })}
              >
                <Icons.IconRefresh size={14} /> Reset downloads
              </button>
            )}
            <button
              type="button"
              className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon-danger"
              onClick={remove}
            >
              <Icons.IconTrash size={14} /> Delete link
            </button>
          </div>

          {picks === null ? (
            <div className="admin-spinner" />
          ) : picks.length === 0 ? (
            <p className="analytics-empty">No photos selected yet.</p>
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
  const [sessions, setSessions] = useState<AdminProofSession[] | null>(null);
  const [webhookConfigured, setWebhookConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ sessions: AdminProofSession[]; webhookConfigured: boolean }>(
        '/api/admin/proofing',
      );
      setSessions(data.sessions);
      setWebhookConfigured(data.webhookConfigured);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    // The webhook's admin link lands here with ?session=<id>: open that card.
    const wanted = new URLSearchParams(window.location.search).get('session');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on mount
    if (wanted) setExpanded(wanted);
    void load();
  }, [load]);

  return (
    <div className="analytics-view proofing-view">
      <div className="analytics-header">
        <div>
          <h2>
            <Icons.IconHeart size={20} /> Client Proofing
          </h2>
          <p className="analytics-subtitle">
            A private link per client. Picks are saved as they go; you see them here once they
            submit.
          </p>
        </div>
        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => void load()}>
          <Icons.IconRefresh size={14} /> Refresh
        </button>
      </div>

      {!webhookConfigured && (
        <p className="analytics-subtitle">
          Tip: set <code>PROOFING_WEBHOOK_URL</code> to be notified (Discord, Slack, Gotify, n8n, …)
          when a client submits.
        </p>
      )}

      <CreateForm onCreated={() => void load()} />

      {error && <p className="admin-error">{error}</p>}

      {sessions === null && !error ? (
        <div className="admin-loading-container">
          <div className="admin-spinner" />
        </div>
      ) : sessions && sessions.length === 0 ? (
        <p className="analytics-empty">No client links yet.</p>
      ) : (
        sessions?.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            expanded={expanded === session.id}
            onToggle={() => setExpanded((cur) => (cur === session.id ? null : session.id))}
            onChanged={() => void load()}
          />
        ))
      )}
    </div>
  );
}
