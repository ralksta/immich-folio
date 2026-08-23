import { describe, it, expect } from 'vitest';
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
  it('gallery.yaml.example produces a usable gallery', () => {
    const derived = deriveGallery(load('gallery.yaml.example') as GalleryYaml);

    expect(derived.subpages.length).toBeGreaterThan(0);
    expect(derived.albums.length).toBeGreaterThan(0);
    // Every subpage needs a slug to be reachable at all.
    for (const sp of derived.subpages) {
      expect(sp.slug).toBeTruthy();
    }
  });
});
