'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface AssetInfo {
  id: string;
  originalFileName: string;
  fileCreatedAt: string;
  isFavorite: boolean;
}

interface Props {
  onSelect: (assetId: string) => void;
  onClose: () => void;
  currentAssetIds?: string[];
  albumId?: string;
  title?: string;
}

type Tab = 'album' | 'favorites' | 'all';

export default function AssetPicker({
  onSelect,
  onClose,
  currentAssetIds = [],
  albumId,
  title,
}: Props) {
  const [tab, setTab] = useState<Tab>(albumId ? 'album' : 'favorites');
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [uuidInput, setUuidInput] = useState('');
  const [uuidError, setUuidError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const currentIds = new Set(currentAssetIds);

  const loadAssets = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        let res: Response;
        if (tab === 'album' && albumId) {
          res = await fetch(`/api/admin/albums/${albumId}/assets`);
        } else {
          const params = new URLSearchParams({
            page: pageNum.toString(),
            favorites: tab === 'favorites' ? 'true' : 'false',
          });
          res = await fetch(`/api/admin/assets?${params}`);
        }
        if (res.ok) {
          const data = await res.json();
          setAssets((prev) => (append ? [...prev, ...data.assets] : data.assets));
          setHasMore(data.nextPage !== null);
          setPage(pageNum);
        }
      } catch (err) {
        console.error('Failed to load assets:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tab, albumId],
  );

  useEffect(() => {
    setAssets([]);
    setPage(1);
    setHasMore(false);
    loadAssets(1);
  }, [tab, loadAssets]);

  // Infinite scroll
  function handleScroll() {
    if (!listRef.current || loadingMore || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      loadAssets(page + 1, true);
    }
  }

  function handleUuidSubmit(e: React.FormEvent) {
    e.preventDefault();
    const uuid = uuidInput.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      setUuidError('Invalid UUID format');
      return;
    }
    setUuidError('');
    onSelect(uuid);
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  }

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="asset-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <h3>{title || 'Select Hero Image'}</h3>
          <button className="admin-btn-icon" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="asset-picker-tabs">
          {albumId && (
            <button
              className={`asset-picker-tab ${tab === 'album' ? 'active' : ''}`}
              onClick={() => setTab('album')}
            >
              📂 This Album
            </button>
          )}
          <button
            className={`asset-picker-tab ${tab === 'favorites' ? 'active' : ''}`}
            onClick={() => setTab('favorites')}
          >
            ⭐ Favorites
          </button>
          <button
            className={`asset-picker-tab ${tab === 'all' ? 'active' : ''}`}
            onClick={() => setTab('all')}
          >
            🖼️ All Photos
          </button>
        </div>

        {/* Asset Grid */}
        <div className="asset-picker-grid" ref={listRef} onScroll={handleScroll}>
          {loading ? (
            <div className="asset-picker-loading">
              <div className="admin-spinner" />
            </div>
          ) : assets.length === 0 ? (
            <p className="empty-hint">
              {tab === 'favorites'
                ? 'No favorite photos found. Star photos in Immich first, or switch to "All Photos".'
                : 'No photos found.'}
            </p>
          ) : (
            <>
              {assets.map((asset) => {
                const isUsed = currentIds.has(asset.id);
                return (
                  <div
                    key={asset.id}
                    className={`asset-picker-tile ${isUsed ? 'used' : ''}`}
                    onClick={() => !isUsed && onSelect(asset.id)}
                    title={`${asset.originalFileName}\n${formatDate(asset.fileCreatedAt)}`}
                  >
                    <img
                      src={`/api/admin/thumbnail/${asset.id}`}
                      alt={asset.originalFileName}
                      loading="lazy"
                    />
                    {isUsed && <div className="asset-picker-used-badge">✓</div>}
                    {asset.isFavorite && !isUsed && (
                      <div className="asset-picker-fav-badge">⭐</div>
                    )}
                  </div>
                );
              })}
              {loadingMore && (
                <div className="asset-picker-loading-more">
                  <div className="admin-spinner" />
                </div>
              )}
            </>
          )}
        </div>

        {/* UUID Fallback */}
        <div className="asset-picker-uuid-section">
          <form onSubmit={handleUuidSubmit} className="asset-picker-uuid-form">
            <input
              type="text"
              value={uuidInput}
              onChange={(e) => {
                setUuidInput(e.target.value);
                setUuidError('');
              }}
              placeholder="Or paste asset UUID directly..."
              className="asset-picker-uuid-input"
            />
            <button type="submit" className="admin-btn admin-btn-sm" disabled={!uuidInput.trim()}>
              Add
            </button>
          </form>
          {uuidError && <span className="asset-picker-uuid-error">{uuidError}</span>}
        </div>
      </div>
    </div>
  );
}
