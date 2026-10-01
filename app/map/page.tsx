/**
 * Map page — server component shell for the interactive map.
 * Loads Leaflet CSS, renders the MapView client component.
 */

import { getConfig } from '@/lib/config';
import { visibleMapCounts } from '@/lib/mapService';
import { isAuthenticated } from '@/lib/auth';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { MapView } from '@/components/MapView';
import { BackLink } from '@/components/BackLink';
import type { Metadata } from 'next';
import { getServerDictionary } from '@/lib/i18n/server';
// Imported here as well as in LeafletMap: this page has the stylesheet in its
// server HTML, so the tiles never render before their CSS.
import 'leaflet/dist/leaflet.css';
import './map.css';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getServerDictionary().map.title };
}

export default async function MapPage() {
  const config = getConfig();
  const t = getServerDictionary();

  if (!config.map) {
    notFound();
  }

  // Counts what the map may show this viewer: a hidden subpage is reachable
  // by direct link only, and a password-protected subpage or album the
  // viewer has not unlocked is dropped by /api/map — neither is counted.
  const cookieStore = await cookies();
  const { collections: collectionCount, albums: albumCount } = visibleMapCounts(
    config,
    (key, type) => isAuthenticated(key, (name) => cookieStore.get(name)?.value, type),
  );

  return (
    <>
      <div className="map-page">
        <div className="map-page__header">
          <div className="map-page__header-main">
            <BackLink href="/" label={t.common.backToGallery} />
            <p className="map-page__kicker" aria-hidden="true">
              {t.map.kicker}
            </p>
            <h1 className="map-page__title">{t.map.title}</h1>
            <p className="map-page__subtitle">{t.map.subtitle}</p>
          </div>
          <p className="map-page__meta" aria-hidden="true">
            {t.common.collections(collectionCount)} · {t.common.albums(albumCount)}
          </p>
        </div>
        <MapView />
      </div>
    </>
  );
}
