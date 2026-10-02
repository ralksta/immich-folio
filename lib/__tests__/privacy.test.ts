import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseMarkdownBlocks } from '../markdownBlocks';
import { privacyAvailable, processingFacts, starterHeadings } from '../privacy';
import type { AppConfig } from '../config/schema';

describe('parseMarkdownBlocks', () => {
  it('reads headings, lists and paragraphs', () => {
    const blocks = parseMarkdownBlocks(
      '# Datenschutz\n\nErster Satz\nzweiter Satz.\n\n### Detail\n- eins\n- **zwei**\n\n1. a\n2. b',
    );
    expect(blocks).toEqual([
      { type: 'heading', level: 2, html: 'Datenschutz' },
      { type: 'paragraph', html: 'Erster Satz zweiter Satz.' },
      { type: 'heading', level: 3, html: 'Detail' },
      { type: 'list', ordered: false, items: ['eins', '<strong>zwei</strong>'] },
      { type: 'list', ordered: true, items: ['a', 'b'] },
    ]);
  });

  it('escapes the author text before adding its own tags', () => {
    const [p] = parseMarkdownBlocks('<script>alert(1)</script> [x](javascript:alert(1))');
    const html = p.type === 'paragraph' ? p.html : '';
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<a ');
  });
});

const config = (over: Partial<AppConfig> = {}) =>
  ({
    map: false,
    analytics: false,
    contact: { enabled: false, retentionDays: 90 },
    proofing: { enabled: false },
    subpages: [],
    privacy: { enabled: true },
    ...over,
  }) as unknown as AppConfig;

describe('processingFacts', () => {
  it('lists only what this installation actually does', () => {
    const topics = processingFacts(config(), { hasPasswords: false, hasProofingLinks: false }).map(
      (f) => f.topic,
    );
    expect(topics).toEqual(['Photos', 'Server log', 'Fonts', 'Browser storage']);
  });

  it('names third parties for the map, the notification host and a CDN', () => {
    const facts = processingFacts(
      config({
        map: true,
        contact: { enabled: true, retentionDays: 30, notifyUrl: 'https://ntfy.sh/secret' },
      }),
      { hasPasswords: true, hasProofingLinks: false, CDN_URL: 'https://cdn.example.net' },
    );
    const third = facts.filter((f) => f.thirdParty).map((f) => f.topic);
    // The notification carries nothing about the sender (#702), so the
    // contact form is not a third-party transfer.
    expect(third).toEqual(['Map', 'CDN']);
    const contact = facts.find((f) => f.topic === 'Contact form')!;
    expect(contact.detail).toContain('30 days');
    // The host, never the topic path: the topic name is the secret.
    expect(contact.detail).toContain('ntfy.sh');
    expect(contact.detail).not.toContain('secret');
    expect(facts.some((f) => f.topic === 'Cookies')).toBe(true);
  });

  it('keeps anonymous favourites in the browser, also when only a subpage turns them on', () => {
    const storage = (c: AppConfig) =>
      processingFacts(c, { hasPasswords: false, hasProofingLinks: false }).find(
        (f) => f.topic === 'Browser storage',
      )!.detail;
    expect(storage(config())).not.toContain('favourites');
    expect(storage(config({ proofing: { enabled: true } } as Partial<AppConfig>))).toContain(
      'favourites',
    );
    const subpageOnly = config({
      subpages: [{ proofing: true }],
    } as unknown as Partial<AppConfig>);
    expect(storage(subpageOnly)).toContain('favourites');
    expect(storage(subpageOnly)).toContain('localStorage');
  });

  it('says that proofing links store the client’s selection on this server', () => {
    const none = processingFacts(config({ proofing: { enabled: true } } as Partial<AppConfig>), {
      hasPasswords: false,
      hasProofingLinks: false,
    });
    expect(none.some((f) => f.topic === 'Proofing links')).toBe(false);

    // Links do not depend on the proofing switch, so the fact does not either.
    const facts = processingFacts(config(), { hasPasswords: false, hasProofingLinks: true });
    const links = facts.find((f) => f.topic === 'Proofing links')!;
    expect(links.detail).toContain('content/proofing.json');
    expect(links.detail).toContain('client name');
    expect(links.detail).toContain('until you delete the link');
    expect(links.thirdParty).toBe(false);
    expect(starterHeadings('de', facts)).toContain('## Bildauswahl durch Kunden');
    expect(facts.find((f) => f.topic === 'Browser storage')!.detail).not.toContain(
      'never sent to the server',
    );
  });

  it('names the proofing webhook host, since its notification carries the client name', () => {
    const links = processingFacts(config(), {
      hasPasswords: false,
      hasProofingLinks: true,
      proofingWebhookUrl: 'https://discord.com/api/webhooks/123/secret',
    }).find((f) => f.topic === 'Proofing links')!;
    expect(links.thirdParty).toBe(true);
    expect(links.detail).toContain('discord.com');
    expect(links.detail).not.toContain('secret');
  });

  it('turns the facts into headings in the site language, and nothing else', () => {
    const facts = processingFacts(config({ map: true }), {
      hasPasswords: false,
      hasProofingLinks: false,
    });
    const de = starterHeadings('de', facts);
    expect(de).toContain('## Kartendienst');
    expect(de).not.toContain('Kontaktformular');
    expect(de.split('\n').filter((l) => l && !l.startsWith('## '))).toEqual([]);
    expect(starterHeadings('en', facts)).toContain('## Your rights');
  });
});

describe('privacyAvailable', () => {
  it('needs the switch on and text in the file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-privacy-'));
    expect(privacyAvailable(config(), dir)).toBe(false);
    fs.writeFileSync(path.join(dir, 'privacy.md'), '  \n');
    expect(privacyAvailable(config(), dir)).toBe(false);
    fs.writeFileSync(path.join(dir, 'privacy.md'), '## Text\n');
    expect(privacyAvailable(config(), dir)).toBe(true);
    expect(privacyAvailable(config({ privacy: { enabled: false } }), dir)).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
