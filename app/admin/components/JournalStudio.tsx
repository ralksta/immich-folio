'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { JournalEntrySummary, ParsedJournal, JournalBlock } from '@/lib/journal';
import { parseJournalMarkdown, serializeJournalMarkdown, sanitizeSlug } from '@/lib/journal';
import {
  IconFileText,
  IconSparkles,
  IconQuote,
  IconCamera,
  IconArrowLeftRight,
  IconTrash,
  IconChevronUp,
  IconChevronDown,
  IconGear,
  IconLink,
  IconPlus,
  IconBook,
  IconEye,
  IconClock,
  IconCalendar,
  IconLock,
  IconCheck,
} from './Icons';
import AssetPicker from './AssetPicker';
import { BlockBadge } from './BlockBadge';
import { EssayView } from '@/app/[...path]/EssayView';
import type { PhotoItem } from '@/app/[...path]/PhotoGrid';
import './journal-studio.css';

interface JournalStudioProps {
  /** Entry to open, taken from the /admin/journal/[slug] route. */
  slug?: string;
}

export function JournalStudio({ slug: activeSlug }: JournalStudioProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Entry Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/journal');
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      } else {
        setError('Failed to load journal entries');
      }
    } catch {
      setError('Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      const slug = sanitizeSlug(newSlug || newTitle);
      const res = await fetch('/api/admin/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          slug,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowCreateModal(false);
        setNewTitle('');
        setNewSlug('');
        await fetchEntries();
        if (data.entry?.slug) {
          router.push(`/admin/journal/${data.entry.slug}`);
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create journal entry');
      }
    } catch {
      alert('Error creating journal entry');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!confirm(`Are you sure you want to delete "${slug}"?`)) return;

    try {
      const res = await fetch(`/api/admin/journal/${slug}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchEntries();
        if (activeSlug === slug) router.push('/admin/journal');
      } else {
        alert('Failed to delete journal entry');
      }
    } catch {
      alert('Error deleting journal entry');
    }
  };

  if (activeSlug) {
    return <JournalEditor slug={activeSlug} onBack={() => router.push('/admin/journal')} />;
  }

  return (
    <div className="journal-studio">
      <div className="journal-studio-header">
        <div>
          <h2>
            <IconBook size={20} /> Journal &amp; Photo Essays
          </h2>
          <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: '0.9rem' }}>
            Author visual stories, field notes, and longform photo essays with live preview.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <IconPlus size={16} /> New Journal Entry
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.6 }}>
          Loading journal entries...
        </div>
      ) : error ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>{error}</div>
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
          <div className="journal-modal-card">
            <h3 style={{ margin: '0 0 1rem' }}>Create New Journal Entry</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label
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
                  type="text"
                  className="admin-input"
                  placeholder="e.g. expedition-nordkap"
                  value={newSlug}
                  onChange={(e) => setNewSlug(sanitizeSlug(e.target.value))}
                  required
                />
                <span
                  style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px', display: 'block' }}
                >
                  Will be accessible at /journal/{newSlug || 'slug'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
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

// ── Studio Editor Component ──────────────────────────────────────────

interface JournalEditorProps {
  slug: string;
  onBack: () => void;
}

/**
 * Photo blocks may carry a legacy positional reference ("1", "2") instead of an
 * asset UUID. Those only ever resolved against a subpage's album; on a
 * standalone journal page there is no album, so the photo silently disappears.
 * Flag them in the editor so the author can re-pick before publishing.
 */
const ASSET_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isLegacyAssetRef(assetId: string): boolean {
  return assetId.length > 0 && !ASSET_UUID.test(assetId);
}

/** Width of the authoring pane, in percent of the split view. */
const SPLIT_STORAGE_KEY = 'folio-journal-split';
const SPLIT_MIN = 25;
const SPLIT_MAX = 70;
const SPLIT_DEFAULT = 46;

function JournalEditor({ slug, onBack }: JournalEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editorMode, setEditorMode] = useState<'blocks' | 'markdown'>('blocks');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');

  // Draggable divider between authoring pane and preview.
  const splitRef = useRef<HTMLDivElement>(null);
  const [splitPct, setSplitPct] = useState(SPLIT_DEFAULT);
  const [dragging, setDragging] = useState(false);

  // Restore the last width after mount (localStorage is unavailable on the server).
  useEffect(() => {
    const stored = Number(window.localStorage.getItem(SPLIT_STORAGE_KEY));
    if (stored >= SPLIT_MIN && stored <= SPLIT_MAX) setSplitPct(stored);
  }, []);

  const applySplit = useCallback((clientX: number) => {
    const rect = splitRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplitPct(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct)));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      applySplit(e.clientX);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, applySplit]);

  // Persist once the drag ends, not on every pixel.
  useEffect(() => {
    if (dragging) return;
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(Math.round(splitPct)));
  }, [dragging, splitPct]);

  // Keyboard access for the divider: arrows nudge, Home resets.
  const handleSplitKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSplitPct((p) => Math.max(SPLIT_MIN, p - step));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSplitPct((p) => Math.min(SPLIT_MAX, p + step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSplitPct(SPLIT_DEFAULT);
    }
  };

  const [rawMarkdown, setRawMarkdown] = useState('');
  const [parsed, setParsed] = useState<ParsedJournal>(() => ({
    frontmatter: {},
    blocks: [],
    referencedAssetIds: [],
  }));

  // Settings / Metadata Modal
  const [showMetaModal, setShowMetaModal] = useState(false);

  /** Real width/height ratios of the referenced photos, measured from thumbnails. */
  const [assetRatios, setAssetRatios] = useState<Record<string, number>>({});

  // Asset Picker State
  const [assetPickerTarget, setAssetPickerTarget] = useState<{
    onSelect: (assetId: string) => void;
    title: string;
  } | null>(null);

  // Load entry
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/journal/${slug}`);
        if (res.ok) {
          const data = await res.json();
          const md = data.entry.rawMarkdown;
          setRawMarkdown(md);
          setParsed(parseJournalMarkdown(md));
          setDirty(false);
        } else {
          alert('Failed to load journal entry');
        }
      } catch {
        alert('Error loading journal entry');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  // Update markdown and sync blocks
  const handleMarkdownChange = (newMd: string) => {
    setRawMarkdown(newMd);
    setParsed(parseJournalMarkdown(newMd));
    setDirty(true);
  };

  // Update structured blocks and sync markdown
  const handleBlocksChange = (newBlocks: JournalBlock[]) => {
    const updated: ParsedJournal = {
      ...parsed,
      blocks: newBlocks,
      referencedAssetIds: Array.from(
        new Set(
          newBlocks.flatMap((b) => {
            if (b.type === 'photo') return [b.assetId];
            if (b.type === 'photo-pair') return b.assetIds;
            return [];
          }),
        ),
      ),
    };
    const serialized = serializeJournalMarkdown(updated);
    setParsed(updated);
    setRawMarkdown(serialized);
    setDirty(true);
  };

  // Update frontmatter
  const handleFrontmatterChange = (updates: Partial<ParsedJournal['frontmatter']>) => {
    const updated: ParsedJournal = {
      ...parsed,
      frontmatter: {
        ...parsed.frontmatter,
        ...updates,
      },
    };
    const serialized = serializeJournalMarkdown(updated);
    setParsed(updated);
    setRawMarkdown(serialized);
    setDirty(true);
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/journal/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawMarkdown,
        }),
      });

      if (res.ok) {
        setDirty(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save');
      }
    } catch {
      alert('Error saving entry');
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut: Cmd+S / Ctrl+S
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * The preview used to hard-code 3:2 for every photo, so the studio showed a
   * cropped, uniform grid while the published page laid the photos out by their
   * real proportions. There is no admin endpoint that reports asset dimensions,
   * so the thumbnails are measured once as they load.
   */
  const measuredRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    for (const id of parsed.referencedAssetIds) {
      if (!id || measuredRef.current.has(id)) continue;
      measuredRef.current.add(id);

      const probe = new window.Image();
      probe.onload = () => {
        if (cancelled || !probe.naturalHeight) return;
        setAssetRatios((prev) => ({
          ...prev,
          [id]: probe.naturalWidth / probe.naturalHeight,
        }));
      };
      probe.onerror = () => {
        // Unresolvable reference — keep the fallback ratio, the block editor
        // already flags it.
        measuredRef.current.delete(id);
      };
      probe.src = `/api/admin/thumbnail/${id}`;
    }
    return () => {
      cancelled = true;
    };
  }, [parsed.referencedAssetIds]);

  // Block manipulation
  const handleAddBlock = (type: JournalBlock['type']) => {
    let newBlock: JournalBlock;
    switch (type) {
      case 'heading':
        newBlock = { type: 'heading', level: 2, text: 'New Heading' };
        break;
      case 'paragraph':
        newBlock = { type: 'paragraph', html: 'Enter paragraph text here...' };
        break;
      case 'quote':
        newBlock = { type: 'quote', text: 'Enter quote text...', author: '' };
        break;
      case 'photo':
        newBlock = { type: 'photo', assetId: '', caption: '', layout: 'contained' };
        break;
      case 'photo-pair':
        newBlock = { type: 'photo-pair', assetIds: ['', ''], caption: '' };
        break;
    }
    handleBlocksChange([...parsed.blocks, newBlock]);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= parsed.blocks.length) return;
    const blocks = [...parsed.blocks];
    const [moved] = blocks.splice(index, 1);
    blocks.splice(target, 0, moved);
    handleBlocksChange(blocks);
  };

  const handleDeleteBlock = (index: number) => {
    handleBlocksChange(parsed.blocks.filter((_, i) => i !== index));
  };

  const handleUpdateBlock = (index: number, updated: JournalBlock) => {
    const blocks = [...parsed.blocks];
    blocks[index] = updated;
    handleBlocksChange(blocks);
  };

  // Mock PhotoItems for preview
  const previewAssets: PhotoItem[] = parsed.referencedAssetIds.map((id) => ({
    id,
    type: 'image',
    thumbUrl: `/api/admin/thumbnail/${id}`,
    previewUrl: `/api/admin/thumbnail/${id}`,
    exifUrl: `/api/exif/${id}`,
    // Falls back to 3:2 only until the real ratio has been measured.
    aspectRatio: assetRatios[id] ?? 1.5,
  }));

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.6 }}>
        Opening Journal Studio...
      </div>
    );
  }

  return (
    <div className="journal-editor-container">
      {/* Top Bar */}
      <div className="journal-editor-topbar">
        <div className="journal-editor-topbar-left">
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-secondary"
            onClick={onBack}
          >
            ← All Entries
          </button>

          <input
            type="text"
            className="journal-editor-title-input"
            value={parsed.frontmatter.title || ''}
            placeholder="Story Title..."
            onChange={(e) => handleFrontmatterChange({ title: e.target.value })}
          />

          <div
            style={{
              display: 'flex',
              gap: '4px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '6px',
              padding: '2px',
            }}
          >
            <button
              type="button"
              className={`admin-btn admin-btn-xs ${editorMode === 'blocks' ? 'admin-btn-primary' : ''}`}
              onClick={() => setEditorMode('blocks')}
            >
              Visual Blocks
            </button>
            <button
              type="button"
              className={`admin-btn admin-btn-xs ${editorMode === 'markdown' ? 'admin-btn-primary' : ''}`}
              onClick={() => setEditorMode('markdown')}
            >
              Raw Markdown
            </button>
          </div>
        </div>

        <div className="journal-editor-topbar-right">
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-secondary"
            onClick={() => setShowMetaModal(true)}
          >
            <IconGear size={14} /> Story Settings
          </button>

          <a
            href={`/journal/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn-sm admin-btn-secondary"
          >
            <IconLink size={14} /> Live
          </a>

          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              'Saving...'
            ) : dirty ? (
              'Save Changes'
            ) : (
              <>
                <IconCheck size={14} /> Saved
              </>
            )}
          </button>
        </div>
      </div>

      {/* Split Screen */}
      <div
        className={`journal-editor-split${dragging ? ' is-dragging' : ''}`}
        ref={splitRef}
        style={{ ['--journal-split-left' as string]: `${splitPct}%` }}
      >
        {/* Left: Authoring Pane */}
        <div className="journal-editor-pane-left">
          {editorMode === 'markdown' ? (
            <textarea
              className="journal-raw-markdown-editor"
              value={rawMarkdown}
              onChange={(e) => handleMarkdownChange(e.target.value)}
              placeholder="Write Markdown here..."
            />
          ) : (
            <div>
              {/* Add Block Toolbar */}
              <div className="essay-toolbar-sticky">
                <span className="essay-toolbar-label">Add Block:</span>
                <button
                  type="button"
                  className="admin-btn admin-btn-xs"
                  onClick={() => handleAddBlock('paragraph')}
                >
                  <IconFileText size={13} /> + Text
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-xs"
                  onClick={() => handleAddBlock('heading')}
                >
                  <IconSparkles size={13} /> + Heading
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-xs"
                  onClick={() => handleAddBlock('quote')}
                >
                  <IconQuote size={13} /> + Quote
                </button>
                <div className="essay-toolbar-divider" />
                <button
                  type="button"
                  className="admin-btn admin-btn-xs admin-btn-primary"
                  onClick={() => handleAddBlock('photo')}
                >
                  <IconCamera size={13} /> + Photo
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-xs admin-btn-primary"
                  onClick={() => handleAddBlock('photo-pair')}
                >
                  <IconArrowLeftRight size={13} /> + 2-Photo Pair
                </button>
              </div>

              {/* Blocks List */}
              <div
                style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                {parsed.blocks.map((block, idx) => (
                  <div key={idx} className="essay-block-card">
                    <div className="essay-block-card-header">
                      <BlockBadge type={block.type} />
                      <div className="essay-block-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn-xs"
                          disabled={idx === 0}
                          onClick={() => handleMoveBlock(idx, 'up')}
                        >
                          <IconChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-xs"
                          disabled={idx === parsed.blocks.length - 1}
                          onClick={() => handleMoveBlock(idx, 'down')}
                        >
                          <IconChevronDown size={12} />
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-xs admin-btn-danger"
                          onClick={() => handleDeleteBlock(idx)}
                        >
                          <IconTrash size={12} />
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                      {block.type === 'heading' && (
                        <div className="journal-heading-row">
                          <select
                            className="admin-input journal-level-select"
                            value={block.level}
                            onChange={(e) =>
                              handleUpdateBlock(idx, { ...block, level: Number(e.target.value) })
                            }
                          >
                            <option value={1}>H1</option>
                            <option value={2}>H2</option>
                            <option value={3}>H3</option>
                          </select>
                          <input
                            type="text"
                            className="admin-input"
                            value={block.text}
                            onChange={(e) =>
                              handleUpdateBlock(idx, { ...block, text: e.target.value })
                            }
                          />
                        </div>
                      )}

                      {block.type === 'paragraph' && (
                        <textarea
                          className="admin-input"
                          rows={3}
                          value={block.html}
                          onChange={(e) =>
                            handleUpdateBlock(idx, { ...block, html: e.target.value })
                          }
                        />
                      )}

                      {block.type === 'quote' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <textarea
                            className="admin-input"
                            rows={2}
                            value={block.text}
                            placeholder="Quote text..."
                            onChange={(e) =>
                              handleUpdateBlock(idx, { ...block, text: e.target.value })
                            }
                          />
                          <input
                            type="text"
                            className="admin-input"
                            value={block.author || ''}
                            placeholder="Author attribution (optional)"
                            onChange={(e) =>
                              handleUpdateBlock(idx, { ...block, author: e.target.value })
                            }
                          />
                        </div>
                      )}

                      {block.type === 'photo' && isLegacyAssetRef(block.assetId) && (
                        <p className="journal-block-warning">
                          Reference &quot;{block.assetId}&quot; is a legacy album position, not a
                          photo. It will not appear on the published page — pick a photo below.
                        </p>
                      )}

                      {block.type === 'photo' && (
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <div
                            style={{
                              width: '140px',
                              height: '96px',
                              flexShrink: 0,
                              background: 'rgba(0,0,0,0.3)',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                            onClick={() =>
                              setAssetPickerTarget({
                                title: 'Select Photo for Story',
                                onSelect: (id) => handleUpdateBlock(idx, { ...block, assetId: id }),
                              })
                            }
                          >
                            {block.assetId ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/admin/thumbnail/${block.assetId}`}
                                alt="Thumb"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>+ Pick</span>
                            )}
                          </div>

                          <div
                            style={{
                              flexGrow: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            <div className="journal-photo-layout-row">
                              <select
                                className="admin-input"
                                value={block.layout}
                                onChange={(e) =>
                                  handleUpdateBlock(idx, {
                                    ...block,
                                    layout: e.target.value as 'contained' | 'wide' | 'fullbleed',
                                  })
                                }
                              >
                                <option value="contained">Contained (Column Width)</option>
                                <option value="wide">Wide (Expanded Width)</option>
                                <option value="fullbleed">Fullbleed (Edge to Edge)</option>
                              </select>
                              <button
                                type="button"
                                className="admin-btn admin-btn-xs"
                                onClick={() =>
                                  setAssetPickerTarget({
                                    title: 'Select Photo for Story',
                                    onSelect: (id) =>
                                      handleUpdateBlock(idx, { ...block, assetId: id }),
                                  })
                                }
                              >
                                Change Photo
                              </button>
                            </div>
                            <input
                              type="text"
                              className="admin-input"
                              placeholder="Caption (optional)"
                              value={block.caption || ''}
                              onChange={(e) =>
                                handleUpdateBlock(idx, { ...block, caption: e.target.value })
                              }
                            />
                          </div>
                        </div>
                      )}

                      {block.type === 'photo-pair' && block.assetIds.some(isLegacyAssetRef) && (
                        <p className="journal-block-warning">
                          References &quot;{block.assetIds.filter(isLegacyAssetRef).join('", "')}
                          &quot; are legacy album positions, not photos. They will not appear on the
                          published page — pick photos below.
                        </p>
                      )}

                      {block.type === 'photo-pair' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div
                            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
                          >
                            {[0, 1].map((pIdx) => (
                              <div
                                key={pIdx}
                                style={{
                                  height: '90px',
                                  background: 'rgba(0,0,0,0.3)',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  border: '1px dashed rgba(255,255,255,0.15)',
                                }}
                                onClick={() =>
                                  setAssetPickerTarget({
                                    title: `Select Photo #${pIdx + 1} for Pair`,
                                    onSelect: (id) => {
                                      const newIds = [...block.assetIds] as [string, string];
                                      newIds[pIdx] = id;
                                      handleUpdateBlock(idx, { ...block, assetIds: newIds });
                                    },
                                  })
                                }
                              >
                                {block.assetIds[pIdx] ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={`/api/admin/thumbnail/${block.assetIds[pIdx]}`}
                                    alt="Thumb"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                ) : (
                                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                                    + Pick Photo #{pIdx + 1}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          <input
                            type="text"
                            className="admin-input"
                            placeholder="Shared caption for pair (optional)"
                            value={block.caption || ''}
                            onChange={(e) =>
                              handleUpdateBlock(idx, { ...block, caption: e.target.value })
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Draggable divider */}
        <div
          className="journal-editor-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and preview"
          aria-valuenow={Math.round(splitPct)}
          aria-valuemin={SPLIT_MIN}
          aria-valuemax={SPLIT_MAX}
          tabIndex={0}
          onMouseDown={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDoubleClick={() => setSplitPct(SPLIT_DEFAULT)}
          onKeyDown={handleSplitKeyDown}
        >
          <span className="journal-editor-resizer-grip" aria-hidden="true" />
        </div>

        {/* Right: Live Preview Pane */}
        <div className="journal-editor-pane-right">
          <div className="journal-preview-bar">
            <span className="journal-preview-bar-label">
              <IconEye size={13} /> Realtime Theme Preview
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className={`admin-btn admin-btn-xs ${viewport === 'desktop' ? 'admin-btn-primary' : ''}`}
                onClick={() => setViewport('desktop')}
              >
                Desktop
              </button>
              <button
                type="button"
                className={`admin-btn admin-btn-xs ${viewport === 'mobile' ? 'admin-btn-primary' : ''}`}
                onClick={() => setViewport('mobile')}
              >
                Mobile
              </button>
            </div>
          </div>

          <div className={`journal-preview-frame ${viewport}`}>
            <EssayView
              essay={parsed}
              assets={previewAssets}
              title={parsed.frontmatter.title}
              subtitle={parsed.frontmatter.subtitle}
            />
          </div>
        </div>
      </div>

      {/* Metadata Modal */}
      {showMetaModal && (
        <div className="journal-modal-overlay">
          <div className="journal-modal-card">
            <h3 style={{ margin: '0 0 1.25rem' }}>Story Settings &amp; Metadata</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    opacity: 0.8,
                    marginBottom: '4px',
                  }}
                >
                  Subtitle
                </label>
                <input
                  type="text"
                  className="admin-input"
                  value={parsed.frontmatter.subtitle || ''}
                  placeholder="e.g. Field notes from our winter journey"
                  onChange={(e) => handleFrontmatterChange({ subtitle: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      opacity: 0.8,
                      marginBottom: '4px',
                    }}
                  >
                    Author
                  </label>
                  <input
                    type="text"
                    className="admin-input"
                    value={parsed.frontmatter.author || ''}
                    placeholder="e.g. Ralf"
                    onChange={(e) => handleFrontmatterChange({ author: e.target.value })}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      opacity: 0.8,
                      marginBottom: '4px',
                    }}
                  >
                    Publish Date
                  </label>
                  <input
                    type="date"
                    className="admin-input"
                    value={parsed.frontmatter.date || ''}
                    onChange={(e) => handleFrontmatterChange({ date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    opacity: 0.8,
                    marginBottom: '4px',
                  }}
                >
                  Cover Photo
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '70px',
                      height: '50px',
                      borderRadius: '6px',
                      background: 'rgba(0,0,0,0.3)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {parsed.frontmatter.coverAssetId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/admin/thumbnail/${parsed.frontmatter.coverAssetId}`}
                        alt="Cover"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>None</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-btn-xs"
                    onClick={() =>
                      setAssetPickerTarget({
                        title: 'Select Cover Photo',
                        onSelect: (id) => handleFrontmatterChange({ coverAssetId: id }),
                      })
                    }
                  >
                    Choose Cover
                  </button>
                  {parsed.frontmatter.coverAssetId && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-xs admin-btn-danger"
                      onClick={() => handleFrontmatterChange({ coverAssetId: undefined })}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    opacity: 0.8,
                    marginBottom: '4px',
                  }}
                >
                  Password Protection (Optional)
                </label>
                <input
                  type="password"
                  className="admin-input"
                  value={parsed.frontmatter.password || ''}
                  placeholder="Leave empty for public access"
                  onChange={(e) => handleFrontmatterChange({ password: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
                <input
                  type="checkbox"
                  id="draft-checkbox"
                  checked={!!parsed.frontmatter.draft}
                  onChange={(e) => handleFrontmatterChange({ draft: e.target.checked })}
                />
                <label htmlFor="draft-checkbox" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                  Keep as Draft (Hidden from public /journal list)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => setShowMetaModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Picker Modal */}
      {assetPickerTarget && (
        <AssetPicker
          title={assetPickerTarget.title}
          onSelect={(id) => {
            assetPickerTarget.onSelect(id);
            setAssetPickerTarget(null);
          }}
          onClose={() => setAssetPickerTarget(null)}
        />
      )}
    </div>
  );
}
