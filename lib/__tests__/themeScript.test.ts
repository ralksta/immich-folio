// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { THEME_INIT_SCRIPT } from '../themeScript';

/**
 * The inline script that sets the colour mode before the first paint (T-10).
 * Without it a visitor who stored "light" — or runs a light OS under
 * `mode: auto` — saw the server's dark guess until ThemeToggle's bundle ran.
 */

let osLight = false;

function run(defaultTheme: string | null, serverTheme: string | null = defaultTheme) {
  const html = document.documentElement;
  html.removeAttribute('data-theme');
  html.removeAttribute('data-default-theme');
  if (defaultTheme !== null) html.setAttribute('data-default-theme', defaultTheme);
  if (serverTheme !== null && serverTheme !== 'auto') html.setAttribute('data-theme', serverTheme);
  new Function(THEME_INIT_SCRIPT)();
  return html.getAttribute('data-theme');
}

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
  osLight = false;
  stubStorage();
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches: query === '(prefers-color-scheme: light)' ? osLight : false,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('THEME_INIT_SCRIPT', () => {
  it('applies a stored choice over the configured mode', () => {
    localStorage.setItem('theme', 'light');
    expect(run('dark')).toBe('light');
    localStorage.setItem('theme', 'dark');
    expect(run('light')).toBe('dark');
  });

  it('keeps the configured mode for a visitor who never chose', () => {
    expect(run('light')).toBe('light');
    expect(run('dark')).toBe('dark');
  });

  it('follows the OS under mode: auto', () => {
    osLight = true;
    expect(run('auto')).toBe('light');
    osLight = false;
    expect(run('auto')).toBe('dark');
  });

  it('ignores a stored value that is not a mode', () => {
    localStorage.setItem('theme', 'purple');
    osLight = true;
    expect(run('auto')).toBe('light');
  });

  it('falls back to the configured mode when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(run('light')).toBe('light');
  });

  /** It is inlined as a string: a `</script>` inside would end it early. */
  it('is safe to inline', () => {
    expect(THEME_INIT_SCRIPT).not.toMatch(/<\/script/i);
  });
});
