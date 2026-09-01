'use client';

import { DEFAULT_ALBUM_SORT } from '@/lib/albumSort';
import { IconCamera, IconCopy, IconGripVertical, IconImage, IconTrash, IconX } from '../Icons';
import { Listbox } from '../Listbox';
import { SORT_OPTIONS } from './sortOptions';
import type { AlbumEntry, HeroPickerTarget, OrderEditorTarget } from './types';

interface AlbumDrawerProps {
  album: AlbumEntry;
  name: string;
  count: number;
  thumbnailId: string | null;
  onUpdate: (updates: Partial<AlbumEntry>) => void;
  onRemove: () => void;
  onClose: () => void;
  onPickHero: (target: HeroPickerTarget | null) => void;
  onEditOrder: (target: OrderEditorTarget | null) => void;
}

/**
 * Per-album settings, opened from a card in the builder or from inside the
 * subpage drawer. Which album it edits — and how an edit is written back —
 * is resolved by the caller and arrives as `onUpdate`/`onRemove`.
 */
export default function AlbumDrawer({
  album,
  name,
  count,
  thumbnailId,
  onUpdate,
  onRemove,
  onClose,
  onPickHero,
  onEditOrder,
}: AlbumDrawerProps) {
  const heroThumb = album.heroImage || thumbnailId;

  return (
    <div className="album-drawer-overlay open" onClick={() => onClose()}>
      <div className="album-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="album-drawer-header">
          <h3>
            <IconCamera /> Edit Album Details
          </h3>
          <button className="admin-btn-icon" onClick={() => onClose()} title="Close details">
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

              <div className="admin-field">
                <label>Downloads</label>
                <button
                  type="button"
                  className={`admin-toggle-card ${album.download ? 'active' : ''}`}
                  onClick={() => onUpdate({ download: !album.download })}
                  aria-pressed={!!album.download}
                  style={{
                    padding: '10px 14px',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <div className="toggle-card-info" style={{ textAlign: 'left' }}>
                    <span
                      className="toggle-card-title"
                      style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}
                    >
                      Allow original downloads
                    </span>
                    <span
                      className="toggle-card-desc"
                      style={{ fontSize: '0.8rem', display: 'block', opacity: 0.75 }}
                    >
                      Visitors can download the whole album or their selected photos as a ZIP
                    </span>
                  </div>
                  <div className={`switch-toggle ${album.download ? 'on' : ''}`}>
                    <span className="switch-slider" />
                  </div>
                </button>
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
                      onPickHero({
                        albumId: album.id,
                        onSelect: (assetId) => {
                          onUpdate({ heroImage: assetId });
                          onPickHero(null);
                        },
                        currentAssetIds: album.heroImage ? [album.heroImage] : [],
                        title: `Pick Hero Image for ${name}`,
                      })
                    }
                  >
                    <IconImage size={12} /> {album.heroImage ? 'Change Image' : 'Pick Hero Image'}
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
                        onEditOrder({
                          albumId: album.id,
                          albumName: album.title || name,
                          assetOrder: album.assetOrder || [],
                          onSave: (assetOrder) => {
                            onUpdate({ assetOrder });
                            onEditOrder(null);
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
            onClick={() => onClose()}
            style={{ maxWidth: '140px' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
