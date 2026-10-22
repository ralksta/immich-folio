// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AssetOrderEditor from '../AssetOrderEditor';

/**
 * #821: the order editor loads through useAdminFetch. The pinned order is
 * derived from the stored list and the live album until the author changes
 * it, and saving stays blocked while the album is not loaded.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const asset = (id: string) => ({ id, originalFileName: `${id}.jpg` });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderEditor(answer: () => Response, assetOrder = ['b', 'gone', 'a']) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => answer()),
  );
  const onSave = vi.fn();
  render(
    <AssetOrderEditor
      albumId="alb"
      albumName="Trip"
      assetOrder={assetOrder}
      onSave={onSave}
      onClose={() => {}}
    />,
  );
  return onSave;
}

const apply = () => screen.getByRole('button', { name: 'Apply order' }) as HTMLButtonElement;

describe('AssetOrderEditor', () => {
  it('pins the stored photos still in the album and reports the rest', async () => {
    const onSave = renderEditor(() => json({ assets: [asset('a'), asset('b'), asset('c')] }));

    expect(await screen.findByText('Pinned (2)')).toBeTruthy();
    expect(screen.getByText(/1 pinned photo is no longer in this album/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pin c.jpg' }));
    fireEvent.click(apply());
    expect(onSave).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('shows the failure with a retry, and keeps saving blocked until the album loads', async () => {
    let answer = () => json({ error: 'Immich is unreachable' }, 502);
    const onSave = renderEditor(() => answer());

    expect(
      await screen.findByText('Could not load (HTTP 502): Immich is unreachable.'),
    ).toBeTruthy();
    expect(apply().disabled).toBe(true);

    answer = () => json({ assets: [asset('a'), asset('b')] });
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(await screen.findByText('Pinned (2)')).toBeTruthy();
    expect(apply().disabled).toBe(false);
    fireEvent.click(apply());
    expect(onSave).toHaveBeenCalledWith(['b', 'a']);
  });
});
