import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { THEME_PRESETS } from '@/lib/config/theme';

/**
 * Colours that used to be hard-coded and failed in one mode or with one
 * accent (QA T-1, T-2, T-5, T-6, T-8). The values live in app/tokens.css;
 * these checks read them from there, so a palette change that breaks one
 * fails here.
 */
const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), 'utf8');
const tokens = read('app', 'tokens.css');

type RGBA = { r: number; g: number; b: number; a: number };

function parse(value: string): RGBA {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v)?.[1];
  if (hex) {
    const h = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(v)?.[1];
  if (!rgba) throw new Error(`unparsed colour ${value}`);
  const [r, g, b, a = 1] = rgba.split(',').map(Number);
  return { r, g, b, a };
}

function over(fg: RGBA, bg: RGBA): RGBA {
  const m = (x: number, y: number) => x * fg.a + y * (1 - fg.a);
  return { r: m(fg.r, bg.r), g: m(fg.g, bg.g), b: m(fg.b, bg.b), a: 1 };
}

function ratio(a: RGBA, b: RGBA): number {
  const lum = (c: RGBA) =>
    [c.r, c.g, c.b]
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function block(selector: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(tokens)?.[1];
}

function token(body: string | undefined, name: string): string | undefined {
  return body ? new RegExp(`--${name}:\\s*([^;]+);`).exec(body)?.[1] : undefined;
}

const ROOT = block(':root');
const LIGHT = block("[data-theme='light']");
const SURFACES = ['bg-primary', 'bg-secondary', 'bg-card', 'bg-card-hover'];

/** Every opaque surface token a preset resolves to in one mode. */
function surfaces(preset: string, mode: 'dark' | 'light'): string[] {
  const own = block(
    mode === 'dark' ? `[data-preset='${preset}']` : `[data-preset='${preset}'][data-theme='light']`,
  );
  const base = mode === 'dark' ? ROOT : LIGHT;
  return SURFACES.map((s) => token(own, s) ?? token(base, s)!).filter((v) => v.startsWith('#'));
}

/**
 * The --error a preset resolves to in one mode, in cascade order: a preset
 * may set its own where the default red misses 4.5:1 on its surfaces. The
 * preset's dark block comes after `[data-theme='light']` in tokens.css with
 * the same specificity, so in light mode it beats the global light value.
 */
function errorToken(preset: string, mode: 'dark' | 'light'): string | undefined {
  const dark = token(block(`[data-preset='${preset}']`), 'error');
  if (mode === 'dark') return dark ?? token(ROOT, 'error');
  const light = token(block(`[data-preset='${preset}'][data-theme='light']`), 'error');
  return light ?? dark ?? token(LIGHT, 'error');
}

describe('--error (T-8)', () => {
  it('is defined for both modes', () => {
    expect(token(ROOT, 'error')).toBeDefined();
    expect(token(LIGHT, 'error')).toBeDefined();
  });

  for (const preset of Object.keys(THEME_PRESETS)) {
    for (const mode of ['dark', 'light'] as const) {
      it(`${preset} (${mode}): clears 4.5:1 on every surface`, () => {
        const error = parse(errorToken(preset, mode)!);
        for (const surface of surfaces(preset, mode)) {
          expect(ratio(error, parse(surface)), surface).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }

  it('replaces the fixed reds in the error texts', () => {
    for (const file of [
      ['app', 'contact', 'contact.css'],
      ['components', 'PasswordGate.module.css'],
      ['components', 'ProofingModal.tsx'],
    ]) {
      expect(read(...file), file.join('/')).not.toMatch(/#e74c3c|#ff4d4f/i);
    }
  });
});

describe('lightbox tokens (T-1, T-2)', () => {
  const lb = (name: string) => parse(token(ROOT, `lightbox-${name}`)!);
  // The two overlays the lightbox paints (the default, and studio-modern's),
  // over the lightest page a light preset has — the worst case for white text.
  const lightest = parse('#ffffff');
  const overlays = [parse('rgba(0, 0, 0, 0.85)'), parse('rgba(10, 10, 10, 0.92)')].map((o) =>
    over(o, lightest),
  );

  it('keeps text and the saved-favourite colour at 4.5:1 on the overlay', () => {
    for (const bg of overlays) {
      for (const name of ['text', 'text-secondary', 'text-muted', 'fav']) {
        expect(ratio(over(lb(name), bg), bg), name).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('points the text tokens at them inside the overlay in light mode', () => {
    const css = read('components', 'Lightbox.module.css');
    const rule = /:global\(\[data-theme='light'\]\) \.overlay \{([^}]*)\}/.exec(css)?.[1];
    expect(rule).toBeDefined();
    expect(rule).toMatch(/--text-primary:\s*var\(--lightbox-text\)/);
    expect(rule).toMatch(/--text-secondary:\s*var\(--lightbox-text-secondary\)/);
    expect(rule).toMatch(/--text-muted:\s*var\(--lightbox-text-muted\)/);
  });

  it('drops the inline favourite colour that overrode the preset', () => {
    const tsx = read('components', 'Lightbox.tsx');
    expect(tsx).not.toMatch(/#ff4d4f/i);
    expect(tsx).not.toMatch(/color: isFav/);
  });
});

describe('text on the accent (T-5, T-6)', () => {
  it('uses --on-accent instead of a fixed white', () => {
    for (const file of [
      ['components', 'ProofingModal.tsx'],
      ['components', 'ProofSessionControls.tsx'],
    ]) {
      expect(read(...file), file.join('/')).not.toMatch(/color: '#fff'/);
    }
    const studioModern = read('app', 'themes', 'studio-modern.css');
    const button = /\[data-preset='studio-modern'\] \.empty-state__button \{([^}]*)\}/.exec(
      studioModern,
    )?.[1];
    expect(button).toBeDefined();
    expect(button).not.toMatch(/color:\s*#fff/i);
  });
});
