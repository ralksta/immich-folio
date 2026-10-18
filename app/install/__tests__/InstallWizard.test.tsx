// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InstallWizard } from '@/app/install/InstallWizard';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InstallWizard connection step', () => {
  it(
    'keeps Continue disabled until both Immich credentials are entered, then tests the connection',
    async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ albums: [] }),
      });
      vi.stubGlobal('fetch', fetchMock);

      render(
        <InstallWizard
          initialApiUrl="https://photos.example.com"
          hasConfiguredCredentials={false}
          setupToken="setup-token"
        />,
      );

      const continueButton = screen.getByRole('button', { name: 'Test connection & continue' });
      expect(continueButton).toHaveProperty('disabled', true);
      expect(
        screen.getByText(
          'Enter both the Immich server URL and API key to enable the continue button.',
        ),
      ).toBeTruthy();

      fireEvent.change(screen.getByLabelText('Immich API key'), {
        target: { value: 'immich-key' },
      });
      expect(continueButton).toHaveProperty('disabled', false);

      fireEvent.click(continueButton);

      await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
      expect(fetchMock).toHaveBeenCalledWith('/api/install/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-setup-token': 'setup-token' },
        body: JSON.stringify({ apiUrl: 'https://photos.example.com', apiKey: 'immich-key' }),
      });
      expect(await screen.findByText(/Pick albums to publish/)).toBeTruthy();
    },
  );

  it('does not enable Continue for whitespace-only credentials', () => {
    render(
      <InstallWizard
        initialApiUrl=" "
        hasConfiguredCredentials={false}
        setupToken="setup-token"
      />,
    );

    fireEvent.change(screen.getByLabelText('Immich API key'), { target: { value: '  ' } });
    expect(screen.getByRole('button', { name: 'Test connection & continue' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('uses server-configured credentials without exposing the API key to the browser', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ albums: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <InstallWizard
        initialApiUrl="https://photos.example.com"
        hasConfiguredCredentials
        setupToken="setup-token"
      />,
    );

    expect(screen.getByRole('button', { name: 'Test connection & continue' })).toHaveProperty(
      'disabled',
      false,
    );
    expect(screen.getByLabelText('Immich API key')).toHaveProperty('required', false);
    expect(
      screen.getByText(
        'A server-configured Immich API key will be used unless you enter another one.',
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Test connection & continue' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith('/api/install/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-setup-token': 'setup-token' },
      body: JSON.stringify({ apiUrl: 'https://photos.example.com', apiKey: '' }),
    });
    expect(await screen.findByText(/Pick albums to publish/)).toBeTruthy();
  });
});
