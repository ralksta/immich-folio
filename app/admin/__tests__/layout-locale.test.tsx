// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

/**
 * The admin layout picks the panel's language (#604): `adminLang`, else the
 * site's `lang`, else English when there is no usable config.
 */

const config = vi.hoisted(() => ({ current: null as null | { lang: string; adminLang?: string } }));

vi.mock('@/lib/config', () => ({ getConfigOrNull: () => config.current }));
vi.mock('../AdminShell', async () => {
  const { useAdminLocale } = await import('../components/AdminI18n');
  return {
    default: function Shell() {
      return <span data-testid="shell">{useAdminLocale()}</span>;
    },
  };
});

import AdminLayout from '../layout';

beforeEach(() => {
  config.current = null;
});
afterEach(() => cleanup());

function renderLayout() {
  const { container, getByTestId } = render(<AdminLayout>{null}</AdminLayout>);
  return {
    lang: container.querySelector('.admin-layout')?.getAttribute('lang'),
    locale: getByTestId('shell').textContent,
  };
}

describe('AdminLayout locale', () => {
  it('uses adminLang over the site language', () => {
    config.current = { lang: 'de', adminLang: 'en' };
    expect(renderLayout()).toEqual({ lang: 'en', locale: 'en' });
  });

  it('follows the site language when adminLang is unset', () => {
    config.current = { lang: 'de' };
    expect(renderLayout()).toEqual({ lang: 'de', locale: 'de' });
  });

  it('is English without a usable config', () => {
    expect(renderLayout()).toEqual({ lang: 'en', locale: 'en' });
  });

  it('marks an unsupported language as the English it shows', () => {
    config.current = { lang: 'ja' };
    expect(renderLayout()).toEqual({ lang: 'en', locale: 'en' });
  });
});
