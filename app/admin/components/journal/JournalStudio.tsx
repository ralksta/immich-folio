'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { JournalEntrySummary } from '@/lib/journal';
import { serializeJournalMarkdown, sanitizeSlug, slugFieldValue } from '@/lib/journal';
import { JOURNAL_TEMPLATES } from '@/lib/journalTemplates';
import {
  IconTrash,
  IconLink,
  IconPlus,
  IconBook,
  IconClock,
  IconCalendar,
  IconLock,
} from '../Icons';
import './journal-studio.css';
import { JournalEditor } from './JournalEditor';
import { useNotify } from '../Notifications';
import { useAdminFetch } from '../useAdminFetch';
import { useContentRestored } from '../contentRestored';
import AdminLoadState from '../AdminLoadState';
import PageHeader from '../PageHeader';
import { useConfirm } from '../ConfirmDialog';
import { useModalDialog } from '@/hooks/useModalDialog';
import AlbumPicker from '../AlbumPicker';
import AssetPicker from '../AssetPicker';
import { useAdminDictionary } from '../AdminI18n';

interface SharedAlbum {
  id: string;
  albumName: string;
  description: string;
  thumbnailAssetId: string | null;
  assetCount: number;
  isConfigured: boolean;
  shared?: boolean;
}

interface JournalStudioProps {
  /** Entry to open, taken from the /admin/journal/[slug] route. */
  slug?: string;
  /** `config.map`, passed by the server route: a map block renders only when the site has a map. */
  mapEnabled?: boolean;
}

