'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Icons from '../Icons';
import type { SaveStatus } from '../SaveBar';
import { useDraft, readDraft } from '../useDraft';
import { useContentRestored } from '../contentRestored';
import { useVersionedSave } from '../useVersionedSave';
import { useLatest } from '../useLatest';

interface AboutMeta {
  portrait?: string;
  name?: string;
  location?: string;
  gear?: string[];
}

/** The About editor's state, as kept in a draft. */
interface AboutDraft {
  meta: AboutMeta;
  body: string;
  gearText: string;
}

/**
 * What a draft of the About page is compared against: the file's content, not
 * the textarea's. `gearText` is derived from `meta.gear` and would make a
 * trailing newline read as a change on disk.
 */
function aboutFingerprint(about: AboutDraft): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { gear: _gear, ...meta } = about.meta;
  const gear = about.gearText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return JSON.stringify({ meta, gear, body: about.body });
}

/**
 * The About page editor's state: content/about.md, loaded over its own
 * endpoint and saved on its own, but reached through the settings nav and
 * saved by the same save bar and ⌘S (#554).
 *
 * A hook rather than state inside the section, because the section unmounts
 * when another one is opened while an About edit is still unsaved, and the
 * save bar has to keep offering it.
 */
export function useAboutEditor(active: boolean) {
  const [aboutMeta, setAboutMeta] = useState<AboutMeta>({});
  const [aboutBody, setAboutBody] = useState('');
  const [aboutLoading, setAboutLoading] = useState(false);
  const [aboutLoaded, setAboutLoaded] = useState(false);
  const [aboutSaving, setAboutSaving] = useState(false);
  const [aboutDirty, setAboutDirty] = useState(false);
  const [aboutStatus, setAboutStatus] = useState<SaveStatus>(null);
  const [aboutGearText, setAboutGearText] = useState('');
  const [serverAbout, setServerAbout] = useState<AboutDraft | null>(null);
  /** The fields as last rendered: tell a finished save whether editing went on meanwhile. */
  const latest = useLatest({ meta: aboutMeta, body: aboutBody, gearText: aboutGearText });

  // Unsaved About edits survive a tab switch or Reload, like settings (#592).
  const draft = useDraft<AboutDraft>(
    'about',
    { meta: aboutMeta, body: aboutBody, gearText: aboutGearText },
    aboutDirty,
  );
  const loadDraft = draft.load;
  /** about.md as loaded, sent back on save so a change elsewhere is caught (#601). */
  const versionRef = useRef<string | null>(null);
  const versionedSave = useVersionedSave();

  const applyAbout = (value: AboutDraft) => {
    setAboutMeta(value.meta);
    setAboutBody(value.body);
    setAboutGearText(value.gearText);
  };

  const loadAboutContent = useCallback(async () => {
    setAboutLoading(true);
    setAboutStatus(null);
    try {
      const res = await fetch('/api/admin/about');
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? 'Your session has expired. Sign in again to continue.'
            : `The server answered ${res.status}.`,
        );
      }
      const data = await res.json();
      versionRef.current = typeof data.version === 'string' ? data.version : null;
      const loaded: AboutDraft = {
        meta: data.meta || {},
        body: data.body || '',
        gearText: data.meta?.gear?.join('\n') || '',
      };
      setServerAbout(loaded);
      const restored = loadDraft(aboutFingerprint(loaded));
      const value = restored ?? loaded;
      setAboutMeta(value.meta);
      setAboutBody(value.body);
      setAboutGearText(value.gearText);
      setAboutDirty(restored !== null);
      setAboutLoaded(true);
    } catch (err) {
      console.error('Failed to load about content:', err);
      // aboutLoaded stays false, which is what blocks the save below: an empty
      // editor written to about.md would replace the page with nothing.
      setAboutStatus({
        kind: 'error',
        message: `Error: ${err instanceof Error ? err.message : 'The About page could not be loaded.'}`,
      });
    } finally {
      setAboutLoading(false);
    }
  }, [loadDraft]);

  async function saveAboutContent() {
    if (!aboutLoaded) return;

    setAboutSaving(true);
    setAboutStatus(null);
    const cleanedMeta = { ...aboutMeta };
    for (const [k, v] of Object.entries(cleanedMeta)) {
      if (v === '' || v === undefined) delete cleanedMeta[k as keyof typeof cleanedMeta];
    }
    const gearLines = aboutGearText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (gearLines.length > 0) {
      cleanedMeta.gear = gearLines;
    } else {
      delete cleanedMeta.gear;
    }

    try {
      const result = await versionedSave(
        '/api/admin/about',
        { meta: cleanedMeta, body: aboutBody },
        versionRef,
        'The About page',
      );
      if (result.kind === 'reload') {
        draft.discard();
        await loadAboutContent();
      } else if (result.kind === 'keep') {
        setAboutStatus({ kind: 'error', message: 'Not saved — the About page changed elsewhere.' });
      } else if (result.kind === 'saved') {
        const data = result.data;
        const saved: AboutDraft = { meta: cleanedMeta, body: aboutBody, gearText: aboutGearText };
        // Edited while the request was out: those edits are not saved yet.
        const now = latest.current;
        const editedMeanwhile =
          now.meta !== aboutMeta || now.body !== aboutBody || now.gearText !== aboutGearText;
        setServerAbout(saved);
        draft.saved(aboutFingerprint(saved), editedMeanwhile);
        if (!editedMeanwhile) setAboutDirty(false);
        setAboutStatus({
          kind: 'success',
          message: typeof data.message === 'string' ? data.message : 'Saved!',
        });
        setTimeout(() => setAboutStatus(null), 4000);
      } else {
        setAboutStatus({
          kind: 'error',
          message: `Error: ${result.data?.error ?? `HTTP ${result.res.status}`}`,
        });
      }
    } catch {
      setAboutStatus({ kind: 'error', message: 'Error: Failed to save' });
    } finally {
      setAboutSaving(false);
    }
  }

  // Loaded the first time the About section opens, and only then: the editor
  // stays mounted across sections, so reloading on every visit would overwrite
  // unsaved About edits with the file on disk.
  useEffect(() => {
    if (active && !aboutLoaded) loadAboutContent();
  }, [active, aboutLoaded, loadAboutContent]);

  // A kept About draft loads the file at once, from any section, so the save
  // bar owns up to those edits before the About section is ever opened.
  useEffect(() => {
    if (!active && readDraft('about')) loadAboutContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A restored about.md replaces what this editor loaded.
  useContentRestored(({ target }) => {
    if (target === 'about' && aboutLoaded) loadAboutContent();
  });

  function updateAboutMeta(key: string, value: unknown) {
    setAboutMeta((m) => ({ ...m, [key]: value }));
    setAboutDirty(true);
    setAboutStatus(null);
  }

  return {
    meta: aboutMeta,
    body: aboutBody,
    gearText: aboutGearText,
    loading: aboutLoading,
    saving: aboutSaving,
    dirty: aboutDirty,
    status: aboutStatus as SaveStatus,
    updateMeta: updateAboutMeta,
    setBody: (value: string) => {
      setAboutBody(value);
      setAboutDirty(true);
      setAboutStatus(null);
    },
    setGearText: (value: string) => {
      setAboutGearText(value);
      setAboutDirty(true);
      setAboutStatus(null);
    },
    save: saveAboutContent,
    draftStatus: draft.status,
    dismissDraft: draft.dismiss,
    discardDraft: () => {
      draft.discard();
      if (serverAbout) applyAbout(serverAbout);
      setAboutDirty(false);
      setAboutStatus(null);
    },
    restoreDraft: () => {
      const value = draft.takeConflicting();
      if (!value) return;
      applyAbout(value);
      setAboutDirty(true);
    },
  };
}

export type AboutEditor = ReturnType<typeof useAboutEditor>;

export default function AboutSection({ about }: { about: AboutEditor }) {
  return (
    <div className="settings-panel">
      <div className="settings-section-header">
        <h3>
          <Icons.IconCamera size={18} /> About Page
        </h3>
        <p className="settings-section-sub">
          Edit the portrait, biography and gear shown on the About page. Use General to show or hide
          the page itself.
        </p>
      </div>

      {about.loading ? (
        <div className="admin-spinner" style={{ margin: '2rem auto' }} />
      ) : (
        <>
          <div className="admin-field">
            <label htmlFor="about-portrait-asset-id">Portrait Asset ID</label>
            <input
              id="about-portrait-asset-id"
              value={about.meta.portrait || ''}
              onChange={(e) => about.updateMeta('portrait', e.target.value)}
              placeholder="Immich asset UUID for the portrait photo"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="about-name">Name</label>
            <input
              id="about-name"
              value={about.meta.name || ''}
              onChange={(e) => about.updateMeta('name', e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="about-location">Location</label>
            <input
              id="about-location"
              value={about.meta.location || ''}
              onChange={(e) => about.updateMeta('location', e.target.value)}
              placeholder="City, Country"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="about-gear">Gear (one per line)</label>
            <textarea
              id="about-gear"
              value={about.gearText}
              onChange={(e) => about.setGearText(e.target.value)}
              placeholder={`Leica Q3\nSummilux 35mm f/1.4`}
              rows={4}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="about-biography">Biography (Markdown)</label>
            <textarea
              id="about-biography"
              value={about.body}
              onChange={(e) => about.setBody(e.target.value)}
              placeholder="Photographer based in..."
              rows={6}
            />
          </div>
        </>
      )}
    </div>
  );
}
