'use client';

import { useMemo, useState } from 'react';
import { DEFAULT_ALBUM_SORT } from '@/lib/albumSort';
import { slugFieldValue } from '@/lib/journal';
import { IconCamera, IconCopy, IconGripVertical, IconImage, IconTrash, IconX } from '../Icons';
import { Listbox } from '../Listbox';
import { sortOptions } from './sortOptions';
import type { AlbumEntry, HeroPickerTarget, OrderEditorTarget } from './types';
import PasswordField from '../fields/PasswordField';
import ZoomOverrideField from '../fields/ZoomOverrideField';
import { useModalDialog } from '@/hooks/useModalDialog';
import { useAdminDictionary } from '../AdminI18n';
import { PHOTO_LAYOUTS } from '@/lib/admin/layouts';

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
  /**
   * Only standalone albums can be unlisted. A subpage album is hidden by
   * hiding its page, so the control would be a no-op there.
   */
  showVisibility?: boolean;
  /**
   * The album's public address and, for standalone albums, the field that
   * changes its slug. Undefined for an album inside a subpage, whose URL is
   * built from the page and cannot be set here.
   */
  link?: {
    path: string;
    /** Custom slug, or '' while the derived one is used. */
    slug: string;
    /** The slug the title would produce, shown as the placeholder. */
    derived: string;
    onChange: (slug: string | undefined) => void;
  };
}

