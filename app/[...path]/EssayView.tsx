'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Lightbox, type LightboxWatermark } from '@/components/Lightbox';
import { ProofingProvider, useProofing } from '@/components/ProofingContext';
import { ProofingModal } from '@/components/ProofingModal';
import { FadeIn } from '@/components/FadeIn';
import type { ParsedEssay, EssayBlock } from '@/lib/essay';
import type { PhotoItem } from './PhotoGrid';
import './essay.css';
import { useDictionary } from '@/components/I18nProvider';

interface EssayViewProps {
  essay: ParsedEssay;
  assets: PhotoItem[];
  title?: string;
  subtitle?: string;
  watermark?: LightboxWatermark;
  /**
   * Client proofing — favorite hearts, the selection bar and the send-off modal.
   * Off by default: proofing is a delivery workflow for album handovers, and a
   * published story is not one. Album views opt in.
   */
  proofing?: boolean;
  /** Offer the "send by email" button in the proofing modal. */
  allowMailto?: boolean;
}

function EssayViewContent({
  essay,
  assets,
  title,
  subtitle,
  watermark,
  proofing: proofingEnabled = false,
}: EssayViewProps) {
  const t = useDictionary();
  const proofing = useProofing();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Map assetId / index to PhotoItem and its index in `assets`
  const assetMap = useMemo(() => {
    const map = new Map<string, { item: PhotoItem; index: number }>();
    assets.forEach((item, index) => {
      map.set(item.id, { item, index });
      // Also map by 1-based index string ("1", "2") for convenience
      map.set(`${index + 1}`, { item, index });
    });
    return map;
  }, [assets]);

  const displayTitle = title || essay.frontmatter.title;
  const displaySubtitle = subtitle || essay.frontmatter.subtitle;

  // Cover photo if specified
  const coverAsset = essay.frontmatter.coverAssetId
    ? assetMap.get(essay.frontmatter.coverAssetId)
    : undefined;

  const renderBlock = (block: EssayBlock, idx: number) => {
    switch (block.type) {
      case 'heading': {
        const Tag = `h${Math.min(block.level + 1, 4)}` as keyof React.JSX.IntrinsicElements;
        return (
          <Tag key={idx} className={`essay-heading essay-heading--${block.level}`}>
            {block.text}
          </Tag>
        );
      }

      case 'paragraph':
        return (
          <div key={idx} className="essay-prose" dangerouslySetInnerHTML={{ __html: block.html }} />
        );

      case 'quote':
        return (
          <blockquote key={idx} className="essay-quote">
            <div dangerouslySetInnerHTML={{ __html: block.text }} />
            {block.author && <span className="essay-quote__author">— {block.author}</span>}
          </blockquote>
        );

      case 'photo': {
        const resolved = assetMap.get(block.assetId);
        if (!resolved) return null;
        const { item, index } = resolved;
        const isFav = proofing ? proofing.isFavorite(item.id) : false;

        return (
          <FadeIn key={idx}>
            <figure className={`essay-figure essay-figure--${block.layout}`}>
              <div
                className="essay-image-wrapper photo-grid__item"
                onClick={() => setLightboxIndex(index)}
                style={{
                  ...(item.dominantColor ? { backgroundColor: item.dominantColor } : {}),
                  ...(item.aspectRatio ? { aspectRatio: `${item.aspectRatio}` } : {}),
                }}
              >
                <Image
                  src={item.previewUrl || item.thumbUrl}
                  alt={block.caption || ''}
                  fill
                  sizes={
                    block.layout === 'fullbleed'
                      ? '100vw'
                      : block.layout === 'wide'
                        ? '(max-width: 1100px) 100vw, 1100px'
                        : '(max-width: 768px) 100vw, 680px'
                  }
                  loading={idx < 4 ? 'eager' : 'lazy'}
                  {...(item.blurDataURL
                    ? { placeholder: 'blur' as const, blurDataURL: item.blurDataURL }
                    : {})}
                />

                {proofing && (
                  <button
                    type="button"
                    className="photo-grid__fav-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      proofing.toggleFavorite(item.id);
                    }}
                    aria-label={isFav ? t.proofing.removeFavorite : t.proofing.addFavorite}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      zIndex: 5,
                      width: '44px',
                      height: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: isFav ? '#ff4d4f' : 'rgba(255,255,255,0.85)',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="24"
                      height="24"
                      fill={isFav ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </button>
                )}
              </div>
              {block.caption && (
                <figcaption
                  className="essay-figcaption"
                  dangerouslySetInnerHTML={{ __html: block.caption }}
                />
              )}
            </figure>
          </FadeIn>
        );
      }

      case 'photo-pair': {
        const res1 = assetMap.get(block.assetIds[0]);
        const res2 = assetMap.get(block.assetIds[1]);
        if (!res1 || !res2) return null;

        return (
          <FadeIn key={idx}>
            <div className="essay-figure essay-figure--wide">
              <div className="essay-pair-grid">
                {[res1, res2].map(({ item, index }, pIdx) => {
                  const isFav = proofing ? proofing.isFavorite(item.id) : false;
                  return (
                    <div
                      key={pIdx}
                      className="essay-image-wrapper photo-grid__item"
                      onClick={() => setLightboxIndex(index)}
                      style={{
                        ...(item.dominantColor ? { backgroundColor: item.dominantColor } : {}),
                        // Width proportional to the ratio — see .essay-pair-grid.
                        flexGrow: item.aspectRatio ?? 1.5,
                        aspectRatio: `${item.aspectRatio ?? 1.5}`,
                      }}
                    >
                      <Image
                        src={item.previewUrl || item.thumbUrl}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, 550px"
                        loading="lazy"
                        {...(item.blurDataURL
                          ? { placeholder: 'blur' as const, blurDataURL: item.blurDataURL }
                          : {})}
                      />
                      {proofing && (
                        <button
                          type="button"
                          className="photo-grid__fav-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            proofing.toggleFavorite(item.id);
                          }}
                          aria-label={isFav ? t.proofing.removeFavorite : t.proofing.addFavorite}
                          style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            zIndex: 5,
                            width: '44px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: isFav ? '#ff4d4f' : 'rgba(255,255,255,0.85)',
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="24"
                            height="24"
                            fill={isFav ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {block.caption && (
                <figcaption
                  className="essay-figcaption"
                  dangerouslySetInnerHTML={{ __html: block.caption }}
                />
              )}
            </div>
          </FadeIn>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="essay-container">
      <header className="essay-header">
        {displayTitle && <h1 className="essay-header__title">{displayTitle}</h1>}
        {displaySubtitle && <p className="essay-header__subtitle">{displaySubtitle}</p>}
        {(essay.frontmatter.author || essay.frontmatter.date) && (
          <div className="essay-header__meta">
            {[essay.frontmatter.author, essay.frontmatter.date].filter(Boolean).join(' • ')}
          </div>
        )}
      </header>

      {coverAsset && (
        <figure className="essay-figure essay-figure--wide" style={{ marginBottom: '4rem' }}>
          <div
            className="essay-image-wrapper photo-grid__item"
            onClick={() => setLightboxIndex(coverAsset.index)}
            style={{
              ...(coverAsset.item.dominantColor
                ? { backgroundColor: coverAsset.item.dominantColor }
                : {}),
              ...(coverAsset.item.aspectRatio
                ? { aspectRatio: `${coverAsset.item.aspectRatio}` }
                : {}),
            }}
          >
            <Image
              src={coverAsset.item.previewUrl || coverAsset.item.thumbUrl}
              alt=""
              fill
              priority
              sizes="(max-width: 1100px) 100vw, 1100px"
              {...(coverAsset.item.blurDataURL
                ? { placeholder: 'blur' as const, blurDataURL: coverAsset.item.blurDataURL }
                : {})}
            />
          </div>
        </figure>
      )}

      <main>{essay.blocks.map(renderBlock)}</main>

      {proofing && proofing.favorites.size > 0 && (
        <div
          className="proofing-sticky-bar"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 990,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 16px',
            borderRadius: '30px',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <button
            type="button"
            onClick={() => proofing.setIsFilterActive((prev) => !prev)}
            style={{
              background: proofing.isFilterActive
                ? 'var(--accent, #e60012)'
                : 'var(--bg-card-hover)',
              color: proofing.isFilterActive ? '#fff' : 'var(--text-primary)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {proofing.isFilterActive
              ? t.proofing.showAll
              : t.proofing.selected(proofing.favorites.size)}
          </button>
          <button
            type="button"
            onClick={() => proofing.setIsModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {t.proofing.shareExport}
          </button>
        </div>
      )}

      {proofingEnabled && <ProofingModal />}

      {lightboxIndex !== null && (
        <Lightbox
          assets={assets}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNext={() =>
            setLightboxIndex((prev) => (prev !== null ? (prev + 1) % assets.length : null))
          }
          onPrev={() =>
            setLightboxIndex((prev) =>
              prev !== null ? (prev - 1 + assets.length) % assets.length : null,
            )
          }
          watermark={watermark}
          showExifToggle={false}
        />
      )}
    </div>
  );
}

export function EssayView(props: EssayViewProps) {
  const albumTokens = useMemo(() => props.assets.map((a) => a.id), [props.assets]);

  // Without the provider useProofing() returns null, and every proofing control
  // (hearts in the grid and in the lightbox, selection bar) drops out on its own.
  if (!props.proofing) {
    return <EssayViewContent {...props} />;
  }

  return (
    <ProofingProvider albumTokens={albumTokens} allowMailto={props.allowMailto ?? true}>
      <EssayViewContent {...props} />
    </ProofingProvider>
  );
}
