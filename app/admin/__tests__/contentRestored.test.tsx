// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { reportContentRestored, useContentRestored } from '../components/contentRestored';

afterEach(() => cleanup());

describe('useContentRestored', () => {
  it('hands each restore to the mounted editors', () => {
    const handler = vi.fn();
    renderHook(() => useContentRestored(handler));
    act(() => reportContentRestored({ target: 'journal', slug: 'iceland' }));
    expect(handler).toHaveBeenCalledWith({ target: 'journal', slug: 'iceland' });
  });

  it('calls the latest handler, not the one from the first render', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => useContentRestored(fn), {
      initialProps: { fn: first },
    });
    rerender({ fn: second });
    act(() => reportContentRestored({ target: 'gallery' }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('stops listening once the editor unmounts', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useContentRestored(handler));
    unmount();
    act(() => reportContentRestored({ target: 'settings' }));
    expect(handler).not.toHaveBeenCalled();
  });
});
