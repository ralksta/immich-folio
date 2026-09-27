// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useDraft, readDraft } from '../components/useDraft';
import DraftNotice from '../components/DraftNotice';

/**
 * #592: leaving the page builder or the journal editor inside the admin — a tab
 * link, back, Reload, Logout — unmounted it and threw the edits away. The draft
 * is what brings them back, so these tests walk the round trip an operator
 * makes: edit, leave (unmount), come back (a fresh hook), load.
 */

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

type Props = { value: string; dirty: boolean };

function mount(key = 'k', initial: Props = { value: '', dirty: false }) {
  return renderHook(({ value, dirty }: Props) => useDraft(key, value, dirty), {
    initialProps: initial,
  });
}

describe('useDraft', () => {
  it('writes nothing before the server state has loaded', () => {
    // The editor mounts with an empty state; that must not become a draft.
    mount('k', { value: 'empty', dirty: true });
    expect(readDraft('k')).toBeNull();
  });

  it('brings edits back after leaving and returning', () => {
    const first = mount();
    act(() => void first.result.current.load('server-v1'));
    first.rerender({ value: 'my edit', dirty: true });
    first.unmount();

    const second = mount();
    let restored: string | null = null;
    act(() => {
      restored = second.result.current.load('server-v1');
    });
    expect(restored).toBe('my edit');
    expect(second.result.current.status).toBe('restored');
  });

  it('holds a draft back when the server changed since', () => {
    const first = mount();
    act(() => void first.result.current.load('server-v1'));
    first.rerender({ value: 'my edit', dirty: true });
    first.unmount();

    const second = mount();
    let restored: string | null = 'unset';
    act(() => {
      restored = second.result.current.load('server-v2');
    });
    // Applying it silently would overwrite the other save.
    expect(restored).toBeNull();
    expect(second.result.current.status).toBe('conflict');

    let taken: string | null = null;
    act(() => {
      taken = second.result.current.takeConflicting();
    });
    expect(taken).toBe('my edit');
    expect(second.result.current.status).toBe('restored');
  });

  it('keeps a held-back draft while the editor shows the server state', () => {
    const first = mount();
    act(() => void first.result.current.load('server-v1'));
    first.rerender({ value: 'my edit', dirty: true });
    first.unmount();

    // The editor applies the server state after a conflict and is not dirty.
    // That render used to clear the draft "Restore my changes" then reads.
    const second = mount();
    act(() => void second.result.current.load('server-v2'));
    second.rerender({ value: 'server v2', dirty: false });

    let taken: string | null = null;
    act(() => {
      taken = second.result.current.takeConflicting();
    });
    expect(taken).toBe('my edit');
  });

  it('forgets the draft once saved, and bases new edits on the saved state', () => {
    const first = mount();
    act(() => void first.result.current.load('server-v1'));
    first.rerender({ value: 'v2', dirty: true });
    act(() => first.result.current.saved('server-v2'));
    first.rerender({ value: 'v2', dirty: false });
    expect(readDraft('k')).toBeNull();

    // Edits after the save must restore against the saved version, not the
    // one the editor first loaded.
    first.rerender({ value: 'v3 edit', dirty: true });
    first.unmount();
    const second = mount();
    let restored: string | null = null;
    act(() => {
      restored = second.result.current.load('server-v2');
    });
    expect(restored).toBe('v3 edit');
  });

  it('drops the draft when the edits are undone by a discard', () => {
    const first = mount();
    act(() => void first.result.current.load('server-v1'));
    first.rerender({ value: 'my edit', dirty: true });
    act(() => first.result.current.discard());
    first.rerender({ value: 'server-v1', dirty: false });
    expect(readDraft('k')).toBeNull();
    expect(first.result.current.status).toBe('none');
  });

  it('keeps editors apart by key', () => {
    const a = mount('journal-a');
    act(() => void a.result.current.load('a'));
    a.rerender({ value: 'edit in a', dirty: true });

    const b = mount('journal-b');
    let restored: string | null = 'unset';
    act(() => {
      restored = b.result.current.load('a');
    });
    expect(restored).toBeNull();
  });

  it('degrades to no draft when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result, rerender } = mount();
    let restored: string | null = 'unset';
    act(() => {
      restored = result.current.load('server-v1');
    });
    expect(restored).toBeNull();
    expect(() => rerender({ value: 'edit', dirty: true })).not.toThrow();
  });
});

describe('DraftNotice', () => {
  const handlers = () => ({ onDiscard: vi.fn(), onRestore: vi.fn(), onDismiss: vi.fn() });

  it('says nothing without a draft', () => {
    const { container } = render(<DraftNotice status="none" subject="entry" {...handlers()} />);
    expect(container.firstChild).toBeNull();
  });

  it('says a restored draft is still unsaved and offers to discard it', () => {
    const h = handlers();
    render(<DraftNotice status="restored" subject="entry" {...h} />);
    expect(screen.getByText(/were restored\. They are not saved yet/)).toBeTruthy();
    fireEvent.click(screen.getByText('Discard changes'));
    expect(h.onDiscard).toHaveBeenCalled();
  });

  it('asks before restoring over a newer save', () => {
    const h = handlers();
    render(<DraftNotice status="conflict" subject="page structure" {...h} />);
    fireEvent.click(screen.getByText('Restore my changes'));
    expect(h.onRestore).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Discard them'));
    expect(h.onDiscard).toHaveBeenCalled();
  });
});
