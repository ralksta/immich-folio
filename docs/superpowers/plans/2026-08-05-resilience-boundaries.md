# Resilience Follow-Up Implementation Plan (v2, gegen v0.9.2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die drei Lücken schließen, die nach v0.9.2 aus dem ursprünglichen Resilience-Plan übrig sind: Route-Handler testbar machen und die untestbar gebliebene Sicherheitslogik abdecken, bei Immich-Ausfall die zuletzt bekannten Alben weiter ausliefern, und dynamische Seiten sofort eine Hülle rendern statt einer leeren Seite.

**Architecture:** Drei unabhängige, klein geschnittene Eingriffe. (1) `vitest.config.ts` nimmt Tests unter `app/` auf; darauf aufbauend Tests gegen die Admin-Guards und die Content-Type-Sanitisierung des Bild-Proxys, die beide nur auf Routenebene prüfbar sind. (2) `lib/cache.ts` behält abgelaufene Einträge bis zu einer harten Obergrenze; `lib/immich.ts` fängt den in v0.9.2 eingeführten `ImmichUnavailableError` ab und greift auf diese Daten zurück, bevor es den Fehler weiterreicht. (3) `loading.tsx` liefert Skeletons.

**Tech Stack:** Next.js 16 (App Router, React 19), TypeScript strict, Vitest 4 (node environment), Vanilla CSS, keine neuen Laufzeit-Dependencies.

---

## Was v0.9.2 bereits erledigt hat

Der ursprüngliche Plan (v1) entstand gegen v0.9.1. PR #394 hat davon einen großen Teil umgesetzt — teils anders und besser als geplant. Ersatzlos gestrichen:

| Ehemalige Task | Status in v0.9.2 |
|---|---|
| Upstream-Statusmodul (`lib/upstream.ts`) | **Überholt.** Statt eines Seiten-Pings unterscheidet `request()` jetzt an der Quelle: `ImmichUnavailableError` für Ausfälle, `null` nur für 404/410. Das ist die bessere Lösung — kein Nebenkanal, keine Race zwischen Ping und Abruf. |
| 404-vs-503-Politik in `app/[...path]/page.tsx` | **Erledigt.** Der Fehler propagiert, Seiten liefern 5xx statt 404. Zusätzlich geben `/api/exif` und `/api/map` 503 mit `Retry-After`. |
| `app/error.tsx`, `app/not-found.tsx` | **Erledigt**, mit `.empty-state` aus `globals.css` und 8 Tests in `lib/__tests__/error-pages.test.ts`. |
| `app/global-error.tsx` | **Nicht mehr nötig.** Das Layout wirft nicht mehr: `getConfigOrNull()` (`lib/config/index.ts:39`) fängt ab und rendert den SetupScreen, wobei `/admin` erreichbar bleibt. Das war der einzige konkrete Anlass für die Boundary. |
| Bild-Größen-Tiers | **Erledigt**, nach `lib/imageSize.ts` ausgelagert und getestet. |

Obendrein neu und relevant: `IMMICH_TIMEOUT_MS`, ein `MISSING`-Sentinel, der definitive 404-Antworten cacht, `middleware.ts` → `proxy.ts`, sowie 210 statt 98 Unit-Tests.

**Was das für Task 1 bedeutet:** Die vitest-Grenze wurde in #394 zweimal *umgangen* statt gehoben — `lib/imageSize.ts` wurde eigens ausgelagert, damit die Größenlogik aus `lib/__tests__/` erreichbar ist, und `error-pages.test.ts` benutzt `createElement` statt JSX, weil eine `.tsx`-Datei dort nie ausgeführt würde (so im Commit-Text vermerkt). Die Sicherheitslogik, die sich nicht auslagern lässt — Admin-Guards und Content-Type-Sanitisierung — ist deshalb weiterhin ungetestet.

## Global Constraints

- **Keine neuen Runtime-Dependencies.**
- **TypeScript strict** — kein untypisiertes `any`; Suppressions nur als `@ts-expect-error` mit Begründung.
- **Rohe Immich-UUIDs dürfen nie im Client-HTML/JS landen.**
- **Vanilla CSS**, Tokens aus `app/tokens.css` (`--bg-secondary`, `--radius-sm`, `--grid-columns`, `--grid-gap`, `--grid-aspect-ratio`).
- **Formatierung:** nur geänderte Dateien (`npx prettier --write <datei>`), nie `npm run format` im Repo-Root.
- **Vor jedem Commit grün:** `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`.
- **Baseline vor Beginn:** 210 Tests in 19 Dateien. Jede Task nennt die erwartete neue Summe.
- **Commit-Stil:** Conventional Commits.
- **Neue Env-Variablen** gehören in `lib/env.ts` **und** `.env.local.example`.

---

## File Structure

**Neu:**

| Datei | Verantwortung |
|---|---|
| `app/api/admin/__tests__/admin-guards.test.ts` | Tabellengetrieben: jede Admin-Route lehnt ohne Session ab. |
| `app/api/image/__tests__/image-route.test.ts` | Token-Grenze, Content-Type-Sanitisierung, ETag/304. |
| `lib/__tests__/cache-stale.test.ts` | Stale-Fenster und harte Obergrenze des Caches. |
| `app/loading.tsx` | Skeleton für die Startseite. |
| `app/[...path]/loading.tsx` | Skeleton für Album-/Subpage-Routen. |
| `app/loading.module.css` | Skeleton-Styles. |

