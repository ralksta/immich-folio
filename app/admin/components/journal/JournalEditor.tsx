'use client';

import { useState, useEffect, useRef } from 'react';
import type { ParsedJournal, JournalBlock } from '@/lib/journal';
import { parseJournalMarkdown, serializeJournalMarkdown, collectAssetIds } from '@/lib/journal';
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
  IconCheck,
  IconGrid,
  IconColumns,
  IconMap,
  IconFolder,
} from '../Icons';
import AssetPicker from '../AssetPicker';
import AlbumPicker from '../AlbumPicker';
import { SortableBlockList, SortableBlockCard } from '../SortableBlocks';
import { arrayMove } from '@dnd-kit/sortable';
import type { AlbumAssetRef } from '@/lib/journalAlbum';
import { BlockBadge } from '../BlockBadge';
import { useUnsavedGuard } from '../useUnsavedGuard';
import { useDraft } from '../useDraft';
import DraftNotice from '../DraftNotice';
import { reportIfSessionExpired } from '../sessionExpiry';
import { useContentRestored } from '../contentRestored';
import './journal-studio.css';
import { BlockFields, type AssetPickTarget } from './BlockFields';
import { StorySettingsModal } from './StorySettingsModal';
import { JournalPreview } from './JournalPreview';
import { createBlock, moveBlock } from './blockOps';
import { useSplitPane, SPLIT_MIN, SPLIT_MAX } from './splitPane';

interface JournalEditorProps {
  slug: string;
  mapEnabled?: boolean;
  onBack: () => void;
}

