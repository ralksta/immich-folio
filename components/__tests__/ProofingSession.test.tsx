// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { ProofingProvider, useProofing, type ProofSessionInit } from '../ProofingContext';

/**
 * Session mode of the proofing context: the selection starts from the server,
 * a burst of hearts becomes one save, and a submitted selection stays put.
 */

function Probe() {
  const p = useProofing()!;
  return (
    <div>
      <span data-testid="count">{p.favorites.size}</span>
      <span data-testid="state">{p.session?.saveState}</span>
      <span data-testid="submitted">{String(p.session?.submitted)}</span>
      <button onClick={() => p.toggleFavorite('t1')}>t1</button>
      <button onClick={() => p.toggleFavorite('t2')}>t2</button>
      <button onClick={() => void p.session?.submit()}>submit</button>
    </div>
  );
}

const TOKEN = 'k'.repeat(32);

function renderSession(overrides: Partial<ProofSessionInit> = {}) {
  return render(
    <ProofingProvider
      albumTokens={['t1', 't2', 't3']}
      albumName="Wedding"
      session={{
        token: TOKEN,
        selected: ['t3'],
        submitted: false,
        download: 'none',
        downloadsRemaining: null,
        ...overrides,
      }}
    >
      <Probe />
    </ProofingProvider>,
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('ProofingProvider session mode', () => {
  it('starts from the server selection, not localStorage', () => {
    localStorage.setItem('folio_fav_wedding', JSON.stringify(['t1', 't2']));
    renderSession();
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('debounces hearts into one save, in album order', async () => {
    renderSession();
    fireEvent.click(screen.getByText('t2'));
    fireEvent.click(screen.getByText('t1'));
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/proof/${TOKEN}/selection`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ assets: ['t1', 't2', 't3'] });
    expect(screen.getByTestId('state').textContent).toBe('saved');
  });

  it('reports a failed save', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
    renderSession();
    fireEvent.click(screen.getByText('t1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByTestId('state').textContent).toBe('error');
  });

  it('saves pending hearts before submitting, then locks', async () => {
    renderSession();
    fireEvent.click(screen.getByText('t1'));
    await act(async () => {
      fireEvent.click(screen.getByText('submit'));
      await vi.advanceTimersByTimeAsync(0);
    });

    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls).toEqual([`/api/proof/${TOKEN}/selection`, `/api/proof/${TOKEN}/submit`]);
    expect(screen.getByTestId('submitted').textContent).toBe('true');

    fireEvent.click(screen.getByText('t2'));
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('ignores hearts on a submitted selection', () => {
    renderSession({ submitted: true });
    fireEvent.click(screen.getByText('t1'));
    expect(screen.getByTestId('count').textContent).toBe('1');
  });
});
