'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DEFAULT_ALBUM_SORT } from '@/lib/albumSort';
import { IconCamera, IconGripVertical, IconImage, IconLock, IconPencil, IconTrash } from '../Icons';
import { SORT_LABELS } from './sortOptions';
import type { AlbumEntry } from './types';

export function SortableAlbumCard({
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

interface AlbumCardProps {
  album: AlbumEntry;
  name: string;
  count: number;
  thumbnailId: string | null;
  onRemove: () => void;
  onEdit: () => void;
  dragListeners?: Record<string, unknown>;
}

export default function AlbumCard({
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
