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
import { InlineMarkdownField } from '../InlineMarkdownField';
import { fillAssetSlots, isLegacyAssetRef } from './blockOps';
import { useAdminDictionary } from '../AdminI18n';

/** What the asset picker is opened for: its title, and where the pick goes. */
export interface AssetPickTarget {
  title: string;
  onSelect?: (assetId: string) => void;
  /** Multi-select: several picks confirmed at once (#602). */
  onSelectMany?: (assetIds: string[]) => void;
  /** Most assets `onSelectMany` takes. */
  max?: number;
  /** Minimum assets required to confirm a multi-select pick. */
  min?: number;
  /** Offer album browsing alongside the library sources. */
  enableAlbumSelection?: boolean;
}

interface BlockFieldsProps {
  block: JournalBlock;
  onChange: (block: JournalBlock) => void;
  onPickAsset: (target: AssetPickTarget) => void;
  onPickAlbum: (onSelect: (albumId: string) => void) => void;
  /** Assets of the albums referenced by album blocks, as loaded so far. */
  albumAssets: Record<string, AlbumAssetRef[]>;
  /** Why an album's photos did not load, by album ID. */
  albumErrors?: Record<string, string>;
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
  albumErrors,
  albumList,
  mapEnabled,
}: BlockFieldsProps) {
  const dict = useAdminDictionary();
  const t = dict.journal.blocks;
  const pickerTitles = dict.journal.pickerTitles;
  return (
    <div style={{ marginTop: '0.75rem' }}>
      {block.type === 'heading' && (
        <div className="journal-heading-row">
          <select
            aria-label={t.headingLevel}
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
        <InlineMarkdownField
          multiline
          aria-label={t.text}
          className="admin-input"
          rows={3}
          placeholder={t.textPlaceholder}
          html={block.html}
          onChange={(html) => onChange({ ...block, html })}
        />
      )}

      {block.type === 'quote' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <InlineMarkdownField
            multiline
            className="admin-input"
            rows={2}
            html={block.text}
            placeholder={t.quotePlaceholder}
            onChange={(text) => onChange({ ...block, text })}
          />
          <input
            type="text"
            className="admin-input"
            value={block.author || ''}
            placeholder={t.authorPlaceholder}
            onChange={(e) => onChange({ ...block, author: e.target.value })}
          />
        </div>
      )}

      {block.type === 'photo' && isLegacyAssetRef(block.assetId) && (
        <p className="journal-block-warning">{t.legacyRef(block.assetId)}</p>
      )}

      {block.type === 'photo' && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* A button, not a clickable div, so the keyboard reaches it. */}
          <button
            type="button"
            aria-label={block.assetId ? t.changePhoto : t.pickPhoto}
            style={{
              width: '140px',
              height: '96px',
              flexShrink: 0,
              background: 'rgba(0,0,0,0.3)',
              border: 'none',
              padding: 0,
              color: 'inherit',
              font: 'inherit',
              borderRadius: '6px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onClick={() =>
              onPickAsset({
                title: pickerTitles.storyPhoto,
                onSelect: (id) => onChange({ ...block, assetId: id }),
              })
            }
          >
            {block.assetId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/admin/thumbnail/${block.assetId}`}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{t.pick}</span>
            )}
          </button>

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
                aria-label={t.photoLayout}
                className="admin-input"
                value={block.layout}
                onChange={(e) =>
                  onChange({
                    ...block,
                    layout: e.target.value as 'contained' | 'wide' | 'fullbleed',
                  })
                }
              >
                <option value="contained">{t.layoutContained}</option>
                <option value="wide">{t.layoutWide}</option>
                <option value="fullbleed">{t.layoutFullbleed}</option>
              </select>
              <button
                type="button"
                className="admin-btn admin-btn-xs"
                onClick={() =>
                  onPickAsset({
                    title: pickerTitles.storyPhoto,
                    onSelect: (id) => onChange({ ...block, assetId: id }),
                  })
                }
              >
                {t.changePhotoButton}
              </button>
            </div>
            <InlineMarkdownField
              className="admin-input"
              placeholder={t.captionPlaceholder}
              html={block.caption}
              onChange={(caption) => onChange({ ...block, caption })}
            />
          </div>
        </div>
      )}

      {block.type === 'photo-pair' && block.assetIds.some(isLegacyAssetRef) && (
        <p className="journal-block-warning">
          {t.legacyRefs(block.assetIds.filter(isLegacyAssetRef))}
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
              <button
                type="button"
                key={pIdx}
                aria-label={
                  block.assetIds[pIdx] ? t.changePairPhoto(pIdx + 1) : t.pickPairPhoto(pIdx + 1)
                }
                style={{
                  height: '90px',
                  width: '100%',
                  padding: 0,
                  color: 'inherit',
                  font: 'inherit',
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
                    title: pickerTitles.pairPhoto(pIdx + 1),
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
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                    {t.pickPairSlot(pIdx + 1)}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div>
            <button
              type="button"
              className="admin-btn admin-btn-xs"
              onClick={() =>
                onPickAsset({
                  title: pickerTitles.pair,
                  max: 2,
                  onSelectMany: (ids) => {
                    // Two picks replace the pair; a single pick fills a gap.
                    const base = ids.length >= 2 ? ['', ''] : [...block.assetIds];
                    const [a, b] = fillAssetSlots(base, ids, 2);
                    onChange({ ...block, assetIds: [a ?? '', b ?? ''] });
                  },
                })
              }
            >
              <IconCamera size={12} /> {t.pickBoth}
            </button>
          </div>
          <InlineMarkdownField
            className="admin-input"
            placeholder={t.pairCaptionPlaceholder}
            html={block.caption}
            onChange={(caption) => onChange({ ...block, caption })}
          />
        </div>
      )}

      {block.type === 'photo-grid' && block.assetIds.some(isLegacyAssetRef) && (
        <p className="journal-block-warning">
          {t.legacyRefs(block.assetIds.filter(isLegacyAssetRef))}
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
                      title: pickerTitles.gridPhoto(pIdx + 1),
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
                    <img src={`/api/admin/thumbnail/${assetId}`} alt={t.thumb} />
                  ) : (
                    <span>{t.pickGridSlot(pIdx + 1)}</span>
                  )}
                </div>
                {block.assetIds.length > 3 && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-xs journal-grid-tile-remove"
                    aria-label={t.removePhoto(pIdx + 1)}
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
              <IconPlus size={12} /> {t.addPhoto}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-xs"
              onClick={() =>
                onPickAsset({
                  title: pickerTitles.grid,
                  onSelectMany: (ids) =>
                    onChange({ ...block, assetIds: fillAssetSlots(block.assetIds, ids) }),
                })
              }
            >
              <IconCamera size={12} /> {t.pickSeveral}
            </button>
            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{t.gridHint}</span>
          </div>
          <InlineMarkdownField
            className="admin-input"
            placeholder={t.gridCaptionPlaceholder}
            html={block.caption}
            onChange={(caption) => onChange({ ...block, caption })}
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
                placeholder={t.factLabelPlaceholder}
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
              <InlineMarkdownField
                className="admin-input"
                placeholder={t.factValuePlaceholder}
                html={item.value}
                onChange={(value) =>
                  onChange({
                    ...block,
                    items: block.items.map((it, i) => (i === fIdx ? { ...it, value } : it)),
                  })
                }
              />
              <button
                type="button"
                className="admin-btn admin-btn-xs"
                aria-label={t.removeFact(fIdx + 1)}
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
              <IconPlus size={12} /> {t.addFact}
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
                ? (albumList?.find((a) => a.id === block.albumId)?.albumName ?? t.changeAlbum)
                : t.pickAlbum}
            </button>
            {block.albumId && (
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                {albumAssets[block.albumId]
                  ? t.albumPhotoCount(albumAssets[block.albumId].length)
                  : (albumErrors?.[block.albumId] ?? t.albumLoading)}
              </span>
            )}
          </div>
          <div className="journal-album-row">
            <label className="journal-album-field">
              {t.count}
              <input
                type="number"
                min={1}
                className="admin-input"
                placeholder={t.countAll}
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
              {t.skip}
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
              {t.layout}
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
                <option value="grid">{t.albumLayoutGrid}</option>
                <option value="pairs">{t.albumLayoutPairs}</option>
                <option value="wide">{t.albumLayoutWide}</option>
              </select>
            </label>
          </div>
          <InlineMarkdownField
            className="admin-input"
            placeholder={t.albumCaptionPlaceholder}
            html={block.caption}
            onChange={(caption) => onChange({ ...block, caption: caption || undefined })}
          />
          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{t.albumHint}</span>
        </div>
      )}

      {block.type === 'map' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mapEnabled === false && <p className="journal-block-warning">{t.mapOff}</p>}
          <InlineMarkdownField
            className="admin-input"
            placeholder={t.mapCaptionPlaceholder}
            html={block.caption}
            onChange={(caption) => onChange({ ...block, caption })}
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
                      placeholder={t.pointLabelPlaceholder}
                      value={item.label ?? ''}
                      onChange={(e) => setItem({ ...item, label: e.target.value || undefined })}
                    />
                    <input
                      type="number"
                      step="any"
                      className="admin-input journal-map-coord"
                      placeholder={t.lat}
                      aria-label={t.latitude}
                      value={Number.isFinite(item.lat) ? item.lat : ''}
                      onChange={(e) => setItem({ ...item, lat: parseFloat(e.target.value) })}
                    />
                    <input
                      type="number"
                      step="any"
                      className="admin-input journal-map-coord"
                      placeholder={t.lng}
                      aria-label={t.longitude}
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
                        title: pickerTitles.mapPhoto,
                        onSelect: (id) => setItem({ kind: 'photo', assetId: id }),
                      })
                    }
                  >
                    {item.assetId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/admin/thumbnail/${item.assetId}`} alt={t.thumb} />
                    ) : (
                      <span>{t.pickPhotoTile}</span>
                    )}
                  </div>
                )}
                {item.kind === 'all-photos' && (
                  <span className="journal-map-all">{t.allPhotosItem}</span>
                )}
                <div className="essay-block-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn-xs"
                    disabled={mIdx === 0}
                    aria-label={t.movePinUp}
                    onClick={() => move(-1)}
                  >
                    <IconChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-xs"
                    disabled={mIdx === block.items.length - 1}
                    aria-label={t.movePinDown}
                    onClick={() => move(1)}
                  >
                    <IconChevronDown size={12} />
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-xs admin-btn-danger"
                    aria-label={t.removePin}
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
            <p className="journal-block-warning">{t.invalidCoordinates}</p>
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
              <IconPlus size={12} /> {t.addPoint}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-xs"
              onClick={() =>
                onPickAsset({
                  title: pickerTitles.mapPhoto,
                  onSelect: (id) =>
                    onChange({
                      ...block,
                      items: [...block.items, { kind: 'photo', assetId: id }],
                    }),
                })
              }
            >
              <IconCamera size={12} /> {t.addPhotoPin}
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
              <IconMap size={12} /> {t.addAllPhotos}
            </button>
            <label className="journal-map-line-toggle">
              <input
                type="checkbox"
                checked={block.line}
                onChange={(e) => onChange({ ...block, line: e.target.checked })}
              />
              {t.connectLine}
            </label>
          </div>

          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{t.mapHint}</span>
        </div>
      )}
    </div>
  );
}