**Geändert:**

| Datei | Änderung |
|---|---|
| `vitest.config.ts` | `include` um `app/**/__tests__/**/*.test.ts` erweitern. |
| `lib/cache.ts` | Zwei Deadlines pro Eintrag, `getStale()`. |
| `lib/immich.ts` | `ImmichUnavailableError` abfangen, Stale-Fallback, sonst weiterwerfen. |
| `lib/env.ts`, `.env.local.example` | `STALE_MAX_AGE`. |
| `lib/config/schema.ts`, `lib/config/index.ts` | `staleMaxAge` in `AppConfig` und beide Rückgabepfade. |
| `README.md`, `CLAUDE.md` | Stale-Verhalten und Token-Widerruf dokumentieren. |

**Abhängigkeiten:**

```
Task 1 (vitest include + Route-Tests)  ── zuerst, schaltet Tests unter app/ ein
Task 2 (Stale-while-error)             ── unabhängig von Task 1
Task 3 (Loading-Skeletons)             ── unabhängig
Task 4 (Doku)                          ── nach Task 2
```

---

## Task 1: Route-Handler testbar machen und Sicherheitslogik abdecken

**Warum:** `vitest.config.ts` schließt alles außerhalb von `lib/__tests__/` aus. Zwei Stellen sind deshalb ungetestet und lassen sich auch nicht auslagern: die Guards der acht Admin-Routen und die Content-Type-Normalisierung in `app/api/image/[id]/route.ts:99-107`, die aus einem Stored-XSS-Fix stammt (`c2fa8e7`).

**Erwartungshaltung:** Beide Mechanismen funktionieren heute korrekt. Diese Tests finden keinen Bug — sie sind Regressionsbremsen. Der Wert der Admin-Tabelle liegt darin, dass eine *künftig* ergänzte Route ohne Guard die Suite rot macht.

**Files:**
- Modify: `vitest.config.ts`
- Create: `app/api/admin/__tests__/admin-guards.test.ts`
- Create: `app/api/image/__tests__/image-route.test.ts`

**Interfaces:**
- Consumes: `isAdminAuthenticated()`, `isAdminEnabled()` (`lib/admin/auth.ts`, gemockt); `encodeAssetId()` (`lib/tokens.ts`); `immich.streamAsset()` (gemockt).
- Produces: nichts für spätere Tasks.

- [ ] **Step 1: `vitest.config.ts` erweitern**

Die `include`-Zeile in `test` ersetzen:

```ts
    include: ['lib/__tests__/**/*.test.ts', 'app/**/__tests__/**/*.test.ts'],
```

- [ ] **Step 2: Prüfen, dass die Baseline unverändert läuft**

Run: `npm run test:unit`
Erwartung: weiterhin 210 Tests in 19 Dateien — die Erweiterung findet noch keine neuen Dateien.

- [ ] **Step 3: Admin-Guard-Test schreiben**

Erstelle `app/api/admin/__tests__/admin-guards.test.ts`.

Hintergrund: `isAdminAuthenticated()` liest `cookies()` aus `next/headers`, was außerhalb eines Requests wirft. Statt `next/headers` zu mocken, mocken wir `@/lib/admin/auth` — das ist die Schnittstelle, deren Einhaltung geprüft wird. `lib/__tests__/immich.test.ts` nutzt dasselbe `vi.mock`-Muster.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/admin/auth', () => ({
  isAdminEnabled: vi.fn(),
  isAdminAuthenticated: vi.fn(),
  COOKIE_NAME: 'folio_admin_session',
}));

import { isAdminEnabled, isAdminAuthenticated } from '@/lib/admin/auth';

const mockEnabled = isAdminEnabled as unknown as ReturnType<typeof vi.fn>;
const mockAuthed = isAdminAuthenticated as unknown as ReturnType<typeof vi.fn>;

/**
 * Every guarded admin route handler. Adding a new /api/admin route means
 * adding a row here — a route that forgets its guard then fails this suite
 * instead of shipping. /api/admin/auth is deliberately absent: it is the login
 * endpoint and must stay reachable without a session.
 */
