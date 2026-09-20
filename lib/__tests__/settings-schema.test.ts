import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { validateSettings } from '../config/settingsSchema';

/**
 * Half of these tests are about what must *not* be rejected.
 *
 * The failure mode of a validator on a config file is not "it let something
 * through" — it is "it locked an operator out of their own settings, through
 * the panel that writes the file". There is no schemaVersion and no migration
 * code, so older and newer configurations are both in the wild.
 */

const ok = (input: unknown) => validateSettings(input).ok;
const errors = (input: unknown) => {
  const result = validateSettings(input);
  return result.ok ? [] : result.errors;
};

describe('validateSettings — accepts what works today', () => {
  it('accepts the example settings file this repo ships with', () => {
    // content/settings.yaml is gitignored — the example is the one every
    // installation starts from, and the one CI actually has.
    const raw = fs.readFileSync(path.join(process.cwd(), 'content/settings.yaml.example'), 'utf8');

    expect(validateSettings(yaml.load(raw))).toEqual({ ok: true });
  });

  it('accepts an empty settings file', () => {
    // Everything has a default; a site with no settings.yaml is a valid site.
    expect(ok({})).toBe(true);
  });

  it('accepts both spellings of theme', () => {
    expect(ok({ theme: 'minimal' })).toBe(true);
    expect(ok({ theme: { preset: 'minimal', accent: '#c0ffee', radius: 4 } })).toBe(true);
  });

  it('accepts a watermark opacity written as a percentage', () => {
    // The #508 workaround: values above 1 are read as percentages. A validator
    // that insisted on 0–1 would reject configurations that render correctly.
    expect(ok({ watermark: { opacity: 90 } })).toBe(true);
    expect(ok({ watermark: { opacity: 0.5 } })).toBe(true);
  });

  it('accepts a colour mode it does not recognise', () => {
    // resolveColorMode falls back to 'dark'. Rejecting here would be stricter
    // than the behaviour it guards.
    expect(ok({ mode: 'sepia' })).toBe(true);
  });

  it('accepts keys this version has never heard of', () => {
    expect(ok({ title: 'Folio', somethingFromANewerVersion: { nested: true } })).toBe(true);
    expect(ok({ theme: { preset: 'noir', futureKnob: 3 } })).toBe(true);
  });

  it('accepts the legacy exifOnHover switch alongside the group form', () => {
    expect(ok({ exifOnHover: false, exif: { camera: true, caption: false } })).toBe(true);
  });
});

describe('validateSettings — rejects what breaks the site', () => {
  it('rejects a payload that is not an object', () => {
    expect(ok('title: Folio')).toBe(false);
    expect(ok([{ title: 'Folio' }])).toBe(false);
    expect(ok(null)).toBe(false);
  });

  it('rejects a scalar where a section belongs', () => {
    // `grid: 3` reads as "three columns" to a human and as a crash to
    // buildCoverGridVars.
    const found = errors({ grid: 3 });

    expect(found).toHaveLength(1);
    expect(found[0].field).toBe('grid');
  });

  it('rejects a section where a scalar belongs', () => {
    const found = errors({ title: { de: 'Folio', en: 'Folio' } });

    expect(found[0].field).toBe('title');
  });

  it('names the exact field, however deep', () => {
    const found = errors({ theme: { fonts: { heading: 42 } } });

    expect(found.map((e) => e.field)).toContain('theme.fonts.heading');
  });

  it('rejects a theme that is neither a preset name nor a section', () => {
    // The separate theme check must not turn into a hole: anything that is not
    // a string still has to look like the object form.
    expect(ok({ theme: 3 })).toBe(false);
    expect(ok({ theme: ['minimal'] })).toBe(false);
    expect(errors({ theme: 3 })[0].field).toBe('theme');
  });

  it('names an index inside navLinks', () => {
    const found = errors({ navLinks: [{ label: 'Shop', url: 'https://example.com' }, 'nope'] });

    expect(found[0].field).toBe('navLinks.1');
  });

  it('rejects a list where a record belongs', () => {
    expect(ok({ legal: ['Ralf', 'Berlin'] })).toBe(false);
  });

  it('reports every offending field at once, not just the first', () => {
    const found = errors({ title: 1, subtitle: 2, map: 'yes' });

    expect(found.map((e) => e.field).sort()).toEqual(['map', 'subtitle', 'title']);
  });
});
