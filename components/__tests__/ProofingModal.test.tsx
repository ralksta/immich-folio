// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ProofingModal } from '../ProofingModal';
import { encodeEmail } from '@/lib/emailObfuscation';

/**
 * `navigator.clipboard` only exists in a secure context. A portfolio reached
 * over plain http on a LAN is not one, and both copy buttons used to throw on
 * the missing API and appear dead. They now show the text to copy by hand.
 *
 * The context is mutable so a test can turn the email action on and off: the
 * recipient is `proofing.email`, else the footer contact email (#736), encoded
 * until the browser decodes it.
 */

const URL_ = 'http://192.168.1.20:7211/deutschland/kloster-chorin?fav=abc';
const LIST = '#1, #3';
const RECIPIENT = 'hello@example.com';

const { proofing } = vi.hoisted(() => ({ proofing: { current: {} as Record<string, unknown> } }));

vi.mock('../ProofingContext', () => ({ useProofing: () => proofing.current }));

/** The context the modal reads; reset per test so flags cannot leak. */
function setContext(overrides: Record<string, unknown> = {}) {
  proofing.current = {
    favorites: new Set(['a', 'b']),
    isModalOpen: true,
    setIsModalOpen: vi.fn(),
    getProofingUrl: () => URL_,
    getFormattedList: () => LIST,
    getSelectedTokens: () => ['a', 'b'],
    clearFavorites: vi.fn(),
    allowMailto: false,
    encodedMailto: undefined,
    downloadArchiveUrl: undefined,
    ...overrides,
  };
}

const setClipboard = (value: unknown) =>
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });

beforeEach(() => setContext());

afterEach(() => {
  cleanup();
  setClipboard(undefined);
  vi.unstubAllGlobals();
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

describe('ProofingModal email to photographer (#736)', () => {
  it('hides the email action when no recipient is configured', () => {
    setContext({ allowMailto: true, encodedMailto: undefined });
    render(<ProofingModal />);
    expect(screen.queryByText(/Send Email/)).toBeNull();
  });

  it('hides the email action when the site turned it off', () => {
    setContext({ allowMailto: false, encodedMailto: encodeEmail(RECIPIENT) });
    render(<ProofingModal />);
    expect(screen.queryByText(/Send Email/)).toBeNull();
  });

  it('addresses the compose to the configured recipient', () => {
    setContext({ allowMailto: true, encodedMailto: encodeEmail(RECIPIENT) });
    const location = { href: '' };
    vi.stubGlobal('location', location);
    render(<ProofingModal />);
    fireEvent.click(screen.getByText(/Send Email/));
    expect(location.href.startsWith(`mailto:${RECIPIENT}?subject=`)).toBe(true);
  });

  it('keeps a crafted address from adding its own header fields', () => {
    setContext({ allowMailto: true, encodedMailto: encodeEmail('a@b.c?bcc=evil@x.y') });
    const location = { href: '' };
    vi.stubGlobal('location', location);
    render(<ProofingModal />);
    fireEvent.click(screen.getByText(/Send Email/));
    // The `?` and `=` are escaped, so the draft gains no bcc field.
    expect(location.href.startsWith('mailto:a@b.c%3Fbcc%3Devil@x.y?subject=')).toBe(true);
  });

  it('keeps the plain address out of the rendered markup', () => {
    setContext({ allowMailto: true, encodedMailto: encodeEmail(RECIPIENT) });
    const { container } = render(<ProofingModal />);
    expect(container.innerHTML).not.toContain(RECIPIENT);
  });
});
