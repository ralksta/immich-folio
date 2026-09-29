// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { ProofingProvider, useProofing, type ProofSessionInit } from '../ProofingContext';
import { ProofSessionControls } from '../ProofSessionControls';

/**
 * The review dialog of a client proofing link. The selection ZIP is built from
 * what the server has saved, so it must not be offered while a heart is still
 * waiting out the autosave debounce; and the download counter has to follow
 * the downloads started from this page.
 */

const TOKEN = 'k'.repeat(32);

function Heart() {
  const p = useProofing()!;
  return <button onClick={() => p.toggleFavorite('t1')}>heart t1</button>;
}

function renderControls(overrides: Partial<ProofSessionInit> = {}) {
  return render(
    <ProofingProvider
      albumTokens={['t1', 't2', 't3']}
      albumName="Wedding"
      session={{
        token: TOKEN,
        selected: ['t3'],
        submitted: false,
        download: 'album',
        downloadsRemaining: null,
        ...overrides,
      }}
    >
      <Heart />
      <ProofSessionControls />
    </ProofingProvider>,
  );
}

const selectionLink = () => screen.queryByText('Download selection (.zip)');

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ProofSessionControls', () => {
  it('offers the selection ZIP when nothing is waiting to be saved', () => {
    renderControls();
    fireEvent.click(screen.getByText('Review & submit'));
    expect(selectionLink()).not.toBeNull();
  });

  it('withholds the selection ZIP while a heart waits out the autosave debounce', async () => {
    renderControls();
    // A first save, so the state reads 'saved' rather than 'idle'.
    fireEvent.click(screen.getByText('heart t1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Another heart, and the dialog opened before its save is sent.
    fireEvent.click(screen.getByText('heart t1'));
    fireEvent.click(screen.getByText('Review & submit'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(selectionLink()).toBeNull();

    // Once the save lands the link comes back, now for the saved selection.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(selectionLink()).not.toBeNull();
  });

  it('counts a started download against the limit shown', () => {
    renderControls({ downloadsRemaining: 2 });
    fireEvent.click(screen.getByText('Review & submit'));
    expect(screen.getByText('2 downloads left')).toBeTruthy();

    const link = screen.getByText('Download all photos (.zip)');
    // jsdom does not navigate; keep it from trying.
    link.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(link);
    expect(screen.getByText('1 download left')).toBeTruthy();

    fireEvent.click(screen.getByText('Download all photos (.zip)'));
    expect(screen.queryByText('Download all photos (.zip)')).toBeNull();
    expect(selectionLink()).toBeNull();
  });
});
