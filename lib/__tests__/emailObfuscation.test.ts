import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { decodeEmail, encodeEmail, spelledOutEmail } from '../emailObfuscation';
import EmailLink from '@/components/EmailLink';

const ADDRESS = 'ralf.test+impressum@example.de';

describe('email obfuscation', () => {
  it('round-trips, including non-ASCII addresses', () => {
    expect(decodeEmail(encodeEmail(ADDRESS))).toBe(ADDRESS);
    expect(decodeEmail(encodeEmail('jürgen@müller.de'))).toBe('jürgen@müller.de');
  });

  it('leaves nothing a harvester would match in the encoded form', () => {
    const encoded = encodeEmail(ADDRESS);
    expect(encoded).not.toContain('@');
    expect(encoded).not.toContain('example');
  });

  it('decodes garbage to an empty string instead of throwing', () => {
    expect(decodeEmail('%%%')).toBe('');
  });

  it('spells the address out for the no-script fallback', () => {
    expect(spelledOutEmail('a.b@example.de')).toBe('a [dot] b [at] example [dot] de');
  });

  /*
   * The point of the exercise: the server HTML carries neither the address
   * nor a mailto: link. It appears only once the browser has hydrated.
   */
  it('renders no address and no mailto: on the server', () => {
    const html = renderToString(createElement(EmailLink, { encoded: encodeEmail(ADDRESS) }));
    expect(html).not.toContain(ADDRESS);
    expect(html).not.toContain('mailto:');
    expect(html).not.toContain('[at]');
  });
});
