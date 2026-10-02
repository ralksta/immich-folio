// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import GeneralSection from '../settings/GeneralSection';
import ZoomOverrideField from '../fields/ZoomOverrideField';

/**
 * The admin switches for the lightbox zoom (#467): one site-wide toggle in
 * Settings › General, and an inherit / on / off choice per page and album.
 * The YAML they produce is covered by the page builder round-trip tests.
 */

afterEach(cleanup);

describe('Settings › General › Photo zoom', () => {
  const renderWith = (settings: Record<string, unknown>) => {
    const update = vi.fn();
    render(<GeneralSection settings={settings} update={update} updateMany={vi.fn()} />);
    return { update, row: screen.getByRole('button', { name: /Photo zoom/ }) };
  };

  it('is shown off when settings.yaml says nothing, and switches it on', () => {
    const { update, row } = renderWith({});
    expect(row.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(row);
    expect(update).toHaveBeenCalledWith('zoom', true);
  });

  it('switches it off again', () => {
    const { update, row } = renderWith({ zoom: true });
    expect(row.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(row);
    expect(update).toHaveBeenCalledWith('zoom', false);
  });
});

describe('ZoomOverrideField', () => {
  const renderField = (value: boolean | undefined) => {
    const onChange = vi.fn();
    render(
      <ZoomOverrideField
        id="z"
        value={value}
        onChange={onChange}
        inheritLabel="Inherit"
        hint="hint"
      />,
    );
    return { onChange, select: screen.getByLabelText('Photo zoom') as HTMLSelectElement };
  };

  it('shows the three states', () => {
    expect(renderField(undefined).select.value).toBe('');
    cleanup();
    expect(renderField(true).select.value).toBe('on');
    cleanup();
    expect(renderField(false).select.value).toBe('off');
  });

  it('reports true, false, and undefined for inherit', () => {
    const { onChange, select } = renderField(undefined);
    fireEvent.change(select, { target: { value: 'on' } });
    fireEvent.change(select, { target: { value: 'off' } });
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange.mock.calls).toEqual([[true], [false], [undefined]]);
  });
});
