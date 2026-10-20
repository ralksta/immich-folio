// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import GeneralSection from '../settings/GeneralSection';
import { AdminI18nProvider } from '../AdminI18n';
import { SUPPORTED_LOCALES } from '@/lib/i18n';

/**
 * Settings › General › Admin panel language (#604): the panel's own language,
 * `adminLang` in settings.yaml. Empty follows the site language, so choosing
 * "Same as site language" removes the key (update() deletes on '').
 */

afterEach(cleanup);

const renderWith = (settings: Record<string, unknown>) => {
  const update = vi.fn();
  render(<GeneralSection settings={settings} update={update} updateMany={vi.fn()} />);
  return {
    update,
    select: screen.getByLabelText('Admin panel language') as HTMLSelectElement,
  };
};

describe('Settings › General › Admin panel language', () => {
  it('follows the site language while adminLang is unset', () => {
    const { select } = renderWith({ lang: 'de' });
    expect(select.value).toBe('');
    expect(select.options[0].textContent).toBe('Same as site language');
  });

  it('offers every language the panel has a dictionary for', () => {
    const { select } = renderWith({});
    const values = [...select.options].map((o) => o.value);
    expect(values).toEqual(['', ...SUPPORTED_LOCALES]);
  });

  it('writes adminLang, and clears it with the empty option', () => {
    const { update, select } = renderWith({ adminLang: 'de' });
    expect(select.value).toBe('de');
    fireEvent.change(select, { target: { value: 'fr' } });
    fireEvent.change(select, { target: { value: '' } });
    expect(update.mock.calls).toEqual([
      ['adminLang', 'fr'],
      ['adminLang', ''],
    ]);
  });

  it('leaves the site language select alone', () => {
    const { update } = renderWith({});
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'nl' } });
    expect(update).toHaveBeenCalledWith('lang', 'nl');
    expect(update).not.toHaveBeenCalledWith('adminLang', expect.anything());
  });

  it('renders inside the admin locale provider', () => {
    const update = vi.fn();
    render(
      <AdminI18nProvider locale="en">
        <GeneralSection settings={{}} update={update} updateMany={vi.fn()} />
      </AdminI18nProvider>,
    );
    expect(screen.getByLabelText('Admin panel language')).toBeTruthy();
  });
});
