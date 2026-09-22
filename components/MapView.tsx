'use client';

/**
 * MapView — fetches /api/map and renders its location-level markers with
 * themed popups through LeafletMap, which owns the Leaflet setup.
 */

import { useEffect, useMemo, useState } from 'react';
import { useDictionary } from './I18nProvider';
import { LeafletMap, escapeHtml, type LeafletMarker } from './LeafletMap';

interface MapLocationPublic {
  city: string;
  country: string;
  lat: number;
  lng: number;
  photoCount: number;
  coverUrl: string;
  albums: { name: string; url: string }[];
}

export function MapView() {
  const t = useDictionary();
  const [locations, setLocations] = useState<MapLocationPublic[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch('/api/map');
      if (!res.ok) {
        let detail = '';
        try {
          detail = await res.text();
        } catch {
          /* ignore */
        }
        console.error('[Map] API error', res.status, detail);
        if (!cancelled) {
          setError(t.map.loadFailed(res.status));
          setLoading(false);
        }
        return;
      }
      const data: MapLocationPublic[] = await res.json();
      if (!cancelled) setLocations(data);
    }

    load().catch((err) => {
      console.error('[Map] Init error:', err);
      if (!cancelled) {
        setError(t.map.initFailed);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const markers = useMemo<LeafletMarker[]>(
    () =>
      (locations ?? []).map((loc) => {
        const albumLinks = loc.albums
          .map(
            (a) =>
              `<a href="${escapeHtml(a.url)}" class="map-popup__album-link">${escapeHtml(a.name)} →</a>`,
          )
          .join('');

        /*
         * An album set to `location: country` has no city name to show — the
         * API withholds it rather than naming a village inside a 100 km cell
         * (#469). The country then carries the heading on its own.
         */
        const heading = loc.city || loc.country;
        const subheading = loc.city ? loc.country : '';

        return {
          lat: loc.lat,
          lng: loc.lng,
          html: `<div class="map-marker">${loc.photoCount}</div>`,
          popupHtml: `
          <div class="map-popup">
            <img src="${escapeHtml(loc.coverUrl)}" alt="${escapeHtml(heading)}" class="map-popup__cover" loading="lazy" />
            <div class="map-popup__body">
              <h3 class="map-popup__city">${escapeHtml(heading)}</h3>
              ${subheading ? `<p class="map-popup__country">${escapeHtml(subheading)}</p>` : ''}
              <p class="map-popup__count">${escapeHtml(t.common.photos(loc.photoCount))}</p>
              <div class="map-popup__albums">${albumLinks}</div>
            </div>
          </div>
        `,
        };
      }),
    [locations, t],
  );

  if (error) {
    return (
      <div
        className="map-container__loading"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
      >
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {loading && (
        <div
          className="map-container__loading"
          role="alert"
          aria-live="polite"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.5)',
            color: '#fff',
          }}
        >
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }}
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10"></path>
          </svg>
          <p>{t.map.loading}</p>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
      {locations ? (
        <LeafletMap
          markers={markers}
          onReady={() => setLoading(false)}
          onError={() => {
            setError(t.map.initFailed);
            setLoading(false);
          }}
        />
      ) : (
        <div className="map-container" />
      )}
    </div>
  );
}
