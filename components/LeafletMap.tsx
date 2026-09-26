'use client';

/**
 * LeafletMap — the Leaflet core shared by the /map page and journal map
 * blocks: tiles, markers from props, an optional line through them, fit to
 * bounds. It knows nothing about /api/map; MapView fetches and hands over.
 *
 * The Leaflet stylesheet is emitted here rather than by each page, so a map
 * anywhere brings its own CSS. Marker and popup styling lives in
 * app/leaflet.css, loaded globally.
 */

import { useEffect, useRef } from 'react';

export interface LeafletMarker {
  lat: number;
  lng: number;
  /** Inner HTML of the marker icon — already escaped by the caller. */
  html: string;
  popupHtml?: string;
}

interface LeafletMapProps {
  markers: LeafletMarker[];
  /** Draw a dashed line through the markers in the order given. */
  line?: boolean;
  className?: string;
  /** Cap the zoom fitBounds may pick — a single pin otherwise zooms to the rooftop. */
  fitMaxZoom?: number;
  onReady?: () => void;
  onError?: (err: unknown) => void;
}

/** Escapes special HTML characters for Leaflet's string-based popups and icons. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const LEAFLET_CSS_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_CSS_INTEGRITY = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';

export function LeafletMap({
  markers,
  line = false,
  className = 'map-container',
  fitMaxZoom,
  onReady,
  onError,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Callers rebuild the markers array on every render; the map is only
  // rebuilt when its content changes.
  const markersKey = JSON.stringify(markers);
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
      mapRef.current = map;

      // OpenStreetMap's own tiles: free to use with attribution and a Referer,
      // which the Referrer-Policy sends. CARTO's Dark Matter, used before,
      // started answering every tile with "API KEY REQUIRED". The dark look
      // comes from a filter in app/leaflet.css, so it follows the colour mode.
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const current = markersRef.current;
      if (current.length === 0) {
        // Nothing to place — world view
        map.setView([20, 0], 2);
      } else {
        const group = L.featureGroup(
          current.map((m) => {
            const marker = L.marker([m.lat, m.lng], {
              icon: L.divIcon({
                className: '',
                html: m.html,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -20],
              }),
            });
            if (m.popupHtml) marker.bindPopup(m.popupHtml, { maxWidth: 260, minWidth: 200 });
            return marker;
          }),
        ).addTo(map);

        if (line && current.length > 1) {
          const accent =
            getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() ||
            '#e60012';
          L.polyline(
            current.map((m) => [m.lat, m.lng] as [number, number]),
            { color: accent, weight: 2, opacity: 0.75, dashArray: '4 6' },
          ).addTo(map);
        }

        map.fitBounds(group.getBounds().pad(0.15), fitMaxZoom ? { maxZoom: fitMaxZoom } : {});
      }

      // Force Leaflet to recalculate the tile grid once laid out
      setTimeout(() => map.invalidateSize(), 100);
      onReadyRef.current?.();
    }

    init().catch((err) => {
      console.error('[Map] Init error:', err);
      if (!cancelled) onErrorRef.current?.(err);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [markersKey, line, fitMaxZoom]);

  return (
    <>
      <link
        rel="stylesheet"
        href={LEAFLET_CSS_HREF}
        integrity={LEAFLET_CSS_INTEGRITY}
        crossOrigin=""
      />
      <div ref={containerRef} className={className} />
    </>
  );
}