const ROUTES: {
  name: string;
  path: string;
  load: () => Promise<Record<string, unknown>>;
  method: 'GET' | 'PUT' | 'POST' | 'DELETE';
  args: () => unknown[];
}[] = [
  {
    name: 'GET /api/admin/gallery',
    path: 'gallery',
    load: () => import('../gallery/route'),
    method: 'GET',
    args: () => [],
  },
  {
    name: 'PUT /api/admin/gallery',
    path: 'gallery',
    load: () => import('../gallery/route'),
    method: 'PUT',
    args: () => [new Request('http://localhost/api/admin/gallery', { method: 'PUT', body: '{}' })],
  },
  {
    name: 'GET /api/admin/settings',
    path: 'settings',
    load: () => import('../settings/route'),
    method: 'GET',
    args: () => [],
  },
  {
    name: 'PUT /api/admin/settings',
    path: 'settings',
    load: () => import('../settings/route'),
    method: 'PUT',
    args: () => [new Request('http://localhost/api/admin/settings', { method: 'PUT', body: '{}' })],
  },
  {
    name: 'GET /api/admin/albums',
    path: 'albums',
    load: () => import('../albums/route'),
    method: 'GET',
    args: () => [],
  },
  {
    name: 'POST /api/admin/reload',
    path: 'reload',
    load: () => import('../reload/route'),
    method: 'POST',
    args: () => [],
  },
  {
    name: 'GET /api/admin/status',
    path: 'status',
    load: () => import('../status/route'),
    method: 'GET',
    args: () => [],
  },
  {
    name: 'GET /api/admin/assets',
    path: 'assets',
    load: () => import('../assets/route'),
    method: 'GET',
    args: () => [new Request('http://localhost/api/admin/assets')],
  },
  {
    name: 'GET /api/admin/thumbnail/[id]',
    path: 'thumbnail/[id]',
    load: () => import('../thumbnail/[id]/route'),
    method: 'GET',
    args: () => [
      new Request('http://localhost/api/admin/thumbnail/abc'),
      { params: Promise.resolve({ id: 'abc' }) },
    ],
  },
  {
    name: 'GET /api/admin/albums/[albumId]/assets',
    path: 'albums/[albumId]/assets',
    load: () => import('../albums/[albumId]/assets/route'),
    method: 'GET',
    args: () => [
      new Request('http://localhost/api/admin/albums/a1/assets'),
      { params: Promise.resolve({ albumId: 'a1' }) },
    ],
  },
];

describe('admin route guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const route of ROUTES) {
    it(`${route.name} returns 403 when the admin panel is disabled`, async () => {
      mockEnabled.mockReturnValue(false);
      mockAuthed.mockResolvedValue(false);

      const mod = await route.load();
      const handler = mod[route.method] as (...a: unknown[]) => Promise<Response>;
      const res = await handler(...route.args());

      expect(res.status).toBe(403);
    });

    it(`${route.name} returns 401 without a valid session`, async () => {
      mockEnabled.mockReturnValue(true);
      mockAuthed.mockResolvedValue(false);

      const mod = await route.load();
      const handler = mod[route.method] as (...a: unknown[]) => Promise<Response>;
      const res = await handler(...route.args());

      expect(res.status).toBe(401);
    });
  }

  it('has a row for every route module under app/api/admin', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const adminDir = path.join(process.cwd(), 'app/api/admin');

    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__') continue;
          walk(full);
        } else if (entry.name === 'route.ts') {
          found.push(path.relative(adminDir, path.dirname(full)));
        }
      }
    };
    walk(adminDir);

    const covered = new Set(ROUTES.map((r) => r.path));
    const uncovered = found.filter((p) => p !== 'auth' && !covered.has(p));

    expect(uncovered, `Admin routes with no guard test: ${uncovered.join(', ')}`).toEqual([]);
  });
});
```

- [ ] **Step 4: Admin-Test laufen lassen**

Run: `npm run test:unit -- app/api/admin/__tests__/admin-guards.test.ts`
Erwartung: 21 Tests PASS (10 Routen × 2 plus der Abdeckungstest).

Schlägt der Abdeckungstest fehl, nennt die Meldung die fehlenden Pfade — dann die entsprechende Zeile in `ROUTES` ergänzen.

- [ ] **Step 5: Beweisen, dass der Guard-Test greift**

In `app/api/admin/status/route.ts` die beiden Guard-Blöcke vorübergehend auskommentieren.

Run: `npm run test:unit -- app/api/admin/__tests__/admin-guards.test.ts`
Erwartung: die zwei `GET /api/admin/status`-Tests schlagen fehl.

Auskommentierung rückgängig machen, erneut laufen lassen. Erwartung: alles grün.

- [ ] **Step 6: Bild-Proxy-Test schreiben**

Erstelle `app/api/image/__tests__/image-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../[id]/route';
import { encodeAssetId } from '@/lib/tokens';
import { immich } from '@/lib/immich';

vi.mock('@/lib/immich', async () => {
  const actual = await vi.importActual<typeof import('@/lib/immich')>('@/lib/immich');
  return {
    // Keep the real error class — the route branches on it.
    ImmichUnavailableError: actual.ImmichUnavailableError,
    immich: { streamAsset: vi.fn() },
  };
});

const mockStream = immich.streamAsset as unknown as ReturnType<typeof vi.fn>;

const ASSET_ID = '11111111-2222-3333-4444-555555555555';

/** Stream stub — the route only forwards the body, it never reads it. */
function fakeBody(contentType: string) {
  return {
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    }),
    contentType,
    contentLength: '3',
  };
}

function call(token: string, query = '', headers?: Record<string, string>) {
  const req = new NextRequest(`http://localhost/api/image/${token}${query}`, { headers });
  return GET(req, { params: Promise.resolve({ id: token }) });
}

