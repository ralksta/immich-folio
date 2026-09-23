'use client';

import type { JournalBlock, MapItem } from '@/lib/journal';
import { isValidCoordinate } from '@/lib/journal';
import type { AlbumAssetRef } from '@/lib/journalAlbum';
import type AlbumPicker from '../AlbumPicker';
import {
  IconCamera,
  IconChevronUp,
  IconChevronDown,
  IconPlus,
  IconMap,
  IconFolder,
  IconX,
} from '../Icons';
import { isLegacyAssetRef } from './blockOps';

/** What the asset picker is opened for: its title, and where the pick goes. */
export interface AssetPickTarget {
  title: string;
  onSelect: (assetId: string) => void;
}

interface BlockFieldsProps {
  block: JournalBlock;
  onChange: (block: JournalBlock) => void;
  onPickAsset: (target: AssetPickTarget) => void;
  onPickAlbum: (onSelect: (albumId: string) => void) => void;
  /** Assets of the albums referenced by album blocks, as loaded so far. */
  albumAssets: Record<string, AlbumAssetRef[]>;
  /** The picker's album list, once fetched — used for the album's name. */
  albumList: Parameters<typeof AlbumPicker>[0]['albums'] | null;
  mapEnabled?: boolean;
}

/**
 * The form of one block in the journal editor, one branch per block type
 * (#555). Every edit goes out through `onChange` as a whole new block; the
 * editor owns the block list and its order.
 */
