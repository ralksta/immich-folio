// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { parseJournalMarkdown } from '@/lib/journal';
import { escapeHtml } from '@/lib/escapeHtml';

/**
 * Most essays have no map block, yet a static import of LeafletMap put its
 * wrapper and Leaflet's render-blocking stylesheet on every album, subpage and
 * journal page. EssayView now loads it only when a map block renders.
 */

const leafletModuleLoaded = vi.fn();
const mapProps = vi.fn();

vi.mock('@/components/LeafletMap', () => {
  leafletModuleLoaded();
  return {
    LeafletMap: (props: { className?: string; markers: unknown[]; line?: boolean }) => {
      mapProps(props);
      return <div className={props.className} data-testid="leaflet-map" />;
    },
  };
});

beforeAll(() => {
  // FadeIn reveals at once under reduced motion instead of needing IntersectionObserver.
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => cleanup());

describe('EssayView map block', () => {
  it('does not load the map module just by being imported', async () => {
    await import('@/app/[...path]/EssayView');
    expect(leafletModuleLoaded).not.toHaveBeenCalled();
  });

  it('renders the map on demand with the same markers and escaped popups', async () => {
    const { EssayView } = await import('@/app/[...path]/EssayView');
    const essay = parseJournalMarkdown(
      [
        '---',
        'title: "Trip"',
        '---',
        '',
        '::map The route',
        "Berlin's <b>: 52.52, 13.405",
        '48.137, 11.575',
      ].join('\n'),
    );
    const block = essay.blocks.find((b) => b.type === 'map');
    const label =
      block?.type === 'map' && block.items[0].kind === 'point' ? block.items[0].label : '';
    expect(label).toBeTruthy();

    const { container } = render(<EssayView essay={essay} assets={[]} />);

    // Same container the eager version rendered, before and after the load.
    expect(container.querySelector('.essay-map')).not.toBeNull();
    await screen.findByTestId('leaflet-map');
    expect(leafletModuleLoaded).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('.essay-map')).toHaveLength(1);

    const props = mapProps.mock.calls.at(-1)![0];
    expect(props.className).toBe('essay-map');
    expect(props.line).toBe(true);
    expect(props.markers).toHaveLength(2);
    expect(props.markers[0]).toMatchObject({ lat: 52.52, lng: 13.405 });
    expect(props.markers[0].popupHtml).toContain(`>${escapeHtml(label!)}</h3>`);
    expect(props.markers[0].popupHtml).not.toContain('<b>');
    expect(props.markers[1].popupHtml).toBeUndefined();
  });
});