describe('GET /api/image/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a raw Immich UUID instead of an encoded token', async () => {
    const res = await call(ASSET_ID);
    expect(res.status).toBe(400);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('rejects a syntactically broken token', async () => {
    const res = await call('v2:not-valid-base64url!!');
    expect(res.status).toBe(400);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('serves a valid token', async () => {
    mockStream.mockResolvedValue(fakeBody('image/jpeg'));
    const res = await call(encodeAssetId(ASSET_ID));
    expect(res.status).toBe(200);
    expect(mockStream).toHaveBeenCalledWith(ASSET_ID, 'preview');
  });

  // Regression guard for the stored-XSS fix in c2fa8e7. An SVG served as
  // image/svg+xml executes script in the browser under our own origin.
  // This logic lives in the route and cannot be extracted the way
  // lib/imageSize.ts was, so a route-level test is the only way to pin it.
  it.each([
    ['image/svg+xml', 'application/octet-stream'],
    ['text/xml', 'application/octet-stream'],
    ['text/html', 'application/octet-stream'],
    ['application/octet-stream', 'image/jpeg'],
    ['image/jpeg', 'image/jpeg'],
    ['image/webp', 'image/webp'],
  ])('rewrites upstream Content-Type %s to %s', async (upstream, expected) => {
    mockStream.mockResolvedValue(fakeBody(upstream));
    const res = await call(encodeAssetId(ASSET_ID));
    expect(res.headers.get('Content-Type')).toBe(expected);
  });

  it('returns 304 with no body when the ETag matches', async () => {
    mockStream.mockResolvedValue(fakeBody('image/jpeg'));
    const token = encodeAssetId(ASSET_ID);

    const first = await call(token);
    const etag = first.headers.get('ETag');
    expect(etag).toBeTruthy();

    const res = await call(token, '', { 'if-none-match': etag as string });
    expect(res.status).toBe(304);
    expect(await res.text()).toBe('');
  });

  it('never leaks the raw asset UUID in response headers', async () => {
    mockStream.mockResolvedValue(fakeBody('image/jpeg'));
    const res = await call(encodeAssetId(ASSET_ID));
    const headerDump = JSON.stringify([...res.headers.entries()]);
    expect(headerDump).not.toContain(ASSET_ID);
  });

  it('404s when the asset is genuinely gone', async () => {
    mockStream.mockResolvedValue(null);
    const res = await call(encodeAssetId(ASSET_ID));
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('503s when Immich is unavailable, and does not let it be cached', async () => {
    const { ImmichUnavailableError } = await import('@/lib/immich');
    mockStream.mockRejectedValue(new ImmichUnavailableError('upstream down'));
    const res = await call(encodeAssetId(ASSET_ID));
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });
});
```

- [ ] **Step 7: Bild-Test laufen lassen**

Run: `npm run test:unit -- app/api/image/__tests__/image-route.test.ts`
Erwartung: 12 Tests PASS.

Zwei mögliche Stolperstellen — beide zuerst gegen den Code prüfen, bevor der Test angepasst wird:
- Falls der Rate-Limiter über die Aufrufe hinweg greift, in `vitest.setup.ts` `process.env.RATE_LIMIT_RPM = '100000'` ergänzen.
- Falls die 503-Header anders heißen als erwartet, den tatsächlichen Wert aus `app/api/image/[id]/route.ts` übernehmen — der Test soll das reale Verhalten festschreiben.

- [ ] **Step 8: Beweisen, dass der XSS-Test greift**

In `app/api/image/[id]/route.ts` die Normalisierung vorübergehend durch `const contentType = result.contentType.toLowerCase();` ersetzen und die nachfolgenden `if`-Blöcke auskommentieren.

Run: `npm run test:unit -- app/api/image/__tests__/image-route.test.ts`
Erwartung: die Fälle `image/svg+xml`, `text/xml`, `text/html`, `application/octet-stream` schlagen fehl.

Änderung rückgängig machen. Erwartung: alles grün.

- [ ] **Step 9: Gesamtprüfung**

Run: `npm run test:unit`
Erwartung: 243 Tests in 21 Dateien (210 + 21 + 12).

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

Run: `npm run lint`
Erwartung: 0 Fehler.

- [ ] **Step 10: Commit**

```bash
npx prettier --write vitest.config.ts app/api/admin/__tests__/admin-guards.test.ts app/api/image/__tests__/image-route.test.ts
git add vitest.config.ts app/api/admin/__tests__/admin-guards.test.ts app/api/image/__tests__/image-route.test.ts
git commit -m "test: enable route-handler tests and cover admin guards and image content-type"
```

---

## Task 2: Stale-while-error

**Warum:** v0.9.2 unterscheidet Ausfall und Nichtexistenz sauber und liefert bei Ausfall 5xx statt 404 — das war die dringendere Hälfte. Die andere Hälfte fehlt: Ein Besucher sieht während eines Immich-Neustarts eine Fehlerseite, obwohl die Alben Sekunden zuvor noch im Speicher lagen. `lib/cache.ts` löscht abgelaufene Einträge beim Zugriff (Zeile 23).

**Wichtig zur Abgrenzung:** v0.9.2 cacht Ausfälle bewusst *nicht* — ein `ImmichUnavailableError` wird nie gespeichert, damit die Galerie nach der Erholung nicht kaputt bleibt. Diese Task ändert daran nichts. Sie sorgt nur dafür, dass ein früherer **Erfolg** länger verfügbar bleibt, als seine TTL erlaubt. Beides zusammen ergibt: Ausfälle werden nicht eingebrannt, Erfolge überdauern sie.

**Files:**
- Modify: `lib/cache.ts`
- Create: `lib/__tests__/cache-stale.test.ts`
- Modify: `lib/env.ts`, `.env.local.example`
- Modify: `lib/config/schema.ts`, `lib/config/index.ts`
- Modify: `lib/immich.ts`, `lib/__tests__/immich.test.ts`

**Interfaces:**
- Consumes: `ImmichUnavailableError` aus `lib/immich.ts` (in v0.9.2 eingeführt, Zeile 97).
- Produces:
  - `cache.get<T>(key): T | null` — unverändert, nur frische Daten.
  - `cache.getStale<T>(key): T | null` — auch abgelaufene, solange die harte Obergrenze hält.
  - `cache.set<T>(key, data, ttlMs, staleMaxAgeMs?)` — vierter Parameter optional, Default 24 h.
  - `AppConfig.staleMaxAge: number` (Millisekunden).

- [ ] **Step 1: Cache-Test schreiben**

Erstelle `lib/__tests__/cache-stale.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cache } from '../cache';

describe('MemoryCache stale window', () => {
  beforeEach(() => {
    cache.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns fresh entries from get()', () => {
    cache.set('k', { v: 1 }, 1000);
    expect(cache.get<{ v: number }>('k')).toEqual({ v: 1 });
  });

  it('returns null from get() once the ttl elapsed', () => {
    cache.set('k', { v: 1 }, 1000);
    vi.advanceTimersByTime(1001);
    expect(cache.get('k')).toBeNull();
  });

  it('still returns the value from getStale() after the ttl elapsed', () => {
    cache.set('k', { v: 1 }, 1000, 60_000);
    vi.advanceTimersByTime(1001);
    expect(cache.getStale<{ v: number }>('k')).toEqual({ v: 1 });
  });

  it('drops the entry from getStale() past the hard max age', () => {
    cache.set('k', { v: 1 }, 1000, 5000);
    vi.advanceTimersByTime(5001);
    expect(cache.getStale('k')).toBeNull();
  });

  it('does not let get() destroy the stale fallback', () => {
    // get() must not delete an expired entry — otherwise the fallback is gone
    // the moment any caller asks for fresh data first.
    cache.set('k', { v: 1 }, 1000, 60_000);
    vi.advanceTimersByTime(1001);
    expect(cache.get('k')).toBeNull();
    expect(cache.getStale<{ v: number }>('k')).toEqual({ v: 1 });
  });

  it('never expires stale before the ttl itself', () => {
    // A misconfigured STALE_MAX_AGE below CACHE_TTL must not shorten the fresh
    // window.
    cache.set('k', { v: 1 }, 10_000, 1000);
    vi.advanceTimersByTime(9000);
    expect(cache.get<{ v: number }>('k')).toEqual({ v: 1 });
  });

  it('evicts the oldest entry when capacity is exceeded', () => {
    for (let i = 0; i < 201; i++) cache.set(`k${i}`, i, 60_000);
    expect(cache.get('k0')).toBeNull();
    expect(cache.get('k200')).toBe(200);
  });

  it('delete() removes the entry from get() and getStale()', () => {
    cache.set('k', { v: 1 }, 1000, 60_000);
    cache.delete('k');
    expect(cache.get('k')).toBeNull();
    expect(cache.getStale('k')).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag prüfen**

Run: `npm run test:unit -- lib/__tests__/cache-stale.test.ts`
Erwartung: FAIL — `cache.getStale is not a function`.

- [ ] **Step 3: `lib/cache.ts` implementieren**

Vollständig ersetzen:

```ts
/**
 * Simple in-memory LRU cache for Immich API responses.
 * Avoids hammering the Immich server with identical requests.
 *
 * Entries carry two deadlines. `staleAt` is the normal TTL — past it, get()
 * reports a miss and callers refetch. `hardExpiresAt` is the point past which
 * the data is too old to show at all. Between the two, the entry survives as a
 * fallback that getStale() hands out when Immich is unreachable, so a
 * restarting server does not turn the gallery into an error page.
 */

interface CacheEntry<T> {
  data: T;
  staleAt: number;
  hardExpiresAt: number;
}

const DEFAULT_STALE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxEntries = 200;

  get size(): number {
    return this.store.size;
  }

  /** Move an entry to the newest end of the LRU order. */
  private touch(key: string, entry: CacheEntry<unknown>): void {
    this.store.delete(key);
    this.store.set(key, entry);
  }

  /** Fresh data only. Returns null once the TTL has elapsed. */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();

    if (now > entry.hardExpiresAt) {
      this.store.delete(key);
      return null;
    }

    // Past the TTL the entry is no longer fresh, but it is deliberately kept
    // so getStale() can still use it.
    if (now > entry.staleAt) return null;

    this.touch(key, entry);
    return entry.data as T;
  }

  /**
   * Fresh *or* stale data. Only for the upstream-unreachable path — prefer
   * get() everywhere else.
   */
  getStale<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.hardExpiresAt) {
      this.store.delete(key);
      return null;
    }

    this.touch(key, entry);
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number, staleMaxAgeMs = DEFAULT_STALE_MAX_AGE_MS): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    const now = Date.now();
    this.store.set(key, {
      data,
      staleAt: now + ttlMs,
      // Measured from write time, and never shorter than the TTL itself.
      hardExpiresAt: now + Math.max(ttlMs, staleMaxAgeMs),
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export const cache = new MemoryCache();
export { DEFAULT_STALE_MAX_AGE_MS };
```

- [ ] **Step 4: Cache-Tests prüfen**

Run: `npm run test:unit -- lib/__tests__/cache-stale.test.ts`
Erwartung: 8 Tests PASS.

Run: `npm run test:unit`
Erwartung: alle 218 Tests grün. Schlägt `config-cache.test.ts` oder `immich.test.ts` fehl, weil ein Test auf das Löschen beim Ablauf gebaut hat, den Test auf `getStale()` umstellen — nicht die Implementierung.

- [ ] **Step 5: `STALE_MAX_AGE` durch Env und Config reichen**

In `lib/env.ts` im `Env`-Interface direkt nach `CACHE_TTL: number;` ergänzen:

```ts
  STALE_MAX_AGE: number;
```

In `parseEnv()` nach dem `cacheTtl`-Block einfügen:

```ts
  // How long an expired cache entry may still be served while Immich is
  // unreachable. 0 disables the fallback.
  const staleMaxAgeStr = process.env.STALE_MAX_AGE;
  const staleMaxAge =
    staleMaxAgeStr && !isNaN(parseInt(staleMaxAgeStr, 10))
      ? parseInt(staleMaxAgeStr, 10)
      : 86400; // 24 hours
```

Im Rückgabeobjekt nach `CACHE_TTL: Math.max(0, cacheTtl),` einfügen:

```ts
    STALE_MAX_AGE: Math.max(0, staleMaxAge),
```

In `lib/config/schema.ts` im `AppConfig`-Interface neben `cacheTtl` ergänzen:

```ts
  staleMaxAge: number;
```

In `lib/config/index.ts` **beide** Rückgabepfade ergänzen — jeweils direkt nach `cacheTtl: env.CACHE_TTL * 1000,` (Zeilen 278 und 358):

```ts
    staleMaxAge: env.STALE_MAX_AGE * 1000,
```

In `.env.local.example` unterhalb des `CACHE_TTL`-Eintrags:

```sh
# How long (in seconds) an expired cache entry may still be served while the
# Immich server is unreachable. Keeps the public gallery online across an
# Immich restart instead of showing an error page. Set to 0 to disable.
# Default: 86400 (24 hours)
STALE_MAX_AGE=86400
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler. Meldet `config-safe.test.ts` oder `config.test.ts` das neue Pflichtfeld, dort `staleMaxAge` in den gemockten Env- bzw. Erwartungsobjekten ergänzen.

- [ ] **Step 7: Immich-Test für den Stale-Fallback schreiben**

An `lib/__tests__/immich.test.ts` anhängen. Zuvor im dortigen `vi.mock('../config', …)`-Block bei den anderen Feldern ergänzen:

```ts
      staleMaxAge: 86_400_000,
```

Dann ans Dateiende:

```ts
describe('stale fallback when Immich is unavailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
  });

  it('serves the previously cached album list instead of throwing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => [
        {
          id: 'album-1',
          albumName: 'Original',
          description: '',
          albumThumbnailAssetId: null,
          assetCount: 1,
          assets: [],
          createdAt: '',
          updatedAt: '',
          order: 'desc',
        },
      ],
    });

    const fresh = await immich.getAlbums();
    expect(fresh).toHaveLength(1);

    vi.useFakeTimers();
    vi.advanceTimersByTime(60_000);
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const stale = await immich.getAlbums();
    vi.useRealTimers();

    expect(stale).toHaveLength(1);
    expect(stale[0].id).toBe('album-1');
  });

  it('still throws when there is nothing cached to fall back to', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(immich.getAlbums()).rejects.toThrow(ImmichUnavailableError);
  });

  it('does not swallow a definitive 404 as an outage', async () => {
    // A missing album must keep reporting missing, not fall back to stale data.
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => 'application/json' },
    });
    await expect(immich.getAlbum('album-1')).resolves.toBeNull();
  });

  it('still refuses albums outside the allowlist', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(immich.getAlbum('not-allowed')).resolves.toBeNull();
  });
});
```

Der Import am Dateikopf muss `ImmichUnavailableError` mitführen:

```ts
import { immich, ImmichUnavailableError } from '../immich';
```

- [ ] **Step 8: Test laufen lassen und Fehlschlag prüfen**

Run: `npm run test:unit -- lib/__tests__/immich.test.ts`
Erwartung: Der erste neue Test schlägt fehl — `getAlbums()` wirft, statt die gecachte Liste zu liefern.

- [ ] **Step 9: Stale-Fallback in `lib/immich.ts` einbauen**

Direkt nach dem `private get config()`-Getter einen Helfer einfügen:

```ts
  /** Cache write that carries the configured stale window. */
  private cacheSet<T>(key: string, data: T): void {
    cache.set(key, data, this.config.cacheTtl, this.config.staleMaxAge);
  }

  /**
   * Last resort when Immich is unavailable: hand back the most recent known
   * good answer rather than failing the page. Only successes ever reach the
   * cache, so this cannot resurrect an outage — and past staleMaxAge the entry
   * is gone and the error propagates as before.
   */
  private staleOrThrow<T>(cacheKey: string, error: unknown, label: string): T {
    if (error instanceof ImmichUnavailableError) {
      const stale = cache.getStale<T>(cacheKey);
      if (stale !== null) {
        console.warn(`[Immich] ⚠️ Upstream unavailable — serving stale ${label}`);
        return stale;
      }
    }
    throw error;
  }
