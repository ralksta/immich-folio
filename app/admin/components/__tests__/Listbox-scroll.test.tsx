// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Listbox } from '../Listbox';

beforeEach(() => {
  vi.stubGlobal('CSS', { escape: (s: string) => s });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

describe('Listbox scroll dismissal', () => {
  it('stays open when scrolling inside its own popup, and closes on ancestor scroll', () => {
    render(
      <div data-testid="outer">
        <Listbox value="a" onChange={() => {}} options={OPTIONS} ariaLabel="Sort" />
      </div>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Sort' });
    fireEvent.click(trigger);

    const popup = screen.getByRole('listbox');
    expect(popup).toBeTruthy();

    // Scrolling inside the popup (or an option inside it) must keep it open.
    fireEvent.scroll(popup);
    expect(screen.queryByRole('listbox')).toBeTruthy();

    // Scrolling an ancestor container outside the popup dismisses it.
    fireEvent.scroll(screen.getByTestId('outer'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