export function JournalStudio({ slug: activeSlug, mapEnabled }: JournalStudioProps) {
  const dict = useAdminDictionary();
  const t = dict.journal.studio;
  const tc = t.create;
  const templateText = dict.journal.templates;
  const confirm = useConfirm();
  const notify = useNotify();
  const router = useRouter();
  const list = useAdminFetch<{ entries?: JournalEntrySummary[] }>('/api/admin/journal');
  const entries = list.data?.entries ?? [];
  const fetchEntries = list.reload;

  // A restored entry may be one that was deleted, or have a new title.
  useContentRestored(({ target }) => {
    if (target === 'journal') fetchEntries();
  });

  // New Entry Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);
  /** null = start blank, matching the previous (only) behavior. */
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [createTab, setCreateTab] = useState<'start' | 'albums'>('start');
  const [albumList, setAlbumList] = useState<SharedAlbum[] | null>(null);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setSelectedTemplateId(null);
    setCreateTab('start');
    setSelectedAlbumId(null);
    setSelectedAssetIds([]);
    setShowAlbumPicker(false);
    setShowAssetPicker(false);
  };
  const createCardRef = useModalDialog(closeCreateModal, showCreateModal);

  const openAlbumPicker = async () => {
    if (albumList === null) {
      setLoadingAlbums(true);
      try {
        const res = await fetch('/api/admin/albums');
        if (!res.ok) throw new Error(`Immich returned ${res.status}`);
        const data = (await res.json()) as { albums?: SharedAlbum[] };
        setAlbumList(data.albums ?? []);
      } catch {
        notify('error', t.albumsError);
        return;
      } finally {
        setLoadingAlbums(false);
      }
    }
    setShowAlbumPicker(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      const slug = sanitizeSlug(newSlug || newTitle);
      const template = selectedTemplateId
        ? JOURNAL_TEMPLATES.find((tpl) => tpl.id === selectedTemplateId)
        : undefined;
      const selectedPhotoBlocks = selectedAssetIds.map((assetId) => ({
        type: 'photo' as const,
        assetId,
        layout: 'contained' as const,
      }));
      const content =
        template || selectedPhotoBlocks.length > 0
          ? serializeJournalMarkdown({
              frontmatter: {
                title: newTitle.trim(),
                date: new Date().toISOString().slice(0, 10),
                draft: true,
              },
              blocks: [...(template?.blocks ?? []), ...selectedPhotoBlocks],
              referencedAssetIds: [],
            })
          : undefined;

      const res = await fetch('/api/admin/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          slug,
          ...(content ? { content } : {}),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowCreateModal(false);
        setNewTitle('');
        setNewSlug('');
        setSelectedTemplateId(null);
        setCreateTab('start');
        setSelectedAlbumId(null);
        setSelectedAssetIds([]);
        fetchEntries();
        if (data.entry?.slug) {
          router.push(`/admin/journal/${data.entry.slug}`);
        }
      } else {
        const data = await res.json();
        notify('error', data.error || t.createFailed);
      }
    } catch {
      notify('error', t.createError);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (slug: string, title?: string) => {
    // Named by title, as the page delete is; the slug only when there is none.
    const ok = await confirm({
      title: t.deleteTitle(title || slug),
      message: t.deleteMessage,
      confirmLabel: t.deleteEntry,
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/journal/${slug}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchEntries();
        if (activeSlug === slug) router.push('/admin/journal');
      } else {
        notify('error', t.deleteFailed);
      }
    } catch {
      notify('error', t.deleteError);
    }
  };

  if (activeSlug) {
    return (
      <JournalEditor
        slug={activeSlug}
        mapEnabled={mapEnabled}
        onBack={() => router.push('/admin/journal')}
      />
    );
  }

  return (
    <div className="journal-studio">
      <PageHeader
        kicker={t.kicker}
        title={t.title}
        description={t.description}
        actions={
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <IconPlus size={16} /> {t.newEntry}
          </button>
        }
      />

      {(list.loading && !list.data) || list.error ? (
        <AdminLoadState
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          hasData={!!list.data}
        />
      ) : entries.length === 0 ? (
        <div style={{ padding: '5rem 2rem', textAlign: 'center', opacity: 0.6 }}>
          <h3>{t.emptyTitle}</h3>
          <p style={{ margin: '8px 0 1.5rem', fontSize: '0.9rem' }}>{t.emptyText}</p>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <IconPlus size={16} /> {t.createFirst}
          </button>
        </div>
      ) : (
        <div className="journal-list-grid">
          {entries.map((entry) => (
            <div key={entry.slug} className="journal-admin-card">
              <div className="journal-admin-card-cover">
                {entry.frontmatter.coverAssetId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/admin/thumbnail/${entry.frontmatter.coverAssetId}`}
                    alt={entry.frontmatter.title || entry.slug}
                  />
                ) : (
                  <IconBook size={36} className="svg-icon journal-card-cover-placeholder" />
                )}
              </div>
              <div className="journal-admin-card-body">
                <h3 className="journal-admin-card-title">
                  {entry.frontmatter.title || entry.slug}
                </h3>
                <div className="journal-admin-card-slug">/journal/{entry.slug}</div>

                <div className="journal-admin-card-meta">
                  {entry.frontmatter.date && (
                    <span>
                      <IconCalendar size={12} /> {entry.frontmatter.date}
                    </span>
                  )}
                  <span>
                    <IconClock size={12} /> {t.readingTime(entry.readingTimeMinutes)}
                  </span>
                  {entry.frontmatter.draft ? (
                    <span className="journal-status-pill is-draft">{t.draft}</span>
                  ) : (
                    <span className="journal-status-pill is-published">{t.published}</span>
                  )}
                  {entry.frontmatter.password && (
                    <span>
                      <IconLock size={12} /> {t.password}
                    </span>
                  )}
                </div>

                <div className="journal-admin-card-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-primary"
                    onClick={() => router.push(`/admin/journal/${entry.slug}`)}
                  >
                    {t.editInStudio}
                  </button>
                  <a
                    href={`/journal/${entry.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-btn admin-btn-sm admin-btn-secondary"
                    title={t.viewLive}
                  >
                    <IconLink size={14} />
                  </a>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-danger"
                    onClick={() => handleDelete(entry.slug, entry.frontmatter.title)}
                    title={t.deleteEntry}
                    style={{ marginLeft: 'auto' }}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="journal-modal-overlay">
          <div
            className="journal-modal-card"
            ref={createCardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-new-dialog-title"
          >
            <h3 id="journal-new-dialog-title" style={{ margin: '0 0 1rem' }}>
              {tc.title}
            </h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="journal-new-title"
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    marginBottom: '4px',
                    opacity: 0.8,
                  }}
                >
                  {tc.titleLabel}
                </label>
                <input
                  id="journal-new-title"
                  type="text"
                  className="admin-input"
                  placeholder={tc.titlePlaceholder}
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (!newSlug || newSlug === sanitizeSlug(newTitle)) {
                      setNewSlug(sanitizeSlug(e.target.value));
                    }
                  }}
                  autoFocus
                  required
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label
                  htmlFor="journal-new-url-slug"
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    marginBottom: '4px',
                    opacity: 0.8,
                  }}
                >
                  {tc.slugLabel}
                </label>
                <input
                  id="journal-new-url-slug"
                  type="text"
                  className="admin-input"
                  placeholder={tc.slugPlaceholder}
                  value={newSlug}
                  onChange={(e) => setNewSlug(slugFieldValue(e.target.value))}
                  required
                />
                <span
                  style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px', display: 'block' }}
                >
                  {tc.slugHint(newSlug ? sanitizeSlug(newSlug) : tc.slugFallback)}
                </span>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    marginBottom: '6px',
                    opacity: 0.8,
                  }}
                >
                  {tc.startFrom}
                </label>
                <div className="journal-create-tabs" role="group" aria-label={tc.startFromLabel}>
                  <button
                    type="button"
                    aria-pressed={createTab === 'start'}
                    className={`journal-create-tab${createTab === 'start' ? ' is-selected' : ''}`}
                    onClick={() => setCreateTab('start')}
                  >
                    {tc.tabTemplates}
                  </button>
                  <button
                    type="button"
                    aria-pressed={createTab === 'albums'}
                    className={`journal-create-tab${createTab === 'albums' ? ' is-selected' : ''}`}
                    onClick={() => setCreateTab('albums')}
                  >
                    {tc.tabAlbums}
                  </button>
                </div>
                {createTab === 'start' ? (
                  <div className="journal-template-grid">
                    <button
                      type="button"
                      className={`journal-template-card${selectedTemplateId === null ? ' is-selected' : ''}`}
                      onClick={() => setSelectedTemplateId(null)}
                    >
                      <span className="journal-template-card-name">{tc.blank}</span>
                      <span className="journal-template-card-desc">{tc.blankDescription}</span>
                    </button>
                    {JOURNAL_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        className={`journal-template-card${selectedTemplateId === template.id ? ' is-selected' : ''}`}
                        onClick={() => setSelectedTemplateId(template.id)}
                      >
                        <span className="journal-template-card-name">
                          {templateText[template.id as keyof typeof templateText]?.name ??
                            template.name}
                        </span>
                        <span className="journal-template-card-desc">
                          {templateText[template.id as keyof typeof templateText]?.description ??
                            template.description}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="journal-create-album-source">
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={openAlbumPicker}
                      disabled={loadingAlbums}
                    >
                      {loadingAlbums
                        ? tc.loadingAlbums
                        : selectedAlbumId
                          ? (albumList?.find((album) => album.id === selectedAlbumId)?.albumName ??
                            tc.changeAlbum)
                          : tc.selectAlbum}
                    </button>
                    {selectedAlbumId && (
                      <>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          onClick={() => setShowAssetPicker(true)}
                        >
                          {selectedAssetIds.length
                            ? tc.choosePhotosSelected(selectedAssetIds.length)
                            : tc.choosePhotos}
                        </button>
                        {selectedAssetIds.length > 0 && (
                          <div
                            className="journal-create-photo-selection"
                            aria-label={tc.selectedPhotos}
                          >
                            {selectedAssetIds.map((assetId) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={assetId}
                                src={`/api/admin/thumbnail/${encodeURIComponent(assetId)}`}
                                alt=""
                                loading="lazy"
                              />
                            ))}
                          </div>
                        )}
                        <p className="journal-template-card-desc">{tc.albumNote}</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={closeCreateModal}
                >
                  {dict.common.cancel}
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={creating || !newTitle.trim()}
                >
                  {creating ? tc.creating : tc.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showAlbumPicker && albumList && (
        <AlbumPicker
          albums={albumList}
          usedAlbumIds={new Set()}
          onSelect={(albumId) => {
            setSelectedAlbumId(albumId);
            setSelectedAssetIds([]);
            setShowAlbumPicker(false);
            setShowAssetPicker(true);
          }}
          onClose={() => setShowAlbumPicker(false)}
        />
      )}
      {showAssetPicker && selectedAlbumId && (
        <AssetPicker
          key={selectedAlbumId}
          title={tc.pickerTitle}
          albumId={selectedAlbumId}
          albumOnly
          onSelectMany={(assetIds) => {
            setSelectedAssetIds(assetIds);
            setShowAssetPicker(false);
          }}
          initialSelectedAssetIds={selectedAssetIds}
          onClose={() => setShowAssetPicker(false)}
        />
      )}
    </div>
  );
}
