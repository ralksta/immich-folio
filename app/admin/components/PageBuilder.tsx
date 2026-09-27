'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import AlbumPicker from './AlbumPicker';
import { useContentRestored } from './contentRestored';
import AssetPicker from './AssetPicker';
import AssetOrderEditor from './AssetOrderEditor';
import SaveBar, { type SaveStatus } from './SaveBar';
import AlbumDrawer from './page-builder/AlbumDrawer';
import { SortableAlbumCard } from './page-builder/AlbumCard';
import SubpageDrawer from './page-builder/SubpageDrawer';
import { SortableHeroTile, SortableSubpageRow } from './page-builder/SortableTiles';
import { findAlbumAddress } from './page-builder/findAlbumAddress';
import { parseGalleryYaml, serializeGallery, type GalleryState } from './page-builder/galleryYaml';
import * as ops from './page-builder/galleryOps';
import {
  type ActiveEditAlbumAddress,
  type AlbumEntry,
  type HeroPickerTarget,
  type ImmichAlbumInfo,
  type OrderEditorTarget,
  type PickerTarget,
  type Section,
  type Subpage,
} from './page-builder/types';
import { useScrollLock } from './useScrollLock';
import { useUnsavedGuard } from './useUnsavedGuard';
import { useDraft } from './useDraft';
import DraftNotice from './DraftNotice';
import { reportIfSessionExpired } from './sessionExpiry';
import { IconCamera, IconHome, IconPlus, IconSearch } from './Icons';
import { useNotify } from './Notifications';

