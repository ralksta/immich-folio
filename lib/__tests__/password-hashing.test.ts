import { describe, it, expect } from 'vitest';
import { hashFrontmatterPassword, hashPassword, hashPasswordKeys } from '../admin/passwordHashing';
import { generateScryptHash, verifyScrypt } from '../password';

const KEY = new Set(['password']);

describe('hashPassword', () => {
  it('hashes plaintext, and leaves empty, scrypt and bcrypt values alone', async () => {
    const hashed = await hashPassword('secret', []);
    expect(hashed).toMatch(/^scrypt:/);
    expect(await verifyScrypt('secret', hashed)).toBe(true);
    expect(await hashPassword('', [])).toBe('');
    expect(await hashPassword(hashed, [])).toBe(hashed);
    expect(await hashPassword('$2b$10$abcdefghijklmno', [])).toBe('$2b$10$abcdefghijklmno');
  });

  /*
   * The visitor's unlock cookie signs the stored value. The admin form re-sends
   * the plaintext after a save; a fresh salt each time would sign everyone out.
   */
  it('keeps an existing hash when the plaintext still matches it', async () => {
    const existing = await generateScryptHash('secret');
    expect(await hashPassword('secret', [existing])).toBe(existing);
    expect(await hashPassword('other', [existing])).not.toBe(existing);
  });
});

describe('hashPasswordKeys', () => {
  it('hashes every password in a gallery, however deep, and nothing else', async () => {
    const gallery = {
      albums: [{ 'album-1': { title: 'Kyoto', password: 'a' } }],
      subpages: [
        {
          name: 'Clients',
          password: 'b',
          sections: [{ title: 'S', albums: [{ 'album-2': { password: 'c' } }] }],
        },
      ],
    };
    const out = await hashPasswordKeys(gallery, KEY, null);
    const albums = out.albums as Array<Record<string, { title: string; password: string }>>;
    const section = (
      out.subpages[0].sections![0].albums as Array<Record<string, { password: string }>>
    )[0];
    expect(albums[0]['album-1'].password).toMatch(/^scrypt:/);
    expect(albums[0]['album-1'].title).toBe('Kyoto');
    expect(out.subpages[0].password).toMatch(/^scrypt:/);
    expect(section['album-2'].password).toMatch(/^scrypt:/);
    // The input is not mutated.
    expect(gallery.subpages[0].password).toBe('b');
  });

  it('reuses a hash from the file on disk, wherever the entry moved to', async () => {
    const onDisk = { subpages: [{ name: 'A', password: await generateScryptHash('b') }] };
    const out = await hashPasswordKeys(
      { subpages: [{ name: 'Renamed', password: 'b' }] },
      KEY,
      onDisk,
    );
    expect(out.subpages[0].password).toBe(onDisk.subpages[0].password);
  });
});

describe('hashFrontmatterPassword', () => {
  const entry = (pw: string) =>
    `---\ntitle: "Price: $5 & more"\npassword: ${pw}\ndraft: true\n---\n\nBody with password: not-this\n`;

  it('hashes only the frontmatter line and leaves the rest byte for byte', async () => {
    const out = await hashFrontmatterPassword(entry('secret'), null);
    const line = out.match(/^password: "(scrypt:[^"]+)"$/m)!;
    expect(await verifyScrypt('secret', line[1])).toBe(true);
    expect(out).toContain('title: "Price: $5 & more"');
    expect(out).toContain('Body with password: not-this');
  });

  it('understands quoted values and keeps the previous hash when unchanged', async () => {
    const previous = await hashFrontmatterPassword(entry('secret'), null);
    const again = await hashFrontmatterPassword(entry('"secret"'), previous);
    expect(again).toBe(previous);
  });

  it('leaves an entry without a password untouched', async () => {
    const md = '---\ntitle: Open\n---\n\nText\n';
    expect(await hashFrontmatterPassword(md, null)).toBe(md);
  });
});
