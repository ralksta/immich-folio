'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
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
import { EssayBlockEditor } from './EssayBlockEditor';
import SaveBar from './SaveBar';
import { useScrollLock } from './useScrollLock';
import {
  ALBUM_SORT_MODES,
  DEFAULT_ALBUM_SORT,
  isAlbumSortMode,
  type AlbumSortMode,
} from '@/lib/albumSort';
import {
  COVER_GRID_COLUMNS_MAX,
  COVER_GRID_COLUMNS_MIN,
  COVER_GRID_GAP_MAX,
  slugify,
  type AlbumEntryObject,
} from '@/lib/config/schema';
import {
  IconArrowDown,
  IconArrowUp,
  IconBook,
  IconCalendar,
  IconCamera,
  IconCopy,
  IconFolder,
  IconGripVertical,
  IconHome,
  IconImage,
  IconBan,
  IconEyeOff,
  IconGlobe,
  IconLock,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSortAlpha,
  IconTrash,
  IconX,
} from './Icons';
import { Listbox, type ListboxOption } from './Listbox';

/**
 * Labels for the per-album sort control.
 *
 * Kept as plain text on their own because they also feed the `title` attribute
 * on the album card's sort badge, where markup is not an option.
 */
const SORT_LABELS: Record<AlbumSortMode, string> = {
  immich: 'Immich order (default)',
  newest: 'Newest first',
  oldest: 'Oldest first',
  filename: 'Filename',
  manual: 'Manual',
};

/** Manual reuses the drag glyph so the control matches the card's badge. */
const SORT_ICONS: Record<AlbumSortMode, ReactNode> = {
  immich: <IconCalendar />,
  newest: <IconArrowDown />,
  oldest: <IconArrowUp />,
  filename: <IconSortAlpha />,
  manual: <IconGripVertical />,
};

const SORT_OPTIONS: readonly ListboxOption<AlbumSortMode>[] = ALBUM_SORT_MODES.map((mode) => ({
  value: mode,
  label: SORT_LABELS[mode],
  icon: SORT_ICONS[mode],
}));

// ── Types ──────────────────────────────────────────────────────
interface AlbumEntry {
  id: string;
  title?: string;
  description?: string;
  password?: string;
  heroImage?: string;
  sort?: AlbumSortMode;
  /** Pinned asset UUIDs for `sort: manual`; everything else follows automatically. */
  assetOrder?: string[];
  /** EXPERIMENTAL: per-album grid override (layout only in the UI for now) */
  grid?: { columns?: number; gap?: number; aspectRatio?: string; layout?: string };
  /** EXPERIMENTAL: focal point for the cover crop, e.g. "50% 25%" or "top" */
  coverPosition?: string;
}

interface Section {
  title: string;
  description?: string;
  albums: AlbumEntry[];
}

interface Subpage {
  name: string;
  title?: string;
  subtitle?: string;
  password?: string;
  enabled?: boolean;
  /** EXPERIMENTAL: reachable by direct link, but not shown in navigation */
  hidden?: boolean;
  essayText?: string;
  essayFile?: string;
  sections?: Section[];
  albums: AlbumEntry[];
  grid?: { columns?: number; gap?: number; aspectRatio?: string; layout?: string };
}

/**
 * Drops keys the editor cleared so an emptied field never persists as `null`
 * in gallery.yaml, and returns undefined once nothing is left — `handleSave`
 * only writes `grid` when it is truthy.
 */
