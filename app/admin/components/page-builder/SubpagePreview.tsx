'use client';

import { IconFolder } from '../Icons';
import type { ImmichAlbumInfo, Subpage } from './types';

interface SubpagePreviewProps {
  sp: Subpage;
  immichAlbums: ImmichAlbumInfo[];
}

/** The drawer's read-only "Live Preview" tab: hero banner, sections, covers. */
export default function SubpagePreview({ sp, immichAlbums }: SubpagePreviewProps) {
  return (
    <div className="drawer-live-preview-panel">
      <div className="preview-hero-banner">
        <h2 className="preview-hero-title">{sp.title || sp.name || 'Untitled Page'}</h2>
        {sp.subtitle && <p className="preview-hero-sub">{sp.subtitle}</p>}
      </div>

      {sp.sections && sp.sections.length > 0 ? (
        sp.sections.map((sec, sIdx) => (
          <div key={sIdx} className="preview-section-group">
            <h3 className="preview-section-title">{sec.title || 'Untitled Section'}</h3>
            {sec.description && <p className="preview-section-desc">{sec.description}</p>}
            <div className="preview-albums-grid">
              {sec.albums.map((alb, aIdx) => {
                const immichAlb = immichAlbums.find((a) => a.id === alb.id);
                const thumb = alb.heroImage || immichAlb?.thumbnailAssetId;

                return (
                  <div key={aIdx} className="preview-album-tile">
                    <div className="preview-album-cover">
                      {thumb ? (
                        <img src={`/api/admin/thumbnail/${thumb}`} alt="" />
                      ) : (
                        <div className="subpage-tile-placeholder">
                          <IconFolder />
                        </div>
                      )}
                    </div>
                    <span className="preview-album-title">
                      {alb.title || immichAlb?.albumName || alb.id}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      ) : (
        <div className="preview-albums-grid">
          {sp.albums.map((alb, aIdx) => {
            const immichAlb = immichAlbums.find((a) => a.id === alb.id);
            const thumb = alb.heroImage || immichAlb?.thumbnailAssetId;

            return (
              <div key={aIdx} className="preview-album-tile">
                <div className="preview-album-cover">
                  {thumb ? (
                    <img src={`/api/admin/thumbnail/${thumb}`} alt="" />
                  ) : (
                    <div className="subpage-tile-placeholder">
                      <IconFolder />
                    </div>
                  )}
                </div>
                <span className="preview-album-title">
                  {alb.title || immichAlb?.albumName || alb.id}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
