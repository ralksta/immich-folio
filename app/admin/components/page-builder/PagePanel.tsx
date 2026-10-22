'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  parseJournalMarkdown,
  sanitizeSlug,
  serializeJournalMarkdown,
  slugFieldValue,
  type ParsedJournal,
} from '@/lib/journal';
import {
  describeCollision,
  pageSlugCollision,
  type PageSummary,
  type SlugTakenBy,
} from '@/lib/pages';
import PasswordField from '../fields/PasswordField';
import { IconFileText, IconTrash } from '../Icons';
import { useConfirm } from '../ConfirmDialog';
import { useNotify } from '../Notifications';
import { reportIfSessionExpired } from '../sessionExpiry';
import { useVersionedSave } from '../useVersionedSave';
import type { GalleryVersionChange } from '@/lib/admin/pageRefs';
import { useAdminDictionary } from '../AdminI18n';
import { adminGet } from '../useAdminFetch';

interface PagePanelProps {
  slug: string;
  /** Whether gallery.yaml (as edited in the builder) lists the page. */
  inMenu: boolean;
  onToggleMenu: () => void;
  /** Slugs a page may not take. */
  taken: SlugTakenBy;
  /** The other pages' slugs, which a rename must not take either. */
  otherPageSlugs: string[];
  /**
   * `galleryVersion` is set when the server rewrote gallery.yaml's menu, so
   * the builder can follow that change without mistaking it for a foreign
   * edit (#601).
   */
  onSaved: (
    oldSlug: string,
    page: PageSummary,
    menuRenamed: boolean,
    galleryVersion?: GalleryVersionChange | null,
  ) => void;
  onDeleted: (
    slug: string,
    removedFromMenu: boolean,
    galleryVersion?: GalleryVersionChange | null,
  ) => void;
}

/**
 * A content page selected in the structure list (#722): its settings, saved
 * to content/pages/<slug>.md with the panel's own button. "Show in menu" is
 * the one exception — it edits gallery.yaml, so it goes with the builder's
 * Save like every other change to the menu.
 */
