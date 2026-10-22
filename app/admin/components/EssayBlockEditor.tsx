'use client';

import { useState, useCallback } from 'react';
import {
  parseEssayMarkdown,
  serializeEssayMarkdown,
  collectAssetIds,
  isValidCoordinate,
  type ParsedEssay,
  type EssayBlock,
  type MapItem,
} from '@/lib/essay';
import { arrayMove } from '@dnd-kit/sortable';
import { SortableBlockList, SortableBlockCard } from './SortableBlocks';
import {
  IconCamera,
  IconChevronUp,
  IconChevronDown,
  IconTrash,
  IconQuote,
  IconFileText,
  IconSparkles,
  IconArrowLeftRight,
  IconGrid,
  IconColumns,
  IconMap,
  IconFolder,
  IconPlus,
  IconX,
} from './Icons';
import { BlockBadge } from './BlockBadge';
import { InlineMarkdownField } from './InlineMarkdownField';
import { useAdminDictionary } from './AdminI18n';

interface EssayBlockEditorProps {
  markdown: string;
  onChange: (newMarkdown: string) => void;
  onSelectPhoto?: (callback: (assetId: string) => void) => void;
}

export function EssayBlockEditor({ markdown, onChange, onSelectPhoto }: EssayBlockEditorProps) {
  const t = useAdminDictionary().pages.essay;
  const [essay, setEssay] = useState<ParsedEssay>(() =>
    parseEssayMarkdown(markdown || `# ${t.starterTitle}\n\n${t.starterBody}`),
  );

  // Sync internal state when the prop changes from outside (e.g. initial load).
  // Adjusting during render rather than in an effect: an effect would commit the
  // stale essay first and re-render, which flashes the previous story's blocks.
  const [lastMarkdown, setLastMarkdown] = useState(markdown);
  if (markdown !== lastMarkdown) {
    setLastMarkdown(markdown);
    if (markdown && markdown !== serializeEssayMarkdown(essay)) {
      setEssay(parseEssayMarkdown(markdown));
    }
  }

  const updateBlocks = useCallback(
    (newBlocks: EssayBlock[]) => {
      const updatedEssay: ParsedEssay = {
        ...essay,
        blocks: newBlocks,
        referencedAssetIds: collectAssetIds(newBlocks),
      };

      setEssay(updatedEssay);
      onChange(serializeEssayMarkdown(updatedEssay));
    },
    [essay, onChange],
  );

  // Block manipulation helpers
  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= essay.blocks.length) return;

    const newBlocks = [...essay.blocks];
    const [moved] = newBlocks.splice(index, 1);
    newBlocks.splice(targetIdx, 0, moved);
    updateBlocks(newBlocks);
  };

  const handleReorderBlock = (from: number, to: number) => {
    updateBlocks(arrayMove(essay.blocks, from, to));
  };

  const handleDeleteBlock = (index: number) => {
    const newBlocks = essay.blocks.filter((_, i) => i !== index);
    updateBlocks(newBlocks);
  };

  const handleUpdateBlock = (index: number, updated: EssayBlock) => {
    const newBlocks = [...essay.blocks];
    newBlocks[index] = updated;
    updateBlocks(newBlocks);
  };

  const handleAddBlock = (type: EssayBlock['type']) => {
    let newBlock: EssayBlock;

    switch (type) {
      case 'heading':
        newBlock = { type: 'heading', level: 2, text: t.newHeading };
        break;
      case 'paragraph':
        newBlock = { type: 'paragraph', html: t.newParagraph };
        break;
      case 'quote':
        newBlock = { type: 'quote', text: t.newQuote, author: '' };
        break;
      case 'photo':
        newBlock = {
          type: 'photo',
          assetId: '',
          caption: '',
          layout: 'contained',
        };
        break;
      case 'photo-pair':
        newBlock = {
          type: 'photo-pair',
          assetIds: ['', ''],
          caption: '',
        };
        break;
      case 'photo-grid':
        newBlock = { type: 'photo-grid', assetIds: ['', '', ''], caption: '' };
        break;
      case 'facts':
        newBlock = {
          type: 'facts',
          items: [
            { label: '', value: '' },
            { label: '', value: '' },
          ],
        };
        break;
      case 'map':
        newBlock = { type: 'map', caption: '', line: true, items: [] };
        break;
      case 'album':
        newBlock = { type: 'album', albumId: '', layout: 'grid' };
        break;
    }

    updateBlocks([...essay.blocks, newBlock]);
  };

  return (
    <div className="essay-block-editor">
      {/* Sticky Dark Glass Toolbar */}
      <div className="essay-toolbar-sticky">
        <span className="essay-toolbar-label">{t.toolbar}</span>
        <button
          type="button"
          className="admin-btn admin-btn-xs"
          onClick={() => handleAddBlock('paragraph')}
        >
          <IconFileText size={13} /> {t.add.paragraph}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs"
          onClick={() => handleAddBlock('heading')}
        >
          <IconSparkles size={13} /> {t.add.heading}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs"
          onClick={() => handleAddBlock('quote')}
        >
          <IconQuote size={13} /> {t.add.quote}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs"
          onClick={() => handleAddBlock('facts')}
        >
          <IconColumns size={13} /> {t.add.facts}
        </button>
        <div className="essay-toolbar-divider" />
        <button
          type="button"
          className="admin-btn admin-btn-xs admin-btn-primary"
          onClick={() => handleAddBlock('photo')}
        >
          <IconCamera size={13} /> {t.add.photo}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs admin-btn-primary"
          onClick={() => handleAddBlock('photo-pair')}
        >
          <IconCamera size={13} /> {t.add.photoPair}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs admin-btn-primary"
          onClick={() => handleAddBlock('photo-grid')}
        >
          <IconGrid size={13} /> {t.add.photoGrid}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs admin-btn-primary"
          onClick={() => handleAddBlock('album')}
        >
          <IconFolder size={13} /> {t.add.album}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs"
          onClick={() => handleAddBlock('map')}
        >
          <IconMap size={13} /> {t.add.map}
        </button>
      </div>

      {essay.blocks.length === 0 && (
        <p className="empty-hint" style={{ textAlign: 'center', padding: '2rem' }}>
          {t.empty}
        </p>
      )}

      {/* Render Blocks */}
      <SortableBlockList count={essay.blocks.length} onReorder={handleReorderBlock}>
        {essay.blocks.map((block, idx) => (
          <SortableBlockCard
            key={idx}
            index={idx}
            badge={<BlockBadge type={block.type} index={idx + 1} />}
            actions={
              <div className="essay-block-actions">
                <button
                  type="button"
                  className="admin-btn-icon"
                  onClick={() => handleMoveBlock(idx, 'up')}
                  disabled={idx === 0}
                  title={t.moveUp}
                >
                  <IconChevronUp size={15} />
                </button>
                <button
                  type="button"
                  className="admin-btn-icon"
                  onClick={() => handleMoveBlock(idx, 'down')}
                  disabled={idx === essay.blocks.length - 1}
                  title={t.moveDown}
                >
                  <IconChevronDown size={15} />
                </button>
                <button
                  type="button"
                  className="admin-btn-icon"
                  onClick={() => handleDeleteBlock(idx)}
                  title={t.deleteBlock}
                  style={{ color: 'var(--admin-error)' }}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            }
          >
            {/* Block Form Fields */}

            {/* 1. HEADING BLOCK */}
            {block.type === 'heading' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  aria-label={t.headingLevel}
                  value={block.level}
                  onChange={(e) =>
                    handleUpdateBlock(idx, { ...block, level: Number(e.target.value) })
                  }
                  style={{ width: '70px' }}
                >
                  <option value={1}>H1</option>
                  <option value={2}>H2</option>
                  <option value={3}>H3</option>
                </select>
                <input
                  type="text"
                  value={block.text}
                  onChange={(e) => handleUpdateBlock(idx, { ...block, text: e.target.value })}
                  placeholder={t.headingPlaceholder}
                  style={{
                    flex: 1,
                    fontWeight: block.level === 1 ? 700 : block.level === 2 ? 600 : 500,
                  }}
                />
              </div>
            )}

            {/* 2. PARAGRAPH BLOCK

              The field shows the markdown source and writes the rendered HTML
              back, as the journal editor does (InlineMarkdownField). An older
              version stripped the tags for display and wrote the stripped text
              straight back into `html`, destroying italics and links; the one
              after that showed the raw HTML. */}
            {block.type === 'paragraph' && (
              <InlineMarkdownField
                multiline
                rows={3}
                html={block.html}
                onChange={(html) => handleUpdateBlock(idx, { ...block, html })}
                placeholder={t.paragraphPlaceholder}
              />
            )}

            {/* 3. PULLQUOTE BLOCK */}
            {block.type === 'quote' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  borderLeft: '3px solid var(--admin-accent)',
                  paddingLeft: '10px',
                }}
              >
                <InlineMarkdownField
                  multiline
                  rows={2}
                  html={block.text}
                  onChange={(text) => handleUpdateBlock(idx, { ...block, text })}
                  placeholder={t.quotePlaceholder}
                  style={{ fontStyle: 'italic', fontFamily: 'serif', fontSize: '1rem' }}
                />
                <input
                  type="text"
                  value={block.author || ''}
                  onChange={(e) =>
                    handleUpdateBlock(idx, { ...block, author: e.target.value || undefined })
                  }
                  placeholder={t.authorPlaceholder}
                />
              </div>
            )}

            {/* 4. PHOTO BLOCK */}
            {block.type === 'photo' && (
              <div className="essay-photo-card">
                <div className="essay-photo-preview-container">
                  {block.assetId ? (
                    <img
                      src={`/api/admin/thumbnail/${block.assetId}`}
                      alt=""
                      className="essay-photo-thumbnail"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="essay-photo-empty">
                      <IconCamera size={20} />
                      <span>{t.noPhoto}</span>
                    </div>
                  )}

                  <div className="essay-photo-meta">
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {onSelectPhoto && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-primary"
                          onClick={() =>
                            onSelectPhoto((pickedId) =>
                              handleUpdateBlock(idx, { ...block, assetId: pickedId }),
                            )
                          }
                        >
                          <IconCamera size={14} />
                          {block.assetId ? t.changePhoto : t.selectPhoto}
                        </button>
                      )}

                      <div className="essay-pill-selector">
                        <button
                          type="button"
                          className={`essay-pill-btn ${block.layout === 'contained' ? 'active' : ''}`}
                          onClick={() => handleUpdateBlock(idx, { ...block, layout: 'contained' })}
                        >
                          {t.contained}
                        </button>
                        <button
                          type="button"
                          className={`essay-pill-btn ${block.layout === 'wide' ? 'active' : ''}`}
                          onClick={() => handleUpdateBlock(idx, { ...block, layout: 'wide' })}
                        >
                          {t.wide}
                        </button>
                        <button
                          type="button"
                          className={`essay-pill-btn ${block.layout === 'fullbleed' ? 'active' : ''}`}
                          onClick={() => handleUpdateBlock(idx, { ...block, layout: 'fullbleed' })}
                        >
                          {t.fullbleed}
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={block.assetId}
                      onChange={(e) =>
                        handleUpdateBlock(idx, { ...block, assetId: e.target.value })
                      }
                      placeholder={t.assetUuidPlaceholder}
                      style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}
                    />
                  </div>
                </div>

                <InlineMarkdownField
                  html={block.caption}
                  onChange={(caption) =>
                    handleUpdateBlock(idx, { ...block, caption: caption || undefined })
                  }
                  placeholder={t.photoCaption}
                />
              </div>
            )}

            {/* 5. PHOTO-PAIR BLOCK */}
            {block.type === 'photo-pair' && (
              <div className="essay-photo-card">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Photo 1 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--admin-text-secondary)',
                      }}
                    >
                      {t.photoN(1)}
                    </span>
                    <div className="essay-photo-preview-container">
                      {block.assetIds[0] ? (
                        <img
                          src={`/api/admin/thumbnail/${block.assetIds[0]}`}
                          alt=""
                          className="essay-photo-thumbnail"
                          style={{ width: '80px', height: '60px' }}
                        />
                      ) : (
                        <div
                          className="essay-photo-empty"
                          style={{ width: '80px', height: '60px' }}
                        >
                          <IconCamera size={16} />
                        </div>
                      )}
                      <div
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}
                      >
                        {onSelectPhoto && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-xs"
                            onClick={() =>
                              onSelectPhoto((pickedId) =>
                                handleUpdateBlock(idx, {
                                  ...block,
                                  assetIds: [pickedId, block.assetIds[1]],
                                }),
                              )
                            }
                          >
                            <IconCamera size={12} /> {t.selectPhotoN(1)}
                          </button>
                        )}
                        <input
                          type="text"
                          value={block.assetIds[0]}
                          onChange={(e) =>
                            handleUpdateBlock(idx, {
                              ...block,
                              assetIds: [e.target.value, block.assetIds[1]],
                            })
                          }
                          placeholder={t.uuidN(1)}
                          style={{ fontSize: '0.75rem' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Photo 2 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--admin-text-secondary)',
                        }}
                      >
                        {t.photoN(2)}
                      </span>
                      <button
                        type="button"
                        className="admin-btn-icon"
                        title={t.swapPhotos}
                        onClick={() =>
                          handleUpdateBlock(idx, {
                            ...block,
                            assetIds: [block.assetIds[1], block.assetIds[0]],
                          })
                        }
                      >
                        <IconArrowLeftRight size={14} />
                      </button>
                    </div>

                    <div className="essay-photo-preview-container">
                      {block.assetIds[1] ? (
                        <img
                          src={`/api/admin/thumbnail/${block.assetIds[1]}`}
                          alt=""
                          className="essay-photo-thumbnail"
                          style={{ width: '80px', height: '60px' }}
                        />
                      ) : (
                        <div
                          className="essay-photo-empty"
                          style={{ width: '80px', height: '60px' }}
                        >
                          <IconCamera size={16} />
                        </div>
                      )}
                      <div
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}
                      >
                        {onSelectPhoto && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-xs"
                            onClick={() =>
                              onSelectPhoto((pickedId) =>
                                handleUpdateBlock(idx, {
                                  ...block,
                                  assetIds: [block.assetIds[0], pickedId],
                                }),
                              )
                            }
                          >
                            <IconCamera size={12} /> {t.selectPhotoN(2)}
                          </button>
                        )}
                        <input
                          type="text"
                          value={block.assetIds[1]}
                          onChange={(e) =>
                            handleUpdateBlock(idx, {
                              ...block,
                              assetIds: [block.assetIds[0], e.target.value],
                            })
                          }
                          placeholder={t.uuidN(2)}
                          style={{ fontSize: '0.75rem' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <InlineMarkdownField
                  html={block.caption}
                  onChange={(caption) =>
                    handleUpdateBlock(idx, { ...block, caption: caption || undefined })
                  }
                  placeholder={t.pairCaption}
                />
              </div>
            )}

            {/* 6. PHOTO-GRID BLOCK */}
            {block.type === 'photo-grid' && (
              <div className="essay-photo-card">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  {block.assetIds.map((assetId, pIdx) => (
                    <div
                      key={pIdx}
                      style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--admin-text-secondary)',
                          }}
                        >
                          {t.photoN(pIdx + 1)}
                        </span>
                        {block.assetIds.length > 3 && (
                          <button
                            type="button"
                            className="admin-btn-icon"
                            title={t.removePhoto}
                            onClick={() =>
                              handleUpdateBlock(idx, {
                                ...block,
                                assetIds: block.assetIds.filter((_, i) => i !== pIdx),
                              })
                            }
                          >
                            <IconX size={13} />
                          </button>
                        )}
                      </div>
                      <div className="essay-photo-preview-container">
                        {assetId ? (
                          <img
                            src={`/api/admin/thumbnail/${assetId}`}
                            alt=""
                            className="essay-photo-thumbnail"
                            style={{ width: '80px', height: '60px' }}
                          />
                        ) : (
                          <div
                            className="essay-photo-empty"
                            style={{ width: '80px', height: '60px' }}
                          >
                            <IconCamera size={16} />
                          </div>
                        )}
                        <div
                          style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}
                        >
                          {onSelectPhoto && (
                            <button
                              type="button"
                              className="admin-btn admin-btn-xs"
                              onClick={() =>
                                onSelectPhoto((pickedId) => {
                                  const ids = [...block.assetIds];
                                  ids[pIdx] = pickedId;
                                  handleUpdateBlock(idx, { ...block, assetIds: ids });
                                })
                              }
                            >
                              <IconCamera size={12} /> {t.select}
                            </button>
                          )}
                          <input
                            type="text"
                            value={assetId}
                            onChange={(e) => {
                              const ids = [...block.assetIds];
                              ids[pIdx] = e.target.value;
                              handleUpdateBlock(idx, { ...block, assetIds: ids });
                            }}
                            placeholder={t.uuidN(pIdx + 1)}
                            style={{ fontSize: '0.75rem' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="admin-btn admin-btn-xs"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() =>
                    handleUpdateBlock(idx, { ...block, assetIds: [...block.assetIds, ''] })
                  }
                >
                  <IconPlus size={12} /> {t.addPhoto}
                </button>

                <InlineMarkdownField
                  html={block.caption}
                  onChange={(caption) =>
                    handleUpdateBlock(idx, { ...block, caption: caption || undefined })
                  }
                  placeholder={t.gridCaption}
                />
              </div>
            )}
            {/* 7. FACTS BLOCK */}
            {block.type === 'facts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {block.items.map((item, fIdx) => (
                  <div
                    key={fIdx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 2fr auto',
                      gap: '8px',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="text"
                      value={item.label}
                      placeholder={t.factLabel}
                      onChange={(e) =>
                        handleUpdateBlock(idx, {
                          ...block,
                          items: block.items.map((it, i) =>
                            i === fIdx ? { ...it, label: e.target.value } : it,
                          ),
                        })
                      }
                    />
                    <InlineMarkdownField
                      html={item.value}
                      placeholder={t.factValue}
                      onChange={(value) =>
                        handleUpdateBlock(idx, {
                          ...block,
                          items: block.items.map((it, i) => (i === fIdx ? { ...it, value } : it)),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="admin-btn-icon"
                      title={t.removeFact}
                      disabled={block.items.length <= 1}
                      onClick={() =>
                        handleUpdateBlock(idx, {
                          ...block,
                          items: block.items.filter((_, i) => i !== fIdx),
                        })
                      }
                    >
                      <IconX size={13} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="admin-btn admin-btn-xs"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() =>
                    handleUpdateBlock(idx, {
                      ...block,
                      items: [...block.items, { label: '', value: '' }],
                    })
                  }
                >
                  <IconPlus size={12} /> {t.addFact}
                </button>
              </div>
            )}
            {/* 9. ALBUM BLOCK */}
            {block.type === 'album' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  value={block.albumId}
                  placeholder={t.albumUuidPlaceholder}
                  style={{ fontSize: '0.75rem' }}
                  onChange={(e) => handleUpdateBlock(idx, { ...block, albumId: e.target.value })}
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    min={1}
                    placeholder={t.countPlaceholder}
                    aria-label={t.count}
                    style={{ flex: '1 1 100px' }}
                    value={block.count ?? ''}
                    onChange={(e) =>
                      handleUpdateBlock(idx, {
                        ...block,
                        count: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder={t.skipPlaceholder}
                    aria-label={t.skip}
                    style={{ flex: '1 1 100px' }}
                    value={block.skip ?? ''}
                    onChange={(e) =>
                      handleUpdateBlock(idx, {
                        ...block,
                        skip: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                  <select
                    aria-label={t.layout}
                    style={{ flex: '1 1 140px' }}
                    value={block.layout}
                    onChange={(e) =>
                      handleUpdateBlock(idx, {
                        ...block,
                        layout: e.target.value as 'grid' | 'pairs' | 'wide',
                      })
                    }
                  >
                    <option value="grid">{t.albumLayouts.grid}</option>
                    <option value="pairs">{t.albumLayouts.pairs}</option>
                    <option value="wide">{t.albumLayouts.wide}</option>
                  </select>
                </div>
                <InlineMarkdownField
                  html={block.caption}
                  onChange={(caption) =>
                    handleUpdateBlock(idx, { ...block, caption: caption || undefined })
                  }
                  placeholder={t.albumCaption}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                  {t.albumHint}
                </span>
              </div>
            )}

            {/* 8. MAP BLOCK */}
            {block.type === 'map' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <InlineMarkdownField
                  html={block.caption}
                  onChange={(caption) =>
                    handleUpdateBlock(idx, { ...block, caption: caption || undefined })
                  }
                  placeholder={t.mapCaption}
                />

                {block.items.map((item, mIdx) => {
                  const setItem = (next: MapItem) =>
                    handleUpdateBlock(idx, {
                      ...block,
                      items: block.items.map((it, i) => (i === mIdx ? next : it)),
                    });
                  return (
                    <div
                      key={mIdx}
                      style={{
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)' }}>
                        {mIdx + 1}
                      </span>
                      {item.kind === 'point' && (
                        <>
                          <input
                            type="text"
                            value={item.label ?? ''}
                            placeholder={t.pointLabel}
                            style={{ flex: '1 1 140px' }}
                            onChange={(e) =>
                              setItem({ ...item, label: e.target.value || undefined })
                            }
                          />
                          <input
                            type="number"
                            step="any"
                            aria-label={t.latitude}
                            placeholder={t.lat}
                            style={{ flex: '0 1 110px' }}
                            value={Number.isFinite(item.lat) ? item.lat : ''}
                            onChange={(e) => setItem({ ...item, lat: parseFloat(e.target.value) })}
                          />
                          <input
                            type="number"
                            step="any"
                            aria-label={t.longitude}
                            placeholder={t.lng}
                            style={{ flex: '0 1 110px' }}
                            value={Number.isFinite(item.lng) ? item.lng : ''}
                            onChange={(e) => setItem({ ...item, lng: parseFloat(e.target.value) })}
                          />
                        </>
                      )}
                      {item.kind === 'photo' && (
                        <>
                          {onSelectPhoto && (
                            <button
                              type="button"
                              className="admin-btn admin-btn-xs"
                              onClick={() =>
                                onSelectPhoto((pickedId) =>
                                  setItem({ kind: 'photo', assetId: pickedId }),
                                )
                              }
                            >
                              <IconCamera size={12} /> {item.assetId ? t.change : t.select}
                            </button>
                          )}
                          <input
                            type="text"
                            value={item.assetId}
                            placeholder={t.photoUuidPlaceholder}
                            style={{ flex: '1 1 200px', fontSize: '0.75rem' }}
                            onChange={(e) => setItem({ kind: 'photo', assetId: e.target.value })}
                          />
                        </>
                      )}
                      {item.kind === 'all-photos' && (
                        <span style={{ flex: 1, fontSize: '0.8rem' }}>{t.allPhotosItem}</span>
                      )}
                      <button
                        type="button"
                        className="admin-btn-icon"
                        title={t.removePin}
                        onClick={() =>
                          handleUpdateBlock(idx, {
                            ...block,
                            items: block.items.filter((_, i) => i !== mIdx),
                          })
                        }
                      >
                        <IconX size={13} />
                      </button>
                    </div>
                  );
                })}

                {block.items.some(
                  (it) => it.kind === 'point' && !isValidCoordinate(it.lat, it.lng),
                ) && (
                  <p className="empty-hint" style={{ color: 'var(--admin-warning)' }}>
                    {t.invalidPoint}
                  </p>
                )}

                <div
                  style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}
                >
                  <button
                    type="button"
                    className="admin-btn admin-btn-xs"
                    onClick={() =>
                      handleUpdateBlock(idx, {
                        ...block,
                        items: [
                          ...block.items,
                          { kind: 'point', lat: Number.NaN, lng: Number.NaN },
                        ],
                      })
                    }
                  >
                    <IconPlus size={12} /> {t.addPoint}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-xs"
                    onClick={() =>
                      handleUpdateBlock(idx, {
                        ...block,
                        items: [...block.items, { kind: 'photo', assetId: '' }],
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
                      handleUpdateBlock(idx, {
                        ...block,
                        items: [...block.items, { kind: 'all-photos' }],
                      })
                    }
                  >
                    <IconMap size={12} /> {t.addAllPhotos}
                  </button>
                  <label
                    style={{
                      marginLeft: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={block.line}
                      onChange={(e) => handleUpdateBlock(idx, { ...block, line: e.target.checked })}
                    />
                    {t.connectLine}
                  </label>
                </div>

                <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                  {t.mapHint}
                </span>
              </div>
            )}
          </SortableBlockCard>
        ))}
      </SortableBlockList>
    </div>
  );
}
