// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/components/I18nProvider';
import { LeafletMap, localizedLeafletPrefix } from '@/components/LeafletMap';
import { de } from '@/lib/i18n/locales/de';

/**
 * Leaflet ships English control labels: "Zoom in" / "Zoom out" on the zoom
 * buttons (also their aria-label) and "A JavaScript library for interactive
 * maps" on the credit link. On a German site they now come from the
 * dictionary like every other visitor-facing string.
 */

afterEach(() => cleanup());

describe('LeafletMap control labels', () => {
  it('takes the zoom button and credit titles from the dictionary', async () => {
    const { container } = render(
      <I18nProvider locale="de">
        <LeafletMap markers={[]} />
      </I18nProvider>,
    );

    const zoomIn = await waitFor(() => {
      const el = container.querySelector('.leaflet-control-zoom-in');
      if (!el) throw new Error('map not initialised yet');
      return el;
    });
    const zoomOut = container.querySelector('.leaflet-control-zoom-out');

    expect(zoomIn.getAttribute('title')).toBe(de.map.zoomIn);
    expect(zoomIn.getAttribute('aria-label')).toBe(de.map.zoomIn);
    expect(zoomOut?.getAttribute('title')).toBe(de.map.zoomOut);

    const credit = container.querySelector('.leaflet-control-attribution a[href*="leafletjs"]');
    expect(credit?.getAttribute('title')).toBe(de.map.leafletTitle);
    expect(container.innerHTML).not.toContain('Zoom in');
    expect(container.innerHTML).not.toContain('A JavaScript library');
  });
});

describe('localizedLeafletPrefix', () => {
  it('swaps only the title and escapes it', () => {
    const prefix = '<a href="https://leafletjs.com" title="English">Leaflet</a>';
    expect(localizedLeafletPrefix(prefix, 'Karten "&" mehr')).toBe(
      '<a href="https://leafletjs.com" title="Karten &quot;&amp;&quot; mehr">Leaflet</a>',
    );
  });
});

describe('LeafletMap marker names', () => {
  it('names a marker by its label, not by the count it shows', async () => {
    const { container } = render(
      <I18nProvider locale="de">
        <LeafletMap
          markers={[
            {
              lat: 54.16,
              lng: 15.39,
              html: '<div class="map-marker">12</div>',
              label: 'Dźwirzyno, Polen, 12 Fotos',
            },
          ]}
        />
      </I18nProvider>,
    );

    const icon = await waitFor(() => {
      const el = container.querySelector('.leaflet-marker-icon');
      if (!el) throw new Error('marker not placed yet');
      return el;
    });
    expect(icon.getAttribute('aria-label')).toBe('Dźwirzyno, Polen, 12 Fotos');
    expect(icon.getAttribute('title')).toBe('Dźwirzyno, Polen, 12 Fotos');
    expect(icon.getAttribute('role')).toBe('button');
  });
});