function normalizeSubpageGrid(grid: Subpage['grid']): Subpage['grid'] {
  if (!grid) return undefined;
  const next = { ...grid };
  for (const key of Object.keys(next) as Array<keyof typeof next>) {
    const value = next[key];
    if (value === undefined || value === '') delete next[key];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

interface GalleryState {
  hero: string[];
  albums: AlbumEntry[];
  subpages: Subpage[];
}

interface ActiveEditAlbumAddress {
  type: 'standalone' | 'subpage' | 'section';
  subpageIndex?: number;
  sectionIndex?: number;
  albumIndex: number;
}

interface ImmichAlbumInfo {
  id: string;
  albumName: string;
  description: string;
  thumbnailAssetId: string | null;
  assetCount: number;
  isConfigured: boolean;
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
    entry.coverPosition,
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

// ── Sortable Album Card ────────────────────────────────────────

function SortableAlbumCard({
  album,
  index,
  name,
  count,
  thumbnailId,
  onRemove,
  onEdit,
}: {
  album: AlbumEntry;
  index: number;
  name: string;
  count: number;
  thumbnailId: string | null;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `album-${album.id}-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <AlbumCard
        album={album}
        name={name}
        count={count}
        thumbnailId={thumbnailId}
        onRemove={onRemove}
        onEdit={onEdit}
        dragListeners={listeners}
      />
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
  const [pickerTarget, setPickerTarget] = useState<{
    type: 'standalone' | 'subpage' | 'section';
    subpageIndex?: number;
    sectionIndex?: number;
  } | null>(null);
  const [heroPickerTarget, setHeroPickerTarget] = useState<{
    albumId?: string;
    onSelect: (assetId: string) => void;
    currentAssetIds?: string[];
    title?: string;
  } | null>(null);
  const [orderEditorTarget, setOrderEditorTarget] = useState<{
    albumId: string;
    albumName: string;
    assetOrder: string[];
    onSave: (assetOrder: string[]) => void;
  } | null>(null);
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

  // ── Unsaved changes guard ────────────────────────────────────
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

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
          <div className="subpage-drawer-backdrop" onClick={() => setExpandedSubpage(null)}>
            <div className="subpage-drawer-container" onClick={(e) => e.stopPropagation()}>
              {(() => {
                const sp = gallery.subpages[expandedSubpage];
                const spIndex = expandedSubpage;
                return (
                  <>
                    <div className="subpage-drawer-header">
                      <div className="subpage-drawer-title-group">
                        <span className="subpage-drawer-breadcrumb">Pages / Subpages</span>
                        <h3 className="subpage-drawer-title">
                          {sp.title || sp.name || 'Untitled Page'}
                        </h3>
                      </div>
                      <div className="subpage-drawer-header-actions">
                        <div className="segmented-control" style={{ padding: '2px' }}>
                          <button
                            type="button"
                            className={`segment-btn ${drawerMode === 'edit' ? 'active' : ''}`}
                            onClick={() => setDrawerMode('edit')}
                            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                          >
                            <IconPencil size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            className={`segment-btn ${drawerMode === 'preview' ? 'active' : ''}`}
                            onClick={() => setDrawerMode('preview')}
                            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                          >
                            <IconSearch size={14} /> Live Preview
                          </button>
                        </div>

                        <a
                          href={`/${slugify(sp.name)}?fresh=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-btn admin-btn-xs admin-btn-ghost"
                          title="Open live page in new tab (bypassing cache)"
                        >
                          /{slugify(sp.name)} ↗
                        </a>
                        <button
                          className="admin-btn-icon"
                          onClick={() => setExpandedSubpage(null)}
                          title="Close drawer"
                        >
                          <IconX size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="subpage-drawer-body">
                      {drawerMode === 'preview' ? (
                        <div className="drawer-live-preview-panel">
                          <div className="preview-hero-banner">
                            <h2 className="preview-hero-title">
                              {sp.title || sp.name || 'Untitled Page'}
                            </h2>
                            {sp.subtitle && <p className="preview-hero-sub">{sp.subtitle}</p>}
                          </div>

                          {sp.sections && sp.sections.length > 0 ? (
                            sp.sections.map((sec, sIdx) => (
                              <div key={sIdx} className="preview-section-group">
                                <h3 className="preview-section-title">
                                  {sec.title || 'Untitled Section'}
                                </h3>
                                {sec.description && (
                                  <p className="preview-section-desc">{sec.description}</p>
                                )}
                                <div className="preview-albums-grid">
                                  {sec.albums.map((alb, aIdx) => {
                                    const immichAlb = immichAlbums.find((a) => a.id === alb.id);
                                    const thumb = alb.heroImage || immichAlb?.thumbnailAssetId;

                                    return (
                                      <div key={aIdx} className="preview-album-tile">
                                        <div className="preview-album-cover">
                                          {thumb ? (
                                            <img src={`/api/admin/thumbnail/${thumb}`} alt="" />
                                          ) : (
                                            <div className="subpage-tile-placeholder">
                                              <IconFolder />
                                            </div>
                                          )}
                                        </div>
                                        <span className="preview-album-title">
                                          {alb.title || immichAlb?.albumName || alb.id}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="preview-albums-grid">
                              {sp.albums.map((alb, aIdx) => {
                                const immichAlb = immichAlbums.find((a) => a.id === alb.id);
                                const thumb = alb.heroImage || immichAlb?.thumbnailAssetId;

                                return (
                                  <div key={aIdx} className="preview-album-tile">
                                    <div className="preview-album-cover">
                                      {thumb ? (
                                        <img src={`/api/admin/thumbnail/${thumb}`} alt="" />
                                      ) : (
                                        <div className="subpage-tile-placeholder">
                                          <IconFolder />
                                        </div>
                                      )}
                                    </div>
                                    <span className="preview-album-title">
                                      {alb.title || immichAlb?.albumName || alb.id}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="admin-sheet-columns admin-sheet-columns--settings-aside">
                          <div className="admin-sheet-col">
                            <div className="subpage-drawer-section">
                              <div className="admin-field">
                                <label>Page Name (URL Identifier)</label>
                                <div className="input-slug-wrapper">
                                  <input
                                    className="subpage-name-input"
                                    value={sp.name}
                                    onChange={(e) =>
                                      updateSubpage(spIndex, { name: e.target.value })
                                    }
                                    placeholder="e.g. dubai, travel, weddings"
                                  />
                                  <span className="input-slug-preview">/{slugify(sp.name)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Subpage metadata */}
                            <div className="subpage-drawer-section">
                              <div className="admin-field-row">
                                <div className="admin-field">
                                  <label>Display Title (optional)</label>
                                  <input
                                    value={sp.title || ''}
                                    onChange={(e) =>
                                      updateSubpage(spIndex, { title: e.target.value || undefined })
                                    }
                                    placeholder="Display title (defaults to name)"
                                  />
                                </div>
                                <div className="admin-field">
                                  <label>Subtitle</label>
                                  <input
                                    value={sp.subtitle || ''}
                                    onChange={(e) =>
                                      updateSubpage(spIndex, {
                                        subtitle: e.target.value || undefined,
                                      })
                                    }
                                    placeholder="Subtitle text"
                                  />
                                </div>
                              </div>
                              <div className="admin-field" style={{ marginTop: '1rem' }}>
                                <label>Visibility &amp; Access</label>
                                {/*
                            One field, three states — enabled/hidden are two YAML flags,
                            but for the owner it is a single question: how visible is
                            this page? Splitting it across two toggles produced
                            contradictory copy ("Disabled (Hidden)" vs "Unlisted").
                          */}
                                {(
                                  [
                                    {
                                      key: 'published',
                                      active: sp.enabled !== false && sp.hidden !== true,
                                      icon: <IconGlobe size={15} />,
                                      iconColor: '#4ade80',
                                      title: 'Published',
                                      desc: 'Shown in the header menu and homepage lists, reachable via URL',
                                      patch: { enabled: true, hidden: false },
                                    },
                                    {
                                      key: 'unlisted',
                                      active: sp.enabled !== false && sp.hidden === true,
                                      icon: <IconEyeOff size={15} />,
                                      iconColor: '#fbbf24',
                                      title: 'Unlisted (Experimental)',
                                      desc: 'Not shown in menus or on the homepage, but reachable via direct link',
                                      patch: { enabled: true, hidden: true },
                                    },
                                    {
                                      key: 'disabled',
                                      active: sp.enabled === false,
                                      icon: <IconBan size={15} />,
                                      iconColor: '#f87171',
                                      title: 'Disabled',
                                      desc: 'Completely offline — returns 404 even when accessed directly',
                                      patch: { enabled: false, hidden: false },
                                    },
                                  ] as const
                                ).map((opt) => (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    className={`admin-toggle-card ${opt.active ? 'active' : ''}`}
                                    onClick={() => updateSubpage(spIndex, opt.patch)}
                                    aria-pressed={opt.active}
                                    style={{
                                      padding: '10px 14px',
                                      width: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      marginBottom: '6px',
                                    }}
                                  >
                                    <div className="toggle-card-info" style={{ textAlign: 'left' }}>
                                      <span
                                        className="toggle-card-title"
                                        style={{
                                          fontWeight: 600,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                        }}
                                      >
                                        <span
                                          style={{ color: opt.iconColor, display: 'inline-flex' }}
                                          aria-hidden="true"
                                        >
                                          {opt.icon}
                                        </span>
                                        {opt.title}
                                      </span>
                                      <span
                                        className="toggle-card-desc"
                                        style={{
                                          fontSize: '0.8rem',
                                          display: 'block',
                                          opacity: 0.75,
                                        }}
                                      >
                                        {opt.desc}
                                      </span>
                                    </div>
                                    <div className={`switch-toggle ${opt.active ? 'on' : ''}`}>
                                      <span className="switch-slider" />
                                    </div>
                                  </button>
                                ))}

                                {/* Password lives in the same group: it is the access half
                              of "who gets to see this page". Applies to Published and
                              Unlisted; a Disabled page 404s before the gate. */}
                                <div
                                  className="password-input-wrapper"
                                  style={{ marginTop: '6px' }}
                                >
                                  <span className="password-icon">
                                    <IconLock size={12} />
                                  </span>
                                  <input
                                    type="password"
                                    value={sp.password || ''}
                                    onChange={(e) =>
                                      updateSubpage(spIndex, {
                                        password: e.target.value || undefined,
                                      })
                                    }
                                    placeholder="Password protection (optional) — leave empty for public access"
                                    disabled={sp.enabled === false}
                                  />
                                </div>
                              </div>
                              <div className="admin-field" style={{ marginTop: '1rem' }}>
                                <label>Page Layout Style</label>
                                <select
                                  value={sp.grid?.layout || 'masonry'}
                                  onChange={(e) => {
                                    const newLayout = e.target.value;
                                    updateSubpage(spIndex, {
                                      grid: { ...(sp.grid || {}), layout: newLayout },
                                    });
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    width: '100%',
                                    fontSize: '0.9rem',
                                  }}
                                >
                                  {/*
                              Plain text, no emoji: an <option> cannot contain markup, so the
                              SVG icon set is not available here — and a decorative emoji is
                              not a substitute for it.
                            */}
                                  <option value="masonry">Masonry Grid (Dynamic Height)</option>
                                  <option value="uniform">Uniform Grid (Square Tiles)</option>
                                  <option value="showcase">Showcase (Featured First Asset)</option>
                                  <option value="filmstrip">Filmstrip (Horizontal Scroll)</option>
                                  <option value="editorial-flow">Editorial Flow</option>
                                  <option value="essay">
                                    Photo Essay Mode (Storytelling Editor)
                                  </option>
                                </select>
                              </div>

                              {/* Album cover grid — hidden in essay mode, which
                                  renders a story instead of a cover grid. The
                                  album count is deliberately not checked: it
                                  changes in this very drawer, and a field that
                                  vanishes while you edit is worse than one that
                                  has no effect yet. */}
                              {sp.grid?.layout !== 'essay' && sp.essayText == null && (
                                <div className="admin-field" style={{ marginTop: '1rem' }}>
                                  <label>Album Cover Grid</label>
                                  <div style={{ display: 'flex', gap: '12px' }}>
                                    <input
                                      type="number"
                                      min={COVER_GRID_COLUMNS_MIN}
                                      max={COVER_GRID_COLUMNS_MAX}
                                      value={sp.grid?.columns ?? ''}
                                      placeholder="Columns (site default)"
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const columns = raw === '' ? undefined : Number(raw);
                                        updateSubpage(spIndex, {
                                          grid: normalizeSubpageGrid({
                                            ...(sp.grid || {}),
                                            columns:
                                              columns != null &&
                                              columns >= COVER_GRID_COLUMNS_MIN &&
                                              columns <= COVER_GRID_COLUMNS_MAX
                                                ? columns
                                                : undefined,
                                          }),
                                        });
                                      }}
                                      style={{
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        flex: 1,
                                        fontSize: '0.9rem',
                                      }}
                                    />
                                    <input
                                      type="number"
                                      min={0}
                                      max={COVER_GRID_GAP_MAX}
                                      value={sp.grid?.gap ?? ''}
                                      placeholder="Gap in px (theme default)"
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const gap = raw === '' ? undefined : Number(raw);
                                        updateSubpage(spIndex, {
                                          grid: normalizeSubpageGrid({
                                            ...(sp.grid || {}),
                                            gap:
                                              gap != null && gap >= 0 && gap <= COVER_GRID_GAP_MAX
                                                ? gap
                                                : undefined,
                                          }),
                                        });
                                      }}
                                      style={{
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        flex: 1,
                                        fontSize: '0.9rem',
                                      }}
                                    />
                                  </div>
                                  <p className="admin-field-hint">
                                    Overrides how the album covers are tiled on this page. Leave the
                                    column count empty to follow the site-wide grid setting, and the
                                    gap empty to keep the theme&apos;s own spacing. Tablet widths
                                    show at most two covers per row.
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Visual Photo Essay Builder (if layout === 'essay') */}
                            {(sp.grid?.layout === 'essay' || sp.essayText != null) && (
                              <div className="subpage-drawer-section">
                                <div className="drawer-section-heading">
                                  <h4>
                                    <IconBook size={16} /> Storytelling &amp; Photo Essay Builder
                                  </h4>
                                  <p>Compose text, quotes, and fullbleed/wide photos visually.</p>
                                </div>

                                <EssayBlockEditor
                                  markdown={sp.essayText || ''}
                                  onChange={(newMarkdown) =>
                                    updateSubpage(spIndex, { essayText: newMarkdown })
                                  }
                                  onSelectPhoto={(callback) => {
                                    setHeroPickerTarget({
                                      albumId: undefined,
                                      title: 'Select Photo for Photo Essay',
                                      onSelect: (assetId) => {
                                        callback(assetId);
                                        setHeroPickerTarget(null);
                                      },
                                    });
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          <div className="admin-sheet-col admin-sheet-col--divided">
                            {/* Albums (if no sections) with DnD */}
                            {(!sp.sections || sp.sections.length === 0) && (
                              <div className="subpage-albums">
                                <div className="subpage-albums-header">
                                  <span>Albums in this Page</span>
                                  <button
                                    className="admin-btn admin-btn-xs admin-btn-primary"
                                    onClick={() =>
                                      setPickerTarget({ type: 'subpage', subpageIndex: spIndex })
                                    }
                                  >
                                    + Add Album
                                  </button>
                                </div>
                                <DndContext
                                  sensors={sensors}
                                  collisionDetection={closestCenter}
                                  onDragEnd={handleSubpageAlbumDragEnd(spIndex)}
                                >
                                  <SortableContext
                                    items={sp.albums.map((a, i) => `album-${a.id}-${i}`)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    <div className="album-list">
                                      {sp.albums.length === 0 && (
                                        <p className="empty-hint">
                                          No albums added yet. Click + Add Album to pick from
                                          Immich.
                                        </p>
                                      )}
                                      {sp.albums.map((album, aIndex) => (
                                        <SortableAlbumCard
                                          key={`${album.id}-${aIndex}`}
                                          album={album}
                                          index={aIndex}
                                          name={getAlbumName(album.id)}
                                          count={getAlbumCount(album.id)}
                                          thumbnailId={getAlbumThumbnailId(album.id)}
                                          onRemove={() => removeSubpageAlbum(spIndex, aIndex)}
                                          onEdit={() =>
                                            setEditingAlbumAddress({
                                              type: 'subpage',
                                              subpageIndex: spIndex,
                                              albumIndex: aIndex,
                                            })
                                          }
                                        />
                                      ))}
                                    </div>
                                  </SortableContext>
                                </DndContext>
                              </div>
                            )}

                            {/* Sections */}
                            {sp.sections && sp.sections.length > 0 && (
                              <div className="subpage-sections">
                                {sp.sections.map((sec, secIndex) => (
                                  <div key={secIndex} className="section-card">
                                    <div className="section-header">
                                      <input
                                        className="section-title-input"
                                        value={sec.title}
                                        onChange={(e) =>
                                          updateSection(spIndex, secIndex, {
                                            title: e.target.value,
                                          })
                                        }
                                        placeholder="Section title"
                                      />
                                      <button
                                        className="admin-btn-icon"
                                        onClick={() => removeSection(spIndex, secIndex)}
                                        title="Remove section"
                                      >
                                        <IconX size={14} />
                                      </button>
                                    </div>
                                    <div className="admin-field">
                                      <input
                                        value={sec.description || ''}
                                        onChange={(e) =>
                                          updateSection(spIndex, secIndex, {
                                            description: e.target.value || undefined,
                                          })
                                        }
                                        placeholder="Section description (optional)"
                                        className="section-desc-input"
                                      />
                                    </div>
                                    <div className="album-list">
                                      {sec.albums.map((album, aIndex) => (
                                        <AlbumCard
                                          key={`${album.id}-${aIndex}`}
                                          album={album}
                                          name={getAlbumName(album.id)}
                                          count={getAlbumCount(album.id)}
                                          thumbnailId={getAlbumThumbnailId(album.id)}
                                          onRemove={() =>
                                            removeSectionAlbum(spIndex, secIndex, aIndex)
                                          }
                                          onEdit={() =>
                                            setEditingAlbumAddress({
                                              type: 'section',
                                              subpageIndex: spIndex,
                                              sectionIndex: secIndex,
                                              albumIndex: aIndex,
                                            })
                                          }
                                        />
                                      ))}
                                    </div>
                                    <button
                                      className="admin-btn admin-btn-xs"
                                      onClick={() =>
                                        setPickerTarget({
                                          type: 'section',
                                          subpageIndex: spIndex,
                                          sectionIndex: secIndex,
                                        })
                                      }
                                    >
                                      + Add Album
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="subpage-actions" style={{ marginTop: '1rem' }}>
                              <button
                                className="admin-btn admin-btn-xs admin-btn-secondary"
                                onClick={() => addSection(spIndex)}
                              >
                                + Add Section
                              </button>
                              {sp.sections && sp.sections.length > 0 && (
                                <button
                                  className="admin-btn admin-btn-xs admin-btn-secondary"
                                  onClick={() =>
                                    setPickerTarget({ type: 'subpage', subpageIndex: spIndex })
                                  }
                                >
                                  + Add Loose Album
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="subpage-drawer-footer">
                      <button
                        className="admin-btn admin-btn-danger admin-btn-sm"
                        onClick={() => {
                          removeSubpage(spIndex);
                          setExpandedSubpage(null);
                        }}
                      >
                        <IconTrash size={14} /> Delete Subpage
                      </button>
                      <button
                        className="admin-btn admin-btn-primary admin-btn-sm"
                        onClick={() => setExpandedSubpage(null)}
                      >
                        Done
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
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
        const { album, name, count, thumbnailId, onUpdate, onRemove } = info;
        const heroThumb = album.heroImage || thumbnailId;

        return (
          <div className="album-drawer-overlay open" onClick={() => setEditingAlbumAddress(null)}>
            <div className="album-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="album-drawer-header">
                <h3>
                  <IconCamera /> Edit Album Details
                </h3>
                <button
                  className="admin-btn-icon"
                  onClick={() => setEditingAlbumAddress(null)}
                  title="Close details"
                >
                  <IconX size={14} />
                </button>
              </div>
              {/* One scrolling column: cover banner, then the form. Anything the
                  form already shows (password state, custom hero) is not
                  repeated as a read-only stat. */}
              <div className="album-drawer-body">
                <div className="admin-sheet-columns">
                  <div className="admin-sheet-col">
                    <div className="modal-cover-container">
                      {heroThumb ? (
                        <img src={`/api/admin/thumbnail/${heroThumb}`} alt="" loading="lazy" />
                      ) : (
                        <div className="modal-cover-placeholder">
                          <IconCamera />
                        </div>
                      )}
                    </div>
                    <div className="modal-meta-box">
                      <span className="modal-album-title">{album.title || name}</span>
                      <span className="modal-album-subtitle">
                        {count} {count === 1 ? 'photo' : 'photos'}
                        {album.title ? ` · Original: ${name}` : ''}
                      </span>
                    </div>

                    <div className="admin-field">
                      <label>Title override</label>
                      <input
                        value={album.title || ''}
                        onChange={(e) => onUpdate({ title: e.target.value || undefined })}
                        placeholder={name}
                      />
                    </div>

                    <div className="admin-field">
                      <label>Description</label>
                      <textarea
                        value={album.description || ''}
                        onChange={(e) => onUpdate({ description: e.target.value || undefined })}
                        placeholder="Optional description for visitors"
                        rows={4}
                      />
                    </div>

                    <div className="admin-field">
                      <label>Password protection</label>
                      <div className="input-with-icon">
                        <input
                          type="password"
                          value={album.password || ''}
                          onChange={(e) => onUpdate({ password: e.target.value || undefined })}
                          placeholder="Leave empty for public access"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="admin-sheet-col admin-sheet-col--divided">
                    <div className="admin-field">
                      <label>Layout override (Experimental)</label>
                      <select
                        value={album.grid?.layout || ''}
                        onChange={(e) => {
                          const layout = e.target.value || undefined;
                          // Only the layout is exposed here; drop the grid object
                          // entirely when it goes back to "inherit" so the YAML
                          // stays clean.
                          onUpdate({
                            grid: layout ? { ...(album.grid || {}), layout } : undefined,
                          });
                        }}
                      >
                        <option value="">Inherit from page / global settings</option>
                        <option value="masonry">Masonry</option>
                        <option value="uniform">Uniform Grid</option>
                        <option value="showcase">Showcase</option>
                        <option value="filmstrip">Filmstrip</option>
                        <option value="editorial-flow">Editorial Flow</option>
                        <option value="justified">Justified (Experimental)</option>
                      </select>
                    </div>

                    <div className="admin-field">
                      <label>Cover focal point (Experimental)</label>
                      <input
                        value={album.coverPosition || ''}
                        onChange={(e) => onUpdate({ coverPosition: e.target.value || undefined })}
                        placeholder={'e.g. "50% 25%" or "top" — where the cover crop should anchor'}
                      />
                    </div>

                    {/* Hero Image Selection */}
                    <div className="admin-field">
                      <label>Custom Hero Image</label>
                      <div className="album-hero-field">
                        {album.heroImage ? (
                          <div className="album-hero-preview">
                            <img src={`/api/admin/thumbnail/${album.heroImage}`} alt="Hero" />
                            <button
                              className="album-hero-remove"
                              onClick={() => onUpdate({ heroImage: undefined })}
                              title="Remove custom hero image"
                            >
                              <IconX size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="album-hero-empty">Using default album cover</span>
                        )}
                        <button
                          className="admin-btn admin-btn-sm"
                          onClick={() =>
                            setHeroPickerTarget({
                              albumId: album.id,
                              onSelect: (assetId) => {
                                onUpdate({ heroImage: assetId });
                                setHeroPickerTarget(null);
                              },
                              currentAssetIds: album.heroImage ? [album.heroImage] : [],
                              title: `Pick Hero Image for ${name}`,
                            })
                          }
                        >
                          <IconImage size={12} />{' '}
                          {album.heroImage ? 'Change Image' : 'Pick Hero Image'}
                        </button>
                      </div>
                    </div>

                    {/* Photo order */}
                    <div className="admin-field">
                      <label id="album-sort-label">Photo order</label>
                      <Listbox
                        labelledBy="album-sort-label"
                        value={album.sort || DEFAULT_ALBUM_SORT}
                        options={SORT_OPTIONS}
                        onChange={(mode) => onUpdate({ sort: mode })}
                      />
                      <span className="admin-field-hint">
                        {album.sort === 'manual'
                          ? 'Pinned photos come first, in the order you set. Everything else follows in the album’s Immich order.'
                          : 'Immich order follows the album’s own sort setting in Immich.'}
                      </span>

                      {album.sort === 'manual' && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <button
                            className="admin-btn admin-btn-sm"
                            onClick={() =>
                              setOrderEditorTarget({
                                albumId: album.id,
                                albumName: album.title || name,
                                assetOrder: album.assetOrder || [],
                                onSave: (assetOrder) => {
                                  onUpdate({ assetOrder });
                                  setOrderEditorTarget(null);
                                },
                              })
                            }
                          >
                            <IconGripVertical size={18} className="svg-icon svg-drag" />{' '}
                            {album.assetOrder?.length
                              ? `Reorder photos (${album.assetOrder.length} pinned)`
                              : 'Reorder photos'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="album-drawer-footer">
                <button
                  className="admin-btn admin-btn-ghost admin-btn-danger"
                  onClick={onRemove}
                  style={{ maxWidth: '160px' }}
                >
                  <IconTrash size={14} /> Remove Album
                </button>
                <div className="uuid-copy-box" title="Immich album UUID">
                  <code>{album.id}</code>
                  <button
                    className="uuid-copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(album.id);
                    }}
                    title="Copy UUID"
                    aria-label="Copy Immich album UUID"
                  >
                    <IconCopy size={12} />
                  </button>
                </div>
                <button
                  className="admin-btn admin-btn-primary"
                  onClick={() => setEditingAlbumAddress(null)}
                  style={{ maxWidth: '140px' }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
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

// ── Album Card Sub-component ───────────────────────────────────

interface AlbumCardProps {
  album: AlbumEntry;
  name: string;
  count: number;
  thumbnailId: string | null;
  onRemove: () => void;
  onEdit: () => void;
  dragListeners?: Record<string, unknown>;
}

function AlbumCard({
  album,
  name,
  count,
  thumbnailId,
  onRemove,
  onEdit,
  dragListeners,
}: AlbumCardProps) {
  const heroThumb = album.heroImage || thumbnailId;
  const hasPassword = !!album.password;
  const hasTitleOverride = !!album.title;

  return (
    <div className={`album-tile ${hasPassword ? 'has-password' : ''}`}>
      <div className="album-tile-cover">
        {dragListeners && (
          <div className="album-tile-drag" {...dragListeners} title="Drag to reorder">
            <IconGripVertical size={18} className="svg-icon svg-drag" />
          </div>
        )}
        {heroThumb ? (
          <img src={`/api/admin/thumbnail/${heroThumb}`} alt="" loading="lazy" />
        ) : (
          <div className="album-tile-placeholder">
            <IconCamera />
          </div>
        )}
        <div className="album-tile-overlay">
          <button className="album-tile-btn" onClick={onEdit} title="Edit details">
            <IconPencil size={14} />
          </button>
          <button
            className="album-tile-btn album-tile-btn-danger"
            onClick={onRemove}
            title="Remove album"
          >
            <IconTrash size={14} />
          </button>
        </div>
      </div>
      <div className="album-tile-info">
        <div className="album-tile-title-row">
          <span
            className={`album-tile-name ${hasTitleOverride ? 'custom-title' : ''}`}
            title={album.title || name}
          >
            {album.title || name}
          </span>
          <div className="album-tile-badges">
            {hasPassword && (
              <span className="badge badge-password" title="Password protected">
                <IconLock size={12} />
              </span>
            )}
            {album.heroImage && (
              <span className="badge badge-hero" title="Custom Hero Image set">
                <IconImage size={12} />
              </span>
            )}
            {album.sort && album.sort !== DEFAULT_ALBUM_SORT && (
              <span className="badge badge-sort" title={`Photo order: ${SORT_LABELS[album.sort]}`}>
                {album.sort === 'manual' ? (
                  <IconGripVertical size={18} className="svg-icon svg-drag" />
                ) : (
                  album.sort
                )}
              </span>
            )}
          </div>
        </div>
        <span className="album-tile-count">{count} photos</span>
      </div>
    </div>
  );
}
