'use client';

import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { EssayBlockEditor } from '../EssayBlockEditor';
import GridOverrideFields from '../fields/GridOverrideFields';
import {
  IconBan,
  IconBook,
  IconEyeOff,
  IconGlobe,
  IconLock,
  IconPencil,
  IconSearch,
  IconTrash,
  IconX,
} from '../Icons';
import AlbumCard, { SortableAlbumCard } from './AlbumCard';
import SubpagePreview from './SubpagePreview';
import {
  normalizeSubpageGrid,
  type ActiveEditAlbumAddress,
  type HeroPickerTarget,
  type ImmichAlbumInfo,
  type PickerTarget,
  type Section,
  type Subpage,
} from './types';
import {
  COVER_GRID_COLUMNS_MAX,
  COVER_GRID_COLUMNS_MIN,
  COVER_GRID_GAP_MAX,
  PHOTO_GRID_COLUMNS_MAX,
  PHOTO_GRID_COLUMNS_MIN,
  PHOTO_GRID_GAP_MAX,
  slugify,
} from '@/lib/config/schema';

interface SubpageDrawerProps {
  sp: Subpage;
  spIndex: number;
  immichAlbums: ImmichAlbumInfo[];
  sensors: SensorDescriptor<SensorOptions>[];
  drawerMode: 'edit' | 'preview';
  onDrawerModeChange: (mode: 'edit' | 'preview') => void;
  onClose: () => void;
  updateSubpage: (index: number, updates: Partial<Subpage>) => void;
  removeSubpage: (index: number) => void;
  addSection: (subpageIndex: number) => void;
  removeSection: (subpageIndex: number, sectionIndex: number) => void;
  updateSection: (subpageIndex: number, sectionIndex: number, updates: Partial<Section>) => void;
  removeSubpageAlbum: (subpageIndex: number, albumIndex: number) => void;
  removeSectionAlbum: (subpageIndex: number, sectionIndex: number, albumIndex: number) => void;
  onAlbumDragEnd: (event: DragEndEvent) => void;
  onPickAlbum: (target: PickerTarget | null) => void;
  onEditAlbum: (address: ActiveEditAlbumAddress | null) => void;
  onPickHero: (target: HeroPickerTarget | null) => void;
  getAlbumName: (id: string) => string;
  getAlbumCount: (id: string) => number;
  getAlbumThumbnailId: (id: string) => string | null;
}

/**
 * The subpage sheet: metadata, layout, and the albums on one page.
 *
 * The gallery state stays in PageBuilder — this drawer renders the subpage it
 * is handed and reports every edit back through the callbacks above, so it
 * changes nothing on its own.
 */
