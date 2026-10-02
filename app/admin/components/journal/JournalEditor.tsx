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
import { useLatest } from '../useLatest';
import DraftNotice from '../DraftNotice';
import { reportIfSessionExpired } from '../sessionExpiry';
import { useContentRestored } from '../contentRestored';
import { useVersionedSave } from '../useVersionedSave';
import './journal-studio.css';
import { BlockFields, type AssetPickTarget } from './BlockFields';
import { StorySettingsModal } from './StorySettingsModal';
import { PageSettingsPanel } from './PageSettingsPanel';
import { JournalPreview } from './JournalPreview';
import { createBlock, createPhotoBlocks, moveBlock } from './blockOps';
import { useSplitPane, SPLIT_MIN, SPLIT_MAX } from './splitPane';
import { useNotify } from '../Notifications';

interface JournalEditorProps {
  slug: string;
  mapEnabled?: boolean;
  onBack: () => void;
  /**
   * `page` edits a content page (#722) instead of a journal entry: its own
   * API and live URL, no map block, a settings side panel instead of the
   * story settings, and a Publish button that saves the Draft flag at once.
   */
  kind?: 'journal' | 'page';
}

export function JournalEditor({ slug, mapEnabled, onBack, kind = 'journal' }: JournalEditorProps) {
  const isPage = kind === 'page';
  const apiUrl = isPage ? `/api/admin/pages/${slug}` : `/api/admin/journal/${slug}`;
  const liveUrl = isPage ? `/${slug}` : `/journal/${slug}`;
  const notify = useNotify();
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
  /** The markdown as last rendered: tells a finished save whether typing went on meanwhile. */
  const latestMarkdown = useLatest(rawMarkdown);
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
  const draft = useDraft<string>(`${isPage ? 'page' : 'journal'}-${slug}`, rawMarkdown, dirty);
  const loadDraft = draft.load;
  const serverMarkdown = useRef('');
  /** The file as loaded, sent back on save so a change elsewhere is caught (#601). */
  const versionRef = useRef<string | null>(null);
  const versionedSave = useVersionedSave();

  // Bumped when this entry is restored from a backup, to load it again.
  const [reloadKey, setReloadKey] = useState(0);
  useContentRestored(({ target, slug: restored }) => {
    if (target === (isPage ? 'pages' : 'journal') && restored === slug) setReloadKey((k) => k + 1);
  });

  // Load entry
  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? 'Your session has expired. Sign in again to continue.'
              : `The server answered ${res.status}.`,
          );
        }
        const data = await res.json();
        versionRef.current = typeof data.version === 'string' ? data.version : null;
        const md: string = (isPage ? data.page : data.entry).rawMarkdown;
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
  }, [slug, apiUrl, isPage, loadDraft, reloadKey]);

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

  // Save. `override` is markdown to save instead of the editor's — the page
  // editor's Publish button changes the Draft flag and saves in one go.
  const handleSave = async (override?: string) => {
    // The editor is not rendered in this state, but Cmd+S still reaches here.
    if (loadError) return;
    // Nothing to save: every save rotates a backup, so repeated Cmd+S on an
    // unchanged entry pushed real history out of the ten kept per file.
    if ((!dirty && override === undefined) || saving) return;
    const toSave = override ?? rawMarkdown;

    setSaving(true);
    try {
      const result = await versionedSave(
        apiUrl,
        { rawMarkdown: toSave },
        versionRef,
        isPage ? 'This page' : 'This entry',
      );

      if (result.kind === 'reload') {
        draft.discard();
        setReloadKey((k) => k + 1);
      } else if (result.kind === 'keep') {
        notify('error', 'Not saved — it changed elsewhere. Your edits are still here.');
      } else if (result.kind === 'saved') {
        // The file as written, not as sent: a password line is hashed on the
        // way to disk (#690). Taking the sent text as the base would make the
        // next draft look like a conflicting edit from elsewhere.
        const data = result.data as {
          page?: { rawMarkdown?: unknown };
          entry?: { rawMarkdown?: unknown };
        };
        const record = isPage ? data.page : data.entry;
        const written: string =
          typeof record?.rawMarkdown === 'string' ? record.rawMarkdown : toSave;
        serverMarkdown.current = written;
        // Edited while the request was out: those edits are not saved yet, so
        // they stay dirty and are not replaced by the file as written.
        const editedMeanwhile = latestMarkdown.current !== toSave;
        draft.saved(written, editedMeanwhile);
        if (!editedMeanwhile) {
          if (written !== toSave) {
            setRawMarkdown(written);
            setParsed(parseJournalMarkdown(written));
          }
          setDirty(false);
        }
      } else if (!reportIfSessionExpired(result.res)) {
        notify('error', result.data?.error || 'Failed to save');
      }
    } catch {
      notify(
        'error',
        `Could not save the ${isPage ? 'page' : 'entry'}. Check the connection and try again.`,
      );
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
  /** Page mode: publish or unpublish, saved at once. Same flag as the Draft pill. */
  const handleTogglePublish = () => {
    const updated: ParsedJournal = {
      ...parsed,
      frontmatter: { ...parsed.frontmatter, draft: !parsed.frontmatter.draft },
    };
    const serialized = serializeJournalMarkdown(updated);
    setParsed(updated);
    setRawMarkdown(serialized);
    // An edit like any other until the save lands: a failed or refused save
    // must leave the flipped flag unsaved, not shown as "Saved" (a success
    // clears it again).
    setDirty(true);
    handleSave(serialized);
  };

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
        {isPage ? 'Opening page editor...' : 'Opening Journal Studio...'}
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
        <strong>This {isPage ? 'page' : 'entry'} could not be loaded.</strong> {loadError}
        <p>
          Nothing has been changed. Saving stays disabled until it loads, so an empty editor cannot
          overwrite it.
        </p>
        <button className="admin-btn admin-btn-secondary" onClick={onBack}>
          {isPage ? 'Back to pages' : 'Back to entries'}
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
            {isPage ? '← Pages' : '← All Entries'}
          </button>

          <input
            type="text"
            className="journal-editor-title-input"
            value={parsed.frontmatter.title || ''}
            placeholder={isPage ? 'Page title...' : 'Story Title...'}
            aria-label={isPage ? 'Page title' : 'Story title'}
            onChange={(e) => handleFrontmatterChange({ title: e.target.value })}
          />

          {/* The admin's segmented control (QA A-18). As `admin-btn-xs` buttons the
              active one never showed: `.admin-btn-xs` sets its own background
              after `.admin-btn-primary`, so both modes looked identical. */}
          <div
            className="segmented-control segmented-control--sm"
            role="group"
            aria-label="Editor mode"
          >
            <button
              type="button"
              className={`segment-btn ${editorMode === 'blocks' ? 'active' : ''}`}
              aria-pressed={editorMode === 'blocks'}
              onClick={() => setEditorMode('blocks')}
            >
              Visual Blocks
            </button>
            <button
              type="button"
              className={`segment-btn ${editorMode === 'markdown' ? 'active' : ''}`}
              aria-pressed={editorMode === 'markdown'}
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
            <IconGear size={14} /> {isPage ? 'Page Settings' : 'Story Settings'}
          </button>

          {isPage && (
            <button
              type="button"
              className="admin-btn admin-btn-sm admin-btn-secondary"
              onClick={handleTogglePublish}
              disabled={saving}
              title={
                parsed.frontmatter.draft
                  ? 'Publish the page and save it now'
                  : 'Turn the page back into a draft and save it now'
              }
            >
              {parsed.frontmatter.draft ? 'Publish' : 'Unpublish'}
            </button>
          )}

          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn-sm admin-btn-secondary"
          >
            <IconLink size={14} /> Live
          </a>

          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-primary"
            onClick={() => handleSave()}
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
        subject={isPage ? 'page' : 'entry'}
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
                  onClick={() =>
                    setAssetPickerTarget({
                      title: 'Add Photos (one block each)',
                      onSelectMany: (ids) =>
                        handleBlocksChange([...parsed.blocks, ...createPhotoBlocks(ids)]),
                    })
                  }
                >
                  <IconCamera size={13} /> + Photos
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
                {/* No map block on content pages in v1 (#722). */}
                {!isPage && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-xs"
                    onClick={() => handleAddBlock('map')}
                  >
                    <IconMap size={13} /> + Map
                  </button>
                )}
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

      {/* Page settings: a side panel, so editing never means going back (#722). */}
      {showMetaModal && isPage && (
        <PageSettingsPanel
          frontmatter={parsed.frontmatter}
          onChange={handleFrontmatterChange}
          onClose={() => setShowMetaModal(false)}
        />
      )}

      {/* Metadata Modal */}
      {showMetaModal && !isPage && (
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
          max={assetPickerTarget.max}
          onSelect={(id) => {
            assetPickerTarget.onSelect?.(id);
            setAssetPickerTarget(null);
          }}
          onSelectMany={
            assetPickerTarget.onSelectMany &&
            ((ids) => {
              assetPickerTarget.onSelectMany?.(ids);
              setAssetPickerTarget(null);
            })
          }
          onClose={() => setAssetPickerTarget(null)}
        />
      )}
    </div>
  );
}
