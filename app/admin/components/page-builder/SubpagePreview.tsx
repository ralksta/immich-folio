'use client';

import { useEffect, useRef, useState } from 'react';
import { buildCoverGridVars } from '@/lib/config/schema';
import { dictionaryFor } from '@/lib/i18n';
import type { AlbumEntry, ImmichAlbumInfo, Subpage } from './types';

interface SubpagePreviewProps {
  sp: Subpage;
  immichAlbums: ImmichAlbumInfo[];
  /** 1-based position among the enabled subpages, for the header kicker. */
  index?: number;
}

/**
 * The width the page is laid out at before it is scaled into the drawer —
 * a desktop viewport, which is also what the stylesheet's media queries see.
 */
const CANVAS_WIDTH = 1280;

/** Mirrors the fallback in lib/config/index.ts when settings.yaml sets none. */
const DEFAULT_GRID_COLUMNS = 3;

const pad2 = (n: number) => String(n).padStart(2, '0');

interface PreviewAlbum {
  key: string;
  name: string;
  assetCount: number;
  thumb: string | null;
  coverPosition?: string;
}

/**
 * The drawer's read-only "Live Preview" tab.
 *
 * It used to draw its own hero banner and tiles in admin styling, which knew
 * nothing of the preset, the cover grid or the caption bar — the preview showed
 * a page the site never rendered. It now emits the same markup and classes as
 * `SubpageGridView`, so the preset CSS (keyed on `[data-preset]`, which the
 * admin's <html> carries as well) styles it exactly like the public page. The
 * cover grid is sized by the same `buildCoverGridVars()` from the same inputs.
 *
 * The page is laid out at CANVAS_WIDTH and scaled down with `zoom` rather than
 * squeezed into the drawer, so a three-column grid still looks like one.
 */
export default function SubpagePreview({ sp, immichAlbums, index }: SubpagePreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.4);
  const [site, setSite] = useState<{ columns: number; lang?: string }>({
    columns: DEFAULT_GRID_COLUMNS,
  });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      setZoom(entry.contentRect.width / CANVAS_WIDTH);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Fetched on every open rather than cached: the global column count and the
  // language may have been changed in Settings since the page builder loaded.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.settings) return;
        setSite({
          columns: data.settings.grid?.columns ?? DEFAULT_GRID_COLUMNS,
          lang: data.settings.lang,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const t = dictionaryFor(site.lang);
  // Only the two keys the cover grid reads; see buildCoverGridVars().
  const gridStyle = buildCoverGridVars(
    { columns: sp.coverGrid?.columns, gap: sp.coverGrid?.gap },
    site.columns,
  ) as React.CSSProperties;

  const toPreviewAlbum = (alb: AlbumEntry, i: number): PreviewAlbum => {
    const immichAlb = immichAlbums.find((a) => a.id === alb.id);
    return {
      key: `${alb.id}-${i}`,
      name: alb.title || immichAlb?.albumName || alb.id,
      assetCount: immichAlb?.assetCount ?? 0,
      thumb: alb.heroImage || immichAlb?.thumbnailAssetId || null,
      coverPosition: alb.coverPosition,
    };
  };

  const sections = sp.sections ?? [];
  const allAlbums = (sections.length > 0 ? sections.flatMap((sec) => sec.albums) : sp.albums).map(
    toPreviewAlbum,
  );
  const totalPhotos = allAlbums.reduce((sum, a) => sum + a.assetCount, 0);
  const title = sp.title || sp.name;

  const grid = (albums: PreviewAlbum[]) => (
    <div className="subpage-grid" style={gridStyle}>
      {albums.map((album, i) => (
        <div key={album.key} className="subpage-grid__item">
          <span className="subpage-grid__item-media">
            {album.thumb ? (
              // A plain <img> styled like next/image's `fill`: the admin
              // thumbnail route takes a raw asset ID, which the image loader
              // does not.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/admin/thumbnail/${album.thumb}`}
                alt=""
                style={{
                  position: 'absolute',
                  inset: 0,
                  ...(album.coverPosition ? { objectPosition: album.coverPosition } : {}),
                }}
              />
            ) : (
              <span
                className="skeleton"
                style={{ display: 'block', width: '100%', height: '100%' }}
              />
            )}
            <span className="subpage-grid__item-badge">{t.common.photos(album.assetCount)}</span>
            <span className="subpage-grid__item-overlay">
              <span className="subpage-grid__item-title">{album.name}</span>
              <span className="subpage-grid__item-count">{t.common.photos(album.assetCount)}</span>
            </span>
          </span>
          <span className="subpage-grid__item-caption">
            <span className="subpage-grid__item-index">{pad2(i + 1)}</span>
            <span className="subpage-grid__item-caption-title">{album.name}</span>
            <span className="subpage-grid__item-caption-count">
              {t.common.photos(album.assetCount)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="subpage-preview">
      <p className="subpage-preview__note">
        Rendered with the site&rsquo;s saved theme preset at desktop width. Unsaved edits in this
        drawer show up here; theme changes show up once saved in Settings.
      </p>
      <div className="subpage-preview__frame" ref={frameRef}>
        {/* inert: a picture of the page, not a second copy of its links. */}
        <div
          className="subpage-preview__canvas"
          style={{ width: CANVAS_WIDTH, zoom }}
          inert
          aria-hidden="true"
        >
          <div className="main">
            <div className="subpage-container">
              <header className="subpage-header">
                <div className="subpage-header__main">
                  {index !== undefined && (
                    <p className="subpage-header__kicker">
                      {t.subpage.collectionKicker(pad2(index))}
                    </p>
                  )}
                  {title && <h1 className="subpage-title">{title}</h1>}
                  {sp.subtitle && <p className="subpage-subtitle">{sp.subtitle}</p>}
                </div>
                <p className="subpage-header__meta">
                  {t.common.albums(allAlbums.length)} · {t.common.photos(totalPhotos)}
                </p>
              </header>

              {sections.length > 0 && (
                <nav className="subpage-toc">
                  {sections.map((sec, i) => (
                    <span key={i} className="subpage-toc__entry">
                      <span className="subpage-toc__link">
                        <span className="subpage-toc__num">{pad2(i + 1)}</span>
                        <span className="subpage-toc__label">{sec.title}</span>
                      </span>
                    </span>
                  ))}
                </nav>
              )}

              {sections.length > 0
                ? sections.map((sec, i) => (
                    <section key={i} className="subpage-section">
                      <header className="subpage-section__header">
                        <h2 className="subpage-section__title">{sec.title}</h2>
                        {sec.description && (
                          <p className="subpage-section__desc">{sec.description}</p>
                        )}
                        <div className="subpage-section__rule" />
                      </header>
                      {grid(sec.albums.map(toPreviewAlbum))}
                    </section>
                  ))
                : grid(allAlbums)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
