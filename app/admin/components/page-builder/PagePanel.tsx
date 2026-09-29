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
  const confirm = useConfirm();
  const notify = useNotify();
  const [parsed, setParsed] = useState<ParsedJournal | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    setParsed(null);
    setLoadError(null);
    fetch(`/api/admin/pages/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) {
          reportIfSessionExpired(res);
          throw new Error(
            res.status === 404
              ? 'There is no file for this page in content/pages/.'
              : `The server answered ${res.status}.`,
          );
        }
        return res.json();
      })
      .then((data: { page: { rawMarkdown: string }; version?: string }) => {
        if (cancelled) return;
        versionRef.current = data.version ?? null;
        const p = parseJournalMarkdown(data.page.rawMarkdown);
        setParsed(p);
        setTitle(p.frontmatter.title || '');
        setSlugInput(slug);
        setDraft(!!p.frontmatter.draft);
        setPassword(p.frontmatter.password || undefined);
        setDescription(p.frontmatter.description || '');
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load.');
      });
    return () => {
      cancelled = true;
    };
  }, [slug, reloadKey]);

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
      ? `A page "${targetSlug}" already exists.`
      : (() => {
          const c = pageSlugCollision(targetSlug, taken);
          return c ? describeCollision(targetSlug, c) : null;
        })()
    : null;

  async function save() {
    if (!parsed || !dirty || collision || !title.trim()) return;
    if (renaming) {
      const ok = await confirm({
        title: `Move this page to /${targetSlug}?`,
        message: `Links to /${slug} will stop working. There is no automatic redirect.`,
        confirmLabel: 'Move page',
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
        'This page',
      );
      if (result.kind === 'reload') {
        setReloadKey((k) => k + 1);
        return;
      }
      if (result.kind === 'keep') {
        notify('error', 'Not saved — the page changed elsewhere. Your edits are still here.');
        return;
      }
      if (result.kind === 'failed') {
        if (!reportIfSessionExpired(result.res)) {
          notify('error', result.data?.error || 'Failed to save the page');
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
      const { title: t, description: d, password: pw, draft: dr } = written.frontmatter;
      onSaved(
        slug,
        {
          slug: data.page.slug,
          frontmatter: { title: t, description: d, password: pw, draft: dr },
        },
        data.menuRenamed === true,
        data.galleryVersion,
      );
      if (data.warning) notify('error', data.warning);
      else notify('success', 'Page saved.');
    } catch {
      notify('error', 'Could not save the page. Check the connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete “${title || slug}”?`,
      message: inMenu
        ? 'The page is also removed from the menu in gallery.yaml. Both files are backed up first and can be restored under Backups.'
        : 'A copy is kept and can be restored under Backups.',
      confirmLabel: 'Delete page',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/pages/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (!reportIfSessionExpired(res))
          notify('error', data?.error || 'Failed to delete the page');
        return;
      }
      onDeleted(slug, data?.removedFromMenu === true, data?.galleryVersion);
      if (typeof data?.warning === 'string') notify('error', data.warning);
      else notify('success', 'Page deleted.');
    } catch {
      notify('error', 'Could not delete the page. Check the connection and try again.');
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
          <strong>This page could not be loaded.</strong> {loadError}
          {inMenu && (
            <p>
              The menu still lists it. Switch off “Show in menu” and save the structure to remove
              the entry.
            </p>
          )}
        </div>
        {inMenu && (
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onToggleMenu}>
            Remove from menu
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
          title="Open the live page in a new tab"
        >
          /{slug} ↗
        </a>
      </div>

      <div className="admin-field">
        <label htmlFor="page-title">Title</label>
        <input id="page-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="admin-field">
        <label htmlFor="page-slug">URL</label>
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
          {collision
            ? collision
            : renaming
              ? `Links to /${slug} will stop working. There is no automatic redirect.`
              : 'Checked against subpages, albums, journal entries and built-in routes.'}
        </span>
      </div>

      <div className="page-panel-switches">
        <button type="button" className="setting-row" onClick={onToggleMenu} aria-pressed={inMenu}>
          <span className="setting-row-info">
            <span className="setting-row-title">Show in menu</span>
            <span className="setting-row-desc">
              {inMenu
                ? 'Listed in the header menu. Drag it in the structure list to move it.'
                : 'Not in the menu, but reachable at its URL — for pages shared by link.'}{' '}
              Saved with “Save Changes”.
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
            <span className="setting-row-title">Draft</span>
            <span className="setting-row-desc">
              Only you can see a draft. It stays out of the menu and the sitemap.
            </span>
          </span>
          <span className={`switch-toggle switch-toggle--sm ${draft ? 'on' : ''}`}>
            <span className="switch-slider" />
          </span>
        </button>
      </div>

      <div className="admin-field">
        <span className="admin-field-label">Password (optional)</span>
        <PasswordField value={password} onChange={setPassword} label="Page password" />
      </div>

      <div className="admin-field">
        <label htmlFor="page-description">SEO description</label>
        <textarea
          id="page-description"
          rows={2}
          value={description}
          placeholder="One or two sentences for search engines and link previews"
          onChange={(e) => setDescription(e.target.value.replace(/\s*\n\s*/g, ' '))}
        />
      </div>

      <div className="page-panel-actions">
        <Link href={`/admin/pages/edit/${slug}`} className="admin-btn admin-btn-secondary">
          Edit content →
        </Link>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={save}
          disabled={!dirty || saving || !!collision || !title.trim()}
        >
          {saving ? 'Saving…' : 'Save page'}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-danger"
          onClick={remove}
          style={{ marginLeft: 'auto' }}
        >
          <IconTrash size={14} /> Delete
        </button>
      </div>
    </section>
  );
}
