// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { renderToReadableStream } from 'react-dom/server';
import type { ReactNode } from 'react';
import { PhotoGrid, type PhotoItem } from '../PhotoGrid';
import { EssayView } from '../EssayView';
import { parseEssayMarkdown } from '@/lib/essay';

/**
 * Proofing is off on most album pages, but its provider, modal and session
 * controls used to be imported statically by the grid and the essay, so every
 * album, essay and journal page shipped them (~5 KB gzip). They now load
 * through `next/dynamic` only where proofing is on.
 *
 * The mocks below pass every module through unchanged and only note that it
 * was loaded: a page without proofing must not load any of them, and a page
 * with proofing must still render the hearts — on the server too, so they are
 * in the HTML before the chunk arrives.
 */

const loaded = vi.hoisted(() => new Set<string>());

vi.mock('@/components/ProofingContext', async (importOriginal) => {
  loaded.add('ProofingContext');
  return importOriginal();
});
vi.mock('@/components/ProofingModal', async (importOriginal) => {
  loaded.add('ProofingModal');
  return importOriginal();
});
vi.mock('@/components/ProofSessionControls', async (importOriginal) => {
  loaded.add('ProofSessionControls');
  return importOriginal();
});

// The build aliases `next/dynamic` to the App Router implementation in app/;
// the bare package resolves to the Pages Router one.
vi.mock('next/dynamic', async () => ({
  default: (await import('next/dist/shared/lib/app-dynamic')).default,
}));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}));
vi.mock('@/components/LeafletMap', () => ({
  LeafletMap: () => null,
  escapeHtml: (s: string) => s,
}));
vi.mock('@/components/FadeIn', () => ({
  FadeIn: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const photo = (id: string): PhotoItem => ({
  id,
  type: 'image',
  thumbUrl: `/t/${id}`,
  previewUrl: `/p/${id}`,
  exifUrl: `/e/${id}`,
  aspectRatio: 1.5,
});

const ASSETS = [photo('a1'), photo('a2'), photo('a3')];
const ESSAY = parseEssayMarkdown('---\ntitle: Story\n---\n\n![a1, a3](caption)\n');

async function serverHtml(node: ReactNode): Promise<string> {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}

const hearts = (html: string) => html.match(/aria-label="Add favorite"/g)?.length ?? 0;

beforeEach(() => {
  // Node defines its own global localStorage (undefined without
  // --localstorage-file), which shadows jsdom's; give the test a working one.
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Runs first: the set records loads for the whole file.
describe('proofing off', () => {
  it('loads neither the provider nor the modal nor the session controls', async () => {
    const grid = render(<PhotoGrid assets={ASSETS} albumName="Wedding" />);
    const essay = render(<EssayView essay={ESSAY} assets={ASSETS} title="Story" />);
    expect(grid.container.querySelectorAll('img')).toHaveLength(3);
    expect(essay.container.querySelectorAll('img')).toHaveLength(2);
    expect(screen.queryByLabelText('Add favorite')).toBeNull();

    await serverHtml(<PhotoGrid assets={ASSETS} albumName="Wedding" />);
    expect([...loaded]).toEqual([]);
  });
});

describe('proofing on', () => {
  it('renders the hearts on the server', async () => {
    const html = await serverHtml(<PhotoGrid assets={ASSETS} proofing albumName="Wedding" />);
    expect(hearts(html)).toBe(3);
    const essay = await serverHtml(
      <EssayView essay={ESSAY} assets={ASSETS} title="Story" proofing />,
    );
    expect(hearts(essay)).toBe(2);
  });

  it('shares one context between the grid and the lazily loaded provider and modal', async () => {
    render(<PhotoGrid assets={ASSETS} proofing albumName="Wedding" />);
    const [first] = await screen.findAllByLabelText('Add favorite');
    fireEvent.click(first);
    // The heart, the selection bar and the modal all read the same state.
    expect(screen.getAllByLabelText('Remove favorite')).toHaveLength(1);
    fireEvent.click(await screen.findByText('Share & Export'));
    expect(await screen.findByText(/You have selected 1 photo\./)).toBeTruthy();
    expect(loaded).toContain('ProofingContext');
    expect(loaded).toContain('ProofingModal');
  });
});