export function JournalEditor({ slug, mapEnabled, onBack }: JournalEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editorMode, setEditorMode] = useState<'blocks' | 'markdown'>('blocks');

  // Draggable divider between authoring pane and preview.
  const {
    splitRef,
    splitPct,
    dragging,
    onResizerMouseDown,
    onResizerDoubleClick,
    onResizerKeyDown,
  } = useSplitPane();

  const [rawMarkdown, setRawMarkdown] = useState('');
  const [parsed, setParsed] = useState<ParsedJournal>(() => ({
    frontmatter: {},
    blocks: [],
    referencedAssetIds: [],
  }));

  // Settings / Metadata Modal
  const [showMetaModal, setShowMetaModal] = useState(false);

  // Asset Picker State
  const [assetPickerTarget, setAssetPickerTarget] = useState<AssetPickTarget | null>(null);

  /** Set when the entry could not be fetched; blocks saving over it. */
  const [loadError, setLoadError] = useState<string | null>(null);

  // Unsaved edits survive leaving the editor — the entry list, a tab link,
  // back, Reload (#592). The markdown is the whole entry; blocks and
  // frontmatter are parsed from it. `serverMarkdown` is what a discard restores.
  const draft = useDraft<string>(`journal-${slug}`, rawMarkdown, dirty);
  const loadDraft = draft.load;
  const serverMarkdown = useRef('');

  // Bumped when this entry is restored from a backup, to load it again.
  const [reloadKey, setReloadKey] = useState(0);
  useContentRestored(({ target, slug: restored }) => {
    if (target === 'journal' && restored === slug) setReloadKey((k) => k + 1);
  });

  // Load entry
  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/admin/journal/${slug}`);
        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? 'Your session has expired. Sign in again to continue.'
              : `The server answered ${res.status}.`,
          );
        }
        const data = await res.json();
        const md: string = data.entry.rawMarkdown;
        serverMarkdown.current = md;
        const restored = loadDraft(md);
        setRawMarkdown(restored ?? md);
        setParsed(parseJournalMarkdown(restored ?? md));
        setDirty(restored !== null);
      } catch (err) {
        console.error('Failed to load journal entry:', err);
        // An empty editor saved over the entry replaces it with nothing, so
        // this blocks the save rather than only reporting it.
        setLoadError(err instanceof Error ? err.message : 'The entry could not be loaded.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, loadDraft, reloadKey]);

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
      referencedAssetIds: collectAssetIds(newBlocks),
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
    // The editor is not rendered in this state, but Cmd+S still reaches here.
    if (loadError) return;
    // Nothing to save: every save rotates a backup, so repeated Cmd+S on an
    // unchanged entry pushed real history out of the ten kept per file.
    if (!dirty || saving) return;

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
        serverMarkdown.current = rawMarkdown;
        draft.saved(rawMarkdown);
        setDirty(false);
      } else if (!reportIfSessionExpired(res)) {
        const data = await res.json();
        alert(data.error || 'Failed to save');
      }
    } catch {
      alert('Error saving entry');
    } finally {
      setSaving(false);
    }
  };

  useUnsavedGuard(dirty);

  const discardDraft = () => {
    draft.discard();
    setRawMarkdown(serverMarkdown.current);
    setParsed(parseJournalMarkdown(serverMarkdown.current));
    setDirty(false);
  };

  const restoreConflictingDraft = () => {
    const value = draft.takeConflicting();
    if (value === null) return;
    setRawMarkdown(value);
    setParsed(parseJournalMarkdown(value));
    setDirty(true);
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
   * Album blocks are expanded for the preview the way the page expands them,
   * from the admin assets route; until an album has loaded its block simply
   * does not render. The picker's album list is fetched on first use.
   */
  const [albumAssets, setAlbumAssets] = useState<Record<string, AlbumAssetRef[]>>({});
  const albumRequested = useRef(new Set<string>());
  const [albumList, setAlbumList] = useState<Parameters<typeof AlbumPicker>[0]['albums'] | null>(
    null,
  );
  const [albumPickerTarget, setAlbumPickerTarget] = useState<((albumId: string) => void) | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    for (const block of parsed.blocks) {
      if (block.type !== 'album' || !block.albumId || albumRequested.current.has(block.albumId))
        continue;
      const albumId = block.albumId;
      albumRequested.current.add(albumId);
      fetch(`/api/admin/albums/${albumId}/assets?types=all`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((data: { assets: AlbumAssetRef[] }) => {
          if (!cancelled) setAlbumAssets((prev) => ({ ...prev, [albumId]: data.assets }));
        })
        .catch(() => {
          // Let a retry happen after a save or a re-pick.
          albumRequested.current.delete(albumId);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [parsed.blocks]);

  const openAlbumPicker = (onSelect: (albumId: string) => void) => {
    setAlbumPickerTarget(() => onSelect);
    if (albumList === null) {
      fetch('/api/admin/albums')
        .then((res) => res.json())
        .then((data) => setAlbumList(data.albums ?? []))
        .catch(() => setAlbumList([]));
    }
  };

  // Block manipulation
  const handleAddBlock = (type: JournalBlock['type']) => {
    handleBlocksChange([...parsed.blocks, createBlock(type)]);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const blocks = moveBlock(parsed.blocks, index, direction);
    if (blocks) handleBlocksChange(blocks);
  };

  const handleReorderBlock = (from: number, to: number) => {
    handleBlocksChange(arrayMove(parsed.blocks, from, to));
  };

  const handleDeleteBlock = (index: number) => {
    handleBlocksChange(parsed.blocks.filter((_, i) => i !== index));
  };

  const handleUpdateBlock = (index: number, updated: JournalBlock) => {
    const blocks = [...parsed.blocks];
    blocks[index] = updated;
    handleBlocksChange(blocks);
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.6 }}>
        Opening Journal Studio...
      </div>
    );
  }

  /**
   * Replaces the editor rather than sitting above it: an empty editor saved
   * over the entry would replace the text with nothing.
   */
  if (loadError) {
    return (
      <div className="admin-error" role="alert">
        <strong>This entry could not be loaded.</strong> {loadError}
        <p>
          Nothing has been changed. Saving stays disabled until it loads, so an empty editor cannot
          overwrite the entry.
        </p>
        <button className="admin-btn admin-btn-secondary" onClick={onBack}>
          Back to entries
        </button>
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
            disabled={saving || !dirty}
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

      <DraftNotice
        status={draft.status}
        subject="entry"
        onDiscard={discardDraft}
        onRestore={restoreConflictingDraft}
        onDismiss={draft.dismiss}
      />

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
                <button
                  type="button"
                  className="admin-btn admin-btn-xs"
                  onClick={() => handleAddBlock('facts')}
                >
                  <IconColumns size={13} /> + Facts
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
                <button
                  type="button"
                  className="admin-btn admin-btn-xs admin-btn-primary"
                  onClick={() => handleAddBlock('photo-grid')}
                >
                  <IconGrid size={13} /> + Photo Grid
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-xs admin-btn-primary"
                  onClick={() => handleAddBlock('album')}
                >
                  <IconFolder size={13} /> + Album
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-xs"
                  onClick={() => handleAddBlock('map')}
                >
                  <IconMap size={13} /> + Map
                </button>
              </div>

              {/* Blocks List */}
              <SortableBlockList count={parsed.blocks.length} onReorder={handleReorderBlock}>
                <div
                  style={{
                    marginTop: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  {parsed.blocks.map((block, idx) => (
                    <SortableBlockCard
                      key={idx}
                      index={idx}
                      badge={<BlockBadge type={block.type} />}
                      actions={
                        <div className="essay-block-actions">
                          <button
                            type="button"
                            className="admin-btn admin-btn-xs"
                            disabled={idx === 0}
                            aria-label="Move block up"
                            onClick={() => handleMoveBlock(idx, 'up')}
                          >
                            <IconChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-xs"
                            disabled={idx === parsed.blocks.length - 1}
                            aria-label="Move block down"
                            onClick={() => handleMoveBlock(idx, 'down')}
                          >
                            <IconChevronDown size={12} />
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-xs admin-btn-danger"
                            aria-label="Delete block"
                            onClick={() => handleDeleteBlock(idx)}
                          >
                            <IconTrash size={12} />
                          </button>
                        </div>
                      }
                    >
                      <BlockFields
                        block={block}
                        onChange={(updated) => handleUpdateBlock(idx, updated)}
                        onPickAsset={setAssetPickerTarget}
                        onPickAlbum={openAlbumPicker}
                        albumAssets={albumAssets}
                        albumList={albumList}
                        mapEnabled={mapEnabled}
                      />
                    </SortableBlockCard>
                  ))}
                </div>
              </SortableBlockList>
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
          onMouseDown={onResizerMouseDown}
          onDoubleClick={onResizerDoubleClick}
          onKeyDown={onResizerKeyDown}
        >
          <span className="journal-editor-resizer-grip" aria-hidden="true" />
        </div>

        {/* Right: Live Preview Pane */}
        <JournalPreview parsed={parsed} albumAssets={albumAssets} />
      </div>

      {/* Metadata Modal */}
      {showMetaModal && (
        <StorySettingsModal
          frontmatter={parsed.frontmatter}
          onChange={handleFrontmatterChange}
          onPickAsset={setAssetPickerTarget}
          onClose={() => setShowMetaModal(false)}
        />
      )}

      {/* Album Picker Modal */}
      {albumPickerTarget && albumList !== null && (
        <AlbumPicker
          albums={albumList}
          usedAlbumIds={new Set()}
          onSelect={(albumId) => {
            albumPickerTarget(albumId);
            setAlbumPickerTarget(null);
          }}
          onClose={() => setAlbumPickerTarget(null)}
        />
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
