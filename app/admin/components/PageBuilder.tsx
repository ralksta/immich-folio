'use client';

import { useState, useEffect, useCallback } from 'react';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AlbumPicker from './AlbumPicker';
import AssetPicker from './AssetPicker';
import AssetOrderEditor from './AssetOrderEditor';
import SaveBar from './SaveBar';
import AlbumDrawer from './page-builder/AlbumDrawer';
import { SortableAlbumCard } from './page-builder/AlbumCard';
import SubpageDrawer from './page-builder/SubpageDrawer';
import {
  seedCoverGrid,
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
import { DEFAULT_ALBUM_SORT, isAlbumSortMode } from '@/lib/albumSort';
import { type AlbumEntryObject } from '@/lib/config/schema';
import {
  IconCamera,
  IconFolder,
  IconGripVertical,
  IconHome,
  IconLock,
  IconPencil,
  IconPlus,
  IconSearch,
  IconX,
} from './Icons';

// ── Types ──────────────────────────────────────────────────────

interface GalleryState {
  hero: string[];
  albums: AlbumEntry[];
  subpages: Subpage[];
}

// ── Helpers ────────────────────────────────────────────────────

type RawAlbumEntry = string | Record<string, string | AlbumEntryObject>;

/**
 * Whether an entry carries anything beyond its ID.
 *
 * Both collapse rules below depend on this, and they are the reason every new
 * per-album option has to be listed here: an entry that looks "empty" is
 * serialized back to a bare UUID string, so a field missing from this check is
 * silently dropped on the next save.
 */
function hasAlbumOptions(entry: AlbumEntry): boolean {
  return Boolean(
    entry.description ||
    entry.password ||
    entry.heroImage ||
    (entry.sort && entry.sort !== DEFAULT_ALBUM_SORT) ||
    entry.assetOrder?.length ||
    entry.grid ||
    entry.coverPosition ||
    entry.download,
  );
}

function parseAlbumEntries(raw: RawAlbumEntry[] | undefined): AlbumEntry[] {
  if (!raw) return [];
  return raw.map((entry) => {
    if (typeof entry === 'string') return { id: entry };
    const [id, value] = Object.entries(entry)[0];
    if (typeof value === 'string') return { id, title: value };
    return {
      id,
      title: value.title,
      description: value.description,
      password: value.password,
      heroImage: value.heroImage,
      sort: isAlbumSortMode(value.sort) ? value.sort : undefined,
      assetOrder: value.assetOrder,
      grid: value.grid,
      coverPosition: value.coverPosition,
      download: value.download === true,
    };
  });
}

function serializeAlbumEntries(entries: AlbumEntry[]): RawAlbumEntry[] {
  return entries.map((entry) => {
    const extras = hasAlbumOptions(entry);
    if (!entry.title && !extras) return entry.id;
    if (entry.title && !extras) return { [entry.id]: entry.title };

    const val: AlbumEntryObject = {};
    // Only when set: a sort-only entry would otherwise be written with an empty
    // title, which deriveGallery ignores but which still lands in the YAML.
    if (entry.title) val.title = entry.title;
    if (entry.description) val.description = entry.description;
    if (entry.password) val.password = entry.password;
    if (entry.heroImage) val.heroImage = entry.heroImage;
    if (entry.sort && entry.sort !== DEFAULT_ALBUM_SORT) val.sort = entry.sort;
    // Persisted regardless of the mode, so manual → newest → manual does not
    // throw away a hand-curated order.
    if (entry.assetOrder?.length) val.assetOrder = entry.assetOrder;
    if (entry.grid) val.grid = entry.grid;
    if (entry.coverPosition) val.coverPosition = entry.coverPosition;
    if (entry.download) val.download = true;
    return { [entry.id]: val };
  });
}

// ── Sortable Hero Tile ─────────────────────────────────────────

function SortableHeroTile({
  id,
  index,
  onRemove,
}: {
  id: string;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `hero-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="hero-tile" {...attributes}>
      <div className="hero-tile-drag" {...listeners} title="Drag to reorder">
        <IconGripVertical size={18} className="svg-icon svg-drag" />
      </div>
      <img src={`/api/admin/thumbnail/${id}`} alt="" loading="lazy" />
      <button className="hero-tile-remove" onClick={onRemove} title="Remove">
        <IconX size={14} />
      </button>
      <span className="hero-tile-index">{index + 1}</span>
    </div>
  );
}

// ── Sortable Subpage Tile ──────────────────────────────────────

function SortableSubpageTile({
  sp,
  spIndex,
  isActive,
  onClick,
  getFirstThumb,
}: {
  sp: Subpage;
  spIndex: number;
  isActive: boolean;
  onClick: () => void;
  getFirstThumb: (sp: Subpage) => string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `subpage-${spIndex}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const totalAlbums =
    sp.albums.length + (sp.sections?.reduce((sum, sec) => sum + sec.albums.length, 0) || 0);
  const firstThumb = getFirstThumb(sp);
  const slug = sp.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`subpage-tile ${isActive ? 'active' : ''}`}
      onClick={onClick}
      {...attributes}
    >
      <div className="subpage-tile-drag" {...listeners} title="Drag to reorder">
        <IconGripVertical size={18} className="svg-icon svg-drag" />
      </div>

      {sp.enabled === false && (
        <span
          className="subpage-badge-protected"
          style={{ background: '#e60012', color: '#fff' }}
          title="Page is disabled"
        >
          Disabled
        </span>
      )}

      {sp.hidden === true && sp.enabled !== false && (
        <span
          className="subpage-badge-protected"
          title="Hidden from navigation, reachable by direct link"
        >
          Unlisted
        </span>
      )}

      {sp.password && (
        <span className="subpage-badge-protected" title="Password protected">
          <IconLock size={12} /> Password
        </span>
      )}

      <div className="subpage-tile-cover">
        {firstThumb ? (
          <img src={`/api/admin/thumbnail/${firstThumb}`} alt="" loading="lazy" />
        ) : (
          <div className="subpage-tile-placeholder">
            <IconFolder />
          </div>
        )}
        <div className="subpage-hover-overlay">
          <span className="hover-action-btn">
            <IconPencil size={14} /> Edit Page
          </span>
        </div>
      </div>
      <div className="subpage-tile-info">
        <div className="subpage-tile-title-row">
          <span className="subpage-tile-name">{sp.title || sp.name}</span>
          <span className="subpage-tile-slug">/{slug}</span>
        </div>
        <span className="subpage-tile-meta">
          <IconFolder /> {totalAlbums} album{totalAlbums !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────

export default function PageBuilder() {
  const [gallery, setGallery] = useState<GalleryState>({ hero: [], albums: [], subpages: [] });
  const [immichAlbums, setImmichAlbums] = useState<ImmichAlbumInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [expandedSubpage, setExpandedSubpage] = useState<number | null>(null);
  const [drawerMode, setDrawerMode] = useState<'edit' | 'preview'>('edit');
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [heroPickerTarget, setHeroPickerTarget] = useState<HeroPickerTarget | null>(null);
  const [orderEditorTarget, setOrderEditorTarget] = useState<OrderEditorTarget | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingAlbumAddress, setEditingAlbumAddress] = useState<ActiveEditAlbumAddress | null>(
    null,
  );

  // Keep the builder still behind either drawer. One combined lock rather than
  // one per drawer: the album drawer opens from inside the subpage drawer, and
  // a single condition avoids two locks racing over the same inline style.
  useScrollLock(editingAlbumAddress !== null || expandedSubpage !== null);

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

  // ── Escape closes the subpage sheet — only when it is topmost ─
  useEffect(() => {
    if (expandedSubpage === null) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      // Listbox preventDefaults its own Escape but does not stopPropagation —
      // respect that so closing a popup never also closes the sheet.
      if (e.defaultPrevented) return;
      // A higher layer (album editor, pickers, order editor) owns the key.
      if (editingAlbumAddress || pickerTarget || heroPickerTarget || orderEditorTarget) return;
      setExpandedSubpage(null);
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [expandedSubpage, editingAlbumAddress, pickerTarget, heroPickerTarget, orderEditorTarget]);

  useUnsavedGuard(dirty);

  async function loadData() {
    setLoading(true);
    try {
      const [galleryRes, albumsRes] = await Promise.all([
        fetch('/api/admin/gallery'),
        fetch('/api/admin/albums'),
      ]);

      if (galleryRes.ok) {
        const { gallery: raw } = await galleryRes.json();
        setGallery(parseGalleryYaml(raw));
      }

      if (albumsRes.ok) {
        const { albums } = await albumsRes.json();
        setImmichAlbums(albums);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  }

  function parseGalleryYaml(raw: Record<string, unknown>): GalleryState {
    const hero = Array.isArray(raw.hero) ? raw.hero : raw.hero ? [raw.hero as string] : [];
    const albums = parseAlbumEntries(
      raw.albums as Array<string | Record<string, string>> | undefined,
    );

    let subpages: Subpage[] = [];
    if (Array.isArray(raw.subpages)) {
      subpages = (raw.subpages as Array<Record<string, unknown>>).map((sp) => ({
        name: (sp.name as string) || '',
        title: sp.title as string | undefined,
        subtitle: sp.subtitle as string | undefined,
        password: sp.password as string | undefined,
        enabled: sp.enabled !== false,
        hidden: sp.hidden === true,
        essayText: sp.essayText as string | undefined,
        essayFile: sp.essayFile as string | undefined,
        albums: parseAlbumEntries(sp.albums as Array<string | Record<string, string>> | undefined),
        sections: sp.sections
          ? (sp.sections as Array<Record<string, unknown>>).map((sec) => ({
              title: (sec.title as string) || '',
              description: sec.description as string | undefined,
              albums: parseAlbumEntries(sec.albums as Array<string | Record<string, string>>),
            }))
          : undefined,
        grid: sp.grid as Subpage['grid'],
        coverGrid:
          (sp.coverGrid as Subpage['coverGrid']) ?? seedCoverGrid(sp.grid as Subpage['grid']),
      }));
    } else if (raw.subpages && typeof raw.subpages === 'object') {
      subpages = Object.entries(raw.subpages as Record<string, unknown>).map(([name, value]) => {
        if (Array.isArray(value)) {
          return { name, albums: parseAlbumEntries(value), sections: undefined, enabled: true };
        }
        const sp = value as Record<string, unknown>;
        return {
          name,
          title: sp.title as string | undefined,
          subtitle: sp.subtitle as string | undefined,
          password: sp.password as string | undefined,
          enabled: sp.enabled !== false,
          hidden: sp.hidden === true,
          essayText: sp.essayText as string | undefined,
          essayFile: sp.essayFile as string | undefined,
          albums: parseAlbumEntries(
            sp.albums as Array<string | Record<string, string>> | undefined,
          ),
          sections: undefined,
          grid: sp.grid as Subpage['grid'],
          coverGrid:
            (sp.coverGrid as Subpage['coverGrid']) ?? seedCoverGrid(sp.grid as Subpage['grid']),
        };
      });
    }

    return { hero, albums, subpages };
  }

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveMessage('');
  }, []);

  // ── Save ──────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaveMessage('');

    const yamlData: Record<string, unknown> = {};

    if (gallery.hero.length > 0) {
      yamlData.hero = gallery.hero;
    }
    if (gallery.albums.length > 0) {
      yamlData.albums = serializeAlbumEntries(gallery.albums);
    }
    if (gallery.subpages.length > 0) {
      yamlData.subpages = gallery.subpages.map((sp) => {
        const entry: Record<string, unknown> = { name: sp.name };
        if (sp.title) entry.title = sp.title;
        if (sp.subtitle) entry.subtitle = sp.subtitle;
        if (sp.password) entry.password = sp.password;
        if (sp.enabled === false) entry.enabled = false;
        if (sp.hidden === true) entry.hidden = true;
        if (sp.essayText) entry.essayText = sp.essayText;
        if (sp.essayFile) entry.essayFile = sp.essayFile;
        if (sp.grid) entry.grid = sp.grid;
        if (sp.coverGrid) entry.coverGrid = sp.coverGrid;

        if (sp.sections && sp.sections.length > 0) {
          entry.sections = sp.sections.map((sec) => {
            const s: Record<string, unknown> = {
              title: sec.title,
              albums: serializeAlbumEntries(sec.albums),
            };
            if (sec.description) s.description = sec.description;
            return s;
          });
          if (sp.albums.length > 0) {
            entry.albums = serializeAlbumEntries(sp.albums);
          }
        } else {
          entry.albums = serializeAlbumEntries(sp.albums);
        }

        return entry;
      });
    }

    try {
      const res = await fetch('/api/admin/gallery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gallery: yamlData }),
      });

      if (res.ok) {
        const data = await res.json();
        setDirty(false);
        setSaveMessage(data.message || 'Saved successfully!');
        setTimeout(() => setSaveMessage(''), 5000);
      } else {
        const err = await res.json();
        setSaveMessage(`Error: ${err.error}`);
      }
    } catch {
      setSaveMessage('Error: Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // ── Hero Picker ──────────────────────────────────────────────
  function handleHeroSelect(assetId: string) {
    setGallery((g) => ({ ...g, hero: [...g.hero, assetId] }));
    setHeroPickerTarget(null);
    markDirty();
  }

  // ── Album Picker Handlers ────────────────────────────────────
  function handlePickAlbum(albumId: string) {
    if (!pickerTarget) return;

    const entry: AlbumEntry = { id: albumId };

    if (pickerTarget.type === 'standalone') {
      setGallery((g) => ({ ...g, albums: [...g.albums, entry] }));
    } else if (pickerTarget.type === 'subpage' && pickerTarget.subpageIndex != null) {
      setGallery((g) => {
        const subpages = [...g.subpages];
        const sp = { ...subpages[pickerTarget.subpageIndex!] };
        sp.albums = [...sp.albums, entry];
        subpages[pickerTarget.subpageIndex!] = sp;
        return { ...g, subpages };
      });
    } else if (
      pickerTarget.type === 'section' &&
      pickerTarget.subpageIndex != null &&
      pickerTarget.sectionIndex != null
    ) {
      setGallery((g) => {
        const subpages = [...g.subpages];
        const sp = { ...subpages[pickerTarget.subpageIndex!] };
        const sections = [...(sp.sections || [])];
        const sec = { ...sections[pickerTarget.sectionIndex!] };
        sec.albums = [...sec.albums, entry];
        sections[pickerTarget.sectionIndex!] = sec;
        sp.sections = sections;
        subpages[pickerTarget.subpageIndex!] = sp;
        return { ...g, subpages };
      });
    }

    setPickerTarget(null);
    markDirty();
  }

  // ── Drag & Drop Handlers ─────────────────────────────────────
  function handleHeroDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = gallery.hero.findIndex((_, i) => `hero-${i}` === active.id);
    const newIndex = gallery.hero.findIndex((_, i) => `hero-${i}` === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      setGallery((g) => ({ ...g, hero: arrayMove(g.hero, oldIndex, newIndex) }));
      markDirty();
    }
  }

  function handleAlbumDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = gallery.albums.findIndex((a, i) => `album-${a.id}-${i}` === active.id);
    const newIndex = gallery.albums.findIndex((a, i) => `album-${a.id}-${i}` === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      setGallery((g) => ({ ...g, albums: arrayMove(g.albums, oldIndex, newIndex) }));
      markDirty();
    }
  }

  function handleSubpageDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = gallery.subpages.findIndex((_, i) => `subpage-${i}` === active.id);
    const newIndex = gallery.subpages.findIndex((_, i) => `subpage-${i}` === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      setGallery((g) => ({ ...g, subpages: arrayMove(g.subpages, oldIndex, newIndex) }));
      if (expandedSubpage === oldIndex) setExpandedSubpage(newIndex);
      else if (expandedSubpage !== null) {
        if (oldIndex < expandedSubpage && newIndex >= expandedSubpage)
          setExpandedSubpage(expandedSubpage - 1);
        else if (oldIndex > expandedSubpage && newIndex <= expandedSubpage)
          setExpandedSubpage(expandedSubpage + 1);
      }
      markDirty();
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
        setGallery((g) => {
          const subpages = [...g.subpages];
          const sp2 = { ...subpages[spIndex] };
          sp2.albums = arrayMove(sp2.albums, oldIndex, newIndex);
          subpages[spIndex] = sp2;
          return { ...g, subpages };
        });
        markDirty();
      }
    };
  }

  // ── Subpage Management ────────────────────────────────────────
  function addSubpage() {
    setGallery((g) => ({
      ...g,
      subpages: [
        ...g.subpages,
        { name: `New Page ${g.subpages.length + 1}`, albums: [], sections: undefined },
      ],
    }));
    markDirty();
  }

  function removeSubpage(index: number) {
    if (!confirm('Remove this subpage?')) return;
    setGallery((g) => ({
      ...g,
      subpages: g.subpages.filter((_, i) => i !== index),
    }));
    markDirty();
  }

  function updateSubpage(index: number, updates: Partial<Subpage>) {
    setGallery((g) => {
      const subpages = [...g.subpages];
      subpages[index] = { ...subpages[index], ...updates };
      return { ...g, subpages };
    });
    markDirty();
  }

  // ── Section Management ────────────────────────────────────────
  function addSection(subpageIndex: number) {
    setGallery((g) => {
      const subpages = [...g.subpages];
      const sp = { ...subpages[subpageIndex] };
      sp.sections = [...(sp.sections || []), { title: 'New Section', albums: [] }];
      subpages[subpageIndex] = sp;
      return { ...g, subpages };
    });
    markDirty();
  }

  function removeSection(subpageIndex: number, sectionIndex: number) {
    setGallery((g) => {
      const subpages = [...g.subpages];
      const sp = { ...subpages[subpageIndex] };
      sp.sections = (sp.sections || []).filter((_, i) => i !== sectionIndex);
      subpages[subpageIndex] = sp;
      return { ...g, subpages };
    });
    markDirty();
  }

  function updateSection(subpageIndex: number, sectionIndex: number, updates: Partial<Section>) {
    setGallery((g) => {
      const subpages = [...g.subpages];
      const sp = { ...subpages[subpageIndex] };
      const sections = [...(sp.sections || [])];
      sections[sectionIndex] = { ...sections[sectionIndex], ...updates };
      sp.sections = sections;
      subpages[subpageIndex] = sp;
      return { ...g, subpages };
    });
    markDirty();
  }

  // ── Album Removal ────────────────────────────────────────────
  function removeStandaloneAlbum(index: number) {
    setGallery((g) => ({
      ...g,
      albums: g.albums.filter((_, i) => i !== index),
    }));
    markDirty();
  }

  function removeSubpageAlbum(subpageIndex: number, albumIndex: number) {
    setGallery((g) => {
      const subpages = [...g.subpages];
      const sp = { ...subpages[subpageIndex] };
      sp.albums = sp.albums.filter((_, i) => i !== albumIndex);
      subpages[subpageIndex] = sp;
      return { ...g, subpages };
    });
    markDirty();
  }

  function removeSectionAlbum(subpageIndex: number, sectionIndex: number, albumIndex: number) {
    setGallery((g) => {
      const subpages = [...g.subpages];
      const sp = { ...subpages[subpageIndex] };
      const sections = [...(sp.sections || [])];
      const sec = { ...sections[sectionIndex] };
      sec.albums = sec.albums.filter((_, i) => i !== albumIndex);
      sections[sectionIndex] = sec;
      sp.sections = sections;
      subpages[subpageIndex] = sp;
      return { ...g, subpages };
    });
    markDirty();
  }

  // ── Hero Management ──────────────────────────────────────────
  function removeHero(index: number) {
    setGallery((g) => ({
      ...g,
      hero: g.hero.filter((_, i) => i !== index),
    }));
    markDirty();
  }

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

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
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
        saveMessage={saveMessage}
        onSave={handleSave}
        label="Save Changes"
        showPreview
      />

      {/* Search Bar */}
      <div className="builder-search-container">
        <div className="builder-search-wrapper">
          <span className="builder-search-icon">
            <IconSearch size={14} />
          </span>
          <input
            type="text"
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
                  No hero images configured. Add photos to show a hero carousel on the homepage.
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
                      setEditingAlbumAddress({ type: 'standalone', albumIndex: originalIndex })
                    }
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {/* Subpages */}
      <section className="builder-section">
        <div className="builder-section-header">
          <h2>
            <IconFolder />
            Subpages
          </h2>
          <button className="admin-btn admin-btn-sm" onClick={addSubpage}>
            + New Subpage
          </button>
        </div>

        {gallery.subpages.length === 0 && (
          <p className="empty-hint">
            No subpages. Create one to group albums under a custom URL path.
          </p>
        )}

        {gallery.subpages.length > 0 && filteredSubpages.length === 0 && (
          <p className="empty-hint">No matching subpages found.</p>
        )}

        {/* Collapsed overview grid with DnD */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSubpageDragEnd}
        >
          <SortableContext
            items={filteredSubpages.map(({ index }) => `subpage-${index}`)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="subpage-grid">
              {filteredSubpages.map(({ sp, index }) => (
                <SortableSubpageTile
                  key={`subpage-${index}`}
                  sp={sp}
                  spIndex={index}
                  isActive={expandedSubpage === index}
                  onClick={() => setExpandedSubpage(expandedSubpage === index ? null : index)}
                  getFirstThumb={getFirstSubpageThumb}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Expanded subpage detail (Slide-Over Drawer) */}
        {expandedSubpage !== null && gallery.subpages[expandedSubpage] && (
          <SubpageDrawer
            sp={gallery.subpages[expandedSubpage]}
            spIndex={expandedSubpage}
            immichAlbums={immichAlbums}
            sensors={sensors}
            drawerMode={drawerMode}
            onDrawerModeChange={setDrawerMode}
            onClose={() => setExpandedSubpage(null)}
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
          />
        )}
      </section>

      {/* Album Picker Modal */}
      {pickerTarget && (
        <AlbumPicker
          albums={immichAlbums}
          onSelect={handlePickAlbum}
          onClose={() => setPickerTarget(null)}
          usedAlbumIds={getAllUsedAlbumIds()}
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

  function getEditingAlbumInfo(addr: ActiveEditAlbumAddress) {
    let album: AlbumEntry;
    let name: string;
    let count: number;
    let thumbnailId: string | null;
    let onUpdate: (updates: Partial<AlbumEntry>) => void;
    let onRemove: () => void;

    if (addr.type === 'standalone') {
      album = gallery.albums[addr.albumIndex];
      if (!album) return null;
      name = getAlbumName(album.id);
      count = getAlbumCount(album.id);
      thumbnailId = getAlbumThumbnailId(album.id);
      onUpdate = (updates) => {
        setGallery((g) => {
          const albums = [...g.albums];
          albums[addr.albumIndex] = { ...albums[addr.albumIndex], ...updates };
          return { ...g, albums };
        });
        markDirty();
      };
      onRemove = () => {
        removeStandaloneAlbum(addr.albumIndex);
      };
    } else if (addr.type === 'subpage') {
      const sp = gallery.subpages[addr.subpageIndex!];
      if (!sp) return null;
      album = sp.albums[addr.albumIndex];
      if (!album) return null;
      name = getAlbumName(album.id);
      count = getAlbumCount(album.id);
      thumbnailId = getAlbumThumbnailId(album.id);
      onUpdate = (updates) => {
        setGallery((g) => {
          const subpages = [...g.subpages];
          const sp2 = { ...subpages[addr.subpageIndex!] };
          const albums = [...sp2.albums];
          albums[addr.albumIndex] = { ...albums[addr.albumIndex], ...updates };
          sp2.albums = albums;
          subpages[addr.subpageIndex!] = sp2;
          return { ...g, subpages };
        });
        markDirty();
      };
      onRemove = () => {
        removeSubpageAlbum(addr.subpageIndex!, addr.albumIndex);
      };
    } else {
      const sp = gallery.subpages[addr.subpageIndex!];
      if (!sp) return null;
      const sec = sp.sections?.[addr.sectionIndex!];
      if (!sec) return null;
      album = sec.albums[addr.albumIndex];
      if (!album) return null;
      name = getAlbumName(album.id);
      count = getAlbumCount(album.id);
      thumbnailId = getAlbumThumbnailId(album.id);
      onUpdate = (updates) => {
        setGallery((g) => {
          const subpages = [...g.subpages];
          const sp2 = { ...subpages[addr.subpageIndex!] };
          const sections = [...(sp2.sections || [])];
          const sec2 = { ...sections[addr.sectionIndex!] };
          const albums = [...sec2.albums];
          albums[addr.albumIndex] = { ...albums[addr.albumIndex], ...updates };
          sec2.albums = albums;
          sections[addr.sectionIndex!] = sec2;
          sp2.sections = sections;
          subpages[addr.subpageIndex!] = sp2;
          return { ...g, subpages };
        });
        markDirty();
      };
      onRemove = () => {
        removeSectionAlbum(addr.subpageIndex!, addr.sectionIndex!, addr.albumIndex);
      };
    }

    return { album, name, count, thumbnailId, onUpdate, onRemove };
  }

  function getAllUsedAlbumIds(): Set<string> {
    const ids = new Set<string>();
    gallery.albums.forEach((a) => ids.add(a.id));
    gallery.subpages.forEach((sp) => {
      sp.albums.forEach((a) => ids.add(a.id));
      sp.sections?.forEach((sec) => sec.albums.forEach((a) => ids.add(a.id)));
    });
    return ids;
  }
}