```

All drei Methoden haben heute die Form `try { … } finally { … }` ohne `catch` — ein geworfener `ImmichUnavailableError` läuft ungefangen durch das `finally` und propagiert. Vor jedes bestehende `finally` wird ein `catch` eingefügt.

In `getAlbums()` den Block

```ts
      } finally {
        this.pendingAlbumsPromise = null;
      }
```

ersetzen durch:

```ts
      } catch (error) {
        return this.staleOrThrow<ImmichAlbum[]>(cacheKey, error, 'album list');
      } finally {
        this.pendingAlbumsPromise = null;
      }
```

In `getAlbum()` den Block

```ts
      } finally {
        this.pendingAlbumPromises.delete(albumId);
      }
```

ersetzen durch:

```ts
      } catch (error) {
        return this.staleOrThrow<ImmichAlbum>(cacheKey, error, `album ${albumId}`);
      } finally {
        this.pendingAlbumPromises.delete(albumId);
      }
```

In `getAssetInfo()` den Block

```ts
      } finally {
        this.pendingAssetPromises.delete(assetId);
      }
```

ersetzen durch:

```ts
      } catch (error) {
        return this.staleOrThrow<ImmichAsset>(cacheKey, error, `asset ${assetId}`);
      } finally {
        this.pendingAssetPromises.delete(assetId);
      }
