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
import {
  OffMenuDropZone,
  SortableHeroTile,
  SortablePageRow,
  SortableSubpageRow,
} from './page-builder/SortableTiles';
import PagePanel from './page-builder/PagePanel';
import { isValidSlug } from '@/lib/journal';
import NewPageDialog from './page-builder/NewPageDialog';
import type { PageSummary, SlugTakenBy } from '@/lib/pages';
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
import { useLatest } from './useLatest';
import { useVersionedSave } from './useVersionedSave';
import type { GalleryVersionChange } from '@/lib/admin/pageRefs';
import DraftNotice from './DraftNotice';
import { sameDraft } from './sameDraft';
import { reportIfSessionExpired } from './sessionExpiry';
import { IconCamera, IconHome, IconPlus, IconSearch } from './Icons';
import { useNotify } from './Notifications';
import { dndAnnouncements } from './dndAnnouncements';

/** Drop target id of the "Not in menu" group. */
const OFF_MENU_ID = 'offmenu-zone';

/** Sortable id of a menu row. Subpages keep their old `subpage-<index>` id. */
function menuRowId(item: ops.MenuItem): string {
  return item.kind === 'subpage' ? `subpage-${item.index}` : `page-${item.slug}`;
}

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
  /** Set by any edit; `dirty` below also asks whether the edits changed anything. */
  const [edited, setDirty] = useState(false);
  /** gallery.yaml as last loaded or saved — `serverState`, as state for the comparison. */
  const [savedGallery, setSavedGallery] = useState<GalleryState | null>(null);
  // Putting an edit back the way it was is not an unsaved change (QA A-19).
  const dirty = edited && !(savedGallery && sameDraft(gallery, savedGallery));
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

  // ── Content pages (#722) ──
  /** Every page file; the menu itself lives in `gallery.pageRefs`. */
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [takenSlugs, setTakenSlugs] = useState<SlugTakenBy>({
    subpages: [],
    albums: [],
    journal: [],
  });
  /** The page shown in the panel; exclusive with `expandedSubpage`. */
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [showNewPage, setShowNewPage] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  /** The edit panel beside (or, on narrow screens, below) the structure list. */
  const panelRef = useRef<HTMLDivElement>(null);

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
  /** The tree as last rendered: tells a finished save whether editing went on meanwhile. */
  const latestGallery = useLatest(gallery);
  const serverState = useRef<GalleryState | null>(null);
  /** gallery.yaml as loaded, sent back on save so a change elsewhere is caught (#601). */
  const versionRef = useRef<string | null>(null);
  const versionedSave = useVersionedSave();

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
      const [galleryRes, albumsRes, pagesRes] = await Promise.all([
        fetch('/api/admin/gallery'),
        fetch('/api/admin/albums'),
        fetch('/api/admin/pages'),
      ]);

      if (!galleryRes.ok) {
        throw new Error(
          galleryRes.status === 401
            ? 'Your session has expired. Sign in again to continue.'
            : `The server answered ${galleryRes.status}.`,
        );
      }

      const { gallery: raw, version } = await galleryRes.json();
      versionRef.current = typeof version === 'string' ? version : null;
      const parsed = parseGalleryYaml(raw);
      serverState.current = parsed;
      setSavedGallery(parsed);
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

      // Pages are survivable the same way: without the list the menu still
      // shows their references, and saving keeps them.
      if (pagesRes.ok) {
        const data = (await pagesRes.json()) as { pages: PageSummary[]; taken: SlugTakenBy };
        setPages(data.pages);
        setTakenSlugs(data.taken);
      }
      openPageFromLink();
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

  /** `?page=<slug>` selects a page — the page editor's back link uses it. One-shot. */
  function openPageFromLink() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('page');
    if (slug === null) return;
    params.delete('page');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
    // The slug comes from the address bar and becomes the page's live link, so
    // only a real page slug may select a page — `//host` would leave the site.
    if (!isValidSlug(slug)) return;
    setExpandedSubpage(null);
    setSelectedPage(slug);
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

    const sent = gallery;
    const yamlData = serializeGallery(sent);

    try {
      const result = await versionedSave(
        '/api/admin/gallery',
        { gallery: yamlData },
        versionRef,
        'The page structure (gallery.yaml)',
      );

      if (result.kind === 'reload') {
        draft.discard();
        await loadData();
      } else if (result.kind === 'keep') {
        setSaveStatus({ kind: 'error', message: 'Not saved — gallery.yaml changed elsewhere.' });
      } else if (result.kind === 'saved') {
        const data = result.data as { gallery?: unknown; message?: string };
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
        setSavedGallery(asLoaded);
        // Edited while the request was out: those edits are not saved yet, so
        // they stay dirty and are not replaced by the file as written.
        const editedMeanwhile = latestGallery.current !== sent;
        draft.saved(JSON.stringify(asLoaded), editedMeanwhile);
        if (!editedMeanwhile) {
          // Show the hashes, so a new password reads "Protected" right away.
          if (JSON.stringify(written) !== JSON.stringify(yamlData)) setGallery(asLoaded);
          setDirty(false);
        }
        setSaveStatus({ kind: 'success', message: data.message || 'Saved successfully!' });
        setTimeout(() => setSaveStatus(null), 5000);
      } else if (!reportIfSessionExpired(result.res)) {
        setSaveStatus({
          kind: 'error',
          message: `Error: ${result.data?.error ?? `HTTP ${result.res.status}`}`,
        });
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
  function handleHeroSelectMany(assetIds: string[]) {
    edit((g) => ops.addHeroes(g, assetIds));
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

  /**
   * The menu list holds subpages and pages in one order (#722). A page can
   * also be dragged into or out of "Not in menu", which toggles its "Show in
   * menu" switch.
   */
  function handleMenuDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const items = ops.menuItems(gallery);
    const rowIndex = (id: string) => items.findIndex((item) => menuRowId(item) === id);
    const overOffMenu = overId === OFF_MENU_ID || overId.startsWith('off-');

    if (activeId.startsWith('off-')) {
      if (overOffMenu) return;
      const at = rowIndex(overId);
      if (at === -1) return;
      const slug = activeId.slice('off-'.length);
      edit((g) => ops.setPageInMenu(g, slug, true, at));
      return;
    }

    const from = rowIndex(activeId);
    if (from === -1) return;
    if (overOffMenu) {
      const item = items[from];
      if (item.kind === 'page') edit((g) => ops.setPageInMenu(g, item.slug, false));
      return;
    }
    const to = rowIndex(overId);
    if (to === -1) return;
    setExpandedSubpage(ops.followMenuMove(gallery, expandedSubpage, from, to));
    edit((g) => ops.moveMenuItem(g, from, to));
  }

  // ── Content pages ────────────────────────────────────────────
  function selectPage(slug: string) {
    setExpandedSubpage(null);
    setLinkedAlbumId(null);
    setSelectedPage(slug);
    revealPanel();
  }

  function selectSubpage(index: number) {
    setSelectedPage(null);
    setExpandedSubpage(index);
    revealPanel();
  }

  function selectOverview(which: 'hero' | 'albums') {
    setExpandedSubpage(null);
    setSelectedPage(null);
    setOverview(which);
    revealPanel();
  }

  /**
   * Below 1100px the panel stacks under the structure list, so on a phone a
   * tapped row changed something a screen further down and looked like it
   * did nothing. Scroll the panel up once it has rendered.
   */
  function revealPanel() {
    if (!window.matchMedia?.('(max-width: 1100px)').matches) return;
    requestAnimationFrame(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panelRef.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  const togglePageMenu = (slug: string) =>
    edit((g) => ops.setPageInMenu(g, slug, !ops.isPageInMenu(g, slug)));

  /**
   * gallery.yaml was changed on the server by a page rename or delete. The
   * same change goes into the builder's state and into what it considers
   * saved, so neither a pending edit nor the draft check trips over it.
   */
  function applyServerMenuChange(
    op: (g: GalleryState) => GalleryState,
    change?: GalleryVersionChange | null,
  ) {
    setGallery(op);
    // Follow the rewrite only when it was the sole change since this editor
    // loaded; otherwise the old version stays and the next save asks (#601).
    if (change && versionRef.current === change.from) versionRef.current = change.to;
    if (serverState.current) {
      serverState.current = op(serverState.current);
      setSavedGallery(serverState.current);
      draft.saved(JSON.stringify(serverState.current));
    }
  }

  async function createPage(input: { title: string; slug: string; showInMenu: boolean }) {
    setCreatingPage(true);
    try {
      const res = await fetch('/api/admin/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: input.title, slug: input.slug }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (!reportIfSessionExpired(res))
          notify('error', data?.error || 'Failed to create the page');
        return;
      }
      const slug: string = data.page.slug;
      setPages((prev) => [
        ...prev.filter((p) => p.slug !== slug),
        { slug, frontmatter: { title: input.title, draft: true } },
      ]);
      if (input.showInMenu) edit((g) => ops.setPageInMenu(g, slug, true));
      setShowNewPage(false);
      selectPage(slug);
      notify(
        'success',
        input.showInMenu
          ? 'Page created as a draft. Save Changes to put it in the menu.'
          : 'Page created as a draft.',
      );
    } catch {
      notify('error', 'Could not create the page. Check the connection and try again.');
    } finally {
      setCreatingPage(false);
    }
  }

  function handlePageSaved(
    oldSlug: string,
    page: PageSummary,
    menuRenamed: boolean,
    galleryVersion?: GalleryVersionChange | null,
  ) {
    setPages((prev) => [...prev.filter((p) => p.slug !== oldSlug), page]);
    if (page.slug !== oldSlug) {
      const rename = (g: GalleryState) => ops.renamePageRef(g, oldSlug, page.slug);
      if (menuRenamed) applyServerMenuChange(rename, galleryVersion);
      else setGallery(rename);
      setSelectedPage(page.slug);
    }
  }

  function handlePageDeleted(
    slug: string,
    removedFromMenu: boolean,
    galleryVersion?: GalleryVersionChange | null,
  ) {
    setPages((prev) => prev.filter((p) => p.slug !== slug));
    const remove = (g: GalleryState) => ops.setPageInMenu(g, slug, false);
    if (removedFromMenu) applyServerMenuChange(remove, galleryVersion);
    else setGallery(remove);
    setSelectedPage(null);
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

  /** A sortable id as the list shows it, for the drag announcements (QA A-20). */
  function dragLabel(id: string | number): string {
    const key = String(id);
    const subpage = /^subpage-(\d+)$/.exec(key);
    if (subpage) return `page "${gallery.subpages[Number(subpage[1])]?.name || 'Untitled'}"`;
    const page = /^page-(.+)$/.exec(key);
    if (page) {
      const found = pages.find((p) => p.slug === page[1]);
      return `page "${found?.frontmatter.title || page[1]}"`;
    }
    const hero = /^hero-(\d+)$/.exec(key);
    if (hero) return `homepage hero photo ${Number(hero[1]) + 1}`;
    const album = /^album-(.+)-\d+$/.exec(key);
    if (album) return `album "${getAlbumName(album[1])}"`;
    return 'item';
  }
  const announcements = dndAnnouncements(dragLabel);

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

  // The menu: subpages and pages in saved order (#722). Search filters it.
  const pageBySlug = new Map(pages.map((p) => [p.slug, p]));
  const pageTitle = (slug: string) => pageBySlug.get(slug)?.frontmatter.title || slug;
  const query = searchQuery.toLowerCase();
  const pageMatches = (slug: string) =>
    !searchQuery || slug.includes(query) || pageTitle(slug).toLowerCase().includes(query);
  const offMenuPages = pages
    .filter((p) => !ops.isPageInMenu(gallery, p.slug) && pageMatches(p.slug))
    .sort((a, b) => pageTitle(a.slug).localeCompare(pageTitle(b.slug)));

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
  const shownSubpages = new Set(filteredSubpages.map(({ index }) => index));
  const menuRows = ops
    .menuItems(gallery)
    .filter((item) =>
      item.kind === 'subpage' ? shownSubpages.has(item.index) : pageMatches(item.slug),
    );

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
              onClick={() => selectOverview('hero')}
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

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleMenuDragEnd}
            accessibility={{ announcements }}
          >
            <div className="pb-group">
              <div className="pb-group-head">
                <span>Menu</span>
                <span>
                  {gallery.subpages.filter((sp) => sp.enabled !== false).length} of{' '}
                  {gallery.subpages.length} subpages live
                </span>
              </div>
              {(gallery.subpages.length > 0 || (gallery.pageRefs ?? []).length > 0) &&
                menuRows.length === 0 && <p className="empty-hint">No matching entries.</p>}
              <SortableContext
                items={menuRows.map(menuRowId)}
                strategy={verticalListSortingStrategy}
              >
                {menuRows.map((item) => {
                  if (item.kind === 'subpage') {
                    const sp = gallery.subpages[item.index];
                    return (
                      <SortableSubpageRow
                        key={menuRowId(item)}
                        sp={sp}
                        spIndex={item.index}
                        isActive={expandedSubpage === item.index}
                        onClick={() => selectSubpage(item.index)}
                        getFirstThumb={getFirstSubpageThumb}
                      />
                    );
                  }
                  const page = pageBySlug.get(item.slug);
                  return (
                    <SortablePageRow
                      key={menuRowId(item)}
                      id={menuRowId(item)}
                      title={pageTitle(item.slug)}
                      isActive={selectedPage === item.slug}
                      draft={page?.frontmatter.draft}
                      hasPassword={!!page?.frontmatter.password}
                      // Only once the list has loaded: an empty list is not proof.
                      missing={pages.length > 0 && !page}
                      onClick={() => selectPage(item.slug)}
                    />
                  );
                })}
              </SortableContext>
              <div className="pb-add-row">
                <button
                  type="button"
                  className="pb-add"
                  onClick={() => {
                    addSubpage();
                    selectSubpage(gallery.subpages.length);
                  }}
                >
                  <IconPlus size={13} /> New subpage
                </button>
                <button type="button" className="pb-add" onClick={() => setShowNewPage(true)}>
                  <IconPlus size={13} /> New page
                </button>
              </div>
            </div>

            <div className="pb-group">
              <div className="pb-group-head">
                <span>Not in menu</span>
                <span>{offMenuPages.length}</span>
              </div>
              <OffMenuDropZone id={OFF_MENU_ID}>
                <SortableContext
                  items={offMenuPages.map((p) => `off-${p.slug}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {offMenuPages.map((p) => (
                    <SortablePageRow
                      key={`off-${p.slug}`}
                      id={`off-${p.slug}`}
                      title={pageTitle(p.slug)}
                      isActive={selectedPage === p.slug}
                      draft={p.frontmatter.draft}
                      hasPassword={!!p.frontmatter.password}
                      onClick={() => selectPage(p.slug)}
                    />
                  ))}
                </SortableContext>
                {offMenuPages.length === 0 && (
                  <p className="empty-hint">
                    Pages reachable only by their link. Drag a page here to take it out of the menu.
                  </p>
                )}
              </OffMenuDropZone>
            </div>
          </DndContext>

          <div className="pb-group">
            <div className="pb-group-head">
              <span>Standalone albums</span>
            </div>
            <button
              type="button"
              className={`pb-row-main pb-row-solo ${expandedSubpage === null && overview === 'albums' ? 'active' : ''}`}
              onClick={() => selectOverview('albums')}
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
        <div className="pb-panel" ref={panelRef}>
          {selectedPage !== null ? (
            <PagePanel
              key={selectedPage}
              slug={selectedPage}
              inMenu={ops.isPageInMenu(gallery, selectedPage)}
              onToggleMenu={() => togglePageMenu(selectedPage)}
              taken={takenSlugs}
              otherPageSlugs={pages.map((p) => p.slug).filter((s) => s !== selectedPage)}
              onSaved={handlePageSaved}
              onDeleted={handlePageDeleted}
            />
          ) : expandedSubpage !== null && gallery.subpages[expandedSubpage] ? (
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
                  accessibility={{ announcements }}
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
                    <IconHome /> Hero photos
                  </h2>
                  <button
                    className="admin-btn admin-btn-sm"
                    onClick={() =>
                      setHeroPickerTarget({
                        onSelectMany: handleHeroSelectMany,
                        currentAssetIds: gallery.hero,
                        title: 'Pick Hero Images for Homepage',
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
                  accessibility={{ announcements }}
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

      {showNewPage && (
        <NewPageDialog
          taken={takenSlugs}
          existingPageSlugs={pages.map((p) => p.slug)}
          creating={creatingPage}
          onCreate={createPage}
          onClose={() => setShowNewPage(false)}
        />
      )}

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
          onSelectMany={heroPickerTarget.onSelectMany}
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
