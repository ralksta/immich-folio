// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ProofingModal } from '../ProofingModal';

/**
 * `navigator.clipboard` only exists in a secure context. A portfolio reached
 * over plain http on a LAN is not one, and both copy buttons used to throw on
 * the missing API and appear dead. They now show the text to copy by hand.
 */

const URL_ = 'http://192.168.1.20:7211/deutschland/kloster-chorin?fav=abc';
const LIST = '#1, #3';

vi.mock('../ProofingContext', () => ({
  useProofing: () => ({
    favorites: new Set(['a', 'b']),
    isModalOpen: true,
    setIsModalOpen: vi.fn(),
    getProofingUrl: () => URL_,
    getFormattedList: () => LIST,
    getSelectedTokens: () => ['a', 'b'],
    clearFavorites: vi.fn(),
    allowMailto: false,
    downloadArchiveUrl: undefined,
  }),
}));

const setClipboard = (value: unknown) =>
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });

afterEach(() => {
  cleanup();
  setClipboard(undefined);
});

describe('ProofingModal copy buttons', () => {
  it('shows the link to copy by hand when there is no clipboard (plain http)', () => {
    setClipboard(undefined);
    render(<ProofingModal />);
    fireEvent.click(screen.getByText('Copy Shareable Link'));
    expect((screen.getByLabelText('Copy this link') as HTMLTextAreaElement).value).toBe(URL_);
  });

  it('shows the list to copy by hand when there is no clipboard', () => {
    setClipboard(undefined);
    render(<ProofingModal />);
    fireEvent.click(screen.getByText('Copy Text List (#1, #2...)'));
    expect((screen.getByLabelText('Copy this list') as HTMLTextAreaElement).value).toBe(LIST);
  });

  it('falls back as well when the browser refuses the write', async () => {
    setClipboard({ writeText: vi.fn(() => Promise.reject(new Error('NotAllowedError'))) });
    render(<ProofingModal />);
    fireEvent.click(screen.getByText('Copy Shareable Link'));
    await waitFor(() => expect(screen.getByLabelText('Copy this link')).toBeTruthy());
  });

  it('copies silently where the clipboard works', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    render(<ProofingModal />);
    fireEvent.click(screen.getByText('Copy Shareable Link'));
    await waitFor(() => expect(screen.getByText('Link Copied!')).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(URL_);
    expect(screen.queryByLabelText('Copy this link')).toBeNull();
  });
});
