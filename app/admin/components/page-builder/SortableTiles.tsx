'use client';

/**
 * The two drag-sortable tiles of the page builder (#608): a hero photo, and
 * a subpage in the page list. Album cards are in ./AlbumCard.tsx.
 */

import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import { IconFileText, IconFolder, IconGripVertical, IconLock, IconPencil, IconX } from '../Icons';
import type { Subpage } from './types';

// ── Sortable Hero Tile ─────────────────────────────────────────

export function SortableHeroTile({
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

export function SortableSubpageTile({
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

// ── Sortable Subpage Row (stage 4 structure list) ──────────────

/**
 * One subpage in the page builder's structure list (UX stage 4): drag handle,
 * cover, name, state and album count, in one line. Same sortable id as the
 * tile it replaces, so the builder's drag handler is unchanged.
 */
export function SortableSubpageRow({
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
  const totalAlbums =
    sp.albums.length + (sp.sections?.reduce((sum, sec) => sum + sec.albums.length, 0) || 0);
  const thumb = getFirstThumb(sp);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`pb-row ${isActive ? 'active' : ''} ${sp.enabled === false ? 'is-off' : ''}`}
      {...attributes}
    >
      <span className="pb-row-grip" {...listeners} title="Drag to reorder">
        <IconGripVertical size={14} />
      </span>
      <button type="button" className="pb-row-main" onClick={onClick} aria-current={isActive}>
        <span className="pb-row-thumb">
          {thumb ? (
            <img src={`/api/admin/thumbnail/${thumb}`} alt="" loading="lazy" />
          ) : (
            <IconFolder size={14} />
          )}
        </span>
        <span className="pb-row-name">
          {sp.title || sp.name}
          {sp.password && <IconLock size={11} />}
        </span>
        {sp.enabled === false ? (
          <span className="pb-row-state">Off</span>
        ) : sp.hidden ? (
          <span className="pb-row-state">Unlisted</span>
        ) : (
          <span className="pb-row-count">{totalAlbums}</span>
        )}
      </button>
    </div>
  );
}

// ── Sortable Page Row (#722) ───────────────────────────────────

/**
 * A content page in the structure list: document icon and a PAGE tag, so it
 * reads as something other than a subpage. The same row sits in the menu
 * list and in "Not in menu"; `id` says which, for the drag handler.
 */
export function SortablePageRow({
  id,
  title,
  isActive,
  draft,
  hasPassword,
  missing,
  onClick,
}: {
  id: string;
  title: string;
  isActive: boolean;
  draft?: boolean;
  hasPassword?: boolean;
  /** Referenced from gallery.yaml, but there is no file for it. */
  missing?: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`pb-row ${isActive ? 'active' : ''} ${draft || missing ? 'is-off' : ''}`}
      {...attributes}
    >
      <span className="pb-row-grip" {...listeners} title="Drag to reorder">
        <IconGripVertical size={14} />
      </span>
      <button type="button" className="pb-row-main" onClick={onClick} aria-current={isActive}>
        <span className="pb-row-thumb">
          <IconFileText size={14} />
        </span>
        <span className="pb-row-name">
          {title}
          {hasPassword && <IconLock size={11} />}
        </span>
        {missing ? (
          <span className="pb-row-state">Missing</span>
        ) : draft ? (
          <span className="pb-row-state">Draft</span>
        ) : (
          <span className="pb-row-tag">Page</span>
        )}
      </button>
    </div>
  );
}

/**
 * The "Not in menu" group as a drop target, so a page dragged out of the
 * menu lands there even when the group is empty (#722).
 */
export function OffMenuDropZone({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`pb-offmenu ${isOver ? 'is-over' : ''}`}>
      {children}
    </div>
  );
}
