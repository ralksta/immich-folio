'use client';

/**
 * Editor for content/privacy.md (#699), in Settings → Legal.
 *
 * Folio writes no legal text. Next to the editor it lists what this
 * installation processes, read off the configuration, and "Insert headings"
 * adds the section headings that list implies, nothing more.
 *
 * Saves on its own, like the About page: the policy is a Markdown file, not a
 * key in settings.yaml.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Icons from './Icons';
import { reportIfSessionExpired } from './sessionExpiry';
import { useUnsavedGuard } from './useUnsavedGuard';
import { useContentRestored } from './contentRestored';
import { useVersionedSave } from './useVersionedSave';
import { useLatest } from './useLatest';
import { useDraft } from './useDraft';
import DraftNotice from './DraftNotice';
import type { ProcessingFact } from '@/lib/privacy';

interface PrivacyData {
  body: string;
  enabled: boolean;
  facts: ProcessingFact[];
  starter: string;
  version?: string;
}

type Status = { kind: 'success' | 'error'; message: string } | null;

export default function PrivacyEditor() {
  const [data, setData] = useState<PrivacyData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  useUnsavedGuard(dirty);
  // The editor lives in the Legal section and unmounts when another section
  // opens; without a draft an unsaved policy was simply gone (#554, #592).
  const draft = useDraft<string>('privacy', body, dirty);
  const loadDraft = draft.load;

  /** privacy.md as loaded, sent back on save so a change elsewhere is caught (#601). */
  const versionRef = useRef<string | null>(null);
  const versionedSave = useVersionedSave();
  /** The text as last rendered: tells a finished save whether typing went on meanwhile. */
  const latestBody = useLatest(body);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  });

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/admin/privacy');
      if (!res.ok) {
        reportIfSessionExpired(res);
        throw new Error(`HTTP ${res.status}`);
      }
      const d = (await res.json()) as PrivacyData;
      versionRef.current = d.version ?? null;
      setData(d);
      const restored = loadDraft(d.body);
      setBody(restored ?? d.body);
      setDirty(restored !== null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load.');
    }
  }, [loadDraft]);

  useEffect(() => {
    void load();
  }, [load]);

  // A restored privacy.md replaces what this editor shows — unless there are
  // unsaved edits, which stay; their save then meets the conflict prompt.
  useContentRestored(({ target }) => {
    if (target === 'privacy' && !dirtyRef.current) void load();
  });

  async function save() {
    setSaving(true);
    setStatus(null);
    const sent = body;
    try {
      const result = await versionedSave(
        '/api/admin/privacy',
        { body: sent },
        versionRef,
        'The privacy policy',
      );
      if (result.kind === 'reload') {
        draft.discard();
        await load();
        return;
      }
      if (result.kind === 'keep') {
        setStatus({ kind: 'error', message: 'Not saved — the policy changed elsewhere.' });
        return;
      }
      if (result.kind === 'failed') {
        if (!reportIfSessionExpired(result.res)) {
          setStatus({ kind: 'error', message: `Could not save (HTTP ${result.res.status}).` });
        }
        return;
      }
      // Typed while the request was out: that part is not saved yet.
      const editedMeanwhile = latestBody.current !== sent;
      setData((d) => (d ? { ...d, body: sent } : d));
      draft.saved(sent, editedMeanwhile);
      if (!editedMeanwhile) setDirty(false);
      setStatus({ kind: 'success', message: 'Privacy policy saved.' });
    } catch {
      setStatus({ kind: 'error', message: 'Could not reach the server.' });
    } finally {
      setSaving(false);
    }
  }

  function insertHeadings() {
    if (!data) return;
    setBody((b) => (b.trim() ? `${b.trimEnd()}\n\n${data.starter}\n` : `${data.starter}\n`));
    setDirty(true);
  }

  if (loadError) {
    // No editor over an unknown file: saving an empty one would erase the policy.
    return (
      <p className="admin-field-hint admin-field-hint--error">
        The privacy policy could not be loaded ({loadError}). Reload the page to try again.
      </p>
    );
  }
  if (!data) return <div className="admin-spinner" />;

  return (
    <div className="privacy-editor">
      <DraftNotice
        status={draft.status}
        subject="privacy policy"
        onDiscard={() => {
          draft.discard();
          setBody(data.body);
          setDirty(false);
          setStatus(null);
        }}
        onRestore={() => {
          const value = draft.takeConflicting();
          if (value === null) return;
          setBody(value);
          setDirty(true);
        }}
        onDismiss={draft.dismiss}
      />

      <div className="privacy-editor__facts">
        <h4>What this site processes</h4>
        <p className="admin-field-hint">
          Read off your current configuration. A checklist for writing the policy, not text for the
          page.
        </p>
        <ul>
          {data.facts.map((f) => (
            <li key={f.topic}>
              <strong>{f.topic}</strong>
              {f.thirdParty && <span className="privacy-editor__badge">third party</span>}
              <span>{f.detail}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-field">
        <label htmlFor="privacy-body">Privacy policy (Markdown)</label>
        <textarea
          id="privacy-body"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setDirty(true);
          }}
          rows={18}
          placeholder="## Controller&#10;&#10;Name, address, email…"
        />
        <p className="admin-field-hint">
          Headings with <code>##</code>, lists with <code>-</code>, <code>**bold**</code> and{' '}
          <code>[links](https://…)</code>. Shown at /privacy and linked in the footer once there is
          text. Earlier versions are kept under Backups.
        </p>
      </div>

      <div className="privacy-editor__actions">
        <button type="button" className="admin-btn admin-btn-ghost" onClick={insertHeadings}>
          <Icons.IconPlus size={14} /> Insert headings
        </button>
        {body.trim() && data.enabled && (
          <a
            className="admin-btn admin-btn-ghost"
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            View /privacy ↗
          </a>
        )}
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={save}
          disabled={!dirty || saving}
        >
          {saving ? 'Saving…' : 'Save privacy policy'}
        </button>
        {status && (
          <span className={`save-message ${status.kind}`} role="status">
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}
