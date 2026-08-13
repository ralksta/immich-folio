/**
 * PhotoGrid — client component wrapping the masonry grid and lightbox.
 * Handles image click → lightbox open, keyboard nav, and EXIF fetching.
 *
 * Deep-link support: syncs lightbox index with the URL hash (#photo-N).
 * Sharing a link with a hash opens the lightbox to that photo directly.
 */

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Lightbox, type LightboxWatermark } from '@/components/Lightbox';
import { FadeIn } from '@/components/FadeIn';
import { ProofingProvider, useProofing } from '@/components/ProofingContext';
import { ProofingModal } from '@/components/ProofingModal';

export interface PhotoItem {
  id: string;
  type: 'image' | 'video';
  thumbUrl: string;
  previewUrl: string;
  videoUrl?: string;
  exifUrl: string;
  blurDataURL?: string;
  dominantColor?: string;
  /** Compact EXIF summary for hover overlay */
  camera?: string;
  lens?: string;
  focalLength?: string;
  /** Natural image aspect ratio (width/height) for masonry layout */
  aspectRatio?: number;
}

interface PhotoGridProps {
  assets: PhotoItem[];
  layout?:
    | 'masonry'
    | 'uniform'
    | 'showcase'
    | 'filmstrip'
    | 'editorial-flow'
    | 'essay'
    | 'justified';
  gridStyle?: React.CSSProperties;
  watermark?: LightboxWatermark;
}

/** Parse `#photo-N` from a hash string. Returns index or null. */
function parsePhotoHash(hash: string): number | null {
  const match = hash.match(/^#photo-(\d+)$/);
  if (!match) return null;
  const idx = parseInt(match[1], 10) - 1; // 1-indexed in URL, 0-indexed internally
  return idx >= 0 ? idx : null;
}

/** Build the hash string for a given 0-based index. */
function buildPhotoHash(index: number): string {
  return `#photo-${index + 1}`; // 1-indexed for user-friendliness
}

function PhotoGridInner({ assets, layout = 'masonry', gridStyle, watermark }: PhotoGridProps) {
  const proofing = useProofing();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const displayedAssets = useMemo(() => {
    if (proofing && proofing.isFilterActive) {
      return assets.filter((a) => proofing.isFavorite(a.id));
    }
    return assets;
  }, [assets, proofing]);

  // ── Initial hash check (Client-only to avoid hydration mismatch) ──
  useEffect(() => {
    const idx = parsePhotoHash(window.location.hash);
    if (idx !== null && idx < displayedAssets.length) {
      // state from URL hash on mount only
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLightboxIndex(idx);
    }
  }, [displayedAssets.length]);

  // ── Sync URL hash when lightbox state changes ─────────────────
  useEffect(() => {
    if (lightboxIndex !== null && lightboxIndex < displayedAssets.length) {
      const hash = buildPhotoHash(lightboxIndex);
      if (window.location.hash !== hash) {
        window.history.replaceState(null, '', hash);
      }
    }
  }, [lightboxIndex, displayedAssets.length]);

  // ── Listen for browser back/forward (hash change) ─────────────
  useEffect(() => {
    const handleHashChange = () => {
      const idx = parsePhotoHash(window.location.hash);
      if (idx !== null && idx < displayedAssets.length) {
        setLightboxIndex(idx);
      } else {
        setLightboxIndex(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [displayedAssets.length]);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    window.history.pushState(null, '', buildPhotoHash(index));
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    window.history.pushState(null, '', window.location.pathname + window.location.search);
  }, []);

  const goNext = useCallback(() => {
    setLightboxIndex((prev) => (prev !== null ? (prev + 1) % displayedAssets.length : null));
  }, [displayedAssets.length]);

  const goPrev = useCallback(() => {
    setLightboxIndex((prev) => (prev !== null ? (prev - 1 + displayedAssets.length) % displayedAssets.length : null));
  }, [displayedAssets.length]);

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowRight':
          goNext();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, closeLightbox, goNext, goPrev]);

  const gridItems = useMemo(() => {
    return displayedAssets.map((asset, index) => {
      const isFav = proofing ? proofing.isFavorite(asset.id) : false;

      // Justified rows: the flex sizing must sit on the outermost grid child,
      // which is the FadeIn wrapper — not the .photo-grid__item inside it.
      // Aspect ratio drives both grow factor and basis; ~3:2 fallback for
      // assets without dimensions (e.g. videos) keeps the row math sane.
      const justifiedAr = asset.aspectRatio || 1.5;
      const justifiedStyle: React.CSSProperties | undefined =
        layout === 'justified'
          ? {
              flexGrow: justifiedAr,
              flexBasis: `calc(var(--grid-row-height, 300px) * ${justifiedAr})`,
            }
          : undefined;

      return (
        <FadeIn key={asset.id} delay={index < 12 ? index * 50 : 0} style={justifiedStyle}>
          <div
            className={`photo-grid__item${
              layout === 'showcase' && index === 0 ? ' photo-grid__featured' : ''
            }`}
            onClick={() => openLightbox(index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openLightbox(index);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`View photo ${index + 1}`}
            aria-haspopup="dialog"
            style={{
              ...(asset.dominantColor ? { backgroundColor: asset.dominantColor } : {}),
              ...((layout === 'masonry' || layout === 'showcase') && asset.aspectRatio
                ? { aspectRatio: `${asset.aspectRatio}` }
                : {}),
              position: 'relative',
            }}
          >
            <Image
              src={asset.thumbUrl}
              alt=""
              fill
              sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw"
              loading={index < 6 ? 'eager' : 'lazy'}
              {...(asset.blurDataURL
                ? { placeholder: 'blur' as const, blurDataURL: asset.blurDataURL }
                : {})}
            />

            {proofing && (
              <button
                type="button"
                className="photo-grid__fav-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  proofing.toggleFavorite(asset.id);
                }}
                aria-label={isFav ? 'Remove favorite' : 'Add favorite'}
                title={isFav ? 'Remove favorite' : 'Add favorite'}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
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
                  padding: 0,
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

            {asset.type === 'video' && (
              <div className="photo-grid__item-play" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="12" fillOpacity="0.55" />
                  <polygon points="10,8 10,16 17,12" fill="white" />
                </svg>
              </div>
            )}
            {(asset.camera || asset.lens) && (
              <div className="photo-grid__item-exif" aria-hidden="true">
                {[asset.camera, asset.lens, asset.focalLength].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </FadeIn>
      );
    });
  }, [displayedAssets, layout, openLightbox, proofing]);

  return (
    <>
      <div className={`photo-grid photo-grid--${layout}`} style={gridStyle}>
        {gridItems}
      </div>

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
            background: 'var(--bg-surface, #1e1e1e)',
            color: 'var(--text-primary, #ffffff)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <button
            type="button"
            onClick={() => proofing.setIsFilterActive((prev) => !prev)}
            style={{
              background: proofing.isFilterActive ? 'var(--accent, #e60012)' : 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {proofing.isFilterActive ? 'Show All' : `❤️ ${proofing.favorites.size} Selected`}
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
            Share & Export
          </button>
        </div>
      )}

      <ProofingModal />

      {lightboxIndex !== null && (
        <Lightbox
          assets={displayedAssets}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNext={goNext}
          onPrev={goPrev}
          watermark={watermark}
        />
      )}
    </>
  );
}

export function PhotoGrid(props: PhotoGridProps) {
  const albumTokens = useMemo(() => props.assets.map((a) => a.id), [props.assets]);

  return (
    <ProofingProvider albumTokens={albumTokens}>
      <PhotoGridInner {...props} />
    </ProofingProvider>
  );
}
