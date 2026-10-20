// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AdminI18nProvider, rich, useAdminDictionary, useAdminLocale } from '../AdminI18n';
import { adminEn } from '@/lib/i18n/admin/en';

afterEach(() => cleanup());

describe('rich', () => {
  it('puts each part where its placeholder sits', () => {
    const { container } = render(
      <p>{rich('Set {env} in {file}.', { env: <code>ADMIN_PASSWORD</code>, file: '.env' })}</p>,
    );
    expect(container.innerHTML).toBe('<p>Set <code>ADMIN_PASSWORD</code> in .env.</p>');
  });

  it('follows the order of the template, not of the parts', () => {
    const { container } = render(<p>{rich('{b} vor {a}', { a: 'A', b: <em>B</em> })}</p>);
    expect(container.innerHTML).toBe('<p><em>B</em> vor A</p>');
  });

  it('leaves a placeholder without a part visible', () => {
    const { container } = render(<p>{rich('Run the {wizard}.', {})}</p>);
    expect(container.textContent).toBe('Run the {wizard}.');
  });
});

describe('AdminI18nProvider', () => {
  function Probe() {
    const t = useAdminDictionary();
    return (
      <span data-locale={useAdminLocale()}>{t === adminEn ? 'english' : 'translated'}</span>
    );
  }

  it('is English outside a provider', () => {
    const { container } = render(<Probe />);
    expect(container.querySelector('span')?.dataset.locale).toBe('en');
    expect(container.textContent).toBe('english');
  });

  it('passes the resolved locale down', () => {
    const { container } = render(
      <AdminI18nProvider locale="de">
        <Probe />
      </AdminI18nProvider>,
    );
    expect(container.querySelector('span')?.dataset.locale).toBe('de');
  });
});