export default function PagePanel({
  slug,
  inMenu,
  onToggleMenu,
  taken,
  otherPageSlugs,
  onSaved,
  onDeleted,
}: PagePanelProps) {
  const dict = useAdminDictionary();
  const t = dict.pages.pagePanel;
  const confirm = useConfirm();
  const notify = useNotify();
  const [parsedState, setParsed] = useState<ParsedJournal | null>(null);
  const [loadErrorState, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [slugInput, setSlugInput] = useState(slug);
  const [draft, setDraft] = useState(false);
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  /** The page file as loaded, sent back on save (#601). */
  const versionRef = useRef<string | null>(null);
  const versionedSave = useVersionedSave();
  /** Bumped to load the file again — "Reload" in the conflict prompt. */
  const [reloadKey, setReloadKey] = useState(0);

  // What was loaded belongs to one slug and reload: until that one answers,
  // the panel shows neither the previous page nor its error.
  const loadKey = `${reloadKey}:${slug}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const current = loadedKey === loadKey;
  const parsed = current ? parsedState : null;
  const loadError = current ? loadErrorState : null;

  useEffect(() => {
    let cancelled = false;
    adminGet<{ page: { rawMarkdown: string }; version?: string }>(
      `/api/admin/pages/${encodeURIComponent(slug)}`,
      dict.shell,
    ).then((r) => {
      if (cancelled) return;
      setLoadedKey(loadKey);
      if (r.error !== null) {
        setParsed(null);
        setLoadError(r.status === 404 ? t.noFile : r.error);
        return;
      }
      setLoadError(null);
      const data = r.data;
      versionRef.current = data.version ?? null;
      const p = parseJournalMarkdown(data.page.rawMarkdown);
      setParsed(p);
      setTitle(p.frontmatter.title || '');
      setSlugInput(slug);
      setDraft(!!p.frontmatter.draft);
      setPassword(p.frontmatter.password || undefined);
      setDescription(p.frontmatter.description || '');
    });
    return () => {
      cancelled = true;
    };
    // `t` only words the error; a language switch need not reload the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  // The field keeps what is typed, a trailing "-" included; the page moves to
  // the finished slug.
  const targetSlug = slugInput ? sanitizeSlug(slugInput) : '';

  const fm = parsed?.frontmatter;
  const dirty =
    !!fm &&
    (title !== (fm.title || '') ||
      targetSlug !== slug ||
      draft !== !!fm.draft ||
      (password || '') !== (fm.password || '') ||
      description !== (fm.description || ''));

  const renaming = targetSlug !== slug;
  const collision = renaming
    ? otherPageSlugs.includes(targetSlug)
      ? t.exists(targetSlug)
      : (() => {
          const c = pageSlugCollision(targetSlug, taken);
          return c ? describeCollision(targetSlug, c, dict.pages.collision) : null;
        })()
    : null;

  async function save() {
    if (!parsed || !dirty || collision || !title.trim()) return;
    if (renaming) {
      const ok = await confirm({
        title: t.moveTitle(targetSlug),
        message: t.linksBreak(slug),
        confirmLabel: t.movePage,
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const markdown = serializeJournalMarkdown({
        ...parsed,
        frontmatter: {
          ...parsed.frontmatter,
          title: title.trim(),
          draft: draft || undefined,
          password: password || undefined,
          description: description.trim() || undefined,
        },
      });
      const result = await versionedSave(
        `/api/admin/pages/${encodeURIComponent(slug)}`,
        { rawMarkdown: markdown, ...(renaming ? { newSlug: targetSlug } : {}) },
        versionRef,
        'page',
      );
      if (result.kind === 'reload') {
        setReloadKey((k) => k + 1);
        return;
      }
      if (result.kind === 'keep') {
        notify('error', t.notSavedConflict);
        return;
      }
      if (result.kind === 'failed') {
        if (!reportIfSessionExpired(result.res)) {
          notify('error', result.data?.error || t.saveFailed);
        }
        return;
      }
      const data = result.data as {
        page: { slug: string; rawMarkdown: string };
        menuRenamed?: boolean;
        galleryVersion?: GalleryVersionChange | null;
        /** The page was saved, but its menu entry in gallery.yaml was not updated. */
        warning?: string;
      };
      const written = parseJournalMarkdown(data.page.rawMarkdown);
      setParsed(written);
      setPassword(written.frontmatter.password || undefined);
      const { title: ti, description: d, password: pw, draft: dr } = written.frontmatter;
      onSaved(
        slug,
        {
          slug: data.page.slug,
          frontmatter: { title: ti, description: d, password: pw, draft: dr },
        },
        data.menuRenamed === true,
        data.galleryVersion,
      );
      if (data.warning) notify('error', data.warning);
      else notify('success', t.saved);
    } catch {
      notify('error', t.saveOffline);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: t.deleteTitle(title || slug),
      message: inMenu ? t.deleteMessageInMenu : t.deleteMessage,
      confirmLabel: t.deletePage,
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/pages/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (!reportIfSessionExpired(res)) notify('error', data?.error || t.deleteFailed);
        return;
      }
      onDeleted(slug, data?.removedFromMenu === true, data?.galleryVersion);
      if (typeof data?.warning === 'string') notify('error', data.warning);
      else notify('success', t.deleted);
    } catch {
      notify('error', t.deleteOffline);
    }
  }

  if (loadError) {
    return (
      <section className="builder-section">
        <div className="builder-section-header">
          <h2>
            <IconFileText /> /{slug}
          </h2>
        </div>
        <div className="admin-error" role="alert">
          <strong>{t.loadFailed}</strong> {loadError}
          {inMenu && <p>{t.menuStillLists}</p>}
        </div>
        {inMenu && (
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onToggleMenu}>
            {t.removeFromMenu}
          </button>
        )}
      </section>
    );
  }

  if (!parsed) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
      </div>
    );
  }

  return (
    <section className="builder-section page-panel">
      <div className="builder-section-header">
        <h2>
          <IconFileText /> {fm?.title || slug}
        </h2>
        <a
          href={`/${encodeURIComponent(slug)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="admin-btn admin-btn-xs admin-btn-ghost"
          title={t.openLive}
        >
          /{slug} ↗
        </a>
      </div>

      <div className="admin-field">
        <label htmlFor="page-title">{t.title}</label>
        <input id="page-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="admin-field">
        <label htmlFor="page-slug">{t.url}</label>
        <div className="input-slug-wrapper">
          <input
            id="page-slug"
            className="subpage-name-input"
            value={slugInput}
            onChange={(e) => setSlugInput(slugFieldValue(e.target.value))}
            aria-describedby="page-slug-hint"
          />
          <span className="input-slug-preview">/{targetSlug}</span>
        </div>
        <span
          id="page-slug-hint"
          className={`admin-field-hint${collision ? ' admin-field-hint--error' : renaming ? ' admin-field-hint--warn' : ''}`}
        >
          {collision ? collision : renaming ? t.linksBreak(slug) : t.slugHint}
        </span>
      </div>

      <div className="page-panel-switches">
        <button type="button" className="setting-row" onClick={onToggleMenu} aria-pressed={inMenu}>
          <span className="setting-row-info">
            <span className="setting-row-title">{t.showInMenu}</span>
            <span className="setting-row-desc">
              {inMenu ? t.inMenuDesc : t.offMenuDesc} {t.savedWithStructure}
            </span>
          </span>
          <span className={`switch-toggle switch-toggle--sm ${inMenu ? 'on' : ''}`}>
            <span className="switch-slider" />
          </span>
        </button>

        <button
          type="button"
          className="setting-row"
          onClick={() => setDraft(!draft)}
          aria-pressed={draft}
        >
          <span className="setting-row-info">
            <span className="setting-row-title">{t.draft}</span>
            <span className="setting-row-desc">{t.draftDesc}</span>
          </span>
          <span className={`switch-toggle switch-toggle--sm ${draft ? 'on' : ''}`}>
            <span className="switch-slider" />
          </span>
        </button>
      </div>

      <div className="admin-field">
        <span className="admin-field-label">{t.password}</span>
        <PasswordField value={password} onChange={setPassword} label={t.pagePassword} />
      </div>

      <div className="admin-field">
        <label htmlFor="page-description">{t.seoDescription}</label>
        <textarea
          id="page-description"
          rows={2}
          value={description}
          placeholder={t.seoPlaceholder}
          onChange={(e) => setDescription(e.target.value.replace(/\s*\n\s*/g, ' '))}
        />
      </div>

      <div className="page-panel-actions">
        <Link href={`/admin/pages/edit/${slug}`} className="admin-btn admin-btn-secondary">
          {t.editContent}
        </Link>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={save}
          disabled={!dirty || saving || !!collision || !title.trim()}
        >
          {saving ? dict.common.saving : t.savePage}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-danger"
          onClick={remove}
          style={{ marginLeft: 'auto' }}
        >
          <IconTrash size={14} /> {dict.common.delete}
        </button>
      </div>
    </section>
  );
}
