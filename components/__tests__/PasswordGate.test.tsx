// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import PasswordGate from '../PasswordGate';

/**
 * The gate treated every non-ok answer as a wrong password. After ten attempts
 * the rate limit answers 429 — and the visitor who finally typed the right
 * password was told it was wrong, and had it wiped from the field.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function submit(response: Response, type?: 'journal') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response),
  );
  render(<PasswordGate slug="polen" title="Polen" type={type} />);
  const input = screen.getByLabelText('Enter password') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'right-password' } });
  fireEvent.submit(input.closest('form')!);
  const alert = await screen.findByRole('alert');
  await waitFor(() => expect(input.disabled).toBe(false));
  return { alert, input };
}

describe('PasswordGate refusals', () => {
  it('says a wrong password is wrong, and clears the field', async () => {
    const { alert, input } = await submit(new Response(null, { status: 401 }));
    expect(alert.textContent).toBe('Incorrect password. Please try again.');
    expect(input.value).toBe('');
  });

  it('says a rate limit is a rate limit, with the wait, and keeps the password', async () => {
    const { alert, input } = await submit(
      new Response(null, { status: 429, headers: { 'Retry-After': '42' } }),
    );
    expect(alert.textContent).toBe('Too many attempts. Please try again in 42 seconds.');
    expect(alert.textContent).not.toContain('Incorrect');
    expect(input.value).toBe('right-password');
  });

  it('copes with a rate limit that names no wait', async () => {
    const { alert } = await submit(new Response(null, { status: 429 }));
    expect(alert.textContent).toBe('Too many attempts. Please try again later.');
  });

  it('reports a server failure as a failure, not a wrong password', async () => {
    const { alert, input } = await submit(new Response(null, { status: 500 }));
    expect(alert.textContent).toBe('Unable to verify password. Please try again later.');
    expect(input.value).toBe('right-password');
  });
});

describe('PasswordGate subtitle', () => {
  it('calls a journal entry a journal entry, not a gallery', () => {
    render(<PasswordGate slug="tagebuch" title="Journal" type="journal" />);
    expect(screen.getByText('This journal entry is password-protected.')).toBeTruthy();
    expect(screen.queryByText('This gallery is password-protected.')).toBeNull();
  });
});
