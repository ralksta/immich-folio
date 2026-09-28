import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';

/**
 * Every content editor's route (#601): GET hands out a version, a PUT with a
 * stale `If-Match` is answered 409 with the current version and writes
 * nothing, a matching one saves and returns the new version, and a PUT with no
 * `If-Match` at all — an admin tab from before the upgrade — still saves.
 *
 * Real services on a temp content/ directory; the routes resolve it from
 * process.cwd() at import, so they are imported after cwd is pointed there.
 */

vi.mock('@/lib/admin/auth', () => ({
  isAdminEnabled: vi.fn(() => true),
  isAdminAuthenticated: vi.fn(async () => true),
  COOKIE_NAME: 'folio_admin_session',
}));

vi.mock('@/lib/config', () => ({
  invalidateConfigCache: vi.fn(),
  getConfigOrNull: vi.fn(() => null),
  getConfig: vi.fn(() => ({
    privacy: { enabled: true },
    subpages: [],
    albumPasswords: {},
    lang: 'en',
  })),
  deriveGallery: vi.fn(() => ({ subpages: [] })),
  isPageRef: (e: unknown) => !!e && typeof e === 'object' && 'page' in e,
}));
vi.mock('@/lib/privacy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/privacy')>()),
  processingFacts: vi.fn(() => []),
  starterHeadings: vi.fn(() => ''),
}));
vi.mock('@/lib/admin/pageSlugs', () => ({
  takenPageSlugs: vi.fn(async () => ({ subpages: [], albums: [], journal: [] })),
}));
vi.mock('@/lib/immich', () => ({ immich: { invalidateAll: vi.fn() } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let root: string;
let content: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'folio-conflict-'));
  content = path.join(root, 'content');
  await mkdir(path.join(content, 'journal'), { recursive: true });
  await mkdir(path.join(content, 'pages'), { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.resetModules();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

const req = (method: string, body?: unknown, ifMatch?: string) =>
  new Request('http://localhost/api/admin/x', {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

type Handler = (request: Request, ctx?: never) => Promise<Response>;

interface Case {
  name: string;
  file: string;
  initial: string;
  load: () => Promise<{ GET: Handler; PUT: Handler }>;
  ctx?: unknown;
  body: (tag: string) => unknown;
}

const md = (title: string) => `---\ntitle: "${title}"\n---\n\nBody of ${title}\n`;
const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) });

const cases: Case[] = [
  {
    name: 'settings',
    file: 'settings.yaml',
    initial: 'title: Start\n',
    load: () => import('../settings/route'),
    body: (tag) => ({ settings: { title: tag } }),
  },
  {
    name: 'gallery',
    file: 'gallery.yaml',
    initial: 'hero: []\nalbums: []\nsubpages: []\n',
    load: () => import('../gallery/route'),
    body: (tag) => ({ gallery: { hero: [], albums: [tag], subpages: [] } }),
  },
  {
    name: 'about',
    file: 'about.md',
    initial: '---\nname: Start\n---\n\nHello\n',
    load: () => import('../about/route'),
    body: (tag) => ({ meta: { name: tag }, body: 'Hello' }),
  },
  {
    name: 'privacy',
    file: 'privacy.md',
    initial: 'Start\n',
    load: () => import('../privacy/route'),
    body: (tag) => ({ body: tag }),
  },
  {
    name: 'journal entry',
    file: 'journal/trip.md',
    initial: md('Start'),
    load: () => import('../journal/[slug]/route') as never,
    ctx: slugCtx('trip'),
    body: (tag) => ({ rawMarkdown: md(tag) }),
  },
  {
    name: 'content page',
    file: 'pages/faq.md',
    initial: md('Start'),
    load: () => import('../pages/[slug]/route') as never,
    ctx: slugCtx('faq'),
    body: (tag) => ({ rawMarkdown: md(tag) }),
  },
];

describe.each(cases)('$name route (#601)', ({ file, initial, load, ctx, body }) => {
  const call = (h: Handler, r: Request) => h(r, ctx as never);

  it('GET returns a version and ETag; a matching If-Match saves and returns the next one', async () => {
    await writeFile(path.join(content, file), initial);
    const { GET, PUT } = await load();

    const got = await call(GET, req('GET'));
    const { version } = await got.json();
    expect(typeof version).toBe('string');
    expect(got.headers.get('ETag')).toBe(`"${version}"`);

    const saved = await call(PUT, req('PUT', body('Mine'), `"${version}"`));
    expect(saved.status).toBe(200);
    const data = await saved.json();
    expect(data.version).toMatch(/^[0-9a-f]{32}$/);
    expect(data.version).not.toBe(version);
  });

  it('a stale If-Match gets 409 with the current version and writes nothing', async () => {
    await writeFile(path.join(content, file), initial);
    const { GET, PUT } = await load();
    const { version: stale } = await (await call(GET, req('GET'))).json();

    // Another tab saves in between.
    const other = await call(PUT, req('PUT', body('Theirs'), `"${stale}"`));
    expect(other.status).toBe(200);
    const { version: current } = await other.json();
    const onDisk = await readFile(path.join(content, file), 'utf8');

    const res = await call(PUT, req('PUT', body('Mine'), `"${stale}"`));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data).toMatchObject({ conflict: true, version: current });
    expect(res.headers.get('ETag')).toBe(`"${current}"`);
    await expect(readFile(path.join(content, file), 'utf8')).resolves.toBe(onDisk);

    // "Overwrite anyway" resends with the version the 409 named.
    const forced = await call(PUT, req('PUT', body('Mine'), `"${current}"`));
    expect(forced.status).toBe(200);
  });

  it('a file that is not valid UTF-8 saves with the version GET handed out', async () => {
    // A hand edit in Latin-1: "Über" as 0xDC, which UTF-8 cannot decode. The
    // decoded text re-encodes to other bytes, so a version taken from it never
    // matched the save's check and every save was a 409.
    const latin1 = Buffer.concat([
      Buffer.from(initial),
      Buffer.from('\n# '),
      Buffer.from([0xdc]),
      Buffer.from('ber\n'),
    ]);
    await writeFile(path.join(content, file), latin1);
    const { GET, PUT } = await load();

    const { version } = await (await call(GET, req('GET'))).json();
    const res = await call(PUT, req('PUT', body('Mine'), `"${version}"`));
    expect(res.status).toBe(200);
  });

  it('a PUT without If-Match still saves (older clients)', async () => {
    await writeFile(path.join(content, file), initial);
    const { PUT } = await load();
    const res = await call(PUT, req('PUT', body('Mine')));
    expect(res.status).toBe(200);
    await expect(readFile(path.join(content, file), 'utf8')).resolves.not.toBe(initial);
  });
});

describe('renames (#601)', () => {
  it('a journal rename is checked against the entry it was loaded from', async () => {
    await writeFile(path.join(content, 'journal/trip.md'), md('Start'));
    const { GET, PUT } = await import('../journal/[slug]/route');
    const ctx = slugCtx('trip');
    const { version } = await (await GET(req('GET'), ctx)).json();
    await writeFile(path.join(content, 'journal/trip.md'), md('Hand edit'));

    const res = await PUT(req('PUT', { rawMarkdown: md('Mine'), newSlug: 'voyage' }, version), ctx);
    expect(res.status).toBe(409);
    await expect(readFile(path.join(content, 'journal/trip.md'), 'utf8')).resolves.toBe(
      md('Hand edit'),
    );
    await expect(readFile(path.join(content, 'journal/voyage.md'))).rejects.toThrow();
  });

  it('a page rename reports the gallery.yaml version change it made', async () => {
    await writeFile(path.join(content, 'pages/faq.md'), md('FAQ'));
    await writeFile(path.join(content, 'gallery.yaml'), 'subpages:\n  - page: faq\n');
    const gallery = await import('../gallery/route');
    const { version: galleryBefore } = await (await gallery.GET()).json();
    const { GET, PUT } = await import('../pages/[slug]/route');
    const ctx = slugCtx('faq');
    const { version } = await (await GET(req('GET'), ctx)).json();

    const res = await PUT(req('PUT', { rawMarkdown: md('FAQ'), newSlug: 'help' }, version), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.menuRenamed).toBe(true);
    expect(data.galleryVersion.from).toBe(galleryBefore);
    const { version: galleryAfter } = await (await gallery.GET()).json();
    expect(data.galleryVersion.to).toBe(galleryAfter);
  });
});
