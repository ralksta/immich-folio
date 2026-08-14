'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  parseEssayMarkdown,
  serializeEssayMarkdown,
  type ParsedEssay,
  type EssayBlock,
} from '@/lib/essay';
import {
  IconCamera,
  IconChevronUp,
  IconChevronDown,
  IconTrash,
  IconGripVertical,
  IconQuote,
  IconFileText,
  IconSparkles,
  IconArrowLeftRight,
} from './Icons';
import { BlockBadge } from './BlockBadge';

interface EssayBlockEditorProps {
  markdown: string;
  onChange: (newMarkdown: string) => void;
  onSelectPhoto?: (callback: (assetId: string) => void) => void;
}

export function EssayBlockEditor({ markdown, onChange, onSelectPhoto }: EssayBlockEditorProps) {
  const [essay, setEssay] = useState<ParsedEssay>(() =>
    parseEssayMarkdown(markdown || '# Title\n\nWrite your story here...')
  );

  // Sync internal state when prop changes from outside (e.g. initial load)
  useEffect(() => {
    const currentSerialized = serializeEssayMarkdown(essay);
    if (markdown !== currentSerialized && markdown) {
      setEssay(parseEssayMarkdown(markdown));
    }
  }, [markdown]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateBlocks = useCallback(
    (newBlocks: EssayBlock[]) => {
      const updatedEssay: ParsedEssay = {
        ...essay,
        blocks: newBlocks,
        referencedAssetIds: Array.from(
          new Set(
            newBlocks.flatMap((b) => {
              if (b.type === 'photo') return [b.assetId];
              if (b.type === 'photo-pair') return b.assetIds;
              return [];
            })
          )
        ),
      };

      setEssay(updatedEssay);
      onChange(serializeEssayMarkdown(updatedEssay));
    },
    [essay, onChange]
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
        newBlock = { type: 'heading', level: 2, text: 'New Section Heading' };
        break;
      case 'paragraph':
        newBlock = { type: 'paragraph', html: 'Enter text paragraph here...' };
        break;
      case 'quote':
        newBlock = { type: 'quote', text: 'Enter quote text here...', author: '' };
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
    }

    updateBlocks([...essay.blocks, newBlock]);
  };

  return (
    <div className="essay-block-editor">
      {/* Sticky Dark Glass Toolbar */}
      <div className="essay-toolbar-sticky">
        <span className="essay-toolbar-label">Add Story Block:</span>
        <button
          type="button"
          className="admin-btn admin-btn-xs"
          onClick={() => handleAddBlock('paragraph')}
        >
          <IconFileText size={13} /> + Paragraph
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs"
          onClick={() => handleAddBlock('heading')}
        >
          <IconSparkles size={13} /> + Heading
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs"
          onClick={() => handleAddBlock('quote')}
        >
          <IconQuote size={13} /> + Pullquote
        </button>
        <div className="essay-toolbar-divider" />
        <button
          type="button"
          className="admin-btn admin-btn-xs admin-btn-primary"
          onClick={() => handleAddBlock('photo')}
        >
          <IconCamera size={13} /> + Photo
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs admin-btn-primary"
          onClick={() => handleAddBlock('photo-pair')}
        >
          <IconCamera size={13} /> + 2-Photo Pair
        </button>
      </div>

      {essay.blocks.length === 0 && (
        <p className="empty-hint" style={{ textAlign: 'center', padding: '2rem' }}>
          No story blocks yet. Use the buttons above to build your photo essay!
        </p>
      )}

      {/* Render Blocks */}
      {essay.blocks.map((block, idx) => (
        <div key={idx} className="essay-block-card">
          {/* Card Header */}
          <div className="essay-block-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconGripVertical size={14} style={{ color: 'var(--admin-text-muted)', cursor: 'grab' }} />
              <BlockBadge type={block.type} index={idx + 1} />
            </div>

            <div className="essay-block-actions">
              <button
                type="button"
                className="admin-btn-icon"
                onClick={() => handleMoveBlock(idx, 'up')}
                disabled={idx === 0}
                title="Move Up"
              >
                <IconChevronUp size={15} />
              </button>
              <button
                type="button"
                className="admin-btn-icon"
                onClick={() => handleMoveBlock(idx, 'down')}
                disabled={idx === essay.blocks.length - 1}
                title="Move Down"
              >
                <IconChevronDown size={15} />
              </button>
              <button
                type="button"
                className="admin-btn-icon"
                onClick={() => handleDeleteBlock(idx)}
                title="Delete Block"
                style={{ color: 'var(--admin-error)' }}
              >
                <IconTrash size={15} />
              </button>
            </div>
          </div>

          {/* Block Form Fields */}

          {/* 1. HEADING BLOCK */}
          {block.type === 'heading' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
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
                placeholder="Section heading..."
                style={{ flex: 1, fontWeight: block.level === 1 ? 700 : block.level === 2 ? 600 : 500 }}
              />
            </div>
          )}

          {/* 2. PARAGRAPH BLOCK */}
          {block.type === 'paragraph' && (
            <textarea
              rows={3}
              value={block.html.replace(/<[^>]+>/g, (t) =>
                t.startsWith('<strong>') ? '**' : t.startsWith('</strong>') ? '**' : ''
              )}
              onChange={(e) => handleUpdateBlock(idx, { ...block, html: e.target.value })}
              placeholder="Write text paragraph... (**bold**, *italic* markdown supported)"
            />
          )}

          {/* 3. PULLQUOTE BLOCK */}
          {block.type === 'quote' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid var(--admin-accent)', paddingLeft: '10px' }}>
              <textarea
                rows={2}
                value={block.text}
                onChange={(e) => handleUpdateBlock(idx, { ...block, text: e.target.value })}
                placeholder="Quote text..."
                style={{ fontStyle: 'italic', fontFamily: 'serif', fontSize: '1rem' }}
              />
              <input
                type="text"
                value={block.author || ''}
                onChange={(e) =>
                  handleUpdateBlock(idx, { ...block, author: e.target.value || undefined })
                }
                placeholder="— Author / Attribution (optional)"
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
                    <span>No Photo</span>
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
                            handleUpdateBlock(idx, { ...block, assetId: pickedId })
                          )
                        }
                      >
                        <IconCamera size={14} />
                        {block.assetId ? 'Change Photo' : 'Select Photo'}
                      </button>
                    )}

                    <div className="essay-pill-selector">
                      <button
                        type="button"
                        className={`essay-pill-btn ${block.layout === 'contained' ? 'active' : ''}`}
                        onClick={() => handleUpdateBlock(idx, { ...block, layout: 'contained' })}
                      >
                        Contained (68ch)
                      </button>
                      <button
                        type="button"
                        className={`essay-pill-btn ${block.layout === 'wide' ? 'active' : ''}`}
                        onClick={() => handleUpdateBlock(idx, { ...block, layout: 'wide' })}
                      >
                        Wide (1100px)
                      </button>
                      <button
                        type="button"
                        className={`essay-pill-btn ${block.layout === 'fullbleed' ? 'active' : ''}`}
                        onClick={() => handleUpdateBlock(idx, { ...block, layout: 'fullbleed' })}
                      >
                        Fullbleed (100vw)
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={block.assetId}
                    onChange={(e) => handleUpdateBlock(idx, { ...block, assetId: e.target.value })}
                    placeholder="Immich Asset UUID..."
                    style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}
                  />
                </div>
              </div>

              <input
                type="text"
                value={block.caption || ''}
                onChange={(e) =>
                  handleUpdateBlock(idx, { ...block, caption: e.target.value || undefined })
                }
                placeholder="Photo caption (optional)"
              />
            </div>
          )}

          {/* 5. PHOTO-PAIR BLOCK */}
          {block.type === 'photo-pair' && (
            <div className="essay-photo-card">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Photo 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-text-secondary)' }}>
                    Photo 1
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
                      <div className="essay-photo-empty" style={{ width: '80px', height: '60px' }}>
                        <IconCamera size={16} />
                      </div>
                    )}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {onSelectPhoto && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-xs"
                          onClick={() =>
                            onSelectPhoto((pickedId) =>
                              handleUpdateBlock(idx, {
                                ...block,
                                assetIds: [pickedId, block.assetIds[1]],
                              })
                            )
                          }
                        >
                          <IconCamera size={12} /> Select Photo 1
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
                        placeholder="UUID 1..."
                        style={{ fontSize: '0.75rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Photo 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-text-secondary)' }}>
                      Photo 2
                    </span>
                    <button
                      type="button"
                      className="admin-btn-icon"
                      title="Swap Photo 1 & Photo 2"
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
                      <div className="essay-photo-empty" style={{ width: '80px', height: '60px' }}>
                        <IconCamera size={16} />
                      </div>
                    )}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {onSelectPhoto && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-xs"
                          onClick={() =>
                            onSelectPhoto((pickedId) =>
                              handleUpdateBlock(idx, {
                                ...block,
                                assetIds: [block.assetIds[0], pickedId],
                              })
                            )
                          }
                        >
                          <IconCamera size={12} /> Select Photo 2
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
                        placeholder="UUID 2..."
                        style={{ fontSize: '0.75rem' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <input
                type="text"
                value={block.caption || ''}
                onChange={(e) =>
                  handleUpdateBlock(idx, { ...block, caption: e.target.value || undefined })
                }
                placeholder="Side-by-side caption (optional)"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
