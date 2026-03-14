'use client';

/**
 * MapView — client component that initializes Leaflet, fetches /api/map,
 * and renders location-level markers with themed popups.
 */

import { useEffect, useRef, useState } from 'react';

/** Escapes special HTML characters to prevent XSS in Leaflet popup templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Dynamically import Leaflet (client-only)
      const L = (await import('leaflet')).default;

      if (cancelled || !containerRef.current || mapRef.current) return;

      // Fetch map data
      const res = await fetch('/api/map');
      if (!res.ok) {
        let detail = '';
        try {
          detail = await res.text();
        } catch {
          /* ignore */
        }
        console.error('[Map] API error', res.status, detail);
        setError(`Failed to load map data (${res.status})`);
        setLoading(false);
        return;
      }
      const locations: MapLocationPublic[] = await res.json();

      if (cancelled) return;

      // Initialize map
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      // Dark-themed tiles (CartoDB Dark Matter)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      if (locations.length === 0) {
        // No geotagged photos — show world view
        map.setView([20, 0], 2);
        setLoading(false);
        return;
      }

      // Create markers with custom HTML icons
      const markers: L.Marker[] = [];

      for (const loc of locations) {
        const icon = L.divIcon({
          className: '',
          html: `<div class="map-marker">${loc.photoCount}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -20],
        });

        const albumLinks = loc.albums
          .map(
            (a) =>
              `<a href="${escapeHtml(a.url)}" class="map-popup__album-link">${escapeHtml(a.name)} →</a>`,
          )
          .join('');

        const popupHtml = `
          <div class="map-popup">
            <img src="${escapeHtml(loc.coverUrl)}" alt="${escapeHtml(loc.city)}" class="map-popup__cover" loading="lazy" />
            <div class="map-popup__body">
              <h3 class="map-popup__city">${escapeHtml(loc.city)}</h3>
              <p class="map-popup__country">${escapeHtml(loc.country)}</p>
              <p class="map-popup__count">${loc.photoCount} photo${loc.photoCount === 1 ? '' : 's'}</p>
              <div class="map-popup__albums">${albumLinks}</div>
            </div>
          </div>
        `;

        const marker = L.marker([loc.lat, loc.lng], { icon })
          .addTo(map)
          .bindPopup(popupHtml, { maxWidth: 260, minWidth: 200 });

        markers.push(marker);
      }

      // Fit bounds to show all markers
      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.15));
      }

      // Force Leaflet to recalculate tile grid
      setTimeout(() => map.invalidateSize(), 100);

      setLoading(false);
    }

    init().catch((err) => {
      console.error('[Map] Init error:', err);
      if (!cancelled) {
        setError('Failed to initialize map');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as L.Map).remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (error) {
    return (
      <div className="map-container__loading">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {loading && (
        <div
          className="map-container__loading"
          style={{ position: 'absolute', inset: 0, zIndex: 1000 }}
        >
          <p>Loading map…</p>
        </div>
      )}
      <div ref={containerRef} className="map-container" />
    </div>
  );
}