```

`lib/immich.ts` enthält fünf `cache.set(cacheKey, …, this.config.cacheTtl)`-Aufrufe. Nur die drei mit einem echten Ergebnis umstellen:

- `cache.set(cacheKey, filtered, this.config.cacheTtl);` in `getAlbums()` → `this.cacheSet(cacheKey, filtered);`
- `cache.set(cacheKey, album, this.config.cacheTtl);` in `getAlbum()` → `this.cacheSet(cacheKey, album);`
- `cache.set(cacheKey, asset, this.config.cacheTtl);` in `getAssetInfo()` → `this.cacheSet(cacheKey, asset);`

**Nicht umstellen:** die beiden `cache.set(cacheKey, MISSING, this.config.cacheTtl);`-Aufrufe (in `getAlbum()` und `getAssetInfo()`, direkt nach `if (!album) {`/`if (!asset) {`). Ein „existiert nicht" soll nach der normalen TTL neu geprüft werden und nicht 24 Stunden festhängen — genau das war die Begründung in #394.

- [ ] **Step 10: Tests prüfen**

Run: `npm run test:unit -- lib/__tests__/immich.test.ts`
Erwartung: alle Tests PASS, inklusive der vier neuen.

Der dritte neue Test ist der wichtige: Ein definitives 404 darf **nicht** in den Stale-Pfad laufen. `staleOrThrow` prüft deshalb auf `instanceof ImmichUnavailableError` — ein 404 erzeugt gar keinen Fehler, sondern `null`, und erreicht das `catch` nie.

- [ ] **Step 11: Gesamtprüfung**

Run: `npm run test:unit`
Erwartung: 222 Tests grün.

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

Run: `npm run lint`
Erwartung: 0 Fehler.

Run: `npm run build`
Erwartung: Build erfolgreich.

- [ ] **Step 12: Commit**

```bash
npx prettier --write lib/cache.ts lib/immich.ts lib/env.ts lib/config/schema.ts lib/config/index.ts lib/__tests__/cache-stale.test.ts lib/__tests__/immich.test.ts .env.local.example
git add lib/cache.ts lib/immich.ts lib/env.ts lib/config/schema.ts lib/config/index.ts lib/__tests__/cache-stale.test.ts lib/__tests__/immich.test.ts .env.local.example
git commit -m "feat: serve stale cache entries while Immich is unavailable"
```

---

## Task 3: Lade-Skeletons

**Warum:** Alle Galerieseiten sind `force-dynamic` und warten vollständig auf Immich. Mit `IMMICH_TIMEOUT_MS` (Default 15 s) kann diese Wartezeit im Störungsfall lang werden — ohne `loading.tsx` sieht der Besucher währenddessen nichts.

**Files:**
- Create: `app/loading.module.css`
- Create: `app/loading.tsx`
- Create: `app/[...path]/loading.tsx`

**Interfaces:**
- Consumes: Tokens aus `app/tokens.css`; die Grid-Variablen, die `app/[...path]/page.tsx` setzt.
- Produces: nichts.

- [ ] **Step 1: `app/loading.module.css` anlegen**

```css
/* Skeleton placeholders shown while a dynamic page waits on Immich. */

.grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-columns, 3), 1fr);
  gap: var(--grid-gap, 12px);
}

