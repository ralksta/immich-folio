// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import GeneralSection from '../GeneralSection';
import type { Settings } from '../types';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/settings/general',
}));

afterEach(cleanup);

/**
 * The proofing email draft had no recipient (#736), and the address it now
 * uses would otherwise be a silent borrow from the footer. The field sits at
 * the proofing switch and says which address applies when it is empty.
 */
describe('GeneralSection proofing email', () => {
  const renderWith = (settings: Settings) => {
    const update = vi.fn();
    render(<GeneralSection settings={settings} update={update} updateMany={vi.fn()} />);
    return { update, field: screen.getByLabelText('Email for client selections') };
  };

  it('names the footer address that applies while the field is empty', () => {
    renderWith({ footer: { email: 'hello@example.com' } });
    expect(screen.getByText(/go to hello@example\.com, the address set under Footer/)).toBeTruthy();
  });

  it('falls back to the Legal address only while the Impressum is on', () => {
    const legal = { enabled: true, name: '', address: '', zipCity: '', country: '' };
    renderWith({ legal: { ...legal, email: 'legal@example.com' } });
    expect(screen.getByText(/the address set under Legal/)).toBeTruthy();
    cleanup();
    renderWith({ legal: { ...legal, enabled: false, email: 'legal@example.com' } });
    expect(screen.getByText(/drafts open without a recipient/)).toBeTruthy();
  });

  it('stops naming a fallback once its own address is set', () => {
    renderWith({
      proofing: { email: 'picks@example.com' },
      footer: { email: 'hello@example.com' },
    });
    expect(screen.queryByText(/hello@example\.com/)).toBeNull();
  });

  it('writes proofing.email', () => {
    const { update, field } = renderWith({});
    fireEvent.change(field, { target: { value: 'picks@example.com' } });
    expect(update).toHaveBeenCalledWith('proofing.email', 'picks@example.com');
  });

  it('switches the email button and disables the field with it', () => {
    const { update, field } = renderWith({ proofing: { allowMailto: false } });
    expect((field as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Email button/ }));
    expect(update).toHaveBeenCalledWith('proofing.allowMailto', true);
  });
});
