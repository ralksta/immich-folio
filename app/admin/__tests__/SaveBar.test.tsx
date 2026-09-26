// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import SaveBar, { type SaveStatus } from '../components/SaveBar';

/**
 * The first component test in the project, and deliberately a small one: it is
 * here to show the shape (`// @vitest-environment jsdom` on the first line,
 * render, assert, cleanup) as much as to cover SaveBar.
 *
 * SaveBar earns it though. It used to decide whether an outcome read as
 * success or failure by testing whether the message happened to start with
 * "Error"; #600 replaced that with a typed state, pinned below.
 */

afterEach(cleanup);

const props = {
  dirty: false,
  saving: false,
  status: null as SaveStatus,
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
    const { rerender } = render(
      <SaveBar {...props} status={{ kind: 'success', message: 'Saved!' }} />,
    );
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

  it('styles the outcome by its kind, not by its wording', () => {
    // #600: the bar used to call a message an error when it started with
    // "Error", so this third message was shown as a success.
    const { rerender } = render(
      <SaveBar {...props} status={{ kind: 'error', message: 'Error: Failed to save' }} />,
    );
    expect(screen.getByText('Error: Failed to save').className).toContain('error');

    rerender(<SaveBar {...props} status={{ kind: 'success', message: 'Saved!' }} />);
    expect(screen.getByText('Saved!').className).toContain('success');

    rerender(
      <SaveBar {...props} status={{ kind: 'error', message: 'Could not reach the server' }} />,
    );
    expect(screen.getByText('Could not reach the server').className).toContain('error');
  });

  it('offers the preview link only where it belongs', () => {
    const { rerender } = render(<SaveBar {...props} dirty />);
    expect(screen.queryByRole('link')).toBeNull();

    rerender(<SaveBar {...props} dirty showPreview />);
    // `?fresh=1` is what bypasses the cache, so the preview shows the save.
    expect(screen.getByRole('link')).toHaveProperty('href', expect.stringContaining('/?fresh=1'));
  });
});
