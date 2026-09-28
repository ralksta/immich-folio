// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import ContactForm from '../ContactForm';
import { validateContact } from '@/lib/contact';

/**
 * The fill-time check compares `startedAt` against the server's clock. When
 * the form stamped it with the visitor's clock, a device running a few
 * minutes fast made every message look "sent before the form existed": the
 * route answered `ok` (as it does for bots) and dropped the message, and the
 * visitor saw the thank-you page.
 */

const SERVER_RENDERED_AT = 1_800_000_000_000;
const MINUTE = 60_000;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function submitWithClientClock(clientNow: number) {
  vi.useFakeTimers({ now: clientNow, toFake: ['Date'] });
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);

  render(<ContactForm retentionDays={30} renderedAt={SERVER_RENDERED_AT} />);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello there' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Send message' }).closest('form')!);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  return JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
}

describe('ContactForm fill-time stamp', () => {
  it('survives a visitor clock running ahead of the server', async () => {
    const body = await submitWithClientClock(SERVER_RENDERED_AT + 10 * MINUTE);
    // The visitor took two minutes, measured on the server's clock.
    expect(validateContact(body, SERVER_RENDERED_AT + 2 * MINUTE).ok).toBe(true);
  });

  it('survives a visitor clock running a day behind the server', async () => {
    const body = await submitWithClientClock(SERVER_RENDERED_AT - 25 * 60 * MINUTE);
    expect(validateContact(body, SERVER_RENDERED_AT + 2 * MINUTE).ok).toBe(true);
  });

  it('still treats an instant submission as spam', async () => {
    const body = await submitWithClientClock(SERVER_RENDERED_AT);
    expect(validateContact(body, SERVER_RENDERED_AT + 500)).toEqual({ ok: false, reason: 'spam' });
  });
});
