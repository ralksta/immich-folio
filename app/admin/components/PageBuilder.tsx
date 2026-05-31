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

// ── Types ──────────────────────────────────────────────────────
interface AlbumEntry {
  id: string;
  title?: string;
  description?: string;
  password?: string;
  heroImage?: string;
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
  sections?: Section[];
  albums: AlbumEntry[];
  grid?: { columns?: number; gap?: number; aspectRatio?: string; layout?: string };
}

interface GalleryState {
  hero: string[];
  albums: AlbumEntry[];
  subpages: Subpage[];
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

function parseAlbumEntries(
  raw:
    | Array<
        | string
        | Record<
            string,
            string | { title: string; description?: string; password?: string; heroImage?: string }
          >
      >
    | undefined,
): AlbumEntry[] {
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
    };
  });
}

function serializeAlbumEntries(
  entries: AlbumEntry[],
): Array<
  | string
  | Record<string, string | { title: string; description?: string; password?: string; heroImage?: string }>
> {
  return entries.map((entry) => {
    if (!entry.title && !entry.description && !entry.password && !entry.heroImage) return entry.id;
    if (entry.title && !entry.description && !entry.password && !entry.heroImage) {
      return { [entry.id]: entry.title };
    }
    const val: { title: string; description?: string; password?: string; heroImage?: string } = {
      title: entry.title || '',
    };
    if (entry.description) val.description = entry.description;
    if (entry.password) val.password = entry.password;
    if (entry.heroImage) val.heroImage = entry.heroImage;
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
        ⠿
      </div>
      <img src={`/api/admin/thumbnail/${id}`} alt="" loading="lazy" />
      <button className="hero-tile-remove" onClick={onRemove} title="Remove">
        ×
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
  onUpdate,
}: {
  album: AlbumEntry;
  index: number;
  name: string;
  count: number;
  thumbnailId: string | null;
  onRemove: () => void;
  onUpdate: (updates: Partial<AlbumEntry>) => void;
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
        onUpdate={onUpdate}
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`subpage-tile ${isActive ? 'active' : ''}`}
      onClick={onClick}
      {...attributes}
    >
      <div className="subpage-tile-drag" {...listeners} title="Drag to reorder">
        ⠿
      </div>
      <div className="subpage-tile-cover">
        {firstThumb ? (
          <img src={`/api/admin/thumbnail/${firstThumb}`} alt="" loading="lazy" />
        ) : (
          <div className="subpage-tile-placeholder">📂</div>
        )}
      </div>
      <div className="subpage-tile-info">
        <span className="subpage-tile-name">{sp.title || sp.name}</span>
        <span className="subpage-tile-meta">
          {totalAlbums} album{totalAlbums !== 1 ? 's' : ''}
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
  const [pickerTarget, setPickerTarget] = useState<{
    type: 'standalone' | 'subpage' | 'section';
    subpageIndex?: number;
    sectionIndex?: number;
  } | null>(null);
  const [showHeroPicker, setShowHeroPicker] = useState(false);

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
          return { name, albums: parseAlbumEntries(value), sections: undefined };
        }
        const sp = value as Record<string, unknown>;
        return {
          name,
          title: sp.title as string | undefined,
          subtitle: sp.subtitle as string | undefined,
          password: sp.password as string | undefined,
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
    setShowHeroPicker(false);
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

  function slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
      </div>
    );
  }

  return (
    <div className="page-builder">
      {/* Save Bar */}
      <div className={`save-bar ${dirty ? 'dirty' : ''}`}>
        <div className="save-bar-left">
          {dirty && <span className="unsaved-badge">Unsaved changes</span>}
          {saveMessage && (
            <span
              className={`save-message ${saveMessage.startsWith('Error') ? 'error' : 'success'}`}
            >
              {saveMessage}
            </span>
          )}
          {!dirty && !saveMessage && <span className="save-hint">⌘S to save</span>}
        </div>
        <div className="save-bar-right">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn-ghost admin-btn-preview"
            title="Open site in new tab"
          >
            ↗ Preview Site
          </a>
          <button
            className="admin-btn admin-btn-primary"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="builder-section">
        <div className="builder-section-header">
          <h2>🏠 Homepage Hero</h2>
          <button className="admin-btn admin-btn-sm" onClick={() => setShowHeroPicker(true)}>
            + Add Hero
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
          <h2>📷 Standalone Albums</h2>
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
            items={gallery.albums.map((a, i) => `album-${a.id}-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="album-list">
              {gallery.albums.length === 0 && (
                <p className="empty-hint">
                  No standalone albums. These show directly on the homepage.
                </p>
              )}
              {gallery.albums.map((album, i) => (
                <SortableAlbumCard
                  key={`${album.id}-${i}`}
                  album={album}
                  index={i}
                  name={getAlbumName(album.id)}
                  count={getAlbumCount(album.id)}
                  thumbnailId={getAlbumThumbnailId(album.id)}
                  onRemove={() => removeStandaloneAlbum(i)}
                  onUpdate={(updates) => {
                    setGallery((g) => {
                      const albums = [...g.albums];
                      albums[i] = { ...albums[i], ...updates };
                      return { ...g, albums };
                    });
                    markDirty();
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {/* Subpages */}
      <section className="builder-section">
        <div className="builder-section-header">
          <h2>📂 Subpages</h2>
          <button className="admin-btn admin-btn-sm" onClick={addSubpage}>
            + New Subpage
          </button>
        </div>

        {gallery.subpages.length === 0 && (
          <p className="empty-hint">
            No subpages. Create one to group albums under a custom URL path.
          </p>
        )}

        {/* Collapsed overview grid with DnD */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSubpageDragEnd}
        >
          <SortableContext
            items={gallery.subpages.map((_, i) => `subpage-${i}`)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="subpage-grid">
              {gallery.subpages.map((sp, spIndex) => (
                <SortableSubpageTile
                  key={`subpage-${spIndex}`}
                  sp={sp}
                  spIndex={spIndex}
                  isActive={expandedSubpage === spIndex}
                  onClick={() => setExpandedSubpage(expandedSubpage === spIndex ? null : spIndex)}
                  getFirstThumb={getFirstSubpageThumb}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Expanded subpage detail */}
        {expandedSubpage !== null && gallery.subpages[expandedSubpage] && (
          <div className="subpage-detail">
            {(() => {
              const sp = gallery.subpages[expandedSubpage];
              const spIndex = expandedSubpage;
              return (
                <>
                  <div className="subpage-detail-header">
                    <div className="subpage-detail-header-left">
                      <input
                        className="subpage-name-input"
                        value={sp.name}
                        onChange={(e) => updateSubpage(spIndex, { name: e.target.value })}
                        placeholder="Page name (used for URL)"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="subpage-slug-preview">/{slugify(sp.name)}</span>
                    </div>
                    <div className="subpage-detail-header-right">
                      <a
                        href={`/${slugify(sp.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-btn-icon"
                        title="Preview this page"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ↗
                      </a>
                      <button
                        className="admin-btn-icon"
                        onClick={() => setExpandedSubpage(null)}
                        title="Collapse"
                      >
                        ✕
                      </button>
                      <button
                        className="admin-btn-icon admin-btn-icon-danger"
                        onClick={() => {
                          removeSubpage(spIndex);
                          setExpandedSubpage(null);
                        }}
                        title="Delete subpage"
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  {/* Subpage metadata */}
                  <div className="subpage-meta">
                    <div className="admin-field-row">
                      <div className="admin-field">
                        <label>Title (optional)</label>
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
                            updateSubpage(spIndex, { subtitle: e.target.value || undefined })
                          }
                          placeholder="Subtitle text"
                        />
                      </div>
                    </div>
                    <div className="admin-field-row">
                      <div className="admin-field">
                        <label>Password (optional)</label>
                        <input
                          type="password"
                          value={sp.password || ''}
                          onChange={(e) =>
                            updateSubpage(spIndex, { password: e.target.value || undefined })
                          }
                          placeholder="Leave empty for public"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Albums (if no sections) with DnD */}
                  {(!sp.sections || sp.sections.length === 0) && (
                    <div className="subpage-albums">
                      <div className="subpage-albums-header">
                        <span>Albums</span>
                        <button
                          className="admin-btn admin-btn-xs"
                          onClick={() =>
                            setPickerTarget({ type: 'subpage', subpageIndex: spIndex })
                          }
                        >
                          + Add
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
                            {sp.albums.map((album, aIndex) => (
                              <SortableAlbumCard
                                key={`${album.id}-${aIndex}`}
                                album={album}
                                index={aIndex}
                                name={getAlbumName(album.id)}
                                count={getAlbumCount(album.id)}
                                thumbnailId={getAlbumThumbnailId(album.id)}
                                onRemove={() => removeSubpageAlbum(spIndex, aIndex)}
                                onUpdate={(updates) => {
                                  setGallery((g) => {
                                    const subpages = [...g.subpages];
                                    const sp2 = { ...subpages[spIndex] };
                                    const albums = [...sp2.albums];
                                    albums[aIndex] = { ...albums[aIndex], ...updates };
                                    sp2.albums = albums;
                                    subpages[spIndex] = sp2;
                                    return { ...g, subpages };
                                  });
                                  markDirty();
                                }}
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
                                updateSection(spIndex, secIndex, { title: e.target.value })
                              }
                              placeholder="Section title"
                            />
                            <button
                              className="admin-btn-icon"
                              onClick={() => removeSection(spIndex, secIndex)}
                              title="Remove section"
                            >
                              ×
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
                                onRemove={() => removeSectionAlbum(spIndex, secIndex, aIndex)}
                                onUpdate={(updates) => {
                                  setGallery((g) => {
                                    const subpages = [...g.subpages];
                                    const sp2 = { ...subpages[spIndex] };
                                    const sections = [...(sp2.sections || [])];
                                    const sec2 = { ...sections[secIndex] };
                                    const albums = [...sec2.albums];
                                    albums[aIndex] = { ...albums[aIndex], ...updates };
                                    sec2.albums = albums;
                                    sections[secIndex] = sec2;
                                    sp2.sections = sections;
                                    subpages[spIndex] = sp2;
                                    return { ...g, subpages };
                                  });
                                  markDirty();
                                }}
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

                  <div className="subpage-actions">
                    <button className="admin-btn admin-btn-xs" onClick={() => addSection(spIndex)}>
                      + Add Section
                    </button>
                    {sp.sections && sp.sections.length > 0 && (
                      <button
                        className="admin-btn admin-btn-xs"
                        onClick={() => setPickerTarget({ type: 'subpage', subpageIndex: spIndex })}
                      >
                        + Add Album (outside sections)
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
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

      {/* Hero Asset Picker Modal */}
      {showHeroPicker && (
        <AssetPicker
          onSelect={handleHeroSelect}
          onClose={() => setShowHeroPicker(false)}
          currentAssetIds={gallery.hero}
        />
      )}
    </div>
  );

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
  onUpdate: (updates: Partial<AlbumEntry>) => void;
  dragListeners?: Record<string, unknown>;
}

function AlbumCard({
  album,
  name,
  count,
  thumbnailId,
  onRemove,
  onUpdate,
  dragListeners,
}: AlbumCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showHeroPicker, setShowHeroPicker] = useState(false);

  return (
    <div className="album-tile">
      <div className="album-tile-cover">
        {dragListeners && (
          <div className="album-tile-drag" {...dragListeners} title="Drag to reorder">
            ⠿
          </div>
        )}
        {thumbnailId ? (
          <img src={`/api/admin/thumbnail/${thumbnailId}`} alt="" loading="lazy" />
        ) : (
          <div className="album-tile-placeholder">📷</div>
        )}
        <div className="album-tile-overlay">
          <button
            className="album-tile-btn"
            onClick={() => setExpanded(!expanded)}
            title="Edit details"
          >
            ✏️
          </button>
          <button className="album-tile-btn" onClick={onRemove} title="Remove">
            ×
          </button>
        </div>
      </div>
      <div className="album-tile-info">
        <span className="album-tile-name">{album.title || name}</span>
        <span className="album-tile-count">{count} photos</span>
      </div>
      {expanded && (
        <div className="album-tile-details">
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
            <input
              value={album.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value || undefined })}
              placeholder="Optional description"
            />
          </div>
          <div className="admin-field">
            <label>Password</label>
            <input
              type="password"
              value={album.password || ''}
              onChange={(e) => onUpdate({ password: e.target.value || undefined })}
              placeholder="Leave empty for public"
            />
          </div>
          {/* Hero Image */}
          <div className="admin-field">
            <label>Hero Image</label>
            <div className="album-hero-field">
              {album.heroImage ? (
                <div className="album-hero-preview">
                  <img src={`/api/admin/thumbnail/${album.heroImage}`} alt="Hero" />
                  <button
                    className="album-hero-remove"
                    onClick={() => onUpdate({ heroImage: undefined })}
                    title="Remove hero image"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <span className="album-hero-empty">No hero image set</span>
              )}
              <button
                className="admin-btn admin-btn-xs"
                onClick={() => setShowHeroPicker(true)}
              >
                {album.heroImage ? 'Change' : '+ Pick'}
              </button>
            </div>
          </div>
          <div className="album-tile-uuid">
            <code>{album.id}</code>
          </div>
        </div>
      )}
      {showHeroPicker && (
        <AssetPicker
          albumId={album.id}
          onSelect={(assetId) => {
            onUpdate({ heroImage: assetId });
            setShowHeroPicker(false);
          }}
          onClose={() => setShowHeroPicker(false)}
          currentAssetIds={album.heroImage ? [album.heroImage] : []}
          title="Pick Hero Image for Album"
        />
      )}
    </div>
  );
}
