'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ParsedJournal } from '@/lib/journal';
import { collectAssetIds } from '@/lib/journal';
import { expandAlbumBlocks, type AlbumAssetRef } from '@/lib/journalAlbum';
import { EssayView } from '@/app/[...path]/EssayView';
import type { PhotoItem } from '@/app/[...path]/PhotoGrid';
import { IconEye } from '../Icons';

interface JournalPreviewProps {
  parsed: ParsedJournal;
  /** Assets of the albums referenced by album blocks, as loaded so far. */
  albumAssets: Record<string, AlbumAssetRef[]>;
}

/**
 * The editor's live preview: the entry rendered through the public
 * `EssayView`, with a desktop/mobile frame (#555). Album blocks are expanded
 * the way the page expands them, and photo proportions are measured from the
 * admin thumbnails.
 */
export function JournalPreview({ parsed, albumAssets }: JournalPreviewProps) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');

  /** Real width/height ratios of the referenced photos, measured from thumbnails. */
  const [assetRatios, setAssetRatios] = useState<Record<string, number>>({});

  const previewBlocks = useMemo(
    () => expandAlbumBlocks(parsed.blocks, (id) => albumAssets[id]).blocks,
    [parsed.blocks, albumAssets],
  );
  const previewIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...(parsed.frontmatter.coverAssetId ? [parsed.frontmatter.coverAssetId] : []),
          ...collectAssetIds(previewBlocks),
        ]),
      ),
    [previewBlocks, parsed.frontmatter.coverAssetId],
  );

  /*
   * The preview used to hard-code 3:2 for every photo, so the studio showed a
   * cropped, uniform grid while the published page laid the photos out by their
   * real proportions. There is no admin endpoint that reports asset dimensions,
   * so the thumbnails are measured once as they load.
   */
  const measuredRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    for (const id of previewIds) {
      if (!id || measuredRef.current.has(id)) continue;
      measuredRef.current.add(id);

      const probe = new window.Image();
      probe.onload = () => {
        if (cancelled || !probe.naturalHeight) return;
        setAssetRatios((prev) => ({
          ...prev,
          [id]: probe.naturalWidth / probe.naturalHeight,
        }));
      };
      probe.onerror = () => {
        // Unresolvable reference — keep the fallback ratio, the block editor
        // already flags it.
        measuredRef.current.delete(id);
      };
      probe.src = `/api/admin/thumbnail/${id}`;
    }
    return () => {
      cancelled = true;
    };
  }, [previewIds]);

  // Mock PhotoItems for preview
  const previewAssets: PhotoItem[] = previewIds.map((id) => ({
    id,
    type: 'image',
    thumbUrl: `/api/admin/thumbnail/${id}`,
    previewUrl: `/api/admin/thumbnail/${id}`,
    exifUrl: `/api/exif/${id}`,
    // Falls back to 3:2 only until the real ratio has been measured.
    aspectRatio: assetRatios[id] ?? 1.5,
  }));

  return (
    <div className="journal-editor-pane-right">
      <div className="journal-preview-bar">
        <span className="journal-preview-bar-label">
          <IconEye size={13} /> Realtime Theme Preview
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            className={`admin-btn admin-btn-xs ${viewport === 'desktop' ? 'admin-btn-primary' : ''}`}
            onClick={() => setViewport('desktop')}
          >
            Desktop
          </button>
          <button
            type="button"
            className={`admin-btn admin-btn-xs ${viewport === 'mobile' ? 'admin-btn-primary' : ''}`}
            onClick={() => setViewport('mobile')}
          >
            Mobile
          </button>
        </div>
      </div>

      <div className={`journal-preview-frame ${viewport}`}>
        <EssayView
          essay={{ ...parsed, blocks: previewBlocks }}
          assets={previewAssets}
          title={parsed.frontmatter.title}
          subtitle={parsed.frontmatter.subtitle}
        />
      </div>
    </div>
  );
}