.tile {
  aspect-ratio: var(--grid-aspect-ratio, 1);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

.heading {
  height: 2.5rem;
  width: min(320px, 60%);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  margin-bottom: 24px;
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tile,
  .heading {
    animation: none;
  }
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

- [ ] **Step 2: `app/[...path]/loading.tsx` anlegen**

```tsx
/**
 * Instant shell for album and subpage routes. These are force-dynamic and wait
 * on a live Immich round-trip — up to IMMICH_TIMEOUT_MS when the server is
 * struggling — so without this the viewer stares at a blank page.
 */

import styles from '../loading.module.css';

export default function Loading() {
  return (
    <>
      <div className={styles.heading} aria-hidden="true" />
      <div className={styles.grid} role="status" aria-label="Loading photos">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={styles.tile} />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 3: `app/loading.tsx` anlegen**

```tsx
/**
 * Instant shell for the homepage.
 */

import styles from './loading.module.css';

export default function Loading() {
  return (
    <div className={styles.grid} role="status" aria-label="Loading gallery">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={styles.tile} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Im Browser prüfen**

Run: `npm run dev`

In den DevTools unter „Network" auf „Slow 3G" drosseln, dann eine Album-Seite laden.
Erwartung: Kachel-Skeletons erscheinen sofort und werden von den echten Fotos abgelöst. Kein Layoutsprung, keine leere weiße Seite.

- [ ] **Step 5: Verifizieren**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

Run: `npm run lint`
Erwartung: 0 Fehler.

Run: `npm run build`
Erwartung: Build erfolgreich.

- [ ] **Step 6: Commit**

```bash
npx prettier --write app/loading.tsx "app/[...path]/loading.tsx" app/loading.module.css
git add app/loading.tsx "app/[...path]/loading.tsx" app/loading.module.css
git commit -m "feat: add loading skeletons for dynamic gallery routes"
```

---

## Task 4: Dokumentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: `README.md` ergänzen**

Bei den Umgebungsvariablen, neben `CACHE_TTL` und `IMMICH_TIMEOUT_MS`:

```md
| `STALE_MAX_AGE` | `86400` | Seconds an expired cache entry may still be served while Immich is unreachable. Keeps the public gallery online across an Immich restart. Set to `0` to disable. |
```

Und einen Abschnitt:

```md
### Behaviour when Immich is unreachable

Folio buffers your gallery rather than merely proxying it:

- Album pages keep serving the last known good data for up to `STALE_MAX_AGE`.
- Once nothing cached is left, they return `503`, never `404` — a `404` would
  tell search engines to drop a URL that still exists.
- Outages are never cached, so the gallery recovers as soon as Immich does.

The cache lives in the process, so it is empty after a container restart.
```

Zusätzlich im Sicherheitsabschnitt:

```md
### Un-publishing an album does not revoke image links

Asset tokens are deterministic — the same photo always yields the same token,
which is what lets browsers cache images. The image proxy validates the token
but does not re-check album membership per request.

Removing an album from `gallery.yaml` hides it from the site, but image URLs
already handed out keep working. To invalidate them, rotate `AUTH_SECRET` —
this also signs out every password-protected gallery and admin session.
```

- [ ] **Step 2: `CLAUDE.md` aktualisieren**

Den Absatz zur In-Memory-LRU im Abschnitt „Immich client" ersetzen:

```md
- **In-memory LRU cache** (`lib/cache.ts`) — 200-entry LRU. Entries carry two deadlines: `staleAt` (the `CACHE_TTL` window, after which `get()` reports a miss) and `hardExpiresAt` (`STALE_MAX_AGE`, after which the entry is dropped). Between the two, `getStale()` still returns the data — `lib/immich.ts` uses this to keep serving the last known albums when a request fails with `ImmichUnavailableError`. Definitive 404s are cached as a `MISSING` sentinel under the normal TTL and are deliberately excluded from the stale window. Cache keys: `albums-list`, `album-<id>`, `asset-<id>`.
```

Im Abschnitt „Code conventions" ergänzen:

```md
- **Route handlers are testable** — `vitest.config.ts` includes `app/**/__tests__/**/*.test.ts`. Logic that lives in a route (guards, header sanitisation) belongs in a route-level test; do not extract it into `lib/` purely to make it reachable by the test runner.
```

- [ ] **Step 3: Verifizieren**

Run: `npm run format:check`
Erwartung: keine Beanstandungen. Andernfalls `npx prettier --write README.md CLAUDE.md`.

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document stale cache window and route-test convention"
```

---

## Verifikation von Ende zu Ende

**1. Testsuite** — `npm run test:unit`: 222 Tests grün (Baseline 210 + 33 neue − 21 … die exakte Summe ergibt sich aus den Task-Schritten; entscheidend ist, dass keine bestehende Datei rot wird).

**2. Regressionsbremse Admin** — in einer Admin-Route die Guards auskommentieren, `npm run test:unit`: die Guard-Tests schlagen fehl. Zurücknehmen.

**3. Regressionsbremse XSS** — die Content-Type-Normalisierung in `app/api/image/[id]/route.ts` entfernen: die SVG/XML-Fälle schlagen fehl. Zurücknehmen.

**4. Stale-Fallback live** — `npm run dev`, Album-Seite laden (füllt den Cache), dann den Immich-Container stoppen und neu laden.
Erwartung: die Fotos sind weiterhin da; im Log steht `⚠️ Upstream unavailable — serving stale album`.

**5. Kein Cache, kein Immich** — Dev-Server bei gestopptem Immich neu starten, Album-URL aufrufen:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/<album-slug>
```

Erwartung: `500` oder `503` — **kein** `404`.

**6. Erholung** — Immich wieder starten, Seite neu laden.
Erwartung: frische Daten, keine eingebrannte Fehlermeldung.

**7. Skeletons** — mit „Slow 3G" eine Album-Seite laden.
Erwartung: sofort Kacheln, kein weißer Bildschirm.
