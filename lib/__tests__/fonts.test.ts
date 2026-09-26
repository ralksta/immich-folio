import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  __resetFontsForTests,
  getFontFile,
  getGoogleCss,
  parseFamilies,
  rewriteCss,
} from '../fonts';
import { getFontsCssUrl } from '../config/theme';

const GSTATIC_URL = 'https://fonts.gstatic.com/s/archivo/v19/abc.woff2';
const GOOGLE_CSS = `@font-face {
  font-family: 'Archivo';
  font-weight: 400;
  src: url(${GSTATIC_URL}) format('woff2');
}`;

let cwd: string;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // lib/fonts.ts caches under <cwd>/content/.fonts.
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-fonts-'));
  vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith('https://fonts.googleapis.com/')) return new Response(GOOGLE_CSS);
    if (url === GSTATIC_URL) return new Response(new Uint8Array([1, 2, 3]));
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  __resetFontsForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  fs.rmSync(cwd, { recursive: true, force: true });
});

const fileName = () =>
  rewriteCss(GOOGLE_CSS).match(/\/api\/fonts\/file\/([a-f0-9]{32}\.woff2)/)![1];

describe('getFontsCssUrl', () => {
  it('points at this origin, one family parameter per distinct family', () => {
    expect(getFontsCssUrl(['Archivo', 'Archivo', 'IBM Plex Mono'])).toBe(
      '/api/fonts/css?family=Archivo&family=IBM%20Plex%20Mono',
    );
  });
});

describe('parseFamilies', () => {
  it('accepts Google Fonts names with spaces and digits', () => {
    expect(parseFamilies(['Source Sans 3', 'IBM Plex Mono'])).toEqual([
      'Source Sans 3',
      'IBM Plex Mono',
    ]);
  });

  it('rejects anything that could change the upstream query', () => {
    expect(parseFamilies(['Inter:wght@100'])).toBeNull();
    expect(parseFamilies(['Inter&family=Roboto'])).toBeNull();
    expect(parseFamilies(['../etc'])).toBeNull();
  });

  it('rejects an empty list and more families than a theme has slots', () => {
    expect(parseFamilies([])).toBeNull();
    expect(parseFamilies(['A', 'B', 'C', 'D'])).toBeNull();
  });
});

describe('rewriteCss', () => {
  it('replaces every gstatic URL with a same-origin one', () => {
    const css = rewriteCss(GOOGLE_CSS);
    expect(css).not.toContain('gstatic');
    expect(css).toMatch(/url\(\/api\/fonts\/file\/[a-f0-9]{32}\.woff2\)/);
  });
});

describe('getGoogleCss', () => {
  it('fetches once and serves the cached copy afterwards', async () => {
    expect(await getGoogleCss(['Archivo'])).toBe(GOOGLE_CSS);
    __resetFontsForTests();
    expect(await getGoogleCss(['Archivo'])).toBe(GOOGLE_CSS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks Google with a browser User-Agent, so the answer is WOFF2', async () => {
    await getGoogleCss(['IBM Plex Mono']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('family=IBM+Plex+Mono:wght@');
    expect(init.headers['User-Agent']).toMatch(/Chrome/);
  });

  it('does not retry a failed fetch on every request', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await getGoogleCss(['Archivo'])).toBeNull();
    expect(await getGoogleCss(['Archivo'])).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('getFontFile', () => {
  it('serves a file that a fetched stylesheet named, and caches it', async () => {
    await getGoogleCss(['Archivo']);
    expect(await getFontFile(fileName())).toEqual(new Uint8Array([1, 2, 3]));
    expect(fs.existsSync(path.join(cwd, 'content', '.fonts', fileName()))).toBe(true);
  });

  it('finds the file after a restart from the stylesheet on disk', async () => {
    await getGoogleCss(['Archivo']);
    __resetFontsForTests();
    expect(await getFontFile(fileName())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('refuses a name no stylesheet produced, without fetching anything', async () => {
    expect(await getFontFile('0'.repeat(32) + '.woff2')).toBeNull();
    expect(await getFontFile('../../settings.yaml')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
