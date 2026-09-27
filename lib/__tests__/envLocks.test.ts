import { describe, it, expect } from 'vitest';
import { ENV_LOCKS, keepLockedValues, resolveEnvLocks } from '../admin/envLocks';

describe('resolveEnvLocks (#605)', () => {
  it('locks nothing when no overriding variable is set', () => {
    expect(resolveEnvLocks({})).toEqual({});
    expect(resolveEnvLocks({ SITE_PASSWORD: '  ', CONTACT_NOTIFY_URL: undefined })).toEqual({});
  });

  it('maps each set variable to its settings path, by name only', () => {
    const locks = resolveEnvLocks({
      SITE_PASSWORD: 'hunter2',
      CONTACT_NOTIFY_URL: 'https://ntfy.sh/secret-topic',
    });
    expect(locks).toEqual({
      sitePassword: 'SITE_PASSWORD',
      'contact.notifyUrl': 'CONTACT_NOTIFY_URL',
    });
    expect(JSON.stringify(locks)).not.toContain('hunter2');
    expect(JSON.stringify(locks)).not.toContain('secret-topic');
  });

  it('does not lock title, subtitle or url: settings.yaml wins over those variables', () => {
    const locks = resolveEnvLocks({ SITE_TITLE: 'T', SITE_SUBTITLE: 'S', SITE_URL: 'https://x' });
    expect(locks).toEqual({});
    expect(Object.keys(ENV_LOCKS)).not.toContain('title');
  });
});

describe('keepLockedValues (#605)', () => {
  const locks = { sitePassword: 'SITE_PASSWORD', 'contact.notifyUrl': 'CONTACT_NOTIFY_URL' };

  it('puts the stored value back over an edited locked field', () => {
    const out = keepLockedValues(
      { title: 'New', sitePassword: 'changed', contact: { enabled: true, notifyUrl: 'https://b' } },
      { sitePassword: 'scrypt:a:b', contact: { notifyUrl: 'https://a' } },
      locks,
    );
    expect(out).toEqual({
      title: 'New',
      sitePassword: 'scrypt:a:b',
      contact: { enabled: true, notifyUrl: 'https://a' },
    });
  });

  it('drops a locked value the file never had', () => {
    const out = keepLockedValues(
      { sitePassword: 'new', contact: { notifyUrl: 'https://b' } },
      {},
      locks,
    );
    expect(out).toEqual({ contact: {} });
  });

  it('leaves unlocked fields alone and does not mutate the input', () => {
    const incoming = { sitePassword: 'new' };
    expect(keepLockedValues(incoming, { sitePassword: 'old' }, {})).toEqual({
      sitePassword: 'new',
    });
    keepLockedValues(incoming, { sitePassword: 'old' }, locks);
    expect(incoming.sitePassword).toBe('new');
  });
});