export function BlockFields({
  block,
  onChange,
  onPickAsset,
  onPickAlbum,
  albumAssets,
  albumList,
  mapEnabled,
}: BlockFieldsProps) {
  return (
    <div style={{ marginTop: '0.75rem' }}>
      {block.type === 'heading' && (
        <div className="journal-heading-row">
          <select
            aria-label="Heading level"
            className="admin-input journal-level-select"
            value={block.level}
            onChange={(e) => onChange({ ...block, level: Number(e.target.value) })}
          >
            <option value={1}>H1</option>
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <input
            type="text"
            className="admin-input"
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
          />
        </div>
      )}

      {block.type === 'paragraph' && (
        <textarea
          className="admin-input"
          rows={3}
          value={block.html}
          onChange={(e) => onChange({ ...block, html: e.target.value })}
        />
      )}

      {block.type === 'quote' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea
            className="admin-input"
            rows={2}
            value={block.text}
            placeholder="Quote text..."
            onChange={(e) => onChange({ ...block, text: e.target.value })}
          />
          <input
            type="text"
            className="admin-input"
            value={block.author || ''}
            placeholder="Author attribution (optional)"
            onChange={(e) => onChange({ ...block, author: e.target.value })}
          />
        </div>
      )}

      {block.type === 'photo' && isLegacyAssetRef(block.assetId) && (
        <p className="journal-block-warning">
          Reference &quot;{block.assetId}&quot; is a legacy album position, not a photo. It will not
          appear on the published page — pick a photo below.
        </p>
      )}

      {block.type === 'photo' && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div
            style={{
              width: '140px',
              height: '96px',
              flexShrink: 0,
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '6px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onClick={() =>
              onPickAsset({
                title: 'Select Photo for Story',
                onSelect: (id) => onChange({ ...block, assetId: id }),
              })
            }
          >
            {block.assetId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/admin/thumbnail/${block.assetId}`}
                alt="Thumb"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>+ Pick</span>
            )}
          </div>

          <div
            style={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div className="journal-photo-layout-row">
              <select
                aria-label="Photo layout"
                className="admin-input"
                value={block.layout}
                onChange={(e) =>
                  onChange({
                    ...block,
                    layout: e.target.value as 'contained' | 'wide' | 'fullbleed',
                  })
                }
              >
                <option value="contained">Contained (Column Width)</option>
                <option value="wide">Wide (Expanded Width)</option>
                <option value="fullbleed">Fullbleed (Edge to Edge)</option>
              </select>
              <button
                type="button"
                className="admin-btn admin-btn-xs"
                onClick={() =>
                  onPickAsset({
                    title: 'Select Photo for Story',
                    onSelect: (id) => onChange({ ...block, assetId: id }),
                  })
                }
              >
                Change Photo
              </button>
            </div>
            <input
              type="text"
              className="admin-input"
              placeholder="Caption (optional)"
              value={block.caption || ''}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
            />
          </div>
        </div>
      )}

      {block.type === 'photo-pair' && block.assetIds.some(isLegacyAssetRef) && (
        <p className="journal-block-warning">
          References &quot;{block.assetIds.filter(isLegacyAssetRef).join('", "')}
          &quot; are legacy album positions, not photos. They will not appear on the published page
          — pick photos below.
        </p>
      )}

      {block.type === 'photo-pair' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}
          >
            {[0, 1].map((pIdx) => (
              <div
                key={pIdx}
                style={{
                  height: '90px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: '1px dashed rgba(255,255,255,0.15)',
                }}
                onClick={() =>
                  onPickAsset({
                    title: `Select Photo #${pIdx + 1} for Pair`,
                    onSelect: (id) => {
                      const newIds = [...block.assetIds] as [string, string];
                      newIds[pIdx] = id;
                      onChange({ ...block, assetIds: newIds });
                    },
                  })
                }
              >
                {block.assetIds[pIdx] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/admin/thumbnail/${block.assetIds[pIdx]}`}
                    alt="Thumb"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>+ Pick Photo #{pIdx + 1}</span>
                )}
              </div>
            ))}
          </div>
          <input
            type="text"
            className="admin-input"
            placeholder="Shared caption for pair (optional)"
            value={block.caption || ''}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
          />
        </div>
      )}

      {block.type === 'photo-grid' && block.assetIds.some(isLegacyAssetRef) && (
        <p className="journal-block-warning">
          References &quot;{block.assetIds.filter(isLegacyAssetRef).join('", "')}
          &quot; are legacy album positions, not photos. They will not appear on the published page
          — pick photos below.
        </p>
      )}

      {block.type === 'photo-grid' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="journal-grid-tiles">
            {block.assetIds.map((assetId, pIdx) => (
              <div key={pIdx} className="journal-grid-tile">
                <div
                  className="journal-grid-tile-pick"
                  onClick={() =>
                    onPickAsset({
                      title: `Select Photo #${pIdx + 1} for Grid`,
                      onSelect: (id) => {
                        const newIds = [...block.assetIds];
                        newIds[pIdx] = id;
                        onChange({ ...block, assetIds: newIds });
                      },
                    })
                  }
                >
                  {assetId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/admin/thumbnail/${assetId}`} alt="Thumb" />
                  ) : (
                    <span>+ Pick #{pIdx + 1}</span>
                  )}
                </div>
                {block.assetIds.length > 3 && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-xs journal-grid-tile-remove"
                    aria-label={`Remove photo #${pIdx + 1}`}
                    onClick={() =>
                      onChange({
                        ...block,
                        assetIds: block.assetIds.filter((_, i) => i !== pIdx),
                      })
                    }
                  >
                    <IconX size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="admin-btn admin-btn-xs"
              onClick={() =>
                onChange({
                  ...block,
                  assetIds: [...block.assetIds, ''],
                })
              }
            >
              <IconPlus size={12} /> Add photo
            </button>
            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
              Three or more photos, laid out in rows of three.
            </span>
          </div>
          <input
            type="text"
            className="admin-input"
            placeholder="Shared caption for grid (optional)"
            value={block.caption || ''}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
          />
        </div>
      )}

      {block.type === 'facts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {block.items.map((item, fIdx) => (
            <div key={fIdx} className="journal-facts-row">
              <input
                type="text"
                className="admin-input"
                placeholder="Label, e.g. Distance"
                value={item.label}
                onChange={(e) =>
                  onChange({
                    ...block,
                    items: block.items.map((it, i) =>
                      i === fIdx ? { ...it, label: e.target.value } : it,
                    ),
                  })
                }
              />
              <input
                type="text"
                className="admin-input"
                placeholder="Value, e.g. 21 km"
                value={item.value}
                onChange={(e) =>
                  onChange({
                    ...block,
                    items: block.items.map((it, i) =>
                      i === fIdx ? { ...it, value: e.target.value } : it,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="admin-btn admin-btn-xs"
                aria-label={`Remove fact #${fIdx + 1}`}
                disabled={block.items.length <= 1}
                onClick={() =>
                  onChange({
                    ...block,
                    items: block.items.filter((_, i) => i !== fIdx),
                  })
                }
              >
                <IconX size={11} />
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="admin-btn admin-btn-xs"
              onClick={() =>
                onChange({
                  ...block,
                  items: [...block.items, { label: '', value: '' }],
                })
              }
            >
              <IconPlus size={12} /> Add fact
            </button>
          </div>
        </div>
      )}

      {block.type === 'album' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="journal-album-row">
            <button
              type="button"
              className="admin-btn admin-btn-xs admin-btn-primary"
              onClick={() => onPickAlbum((albumId) => onChange({ ...block, albumId }))}
            >
              <IconFolder size={12} />{' '}
              {block.albumId
                ? (albumList?.find((a) => a.id === block.albumId)?.albumName ?? 'Change album')
                : 'Pick album'}
            </button>
            {block.albumId && (
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                {albumAssets[block.albumId]
                  ? `${albumAssets[block.albumId].length} photos in album`
                  : 'loading…'}
              </span>
            )}
          </div>
          <div className="journal-album-row">
            <label className="journal-album-field">
              Count
              <input
                type="number"
                min={1}
                className="admin-input"
                placeholder="all"
                value={block.count ?? ''}
                onChange={(e) =>
                  onChange({
                    ...block,
                    count: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </label>
            <label className="journal-album-field">
              Skip
              <input
                type="number"
                min={0}
                className="admin-input"
                placeholder="0"
                value={block.skip ?? ''}
                onChange={(e) =>
                  onChange({
                    ...block,
                    skip: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </label>
            <label className="journal-album-field">
              Layout
              <select
                className="admin-input"
                value={block.layout}
                onChange={(e) =>
                  onChange({
                    ...block,
                    layout: e.target.value as 'grid' | 'pairs' | 'wide',
                  })
                }
              >
                <option value="grid">Grid (rows of three)</option>
                <option value="pairs">Pairs (rows of two)</option>
                <option value="wide">Wide (one per row)</option>
              </select>
            </label>
          </div>
          <input
            type="text"
            className="admin-input"
            placeholder="Caption for the set (optional)"
            value={block.caption || ''}
            onChange={(e) =>
              onChange({
                ...block,
                caption: e.target.value || undefined,
              })
            }
          />
          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
            Photos follow the album&apos;s order (a manual order in the gallery comes first). Count
            and skip pick a slice; leave count empty for all.
          </span>
        </div>
      )}

      {block.type === 'map' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mapEnabled === false && (
            <p className="journal-block-warning">
              The map is switched off in Settings → General. This block will not render until it is
              enabled.
            </p>
          )}
          <input
            type="text"
            className="admin-input"
            placeholder="Caption, e.g. Busan → Seoul (optional)"
            value={block.caption || ''}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
          />

          {block.items.map((item, mIdx) => {
            const setItem = (next: MapItem) =>
              onChange({
                ...block,
                items: block.items.map((it, i) => (i === mIdx ? next : it)),
              });
            const move = (dir: -1 | 1) => {
              const items = [...block.items];
              const target = mIdx + dir;
              if (target < 0 || target >= items.length) return;
              [items[mIdx], items[target]] = [items[target], items[mIdx]];
              onChange({ ...block, items });
            };
            return (
              <div key={mIdx} className="journal-map-row">
                <span className="journal-map-index">{mIdx + 1}</span>
                {item.kind === 'point' && (
                  <>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="Label (optional)"
                      value={item.label ?? ''}
                      onChange={(e) => setItem({ ...item, label: e.target.value || undefined })}
                    />
                    <input
                      type="number"
                      step="any"
                      className="admin-input journal-map-coord"
                      placeholder="Lat"
                      aria-label="Latitude"
                      value={Number.isFinite(item.lat) ? item.lat : ''}
                      onChange={(e) => setItem({ ...item, lat: parseFloat(e.target.value) })}
                    />
                    <input
                      type="number"
                      step="any"
                      className="admin-input journal-map-coord"
                      placeholder="Lng"
                      aria-label="Longitude"
                      value={Number.isFinite(item.lng) ? item.lng : ''}
                      onChange={(e) => setItem({ ...item, lng: parseFloat(e.target.value) })}
                    />
                  </>
                )}
                {item.kind === 'photo' && (
                  <div
                    className="journal-map-photo"
                    onClick={() =>
                      onPickAsset({
                        title: 'Select a photo to place on the map',
                        onSelect: (id) => setItem({ kind: 'photo', assetId: id }),
                      })
                    }
                  >
                    {item.assetId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/admin/thumbnail/${item.assetId}`} alt="Thumb" />
                    ) : (
                      <span>+ Pick photo</span>
                    )}
                  </div>
                )}
                {item.kind === 'all-photos' && (
                  <span className="journal-map-all">
                    All geotagged photos of this entry, in order
                  </span>
                )}
                <div className="essay-block-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn-xs"
                    disabled={mIdx === 0}
                    aria-label="Move pin up"
                    onClick={() => move(-1)}
                  >
                    <IconChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-xs"
                    disabled={mIdx === block.items.length - 1}
                    aria-label="Move pin down"
                    onClick={() => move(1)}
                  >
                    <IconChevronDown size={12} />
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-xs admin-btn-danger"
                    aria-label="Remove pin"
                    onClick={() =>
                      onChange({
                        ...block,
                        items: block.items.filter((_, i) => i !== mIdx),
                      })
                    }
                  >
                    <IconX size={11} />
                  </button>
                </div>
              </div>
            );
          })}

          {block.items.some((it) => it.kind === 'point' && !isValidCoordinate(it.lat, it.lng)) && (
            <p className="journal-block-warning">
              A point needs a latitude within ±90 and a longitude within ±180. Points without valid
              coordinates are not saved.
            </p>
          )}

          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              className="admin-btn admin-btn-xs"
              onClick={() =>
                onChange({
                  ...block,
                  items: [...block.items, { kind: 'point', lat: Number.NaN, lng: Number.NaN }],
                })
              }
            >
              <IconPlus size={12} /> Point
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-xs"
              onClick={() =>
                onPickAsset({
                  title: 'Select a photo to place on the map',
                  onSelect: (id) =>
                    onChange({
                      ...block,
                      items: [...block.items, { kind: 'photo', assetId: id }],
                    }),
                })
              }
            >
              <IconCamera size={12} /> Photo pin
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-xs"
              disabled={block.items.some((it) => it.kind === 'all-photos')}
              onClick={() =>
                onChange({
                  ...block,
                  items: [...block.items, { kind: 'all-photos' }],
                })
              }
            >
              <IconMap size={12} /> All geotagged photos
            </button>
            <label className="journal-map-line-toggle">
              <input
                type="checkbox"
                checked={block.line}
                onChange={(e) => onChange({ ...block, line: e.target.checked })}
              />
              Connect pins with a line
            </label>
          </div>

          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
            Typed points show in the preview right away. Photo pins are placed on the live page from
            the photo&apos;s GPS, under the album&apos;s location precision.
          </span>
        </div>
      )}
    </div>
  );
}
