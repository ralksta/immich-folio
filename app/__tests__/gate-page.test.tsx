import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * A locked site still serves /impressum and /privacy (proxy.ts, UNGATED_PAGES),
 * and the gate is where a visitor who cannot get in finds them. A link to a
 * page that is switched off would lead to a 404, so each appears only when its
 * page exists.
 */

const config = {
  siteTitle: 'Test Folio',
  lang: 'en',
  legal: { enabled: true },
  privacy: { enabled: true },
};
let privacy = true;

vi.mock('@/lib/config', () => ({
  getConfig: () => config,
  getConfigOrNull: () => config,
}));
vi.mock('@/lib/auth', () => ({
  isSiteLocked: () => true,
  SITE_AUTH_KEY: '__site__',
}));
vi.mock('@/lib/privacy', () => ({
  privacyAvailable: () => privacy,
}));

import GatePage from '../gate/page';

const html = () => renderToStaticMarkup(<GatePage />);

describe('site gate page', () => {
  beforeEach(() => {
    config.lang = 'en';
    config.legal.enabled = true;
    privacy = true;
  });

  it('links the legal notice and the privacy policy', () => {
    const out = html();
    expect(out).toContain('href="/impressum"');
    expect(out).toContain('href="/privacy"');
    expect(out).toContain('aria-label="Legal information"');
  });

  it('leaves out a page that is switched off', () => {
    config.legal.enabled = false;
    expect(html()).not.toContain('href="/impressum"');
    expect(html()).toContain('href="/privacy"');

    config.legal.enabled = true;
    privacy = false;
    expect(html()).toContain('href="/impressum"');
    expect(html()).not.toContain('href="/privacy"');
  });

  it('renders no empty link list when neither page exists', () => {
    config.legal.enabled = false;
    privacy = false;
    expect(html()).not.toContain('<nav');
  });

  it('labels the links in the site language', () => {
    config.lang = 'de';
    const out = html();
    expect(out).toContain('>Impressum</a>');
    expect(out).toContain('>Datenschutz</a>');
  });
});
