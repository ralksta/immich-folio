'use client';

import { useState, useMemo } from 'react';

interface ImmichAlbumInfo {
  id: string;
  albumName: string;
  description: string;
  thumbnailAssetId: string | null;
  assetCount: number;
  isConfigured: boolean;
}

interface Props {
  albums: ImmichAlbumInfo[];
  onSelect: (albumId: string) => void;
  onClose: () => void;
  usedAlbumIds: Set<string>;
}

export default function AlbumPicker({ albums, onSelect, onClose, usedAlbumIds }: Props) {
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

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <h3>Select Album</h3>
          <button className="admin-btn-icon" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="picker-search">
          <input
            type="text"
            placeholder="Search albums by name or UUID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="picker-list">
          {filtered.length === 0 && (
            <p className="empty-hint">
              No albums found. Make sure you have shared albums in Immich.
            </p>
          )}
          {filtered.map((album) => {
            const isUsed = usedAlbumIds.has(album.id);
            return (
              <div
                key={album.id}
                className={`picker-item ${isUsed ? 'used' : ''}`}
                onClick={() => !isUsed && onSelect(album.id)}
              >
                <div className="picker-item-thumb">
                  {album.thumbnailAssetId ? (
                    <img
                      className="picker-thumb-img"
                      src={`/api/admin/thumbnail/${album.thumbnailAssetId}`}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <div className="picker-thumb-placeholder">📁</div>
                  )}
                </div>
                <div className="picker-item-info">
                  <span className="picker-item-name">{album.albumName}</span>
                  <span className="picker-item-meta">
                    {album.assetCount} photos
                    {album.description && ` · ${album.description.slice(0, 40)}`}
                  </span>
                </div>
                <div className="picker-item-action">
                  {isUsed ? (
                    <span className="picker-used-badge">In use</span>
                  ) : (
                    <span className="picker-select-badge">Select</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
