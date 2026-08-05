'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  parseEssayMarkdown,
  serializeEssayMarkdown,
  type ParsedEssay,
  type EssayBlock,
} from '@/lib/essay';
import * as Icons from './Icons';

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
        newBlock = { type: 'quote', text: 'Enter quote text here...', author: 'Author' };
        break;
      case 'photo':
        newBlock = {
          type: 'photo',
          assetId: 'sample-asset',
          caption: 'Photo caption',
          layout: 'contained',
        };
        break;
      case 'photo-pair':
        newBlock = {
          type: 'photo-pair',
          assetIds: ['asset-1', 'asset-2'],
          caption: 'Side by side caption',
        };
        break;
    }

    updateBlocks([...essay.blocks, newBlock]);
  };

  return (
    <div className="essay-block-editor" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div
        className="essay-block-toolbar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          background: 'var(--admin-card-bg, rgba(255,255,255,0.04))',
          borderRadius: '8px',
          border: '1px solid var(--admin-border, rgba(255,255,255,0.1))',
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 600, marginRight: 'auto' }}>
          ✨ Add Story Block:
        </span>
        <button
          type="button"
          className="admin-btn admin-btn-xs"
          onClick={() => handleAddBlock('paragraph')}
        >
          + Paragraph
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs"
          onClick={() => handleAddBlock('heading')}
        >
          + Heading
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs"
          onClick={() => handleAddBlock('quote')}
        >
          + Pullquote
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs admin-btn-primary"
          onClick={() => handleAddBlock('photo')}
        >
          + Photo
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-xs admin-btn-primary"
          onClick={() => handleAddBlock('photo-pair')}
        >
          + 2-Photo Pair
        </button>
      </div>

      {essay.blocks.length === 0 && (
        <p className="empty-hint" style={{ textAlign: 'center', padding: '2rem' }}>
          No story blocks yet. Use the buttons above to build your photo essay!
        </p>
      )}

      {essay.blocks.map((block, idx) => (
        <div
          key={idx}
          className="essay-block-item"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '14px',
            background: 'var(--admin-card-bg, rgba(255,255,255,0.03))',
            borderRadius: '8px',
            border: '1px solid var(--admin-border, rgba(255,255,255,0.08))',
            position: 'relative',
          }}
        >
          {/* Block Header / Action Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                opacity: 0.7,
              }}
            >
              Block {idx + 1}: {block.type}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="admin-btn-icon"
                onClick={() => handleMoveBlock(idx, 'up')}
                disabled={idx === 0}
                title="Move Up"
                style={{ padding: '2px 6px' }}
              >
                ▲
              </button>
              <button
                type="button"
                className="admin-btn-icon"
                onClick={() => handleMoveBlock(idx, 'down')}
                disabled={idx === essay.blocks.length - 1}
                title="Move Down"
                style={{ padding: '2px 6px' }}
              >
                ▼
              </button>
              <button
                type="button"
                className="admin-btn-icon text-danger"
                onClick={() => handleDeleteBlock(idx)}
                title="Delete Block"
                style={{ padding: '2px 6px', color: '#ff4d4f' }}
              >
                <Icons.IconTrash size={14} />
              </button>
            </div>
          </div>

          {/* Render Block Form Controls */}
          {block.type === 'heading' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={block.level}
                onChange={(e) =>
                  handleUpdateBlock(idx, { ...block, level: Number(e.target.value) })
                }
                style={{ width: '80px', padding: '6px', borderRadius: '4px' }}
              >
                <option value={1}>H1</option>
                <option value={2}>H2</option>
                <option value={3}>H3</option>
              </select>
              <input
                type="text"
                value={block.text}
                onChange={(e) => handleUpdateBlock(idx, { ...block, text: e.target.value })}
                placeholder="Section title..."
                style={{ flex: 1, padding: '6px 10px', borderRadius: '4px' }}
              />
            </div>
          )}

          {block.type === 'paragraph' && (
            <textarea
              rows={3}
              value={block.html.replace(/<[^>]+>/g, (t) =>
                t.startsWith('<strong>') ? '**' : t.startsWith('</strong>') ? '**' : ''
              )}
              onChange={(e) => handleUpdateBlock(idx, { ...block, html: e.target.value })}
              placeholder="Write text paragraph... (**bold**, *italic* allowed)"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', resize: 'vertical' }}
            />
          )}

          {block.type === 'quote' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="text"
                value={block.text}
                onChange={(e) => handleUpdateBlock(idx, { ...block, text: e.target.value })}
                placeholder="Quote text..."
                style={{ padding: '6px 10px', borderRadius: '4px' }}
              />
              <input
                type="text"
                value={block.author || ''}
                onChange={(e) =>
                  handleUpdateBlock(idx, { ...block, author: e.target.value || undefined })
                }
                placeholder="Author / Attribution (optional)"
                style={{ padding: '6px 10px', borderRadius: '4px', fontSize: '0.85rem' }}
              />
            </div>
          )}

          {block.type === 'photo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    background: '#222',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={`/api/admin/thumbnail/${block.assetId}`}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      value={block.assetId}
                      onChange={(e) => handleUpdateBlock(idx, { ...block, assetId: e.target.value })}
                      placeholder="Immich Asset ID or Index"
                      style={{ flex: 1, padding: '6px 10px', borderRadius: '4px' }}
                    />
                    {onSelectPhoto && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-xs"
                        onClick={() =>
                          onSelectPhoto((pickedId) =>
                            handleUpdateBlock(idx, { ...block, assetId: pickedId })
                          )
                        }
                      >
                        Pick Photo
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Display Width:</span>
                    <select
                      value={block.layout}
                      onChange={(e) =>
                        handleUpdateBlock(idx, {
                          ...block,
                          layout: e.target.value as 'contained' | 'wide' | 'fullbleed',
                        })
                      }
                      style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}
                    >
                      <option value="contained">Contained (68ch)</option>
                      <option value="wide">Wide (1100px)</option>
                      <option value="fullbleed">Fullbleed (100vw)</option>
                    </select>
                  </div>
                </div>
              </div>

              <input
                type="text"
                value={block.caption || ''}
                onChange={(e) =>
                  handleUpdateBlock(idx, { ...block, caption: e.target.value || undefined })
                }
                placeholder="Photo caption (optional)"
                style={{ padding: '6px 10px', borderRadius: '4px', fontSize: '0.85rem' }}
              />
            </div>
          )}

          {block.type === 'photo-pair' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={block.assetIds[0]}
                    onChange={(e) =>
                      handleUpdateBlock(idx, {
                        ...block,
                        assetIds: [e.target.value, block.assetIds[1]],
                      })
                    }
                    placeholder="Photo 1 ID"
                    style={{ flex: 1, padding: '6px' }}
                  />
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
                      Pick
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={block.assetIds[1]}
                    onChange={(e) =>
                      handleUpdateBlock(idx, {
                        ...block,
                        assetIds: [block.assetIds[0], e.target.value],
                      })
                    }
                    placeholder="Photo 2 ID"
                    style={{ flex: 1, padding: '6px' }}
                  />
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
                      Pick
                    </button>
                  )}
                </div>
              </div>

              <input
                type="text"
                value={block.caption || ''}
                onChange={(e) =>
                  handleUpdateBlock(idx, { ...block, caption: e.target.value || undefined })
                }
                placeholder="Side-by-side caption (optional)"
                style={{ padding: '6px 10px', borderRadius: '4px', fontSize: '0.85rem' }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
