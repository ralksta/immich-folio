// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import SaveBar from '../components/SaveBar';

/**
 * The first component test in the project, and deliberately a small one: it is
 * here to show the shape (`// @vitest-environment jsdom` on the first line,
 * render, assert, cleanup) as much as to cover SaveBar.
 *
 * SaveBar earns it though. It decides whether an outcome reads as success or
 * failure by testing whether the message happens to start with "Error" — #600
 * replaces that with a typed state, and this pins the behaviour so the swap can
 * be verified rather than eyeballed.
 */

afterEach(cleanup);

const props = {
  dirty: false,
  saving: false,
  saveMessage: '',
  onSave: () => {},
  label: 'Save',
};

describe('SaveBar', () => {
  it('stays out of the way when there is nothing to act on', () => {
    const { container } = render(<SaveBar {...props} />);

    // It is pinned over the page, so rendering it with nothing to say would
    // cover content for no reason.
    expect(container.firstChild).toBeNull();
  });

  it('announces unsaved changes', () => {
    render(<SaveBar {...props} dirty />);

    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('only offers saving when there is something to save', () => {
    const { rerender } = render(<SaveBar {...props} saveMessage="Saved!" />);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);

    rerender(<SaveBar {...props} dirty />);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
  });

  it('blocks a second save while one is in flight', () => {
    render(<SaveBar {...props} dirty saving />);

    const button = screen.getByRole('button', { name: 'Saving...' });
    expect(button).toHaveProperty('disabled', true);
  });

  it('calls onSave when clicked', () => {
    const onSave = vi.fn();
    render(<SaveBar {...props} dirty onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledOnce();
  });

  it('tells a failure from a success by the message prefix', () => {
    // Pinned as it is, not as it should be: the prefix check is the thing #600
    // replaces. A message that fails without starting with "Error" is styled as
    // a success today, which is precisely the argument for a typed state.
    const { rerender } = render(<SaveBar {...props} saveMessage="Error: Failed to save" />);
    expect(screen.getByText('Error: Failed to save').className).toContain('error');

    rerender(<SaveBar {...props} saveMessage="Saved!" />);
    expect(screen.getByText('Saved!').className).toContain('success');

    rerender(<SaveBar {...props} saveMessage="Could not reach the server" />);
    expect(screen.getByText('Could not reach the server').className).toContain('success');
  });

  it('offers the preview link only where it belongs', () => {
    const { rerender } = render(<SaveBar {...props} dirty />);
    expect(screen.queryByRole('link')).toBeNull();

    rerender(<SaveBar {...props} dirty showPreview />);
    // `?fresh=1` is what bypasses the cache, so the preview shows the save.
    expect(screen.getByRole('link')).toHaveProperty('href', expect.stringContaining('/?fresh=1'));
  });
});
