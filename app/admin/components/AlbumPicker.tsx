'use client';

import { useState, useMemo } from 'react';
import { useScrollLock } from './useScrollLock';
import { useModalDialog } from '@/hooks/useModalDialog';
import { IconFolder } from './Icons';
import { useAdminDictionary } from './AdminI18n';

interface ImmichAlbumInfo {
  id: string;
  albumName: string;
  description: string;
  thumbnailAssetId: string | null;
  assetCount: number;
  isConfigured: boolean;
  /** Immich's own flag. Undefined on older Immich — silence beats a false alarm. */
  shared?: boolean;
}

interface Props {
  albums: ImmichAlbumInfo[];
  onSelect: (albumId: string) => void;
  onClose: () => void;
  usedAlbumIds: Set<string>;
}

export default function AlbumPicker({ albums, onSelect, onClose, usedAlbumIds }: Props) {
  useScrollLock(true);
  const dict = useAdminDictionary();
  const t = dict.pickers.albumPicker;
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return albums;
    const q = search.toLowerCase();
    return albums.filter(
      (a) =>
        a.albumName.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.id.includes(q),
    );
  }, [albums, search]);

  const cardRef = useModalDialog(onClose);

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div
        className="picker-modal"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="album-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-header">
          <h3 id="album-picker-title">{t.title}</h3>
          <button
            type="button"
            className="admin-btn-icon"
            onClick={onClose}
            aria-label={dict.common.close}
          >
            ×
          </button>
        </div>

        <div className="picker-search">
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="picker-list">
          {filtered.length === 0 && <p className="empty-hint">{t.empty}</p>}
          {filtered.map((album) => {
            const isUsed = usedAlbumIds.has(album.id);
            return (
              // A button, not a div: the list has to work from the keyboard.
              // An album already on the site is disabled rather than inert.
              <button
                type="button"
                key={album.id}
                className={`picker-item ${isUsed ? 'used' : ''}`}
                disabled={isUsed}
                onClick={() => onSelect(album.id)}
              >
                <span className="picker-item-thumb">
                  {album.thumbnailAssetId ? (
                    <img
                      className="picker-thumb-img"
                      src={`/api/admin/thumbnail/${album.thumbnailAssetId}`}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="picker-thumb-placeholder">
                      <IconFolder size={20} />
                    </span>
                  )}
                </span>
                <span className="picker-item-info">
                  <span className="picker-item-name">{album.albumName}</span>
                  <span className="picker-item-meta">
                    {t.photoCount(album.assetCount)}
                    {album.description && ` · ${album.description.slice(0, 40)}`}
                  </span>
                  {/* Not a warning and not a barrier: publishing an unshared
                      album has always worked, because Immich ignores the
                      ?shared=true filter this list is fetched with (#515). It
                      is here so nobody publishes a private album unaware. */}
                  {album.shared === false && (
                    <span className="picker-item-note">{t.notShared}</span>
                  )}
                </span>
                <span className="picker-item-action">
                  {isUsed ? (
                    <span className="picker-used-badge">{t.inUse}</span>
                  ) : (
                    <span className="picker-select-badge">{t.select}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
