// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { useAdminFetch } from '../components/useAdminFetch';
import { SESSION_EXPIRED_EVENT } from '../components/sessionExpiry';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const respond = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

/**
 * #609: every admin screen used to hand-roll this, with three error
 * conventions between them, one of them a silent catch. These pin the one
 * convention that replaced them.
 */
describe('useAdminFetch', () => {
  it('loads data and clears loading', async () => {
    vi.stubGlobal('fetch', respond(200, { n: 1 }));
    const { result } = renderHook(() => useAdminFetch<{ n: number }>('/api/admin/x'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ n: 1 });
    expect(result.current.error).toBeNull();
  });

  it('turns an HTTP failure into a message, with the server error when there is one', async () => {
    vi.stubGlobal('fetch', respond(500, { error: 'disk full' }));
    const { result } = renderHook(() => useAdminFetch('/api/admin/x'));
    await waitFor(() => expect(result.current.error).toBe('Could not load (HTTP 500): disk full.'));
    expect(result.current.data).toBeNull();
  });

  it('reports a network failure instead of swallowing it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network');
      }),
    );
    const { result } = renderHook(() => useAdminFetch('/api/admin/x'));
    await waitFor(() => expect(result.current.error).toBe('Could not reach the server.'));
  });

  it('raises the session-expired event on a 401', async () => {
    vi.stubGlobal('fetch', respond(401, {}));
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    const { result } = renderHook(() => useAdminFetch('/api/admin/x'));
    await waitFor(() => expect(result.current.error).toContain('session expired'));
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });

  it('fetches nothing for a null url, and again on reload', async () => {
    const fetchMock = respond(200, { n: 1 });
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(({ url }) => useAdminFetch(url), {
      initialProps: { url: null as string | null },
    });
    expect(result.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    rerender({ url: '/api/admin/x' });
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    act(() => result.current.reload());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('applies a local edit without a round trip', async () => {
    vi.stubGlobal('fetch', respond(200, { items: [1, 2] }));
    const { result } = renderHook(() => useAdminFetch<{ items: number[] }>('/api/admin/x'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    act(() => result.current.mutate((d) => ({ items: d.items.filter((i) => i !== 1) })));
    expect(result.current.data).toEqual({ items: [2] });
  });
});
