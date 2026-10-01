// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * `mode: auto` follows OS changes while the page is open (T-10/T-18), unless
 * the visitor made a choice or the operator fixed a mode.
 */

let osLight = false;
let onChange: (() => void) | null = null;

// Node 26 defines its own global localStorage (undefined without
// --localstorage-file), which shadows jsdom's; a Map-backed stub stands in.
function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
}

beforeEach(() => {
  vi.resetModules();
  osLight = false;
  onChange = null;
  stubStorage();
  document.documentElement.setAttribute('data-default-theme', 'auto');
  document.documentElement.removeAttribute('data-theme');
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return query === '(prefers-color-scheme: light)' ? osLight : false;
    },
    addEventListener: (_: string, cb: () => void) => {
      onChange = cb;
    },
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function load() {
  await import('../ThemeToggle');
  return document.documentElement;
}

describe('ThemeToggle under mode: auto', () => {
  it('follows the OS when it switches', async () => {
    const html = await load();
    expect(html.getAttribute('data-theme')).toBe('dark');
    osLight = true;
    onChange?.();
    expect(html.getAttribute('data-theme')).toBe('light');
    // Following the OS is not a choice — nothing is stored.
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('keeps a stored choice when the OS switches', async () => {
    localStorage.setItem('theme', 'dark');
    const html = await load();
    osLight = true;
    onChange?.();
    expect(html.getAttribute('data-theme')).toBe('dark');
  });

  it('keeps a fixed configured mode when the OS switches', async () => {
    document.documentElement.setAttribute('data-default-theme', 'dark');
    const html = await load();
    osLight = true;
    onChange?.();
    expect(html.getAttribute('data-theme')).toBe('dark');
  });
});

describe('ThemeToggle on a page rendered from the error shell', () => {
  it('re-applies the stored mode after the client render overwrote it', async () => {
    localStorage.setItem('theme', 'light');
    const html = await load();
    // The 404 shell's client render writes the server default back onto <html>.
    html.setAttribute('data-theme', 'dark');
    const { syncThemeFromDom } = await import('../ThemeToggle');
    syncThemeFromDom();
    expect(html.getAttribute('data-theme')).toBe('light');
  });

  it('picks up a configured mode that only appeared after the module loaded', async () => {
    document.documentElement.removeAttribute('data-default-theme');
    const html = await load();
    expect(html.getAttribute('data-theme')).toBe('dark');
    html.setAttribute('data-default-theme', 'light');
    const { syncThemeFromDom } = await import('../ThemeToggle');
    syncThemeFromDom();
    expect(html.getAttribute('data-theme')).toBe('light');
  });
});
