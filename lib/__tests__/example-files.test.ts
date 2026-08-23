import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { deriveGallery } from '../config';
import type { GalleryYaml } from '../config';

/**
 * The shipped .example files are the ones README, CONTRIBUTING and the setup
 * screen all tell a new user to copy. `gallery.yaml.example` carried two
 * `subpages:` keys, so js-yaml refused it and a brand-new installation answered
 * HTTP 500 on every route — the first thing a user saw was a broken site.
 */
const CONTENT = path.join(process.cwd(), 'content');

function load(file: string): unknown {
  return yaml.load(fs.readFileSync(path.join(CONTENT, file), 'utf8'));
}

describe('shipped example files', () => {
  it('gallery.yaml.example is valid YAML', () => {
    expect(() => load('gallery.yaml.example')).not.toThrow();
  });

  it('settings.yaml.example is valid YAML', () => {
    expect(() => load('settings.yaml.example')).not.toThrow();
  });

  /** Parsing is not enough — it has to survive the config pipeline too. */
  it('gallery.yaml.example produces a usable gallery structure', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const derived = deriveGallery(load('gallery.yaml.example') as GalleryYaml);

    expect(derived.subpages.length).toBeGreaterThan(0);
    // Every subpage needs a slug to be reachable at all.
    for (const sp of derived.subpages) {
      expect(sp.slug).toBeTruthy();
    }

    /*
     * No albums, on purpose: the example's IDs are placeholders like
     * "album-uuid-3", which are not UUIDs and are therefore dropped with a
     * named warning each (#517). A copied example gives a site with page
     * structure and no photos, which is honest — before, the placeholders
     * became the all-zeros UUID and produced an error page.
     */
    expect(derived.albums).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