export default function SubpageDrawer({
  sp,
  spIndex,
  immichAlbums,
  sensors,
  drawerMode,
  onDrawerModeChange,
  onClose,
  updateSubpage,
  removeSubpage,
  addSection,
  removeSection,
  updateSection,
  removeSubpageAlbum,
  removeSectionAlbum,
  onAlbumDragEnd,
  onPickAlbum,
  onEditAlbum,
  onPickHero,
  getAlbumName,
  getAlbumCount,
  getAlbumThumbnailId,
}: SubpageDrawerProps) {
  return (
    <div className="subpage-drawer-backdrop" onClick={() => onClose()}>
      <div className="subpage-drawer-container" onClick={(e) => e.stopPropagation()}>
        <div className="subpage-drawer-header">
          <div className="subpage-drawer-title-group">
            <span className="subpage-drawer-breadcrumb">Pages / Subpages</span>
            <h3 className="subpage-drawer-title">{sp.title || sp.name || 'Untitled Page'}</h3>
          </div>
          <div className="subpage-drawer-header-actions">
            <div className="segmented-control" style={{ padding: '2px' }}>
              <button
                type="button"
                className={`segment-btn ${drawerMode === 'edit' ? 'active' : ''}`}
                onClick={() => onDrawerModeChange('edit')}
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
              >
                <IconPencil size={14} /> Edit
              </button>
              <button
                type="button"
                className={`segment-btn ${drawerMode === 'preview' ? 'active' : ''}`}
                onClick={() => onDrawerModeChange('preview')}
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
              >
                <IconSearch size={14} /> Live Preview
              </button>
            </div>

            <a
              href={`/${slugify(sp.name)}?fresh=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn admin-btn-xs admin-btn-ghost"
              title="Open live page in new tab (bypassing cache)"
            >
              /{slugify(sp.name)} ↗
            </a>
            <button className="admin-btn-icon" onClick={() => onClose()} title="Close drawer">
              <IconX size={14} />
            </button>
          </div>
        </div>

        <div className="subpage-drawer-body">
          {drawerMode === 'preview' ? (
            <SubpagePreview sp={sp} immichAlbums={immichAlbums} />
          ) : (
            <div className="admin-sheet-columns admin-sheet-columns--settings-aside">
              <div className="admin-sheet-col">
                <div className="subpage-drawer-section">
                  <div className="admin-field">
                    <label>Page Name (URL Identifier)</label>
                    <div className="input-slug-wrapper">
                      <input
                        className="subpage-name-input"
                        value={sp.name}
                        onChange={(e) => updateSubpage(spIndex, { name: e.target.value })}
                        placeholder="e.g. dubai, travel, weddings"
                      />
                      <span className="input-slug-preview">/{slugify(sp.name)}</span>
                    </div>
                  </div>
                </div>

                {/* Subpage metadata */}
                <div className="subpage-drawer-section">
                  <div className="admin-field-row">
                    <div className="admin-field">
                      <label>Display Title (optional)</label>
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
                          updateSubpage(spIndex, {
                            subtitle: e.target.value || undefined,
                          })
                        }
                        placeholder="Subtitle text"
                      />
                    </div>
                  </div>
                  <div className="admin-field" style={{ marginTop: '1rem' }}>
                    <label>Visibility &amp; Access</label>
                    {/*
                            One field, three states — enabled/hidden are two YAML flags,
                            but for the owner it is a single question: how visible is
                            this page? Splitting it across two toggles produced
                            contradictory copy ("Disabled (Hidden)" vs "Unlisted").
                          */}
                    {(
                      [
                        {
                          key: 'published',
                          active: sp.enabled !== false && sp.hidden !== true,
                          icon: <IconGlobe size={15} />,
                          iconColor: '#4ade80',
                          title: 'Published',
                          desc: 'Shown in the header menu and homepage lists, reachable via URL',
                          patch: { enabled: true, hidden: false },
                        },
                        {
                          key: 'unlisted',
                          active: sp.enabled !== false && sp.hidden === true,
                          icon: <IconEyeOff size={15} />,
                          iconColor: '#fbbf24',
                          title: 'Unlisted (Experimental)',
                          desc: 'Not shown in menus or on the homepage, but reachable via direct link',
                          patch: { enabled: true, hidden: true },
                        },
                        {
                          key: 'disabled',
                          active: sp.enabled === false,
                          icon: <IconBan size={15} />,
                          iconColor: '#f87171',
                          title: 'Disabled',
                          desc: 'Completely offline — returns 404 even when accessed directly',
                          patch: { enabled: false, hidden: false },
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={`admin-toggle-card ${opt.active ? 'active' : ''}`}
                        onClick={() => updateSubpage(spIndex, opt.patch)}
                        aria-pressed={opt.active}
                        style={{
                          padding: '10px 14px',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          marginBottom: '6px',
                        }}
                      >
                        <div className="toggle-card-info" style={{ textAlign: 'left' }}>
                          <span
                            className="toggle-card-title"
                            style={{
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span
                              style={{ color: opt.iconColor, display: 'inline-flex' }}
                              aria-hidden="true"
                            >
                              {opt.icon}
                            </span>
                            {opt.title}
                          </span>
                          <span
                            className="toggle-card-desc"
                            style={{
                              fontSize: '0.8rem',
                              display: 'block',
                              opacity: 0.75,
                            }}
                          >
                            {opt.desc}
                          </span>
                        </div>
                        <div className={`switch-toggle ${opt.active ? 'on' : ''}`}>
                          <span className="switch-slider" />
                        </div>
                      </button>
                    ))}

                    {/* Password lives in the same group: it is the access half
                              of "who gets to see this page". Applies to Published and
                              Unlisted; a Disabled page 404s before the gate. */}
                    <div className="password-input-wrapper" style={{ marginTop: '6px' }}>
                      <span className="password-icon">
                        <IconLock size={12} />
                      </span>
                      <input
                        type="password"
                        value={sp.password || ''}
                        onChange={(e) =>
                          updateSubpage(spIndex, {
                            password: e.target.value || undefined,
                          })
                        }
                        placeholder="Password protection (optional) — leave empty for public access"
                        disabled={sp.enabled === false}
                      />
                    </div>
                  </div>
                  <div className="admin-field" style={{ marginTop: '1rem' }}>
                    <label>Page Layout Style</label>
                    <select
                      value={sp.grid?.layout || 'masonry'}
                      onChange={(e) => {
                        const newLayout = e.target.value;
                        updateSubpage(spIndex, {
                          grid: { ...(sp.grid || {}), layout: newLayout },
                        });
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        width: '100%',
                        fontSize: '0.9rem',
                      }}
                    >
                      {/*
                              Plain text, no emoji: an <option> cannot contain markup, so the
                              SVG icon set is not available here — and a decorative emoji is
                              not a substitute for it.
                            */}
                      <option value="masonry">Masonry Grid (Dynamic Height)</option>
                      <option value="uniform">Uniform Grid (Square Tiles)</option>
                      <option value="showcase">Showcase (Featured First Asset)</option>
                      <option value="filmstrip">Filmstrip (Horizontal Scroll)</option>
                      <option value="editorial-flow">Editorial Flow</option>
                      <option value="essay">Photo Essay Mode (Storytelling Editor)</option>
                    </select>
                  </div>

                  {/* Album cover grid — hidden in essay mode, which
                                  renders a story instead of a cover grid. The
                                  album count is deliberately not checked: it
                                  changes in this very drawer, and a field that
                                  vanishes while you edit is worse than one that
                                  has no effect yet. */}
                  {sp.grid?.layout !== 'essay' && sp.essayText == null && (
                    <GridOverrideFields
                      label="Album Cover Grid"
                      hint={
                        <>
                          Overrides how the album covers are tiled on this page — the photos inside
                          the albums are not affected. Leave the column count empty to follow the
                          site-wide grid setting, and the gap empty to keep the theme&apos;s own
                          spacing. Tablet widths show at most two covers per row.
                        </>
                      }
                      columnsMin={COVER_GRID_COLUMNS_MIN}
                      columnsMax={COVER_GRID_COLUMNS_MAX}
                      gapMax={COVER_GRID_GAP_MAX}
                      value={sp.coverGrid}
                      onChange={(next) =>
                        updateSubpage(spIndex, {
                          coverGrid: normalizeSubpageGrid(next),
                        })
                      }
                    />
                  )}

                  {/* Photo grid — the albums opened from this page.
                                  Separate from the cover grid above: one field
                                  used to drive both, so a cover gap retuned
                                  every photo grid on the page (#523). */}
                  {sp.essayText == null && (
                    <GridOverrideFields
                      label="Photo Grid (Albums On This Page)"
                      hint={
                        <>
                          How the photos inside every album on this page are laid out. Leave both
                          empty to follow Settings &rsaquo; Grid; a single album can still override
                          this in gallery.yaml.
                        </>
                      }
                      columnsMin={PHOTO_GRID_COLUMNS_MIN}
                      columnsMax={PHOTO_GRID_COLUMNS_MAX}
                      gapMax={PHOTO_GRID_GAP_MAX}
                      value={sp.grid}
                      onChange={(next) =>
                        updateSubpage(spIndex, { grid: normalizeSubpageGrid(next) })
                      }
                    />
                  )}
                </div>

                {/* Visual Photo Essay Builder (if layout === 'essay') */}
                {(sp.grid?.layout === 'essay' || sp.essayText != null) && (
                  <div className="subpage-drawer-section">
                    <div className="drawer-section-heading">
                      <h4>
                        <IconBook size={16} /> Storytelling &amp; Photo Essay Builder
                      </h4>
                      <p>Compose text, quotes, and fullbleed/wide photos visually.</p>
                    </div>

                    <EssayBlockEditor
                      markdown={sp.essayText || ''}
                      onChange={(newMarkdown) => updateSubpage(spIndex, { essayText: newMarkdown })}
                      onSelectPhoto={(callback) => {
                        onPickHero({
                          albumId: undefined,
                          title: 'Select Photo for Photo Essay',
                          onSelect: (assetId) => {
                            callback(assetId);
                            onPickHero(null);
                          },
                        });
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="admin-sheet-col admin-sheet-col--divided">
                {/* Albums (if no sections) with DnD */}
                {(!sp.sections || sp.sections.length === 0) && (
                  <div className="subpage-albums">
                    <div className="subpage-albums-header">
                      <span>Albums in this Page</span>
                      <button
                        className="admin-btn admin-btn-xs admin-btn-primary"
                        onClick={() => onPickAlbum({ type: 'subpage', subpageIndex: spIndex })}
                      >
                        + Add Album
                      </button>
                    </div>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={onAlbumDragEnd}
                    >
                      <SortableContext
                        items={sp.albums.map((a, i) => `album-${a.id}-${i}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="album-list">
                          {sp.albums.length === 0 && (
                            <p className="empty-hint">
                              No albums added yet. Click + Add Album to pick from Immich.
                            </p>
                          )}
                          {sp.albums.map((album, aIndex) => (
                            <SortableAlbumCard
                              key={`${album.id}-${aIndex}`}
                              album={album}
                              index={aIndex}
                              name={getAlbumName(album.id)}
                              count={getAlbumCount(album.id)}
                              thumbnailId={getAlbumThumbnailId(album.id)}
                              onRemove={() => removeSubpageAlbum(spIndex, aIndex)}
                              onEdit={() =>
                                onEditAlbum({
                                  type: 'subpage',
                                  subpageIndex: spIndex,
                                  albumIndex: aIndex,
                                })
                              }
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
                              updateSection(spIndex, secIndex, {
                                title: e.target.value,
                              })
                            }
                            placeholder="Section title"
                          />
                          <button
                            className="admin-btn-icon"
                            onClick={() => removeSection(spIndex, secIndex)}
                            title="Remove section"
                          >
                            <IconX size={14} />
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
                              onEdit={() =>
                                onEditAlbum({
                                  type: 'section',
                                  subpageIndex: spIndex,
                                  sectionIndex: secIndex,
                                  albumIndex: aIndex,
                                })
                              }
                            />
                          ))}
                        </div>
                        <button
                          className="admin-btn admin-btn-xs"
                          onClick={() =>
                            onPickAlbum({
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

                <div className="subpage-actions" style={{ marginTop: '1rem' }}>
                  <button
                    className="admin-btn admin-btn-xs admin-btn-secondary"
                    onClick={() => addSection(spIndex)}
                  >
                    + Add Section
                  </button>
                  {sp.sections && sp.sections.length > 0 && (
                    <button
                      className="admin-btn admin-btn-xs admin-btn-secondary"
                      onClick={() => onPickAlbum({ type: 'subpage', subpageIndex: spIndex })}
                    >
                      + Add Loose Album
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="subpage-drawer-footer">
          <button
            className="admin-btn admin-btn-danger admin-btn-sm"
            onClick={() => {
              removeSubpage(spIndex);
              onClose();
            }}
          >
            <IconTrash size={14} /> Delete Subpage
          </button>
          <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => onClose()}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