/** Ten random base-36 characters, for a link that should not be guessable. */
function randomSlug(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
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
  showVisibility = false,
  link,
}: AlbumDrawerProps) {
  const dict = useAdminDictionary();
  const t = dict.pages.albumDrawer;
  const options = useMemo(() => sortOptions(dict.pages.sort), [dict]);
  const heroThumb = album.heroImage || thumbnailId;
  const cardRef = useModalDialog(onClose);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${link.path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the address is visible in the field to copy by hand.
    }
  }

  return (
    <div className="album-drawer-overlay open" onClick={() => onClose()}>
      <div
        className="album-drawer"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="album-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="album-drawer-header">
          <h3 id="album-drawer-title">
            <IconCamera /> {t.heading}
          </h3>
          <button
            type="button"
            className="admin-btn-icon"
            onClick={() => onClose()}
            title={t.close}
            aria-label={t.close}
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
                  {t.photos(count)}
                  {album.title ? ` · ${t.original(name)}` : ''}
                </span>
              </div>

              <div className="admin-field">
                <label htmlFor="album-title-override">{t.titleOverride}</label>
                <input
                  id="album-title-override"
                  value={album.title || ''}
                  onChange={(e) => onUpdate({ title: e.target.value || undefined })}
                  placeholder={name}
                />
              </div>

              <div className="admin-field">
                <label htmlFor="album-description">{t.description}</label>
                <textarea
                  id="album-description"
                  value={album.description || ''}
                  onChange={(e) => onUpdate({ description: e.target.value || undefined })}
                  placeholder={t.descriptionPlaceholder}
                  rows={4}
                />
              </div>

              {link && (
                <div className="admin-field">
                  <label htmlFor="album-link">{t.link}</label>
                  <div className="album-link-row">
                    <span className="album-link-prefix" aria-hidden="true">
                      /
                    </span>
                    <input
                      id="album-link"
                      value={link.slug}
                      placeholder={link.derived}
                      onChange={(e) => link.onChange(slugFieldValue(e.target.value) || undefined)}
                      spellCheck={false}
                      autoComplete="off"
                      maxLength={64}
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      onClick={() => link.onChange(randomSlug())}
                    >
                      {t.randomLink}
                    </button>
                  </div>
                  <div className="album-link-preview">
                    <code>{link.path}</code>
                    <button type="button" className="admin-btn admin-btn-sm" onClick={copyLink}>
                      {copied ? t.linkCopied : t.copyLink}
                    </button>
                  </div>
                  <span className="admin-field-hint">{t.linkHint}</span>
                </div>
              )}

              {showVisibility && (
                <div className="admin-field">
                  <span className="admin-field-label">{t.visibility}</span>
                  <button
                    type="button"
                    className={`admin-toggle-card ${album.hidden ? 'active' : ''}`}
                    onClick={() => onUpdate({ hidden: album.hidden ? undefined : true })}
                    aria-pressed={!!album.hidden}
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
                        {t.unlisted}
                      </span>
                      <span
                        className="toggle-card-desc"
                        style={{ fontSize: '0.8rem', display: 'block', opacity: 0.75 }}
                      >
                        {album.hidden ? t.unlistedDesc : t.listedDesc}
                      </span>
                    </div>
                    <div className={`switch-toggle ${album.hidden ? 'on' : ''}`}>
                      <span className="switch-slider" />
                    </div>
                  </button>
                </div>
              )}

              <div className="admin-field">
                <label htmlFor="album-password">{t.passwordProtection}</label>
                <PasswordField
                  id="album-password"
                  value={album.password}
                  onChange={(password) => onUpdate({ password })}
                  label={t.albumPassword}
                />
              </div>

              <div className="admin-field">
                <span className="admin-field-label">{t.downloads}</span>
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
                      {t.allowDownloads}
                    </span>
                    <span
                      className="toggle-card-desc"
                      style={{ fontSize: '0.8rem', display: 'block', opacity: 0.75 }}
                    >
                      {t.allowDownloadsDesc}
                    </span>
                  </div>
                  <div className={`switch-toggle ${album.download ? 'on' : ''}`}>
                    <span className="switch-slider" />
                  </div>
                </button>
              </div>

              <ZoomOverrideField
                id="album-zoom"
                value={album.zoom}
                onChange={(zoom) => onUpdate({ zoom })}
                inheritLabel={t.zoomInherit}
                hint={t.zoomHint}
              />
            </div>

            <div className="admin-sheet-col admin-sheet-col--divided">
              <div className="admin-field">
                <label htmlFor="album-layout-override">{t.layoutOverride}</label>
                <select
                  id="album-layout-override"
                  aria-label={t.layoutOverrideAria}
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
                  <option value="">{t.layoutInherit}</option>
                  {PHOTO_LAYOUTS.map((id) => (
                    <option key={id} value={id}>
                      {dict.common.layouts[id].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <label htmlFor="album-cover-focal-point">{t.coverFocalPoint}</label>
                <input
                  id="album-cover-focal-point"
                  value={album.coverPosition || ''}
                  onChange={(e) => onUpdate({ coverPosition: e.target.value || undefined })}
                  placeholder={t.coverFocalPointPlaceholder}
                />
              </div>

              {/* Hero Image Selection */}
              <div className="admin-field">
                <span className="admin-field-label">{t.customHero}</span>
                <div className="album-hero-field">
                  {album.heroImage ? (
                    <div className="album-hero-preview">
                      <img src={`/api/admin/thumbnail/${album.heroImage}`} alt={t.heroAlt} />
                      <button
                        className="album-hero-remove"
                        onClick={() => onUpdate({ heroImage: undefined })}
                        title={t.removeHero}
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="album-hero-empty">{t.defaultCover}</span>
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
                        title: t.pickHeroTitle(name),
                      })
                    }
                  >
                    <IconImage size={12} /> {album.heroImage ? t.changeImage : t.pickHero}
                  </button>
                </div>
              </div>

              {/* Photo order */}
              <div className="admin-field">
                <span className="admin-field-label" id="album-sort-label">
                  {t.photoOrder}
                </span>
                <Listbox
                  labelledBy="album-sort-label"
                  value={album.sort || DEFAULT_ALBUM_SORT}
                  options={options}
                  onChange={(mode) => onUpdate({ sort: mode })}
                />
                <span className="admin-field-hint">
                  {album.sort === 'manual' ? t.manualHint : t.immichHint}
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
                        ? t.reorderPhotosPinned(album.assetOrder.length)
                        : t.reorderPhotos}
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
            <IconTrash size={14} /> {t.removeAlbum}
          </button>
          <div className="uuid-copy-box" title={t.uuidTitle}>
            <code>{album.id}</code>
            <button
              className="uuid-copy-btn"
              onClick={() => {
                navigator.clipboard.writeText(album.id);
              }}
              title={t.copyUuid}
              aria-label={t.copyUuidAria}
            >
              <IconCopy size={12} />
            </button>
          </div>
          <button
            className="admin-btn admin-btn-primary"
            onClick={() => onClose()}
            style={{ maxWidth: '140px' }}
          >
            {t.done}
          </button>
        </div>
      </div>
    </div>
  );
}