export default function PageBuilder() {
  const [gallery, setGallery] = useState<GalleryState>({ hero: [], albums: [], subpages: [] });
  const notify = useNotify();
  /** The state as last rendered, for Undo to check nothing changed since. */
  const galleryRef = useRef(gallery);
  useEffect(() => {
    galleryRef.current = gallery;
  }, [gallery]);
  const [immichAlbums, setImmichAlbums] = useState<ImmichAlbumInfo[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * Set when gallery.yaml could not be fetched. It blocks saving: the builder
   * writes the whole file from its own state, so saving an empty builder
   * publishes an empty gallery.
   */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);
  const [expandedSubpage, setExpandedSubpage] = useState<number | null>(null);
  /** What the panel shows while no subpage is selected (UX stage 4). */
  const [overview, setOverview] = useState<'hero' | 'albums'>('hero');
  const [drawerMode, setDrawerMode] = useState<'edit' | 'preview'>('edit');
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [heroPickerTarget, setHeroPickerTarget] = useState<HeroPickerTarget | null>(null);
  const [orderEditorTarget, setOrderEditorTarget] = useState<OrderEditorTarget | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingAlbumAddress, setEditingAlbumAddress] = useState<ActiveEditAlbumAddress | null>(
    null,
  );
  /** Album a `?album=` link pointed at, marked in its subpage sheet for a moment. */
  const [linkedAlbumId, setLinkedAlbumId] = useState<string | null>(null);

  // Keep the builder still behind either drawer. One combined lock rather than
  // one per drawer: the album drawer opens from inside the subpage drawer, and
  // a single condition avoids two locks racing over the same inline style.
  useScrollLock(editingAlbumAddress !== null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load data
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A restored gallery.yaml replaces what this editor loaded.
  useContentRestored(({ target }) => {
    if (target === 'gallery') loadData();
  });

  // ── Keyboard shortcut: ⌘+S / Ctrl+S ─────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (dirty && !saving) {
          handleSave();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, gallery]);

  useUnsavedGuard(dirty);

  // Unsaved edits survive leaving the builder — a tab link, back, Reload,
  // Logout (#592). `serverState` is what a discard goes back to.
  const draft = useDraft<GalleryState>('page-builder', gallery, dirty);
  const serverState = useRef<GalleryState | null>(null);

  // A subpage opened from a `?album=` link can hold dozens of albums: bring the
  // linked one into view, and let the mark fade after a moment. The mark itself
  // is a prop on the tile — a class added to the DOM here would be wiped by the
  // next render of the tile.
  useEffect(() => {
    if (!linkedAlbumId || expandedSubpage === null) return;
    const frame = requestAnimationFrame(() => {
      const tile = document.querySelector<HTMLElement>(
        `.subpage-drawer-container [data-album-id="${window.CSS.escape(linkedAlbumId)}"]`,
      );
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      tile?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    });
    const fade = window.setTimeout(() => setLinkedAlbumId(null), 2600);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fade);
    };
  }, [linkedAlbumId, expandedSubpage]);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const [galleryRes, albumsRes] = await Promise.all([
        fetch('/api/admin/gallery'),
        fetch('/api/admin/albums'),
      ]);

      if (!galleryRes.ok) {
        throw new Error(
          galleryRes.status === 401
            ? 'Your session has expired. Sign in again to continue.'
            : `The server answered ${galleryRes.status}.`,
        );
      }

      const { gallery: raw } = await galleryRes.json();
      const parsed = parseGalleryYaml(raw);
      serverState.current = parsed;
      const restored = draft.load(JSON.stringify(parsed));
      setGallery(restored ?? parsed);
      // Not merely "set when restored": on a reload after a backup restore the
      // editor may have been dirty, and now shows the server state.
      setDirty(restored !== null);
      openAlbumFromLink(restored ?? parsed);

      // A failed album list is survivable — it only empties the picker, and
      // saving with it empty changes nothing in gallery.yaml.
      if (albumsRes.ok) {
        const { albums } = await albumsRes.json();
        setImmichAlbums(albums);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
      setLoadError(err instanceof Error ? err.message : 'The page structure could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * `?album=<id>` opens the place that album is published from — the
   * diagnostics page links here from a finding about one album. That is the
   * subpage's sheet when the album sits on a subpage: the fix for such a
   * finding (take it off the page, or check which page shows it) lives there,
   * not in the album's own details. A standalone album has no page, so its
   * own drawer is the place.
   *
   * One-shot: the parameter is dropped once read, so a reload after closing
   * the sheet does not open it again.
   */
  function openAlbumFromLink(state: GalleryState) {
    const params = new URLSearchParams(window.location.search);
    const albumId = params.get('album');
    if (!albumId) return;
    params.delete('album');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));

    const address = findAlbumAddress(state, albumId);
    if (!address) return;
    if (address.subpageIndex !== undefined) {
      setExpandedSubpage(address.subpageIndex);
      setLinkedAlbumId(albumId);
    } else {
      setEditingAlbumAddress(address);
    }
  }

  function discardDraft() {
    draft.discard();
    if (serverState.current) setGallery(serverState.current);
    setDirty(false);
    setSaveStatus(null);
  }

  function restoreConflictingDraft() {
    const value = draft.takeConflicting();
    if (!value) return;
    setGallery(value);
    setDirty(true);
  }

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveStatus(null);
  }, []);

  // ── Save ──────────────────────────────────────────────────────
  async function handleSave() {
    // Not reachable from the UI in this state, but Cmd+S still gets here.
    if (loadError) return;

    setSaving(true);
    setSaveStatus(null);

    const yamlData = serializeGallery(gallery);

    try {
      const res = await fetch('/api/admin/gallery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gallery: yamlData }),
      });

      if (res.ok) {
        const data = await res.json();
        // Fingerprint what the next load will see, the way it will see it: the
        // file as written, read back through the same parser. The editor's own
        // state can differ in shape (an `undefined` here, a default there) and
        // would make every later draft look outdated.
        //
        // "As written" is the server's copy, not `yamlData`: passwords are
        // hashed on the way to disk (#690). Fingerprinting the plaintext would
        // make the next draft look like a conflicting edit from elsewhere.
        const written = (data.gallery ?? yamlData) as Record<string, unknown>;
        const asLoaded = parseGalleryYaml(JSON.parse(JSON.stringify(written)));
        serverState.current = asLoaded;
        draft.saved(JSON.stringify(asLoaded));
        // Show the hashes, so a new password reads "Protected" right away.
        if (JSON.stringify(written) !== JSON.stringify(yamlData)) setGallery(asLoaded);
        setDirty(false);
        setSaveStatus({ kind: 'success', message: data.message || 'Saved successfully!' });
        setTimeout(() => setSaveStatus(null), 5000);
      } else if (!reportIfSessionExpired(res)) {
        const err = await res.json();
        setSaveStatus({ kind: 'error', message: `Error: ${err.error}` });
      }
    } catch {
      setSaveStatus({ kind: 'error', message: 'Error: Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  /** Apply one edit from galleryOps and mark the form dirty. */
  function edit(op: (g: GalleryState) => GalleryState) {
    setGallery(op);
    markDirty();
  }

  // ── Pickers ──────────────────────────────────────────────────
  function handleHeroSelect(assetId: string) {
    edit((g) => ops.addHero(g, assetId));
    setHeroPickerTarget(null);
  }

  function handlePickAlbum(albumId: string) {
    if (!pickerTarget) return;
    const target = pickerTarget;
    edit((g) => ops.addAlbum(g, target, { id: albumId }));
    setPickerTarget(null);
  }

  // ── Drag & Drop Handlers ─────────────────────────────────────
  // dnd-kit reports item ids; these map them back to positions in the list.
  function handleHeroDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = gallery.hero.findIndex((_, i) => `hero-${i}` === active.id);
    const newIndex = gallery.hero.findIndex((_, i) => `hero-${i}` === over.id);

    if (oldIndex !== -1 && newIndex !== -1) edit((g) => ops.moveHero(g, oldIndex, newIndex));
  }

  function handleAlbumDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = gallery.albums.findIndex((a, i) => `album-${a.id}-${i}` === active.id);
    const newIndex = gallery.albums.findIndex((a, i) => `album-${a.id}-${i}` === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      edit((g) => ops.moveAlbum(g, { type: 'standalone' }, oldIndex, newIndex));
    }
  }

  function handleSubpageDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = gallery.subpages.findIndex((_, i) => `subpage-${i}` === active.id);
    const newIndex = gallery.subpages.findIndex((_, i) => `subpage-${i}` === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      edit((g) => ops.moveSubpage(g, oldIndex, newIndex));
      setExpandedSubpage(ops.followMovedIndex(expandedSubpage, oldIndex, newIndex));
    }
  }

  function handleSubpageAlbumDragEnd(spIndex: number) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const sp = gallery.subpages[spIndex];
      const oldIndex = sp.albums.findIndex((a, i) => `album-${a.id}-${i}` === active.id);
      const newIndex = sp.albums.findIndex((a, i) => `album-${a.id}-${i}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        edit((g) =>
          ops.moveAlbum(g, { type: 'subpage', subpageIndex: spIndex }, oldIndex, newIndex),
        );
      }
    };
  }

  // ── Subpages and sections ────────────────────────────────────
  const addSubpage = () => edit(ops.addSubpage);

  const removeSubpage = (index: number) =>
    removeWithUndo('Page removed.', (g) => ops.removeSubpage(g, index));

  const updateSubpage = (index: number, updates: Partial<Subpage>) =>
    edit((g) => ops.updateSubpage(g, index, updates));

  const addSection = (subpageIndex: number) => edit((g) => ops.addSection(g, subpageIndex));

  const removeSection = (subpageIndex: number, sectionIndex: number) =>
    edit((g) => ops.removeSection(g, subpageIndex, sectionIndex));

  const updateSection = (subpageIndex: number, sectionIndex: number, updates: Partial<Section>) =>
    edit((g) => ops.updateSection(g, subpageIndex, sectionIndex, updates));

  // ── Removal ──────────────────────────────────────────────────
  // Removing only changes unsaved state, so it happens at once and offers Undo
  // instead of asking first (#694 §3). It used to be a confirm() before every
  // click, which is how the builder ended up asking about things nobody could
  // lose: nothing is written until Save.
  function removeWithUndo(message: string, op: (g: GalleryState) => GalleryState) {
    const before = gallery;
    const after = op(before);
    if (after === before) return;
    edit(() => after);
    notify('success', message, {
      label: 'Undo',
      run: () => {
        // Only while nothing else changed since: restoring `before` on top of
        // later edits would silently throw those away.
        if (galleryRef.current !== after) {
          notify(
            'error',
            'Could not undo: the page structure changed since. Nothing is saved yet.',
          );
          return;
        }
        edit(() => before);
      },
    });
  }

  const removeStandaloneAlbum = (index: number) =>
    removeWithUndo('Album removed.', (g) => ops.removeAlbum(g, { type: 'standalone' }, index));

  const removeSubpageAlbum = (subpageIndex: number, albumIndex: number) =>
    removeWithUndo('Album removed from the page.', (g) =>
      ops.removeAlbum(g, { type: 'subpage', subpageIndex }, albumIndex),
    );

  const removeSectionAlbum = (subpageIndex: number, sectionIndex: number, albumIndex: number) =>
    removeWithUndo('Album removed from the section.', (g) =>
      ops.removeAlbum(g, { type: 'section', subpageIndex, sectionIndex }, albumIndex),
    );

  const removeHero = (index: number) =>
    removeWithUndo('Hero photo removed.', (g) => ops.removeHero(g, index));

  // ── Helpers ──────────────────────────────────────────────────
  function getAlbumName(id: string): string {
    const found = immichAlbums.find((a) => a.id === id);
    return found?.albumName || id.slice(0, 8) + '...';
  }

  function getAlbumCount(id: string): number {
    const found = immichAlbums.find((a) => a.id === id);
    return found?.assetCount || 0;
  }

  function getAlbumThumbnailId(id: string): string | null {
    const found = immichAlbums.find((a) => a.id === id);
    return found?.thumbnailAssetId || null;
  }

  function getFirstSubpageThumb(sp: Subpage): string | null {
    for (const album of sp.albums) {
      const thumb = getAlbumThumbnailId(album.id);
      if (thumb) return thumb;
    }
    if (sp.sections) {
      for (const sec of sp.sections) {
        for (const album of sec.albums) {
          const thumb = getAlbumThumbnailId(album.id);
          if (thumb) return thumb;
        }
      }
    }
    return null;
  }

  /** The album an open drawer edits, with the callbacks the drawer needs. */
  function getEditingAlbumInfo(addr: ActiveEditAlbumAddress) {
    const album = ops.albumsAt(gallery, addr)?.[addr.albumIndex];
    if (!album) return null;
    return {
      album,
      name: getAlbumName(album.id),
      count: getAlbumCount(album.id),
      thumbnailId: getAlbumThumbnailId(album.id),
      onUpdate: (updates: Partial<AlbumEntry>) =>
        edit((g) => ops.updateAlbum(g, addr, addr.albumIndex, updates)),
      onRemove: () => {
        if (addr.type === 'standalone') removeStandaloneAlbum(addr.albumIndex);
        else if (addr.type === 'subpage') removeSubpageAlbum(addr.subpageIndex!, addr.albumIndex);
        else removeSectionAlbum(addr.subpageIndex!, addr.sectionIndex!, addr.albumIndex);
        // The drawer is addressed by index and would otherwise show whichever
        // album slid into this slot.
        setEditingAlbumAddress(null);
      },
    };
  }

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
      </div>
    );
  }

  /**
   * Replaces the builder rather than sitting above it. An empty builder looks
   * exactly like a site with no pages yet, and saving it used to publish an
   * empty gallery.yaml over a working one.
   */
  if (loadError) {
    return (
      <div className="admin-error" role="alert">
        <strong>The page structure could not be loaded.</strong> {loadError}
        <p>
          Nothing has been changed. Saving stays disabled until it loads, so an empty builder cannot
          overwrite your gallery.
        </p>
        <button className="admin-btn admin-btn-secondary" onClick={loadData}>
          Try again
        </button>
      </div>
    );
  }

  // Filter standalone albums
  const filteredAlbums = gallery.albums.filter((album) => {
    if (!searchQuery) return true;
    const name = getAlbumName(album.id).toLowerCase();
    const description = (album.description || '').toLowerCase();
    const overrideTitle = (album.title || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      name.includes(query) ||
      description.includes(query) ||
      overrideTitle.includes(query) ||
      album.id.toLowerCase().includes(query)
    );
  });

  // Filter subpages
  const filteredSubpages = gallery.subpages
    .map((sp, index) => ({ sp, index }))
    .filter(({ sp }) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const name = sp.name.toLowerCase();
      const title = (sp.title || '').toLowerCase();
      const subtitle = (sp.subtitle || '').toLowerCase();

      if (name.includes(query) || title.includes(query) || subtitle.includes(query)) return true;

      const albums = sp.albums || [];
      const hasMatchingAlbum = albums.some((a) => {
        const aName = getAlbumName(a.id).toLowerCase();
        const aTitle = (a.title || '').toLowerCase();
        const aDesc = (a.description || '').toLowerCase();
        return (
          aName.includes(query) ||
          aTitle.includes(query) ||
          aDesc.includes(query) ||
          a.id.toLowerCase().includes(query)
        );
      });

      return hasMatchingAlbum;
    });

  return (
    <div className="page-builder">
      <SaveBar
        dirty={dirty}
        saving={saving}
        status={saveStatus}
        onSave={handleSave}
        label="Save Changes"
        showPreview
      />

      <DraftNotice
        status={draft.status}
        subject="page structure"
        onDiscard={discardDraft}
        onRestore={restoreConflictingDraft}
        onDismiss={draft.dismiss}
      />

      <div className="pb-split">
        {/* Structure: everything on the site, always visible (UX stage 4). */}
        <aside className="pb-tree" aria-label="Page structure">
          {/* Search Bar */}
          <div className="builder-search-container">
            <div className="builder-search-wrapper">
              <span className="builder-search-icon">
                <IconSearch size={14} />
              </span>
              <input
                type="search"
                aria-label="Search albums or subpages"
                className="builder-search-input"
                placeholder="Search albums or subpages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="builder-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="pb-group">
            <div className="pb-group-head">
              <span>Home page</span>
            </div>
            <button
              type="button"
              className={`pb-row-main pb-row-solo ${expandedSubpage === null && overview === 'hero' ? 'active' : ''}`}
              onClick={() => {
                setExpandedSubpage(null);
                setOverview('hero');
              }}
            >
              <span className="pb-row-thumb">
                {gallery.hero[0] ? (
                  <img src={`/api/admin/thumbnail/${gallery.hero[0]}`} alt="" loading="lazy" />
                ) : (
                  <IconHome size={14} />
                )}
              </span>
              <span className="pb-row-name">Hero photos</span>
              <span className="pb-row-count">{gallery.hero.length}</span>
            </button>
          </div>

          <div className="pb-group">
            <div className="pb-group-head">
              <span>Subpages</span>
              <span>
                {gallery.subpages.filter((sp) => sp.enabled !== false).length} of{' '}
                {gallery.subpages.length} live
              </span>
            </div>
            {gallery.subpages.length > 0 && filteredSubpages.length === 0 && (
              <p className="empty-hint">No matching subpages.</p>
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSubpageDragEnd}
            >
              <SortableContext
                items={filteredSubpages.map(({ index }) => `subpage-${index}`)}
                strategy={verticalListSortingStrategy}
              >
                {filteredSubpages.map(({ sp, index }) => (
                  <SortableSubpageRow
                    key={`subpage-${index}`}
                    sp={sp}
                    spIndex={index}
                    isActive={expandedSubpage === index}
                    onClick={() => setExpandedSubpage(index)}
                    getFirstThumb={getFirstSubpageThumb}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <button
              type="button"
              className="pb-add"
              onClick={() => {
                addSubpage();
                setExpandedSubpage(gallery.subpages.length);
              }}
            >
              <IconPlus size={13} /> New subpage
            </button>
          </div>

          <div className="pb-group">
            <div className="pb-group-head">
              <span>Standalone albums</span>
            </div>
            <button
              type="button"
              className={`pb-row-main pb-row-solo ${expandedSubpage === null && overview === 'albums' ? 'active' : ''}`}
              onClick={() => {
                setExpandedSubpage(null);
                setOverview('albums');
              }}
            >
              <span className="pb-row-thumb">
                <IconCamera size={14} />
              </span>
              <span className="pb-row-name">On the home page</span>
              <span className="pb-row-count">{gallery.albums.length}</span>
            </button>
          </div>
        </aside>

        {/* The selected entry, edited in place instead of in an overlay. */}
        <div className="pb-panel">
          {expandedSubpage !== null && gallery.subpages[expandedSubpage] ? (
            <>
              <SubpageDrawer
                sp={gallery.subpages[expandedSubpage]}
                spIndex={expandedSubpage}
                kickerIndex={ops.enabledPosition(gallery, expandedSubpage)}
                immichAlbums={immichAlbums}
                sensors={sensors}
                drawerMode={drawerMode}
                onDrawerModeChange={setDrawerMode}
                onClose={() => {
                  setExpandedSubpage(null);
                  setLinkedAlbumId(null);
                }}
                updateSubpage={updateSubpage}
                removeSubpage={removeSubpage}
                addSection={addSection}
                removeSection={removeSection}
                updateSection={updateSection}
                removeSubpageAlbum={removeSubpageAlbum}
                removeSectionAlbum={removeSectionAlbum}
                onAlbumDragEnd={handleSubpageAlbumDragEnd(expandedSubpage)}
                onPickAlbum={setPickerTarget}
                onEditAlbum={setEditingAlbumAddress}
                onPickHero={setHeroPickerTarget}
                getAlbumName={getAlbumName}
                getAlbumCount={getAlbumCount}
                getAlbumThumbnailId={getAlbumThumbnailId}
                highlightedAlbumId={linkedAlbumId}
                inline
              />
            </>
          ) : overview === 'albums' ? (
            <>
              {/* Standalone Albums */}
              <section className="builder-section">
                <div className="builder-section-header">
                  <h2>
                    <IconCamera />
                    Standalone Albums
                  </h2>
                  <button
                    className="admin-btn admin-btn-sm"
                    onClick={() => setPickerTarget({ type: 'standalone' })}
                  >
                    + Add Album
                  </button>
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleAlbumDragEnd}
                >
                  <SortableContext
                    items={filteredAlbums.map((a) => {
                      const originalIndex = gallery.albums.findIndex((x) => x.id === a.id);
                      return `album-${a.id}-${originalIndex}`;
                    })}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="album-list">
                      {filteredAlbums.length === 0 && (
                        <p className="empty-hint">
                          {searchQuery
                            ? 'No matching standalone albums found.'
                            : 'No standalone albums. These show directly on the homepage.'}
                        </p>
                      )}
                      {filteredAlbums.map((album) => {
                        const originalIndex = gallery.albums.findIndex((a) => a.id === album.id);
                        return (
                          <SortableAlbumCard
                            key={`${album.id}-${originalIndex}`}
                            album={album}
                            index={originalIndex}
                            name={getAlbumName(album.id)}
                            count={getAlbumCount(album.id)}
                            thumbnailId={getAlbumThumbnailId(album.id)}
                            onRemove={() => removeStandaloneAlbum(originalIndex)}
                            onEdit={() =>
                              setEditingAlbumAddress({
                                type: 'standalone',
                                albumIndex: originalIndex,
                              })
                            }
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </section>
            </>
          ) : (
            <>
              {/* Hero Section */}
              <section className="builder-section">
                <div className="builder-section-header">
                  <h2>
                    <IconHome /> Homepage Hero
                  </h2>
                  <button
                    className="admin-btn admin-btn-sm"
                    onClick={() =>
                      setHeroPickerTarget({
                        onSelect: handleHeroSelect,
                        currentAssetIds: gallery.hero,
                        title: 'Pick Hero Image for Homepage',
                      })
                    }
                  >
                    <IconPlus size={14} /> Add Hero
                  </button>
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleHeroDragEnd}
                >
                  <SortableContext
                    items={gallery.hero.map((_, i) => `hero-${i}`)}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div className="hero-grid">
                      {gallery.hero.length === 0 && (
                        <p className="empty-hint">
                          No hero images configured. Add photos to show a hero carousel on the
                          homepage.
                        </p>
                      )}
                      {gallery.hero.map((id, i) => (
                        <SortableHeroTile
                          key={`hero-${i}`}
                          id={id}
                          index={i}
                          onRemove={() => removeHero(i)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </section>
            </>
          )}
        </div>
      </div>

      {/* Album Picker Modal */}
      {pickerTarget && (
        <AlbumPicker
          albums={immichAlbums}
          onSelect={handlePickAlbum}
          onClose={() => setPickerTarget(null)}
          usedAlbumIds={ops.usedAlbumIds(gallery)}
        />
      )}

      {/* Slide-over Drawer for Album Details (Centered 2-Column Modal) */}
      {(() => {
        if (!editingAlbumAddress) return null;
        const info = getEditingAlbumInfo(editingAlbumAddress);
        if (!info) return null;

        return (
          <AlbumDrawer
            {...info}
            onClose={() => setEditingAlbumAddress(null)}
            onPickHero={setHeroPickerTarget}
            onEditOrder={setOrderEditorTarget}
          />
        );
      })()}

      {/* Hero Asset Picker Modal */}
      {heroPickerTarget && (
        <AssetPicker
          albumId={heroPickerTarget.albumId}
          onSelect={heroPickerTarget.onSelect}
          onClose={() => setHeroPickerTarget(null)}
          currentAssetIds={heroPickerTarget.currentAssetIds}
          title={heroPickerTarget.title}
        />
      )}

      {/* Manual Photo Order Editor */}
      {orderEditorTarget && (
        <AssetOrderEditor
          albumId={orderEditorTarget.albumId}
          albumName={orderEditorTarget.albumName}
          assetOrder={orderEditorTarget.assetOrder}
          onSave={orderEditorTarget.onSave}
          onClose={() => setOrderEditorTarget(null)}
        />
      )}
    </div>
  );
}
