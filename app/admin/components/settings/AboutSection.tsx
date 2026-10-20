'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Icons from '../Icons';
import type { SaveStatus } from '../SaveBar';
import { useDraft, readDraft } from '../useDraft';
import { useContentRestored } from '../contentRestored';
import { useVersionedSave } from '../useVersionedSave';
import { useLatest } from '../useLatest';
import { useAdminDictionary } from '../AdminI18n';

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
  const dict = useAdminDictionary();
  const t = dict.settings.about;
  const editor = dict.settings.editor;
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
          res.status === 401 ? editor.sessionExpired : editor.serverAnswered(res.status),
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
        message: dict.common.errorWith(err instanceof Error ? err.message : t.loadFailed),
      });
    } finally {
      setAboutLoading(false);
    }
  }, [loadDraft, dict, t, editor]);

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
        'about',
      );
      if (result.kind === 'reload') {
        draft.discard();
        await loadAboutContent();
      } else if (result.kind === 'keep') {
        setAboutStatus({ kind: 'error', message: t.conflict });
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
          message: typeof data.message === 'string' ? data.message : editor.saved,
        });
        setTimeout(() => setAboutStatus(null), 4000);
      } else {
        setAboutStatus({
          kind: 'error',
          message: dict.common.errorWith(result.data?.error ?? `HTTP ${result.res.status}`),
        });
      }
    } catch {
      setAboutStatus({ kind: 'error', message: dict.common.errorWith(editor.saveFailed) });
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
  const t = useAdminDictionary().settings.about;
  return (
    <div className="settings-panel">
      <div className="settings-section-header">
        <h3>
          <Icons.IconCamera size={18} /> {t.title}
        </h3>
        <p className="settings-section-sub">{t.sub}</p>
      </div>

      {about.loading ? (
        <div className="admin-spinner" style={{ margin: '2rem auto' }} />
      ) : (
        <>
          <div className="admin-field">
            <label htmlFor="about-portrait-asset-id">{t.portrait}</label>
            <input
              id="about-portrait-asset-id"
              value={about.meta.portrait || ''}
              onChange={(e) => about.updateMeta('portrait', e.target.value)}
              placeholder={t.portraitPlaceholder}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="about-name">{t.name}</label>
            <input
              id="about-name"
              value={about.meta.name || ''}
              onChange={(e) => about.updateMeta('name', e.target.value)}
              placeholder={t.namePlaceholder}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="about-location">{t.location}</label>
            <input
              id="about-location"
              value={about.meta.location || ''}
              onChange={(e) => about.updateMeta('location', e.target.value)}
              placeholder={t.locationPlaceholder}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="about-gear">{t.gear}</label>
            <textarea
              id="about-gear"
              value={about.gearText}
              onChange={(e) => about.setGearText(e.target.value)}
              placeholder={`Leica Q3\nSummilux 35mm f/1.4`}
              rows={4}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="about-biography">{t.biography}</label>
            <textarea
              id="about-biography"
              value={about.body}
              onChange={(e) => about.setBody(e.target.value)}
              placeholder={t.biographyPlaceholder}
              rows={6}
            />
          </div>
        </>
      )}
    </div>
  );
}
