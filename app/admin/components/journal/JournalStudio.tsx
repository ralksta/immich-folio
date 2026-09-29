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

interface JournalStudioProps {
  /** Entry to open, taken from the /admin/journal/[slug] route. */
  slug?: string;
  /** `config.map`, passed by the server route: a map block renders only when the site has a map. */
  mapEnabled?: boolean;
}

export function JournalStudio({ slug: activeSlug, mapEnabled }: JournalStudioProps) {
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
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setSelectedTemplateId(null);
  };
  const createCardRef = useModalDialog(closeCreateModal, showCreateModal);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      const slug = sanitizeSlug(newSlug || newTitle);
      const template = selectedTemplateId
        ? JOURNAL_TEMPLATES.find((t) => t.id === selectedTemplateId)
        : undefined;
      const content = template
        ? serializeJournalMarkdown({
            frontmatter: {
              title: newTitle.trim(),
              date: new Date().toISOString().slice(0, 10),
              draft: true,
            },
            blocks: template.blocks,
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
        fetchEntries();
        if (data.entry?.slug) {
          router.push(`/admin/journal/${data.entry.slug}`);
        }
      } else {
        const data = await res.json();
        notify('error', data.error || 'Failed to create journal entry');
      }
    } catch {
      notify('error', 'Could not create the journal entry. Check the connection and try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (slug: string) => {
    const ok = await confirm({
      title: `Delete “${slug}”?`,
      message: 'A copy is kept and can be restored under Backups.',
      confirmLabel: 'Delete',
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
        notify('error', 'Failed to delete journal entry');
      }
    } catch {
      notify('error', 'Could not delete the journal entry. Check the connection and try again.');
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
        kicker="Content"
        title="Journal"
        description="Stories, field notes and longform photo essays, written with a live preview."
        actions={
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <IconPlus size={16} /> New Journal Entry
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
          <h3>No journal entries yet</h3>
          <p style={{ margin: '8px 0 1.5rem', fontSize: '0.9rem' }}>
            Create your first story to share travel journals or wedding reportages.
          </p>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <IconPlus size={16} /> Create First Entry
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
                    <IconClock size={12} /> {entry.readingTimeMinutes} min
                  </span>
                  {entry.frontmatter.draft ? (
                    <span className="journal-status-pill is-draft">Draft</span>
                  ) : (
                    <span className="journal-status-pill is-published">Published</span>
                  )}
                  {entry.frontmatter.password && (
                    <span>
                      <IconLock size={12} /> Password
                    </span>
                  )}
                </div>

                <div className="journal-admin-card-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-primary"
                    onClick={() => router.push(`/admin/journal/${entry.slug}`)}
                  >
                    Edit in Studio
                  </button>
                  <a
                    href={`/journal/${entry.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-btn admin-btn-sm admin-btn-secondary"
                    title="View live page"
                  >
                    <IconLink size={14} />
                  </a>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-danger"
                    onClick={() => handleDelete(entry.slug)}
                    title="Delete entry"
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
              Create New Journal Entry
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
                  Title
                </label>
                <input
                  id="journal-new-title"
                  type="text"
                  className="admin-input"
                  placeholder="e.g. Expedition Nordkap"
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
                  URL Slug
                </label>
                <input
                  id="journal-new-url-slug"
                  type="text"
                  className="admin-input"
                  placeholder="e.g. expedition-nordkap"
                  value={newSlug}
                  onChange={(e) => setNewSlug(slugFieldValue(e.target.value))}
                  required
                />
                <span
                  style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px', display: 'block' }}
                >
                  Will be accessible at /journal/{newSlug ? sanitizeSlug(newSlug) : 'slug'}
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
                  Start from
                </label>
                <div className="journal-template-grid">
                  <button
                    type="button"
                    className={`journal-template-card${selectedTemplateId === null ? ' is-selected' : ''}`}
                    onClick={() => setSelectedTemplateId(null)}
                  >
                    <span className="journal-template-card-name">Blank</span>
                    <span className="journal-template-card-desc">Start with an empty editor.</span>
                  </button>
                  {JOURNAL_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className={`journal-template-card${selectedTemplateId === template.id ? ' is-selected' : ''}`}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <span className="journal-template-card-name">{template.name}</span>
                      <span className="journal-template-card-desc">{template.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={closeCreateModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={creating || !newTitle.trim()}
                >
                  {creating ? 'Creating...' : 'Create & Open Studio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
