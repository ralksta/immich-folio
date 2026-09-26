/**
 * The privacy policy page (#699): `content/privacy.md`, shown at /privacy.
 *
 * Folio ships no legal text. What it can do is say what this installation
 * processes, read off the configuration, so the owner does not have to dig
 * through the code to write the policy: processingFacts() below, shown next
 * to the editor in the admin panel.
 *
 * Server only (fs).
 */

import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig } from './config/schema';

export const PRIVACY_FILENAME = 'privacy.md';

export function privacyPath(contentDir = path.join(process.cwd(), 'content')): string {
  return path.join(contentDir, PRIVACY_FILENAME);
}

/** The policy text, or '' when there is none. */
export function readPrivacy(contentDir?: string): string {
  try {
    return fs.readFileSync(privacyPath(contentDir), 'utf8').trim();
  } catch {
    return '';
  }
}

/**
 * Whether /privacy exists: switched on (the default) and with text in the
 * file. Synchronous, because proxy.ts decides the 404 before rendering.
 */
export function privacyAvailable(config: Pick<AppConfig, 'privacy'>, contentDir?: string): boolean {
  if (!config.privacy.enabled) return false;
  try {
    return fs.statSync(privacyPath(contentDir)).size > 0 && readPrivacy(contentDir) !== '';
  } catch {
    return false;
  }
}

export interface ProcessingFact {
  /** Short label, e.g. "Contact form". */
  topic: string;
  /** What is processed, where it goes, how long it stays. */
  detail: string;
  /** Data leaves this server towards a third party. */
  thirdParty: boolean;
}

/**
 * What this installation processes, derived from its configuration. English,
 * like the rest of the admin panel; it is a checklist for the owner, not text
 * for the page.
 */
export function processingFacts(
  config: AppConfig,
  env: { CDN_URL?: string; hasPasswords: boolean },
): ProcessingFact[] {
  const facts: ProcessingFact[] = [
    {
      topic: 'Photos',
      detail:
        'Served through this site from your Immich server. Visitors never contact Immich directly.',
      thirdParty: false,
    },
    {
      topic: 'Server log',
      detail:
        'Folio keeps no access log. It prints a visitor IP address to the server log only when that visitor exceeds a rate limit. Your reverse proxy or hosting may log more, so check those too.',
      thirdParty: false,
    },
    {
      topic: 'Fonts',
      detail:
        'Served from this site. The server fetches them from Google Fonts once; visitors do not contact Google.',
      thirdParty: false,
    },
  ];

  if (config.map) {
    facts.push({
      topic: 'Map',
      detail:
        'The map on /map and in journal entries loads its tiles from tile.openstreetmap.org (OpenStreetMap Foundation, UK). The visitor’s browser requests them, so their IP address reaches OSM.',
      thirdParty: true,
    });
  }
  if (config.analytics) {
    facts.push({
      topic: 'Visitor statistics',
      detail:
        'A cookieless counter stores the page path, the date and whether the device is mobile or desktop in content/analytics.json. No IP address and no identifier are stored.',
      thirdParty: false,
    });
  }
  if (config.contact.enabled) {
    facts.push({
      topic: 'Contact form',
      detail: `Name, email address and message are stored on this server in content/messages/ and deleted after ${config.contact.retentionDays} days.${
        config.contact.notifyUrl
          ? ` A notification goes to ${hostOf(config.contact.notifyUrl)}, carrying nothing about the sender.`
          : ''
      }`,
      thirdParty: false,
    });
  }
  if (env.hasPasswords) {
    facts.push({
      topic: 'Cookies',
      detail:
        'Password-protected pages set an HttpOnly cookie after a correct password, valid for 24 hours. It is needed for the page to work and holds no personal data.',
      thirdParty: false,
    });
  }
  facts.push({
    topic: 'Browser storage',
    detail: `The colour-mode choice${
      config.proofing.enabled ? ' and photo selections (proofing)' : ''
    } are kept in the visitor’s own browser (localStorage) and never sent to the server.`,
    thirdParty: false,
  });
  if (env.CDN_URL) {
    facts.push({
      topic: 'CDN',
      detail: `Photos and videos are delivered through ${hostOf(env.CDN_URL)}, which receives the visitor’s IP address.`,
      thirdParty: true,
    });
  }
  return facts;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Headings to start from, in the site language. No wording beyond them. */
export function starterHeadings(lang: string, facts: ProcessingFact[]): string {
  const de = lang.toLowerCase().startsWith('de');
  const topics = new Set(facts.map((f) => f.topic));
  const h = (en: string, german: string) => `## ${de ? german : en}\n\n`;
  return [
    h('Controller', 'Verantwortlicher'),
    h('Hosting and server logs', 'Hosting und Server-Logfiles'),
    h('Fonts', 'Schriftarten'),
    topics.has('Map') ? h('Map', 'Kartendienst') : '',
    topics.has('Visitor statistics') ? h('Visitor statistics', 'Besucherstatistik') : '',
    topics.has('Contact form') ? h('Contact form', 'Kontaktformular') : '',
    h('Cookies and browser storage', 'Cookies und lokaler Speicher'),
    topics.has('CDN') ? h('Content delivery network', 'Content Delivery Network') : '',
    h('Your rights', 'Ihre Rechte'),
  ]
    .join('')
    .trim();
}
