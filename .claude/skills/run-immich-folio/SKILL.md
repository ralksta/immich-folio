---
name: run-immich-folio
description: Build, run, and drive immich-folio. Use when asked to start the app, run its dev server, take a screenshot of the portfolio, interact with the running gallery, or test immich-folio.
---

Immich Folio is a Next.js 16 (App Router) photography portfolio that proxies images from an Immich server. Drive it by starting the Next.js dev server and running `.claude/skills/run-immich-folio/driver.mjs` from the repo root — the script uses Playwright's bundled Chromium to navigate the gallery, verify the health endpoint, and capture screenshots.

All paths below are relative to the repo root (`immich-folio/`).

## Prerequisites

Node 20+ and npm are sufficient — no extra system packages needed.

Playwright's Chromium is bundled in `node_modules` but must be installed once:

```bash
npm install
node_modules/.bin/playwright install chromium
```

## Setup

Copy the example files if `content/gallery.yaml` or `.env.local` don't exist yet:

```bash
cp .env.local.example .env.local
# edit .env.local: set IMMICH_API_URL and IMMICH_API_KEY

cp content/gallery.yaml.example content/gallery.yaml
# edit gallery.yaml: paste Immich album UUIDs
```

Required env vars (`.env.local`):

```bash
IMMICH_API_URL=http://your-immich:2283   # base URL of your Immich instance
IMMICH_API_KEY=your-api-key-here         # from Immich → Admin → API Keys
AUTH_SECRET=a-long-random-secret         # required in production; auto-generated in dev
```

## Run (agent path)

Start the dev server in the background, then run the driver:

```bash
npm run dev &> /tmp/immich-folio-dev.log &
echo $! > /tmp/immich-folio.pid

# Wait until the health endpoint answers
for i in {1..30}; do
  curl -sf http://localhost:3001/api/health >/dev/null && echo "Ready" && break
  sleep 1
done
```

> **Port note:** If port 3000 is taken, Next.js auto-assigns the next free port (3001, 3002, …). Check the log: `grep "Local:" /tmp/immich-folio-dev.log`

Run the driver (from repo root):

```bash
node .claude/skills/run-immich-folio/driver.mjs http://localhost:3001
```

Expected output:

```
[1/4] Homepage...
      title: Ralfos Portfolio
      → /tmp/shots/01-homepage.png
[2/4] Subpage: /deutschland
      → /tmp/shots/02-subpage.png
[3/4] Album: /deutschland/an-der-ostsee
      → /tmp/shots/03-album-detail.png
[4/4] API health...
      {"status":"ok","immich":"connected","uptime":...}

✓ All checks passed. Screenshots in /tmp/shots/
```

Screenshots land in `/tmp/shots/`. Pass a different URL as the first argument to target any running instance:

```bash
node .claude/skills/run-immich-folio/driver.mjs http://localhost:3002
```

Stop the dev server:

```bash
kill $(cat /tmp/immich-folio.pid)
# or: pkill -f "next dev"
```

## Run (human path)

```bash
npm run dev   # → http://localhost:3001 (or next free port). Ctrl-C to stop.
```

## Test

```bash
# Unit tests (Vitest, 66 tests across 7 suites — runs in ~250ms)
npm run test:unit

# Type-check
npx tsc --noEmit

# E2E (Playwright, starts its own dev server automatically)
npm run test:e2e
```

---

## Gotchas

- **Port auto-selection** — if 3000 is occupied, Next.js picks 3001 silently. The driver defaults to 3001; override with the first argument if needed. Check `grep "Local:" /tmp/immich-folio-dev.log` to find the actual port.

- **Use `page.goto()` not `.click()` for album navigation** — Next.js RSC streaming causes `.click()` + `waitForLoadState('networkidle')` to capture the previous page's DOM before the new route has streamed in. Navigate by href directly.

- **`eval()` console error in dev** — React emits `eval() is not supported in this environment` in dev mode due to the CSP middleware injecting a nonce. This is dev-only noise; production is unaffected. The driver filters it out.

- **`⚠ The "middleware" file convention is deprecated`** — Next.js 16 warns about `middleware.ts` being renamed to `proxy.ts`. Harmless; the app still works.

- **Immich must be reachable** — all pages are `dynamic = 'force-dynamic'` (no SSG). If `IMMICH_API_URL` is unreachable the health endpoint returns `{"immich":"error"}` and album pages return 404. The driver will fail at step 4.

- **`content/gallery.yaml` must have at least one album or subpage** — `getConfig()` throws at startup if the file is empty or has no albums. If you only have the example file, fill in real UUIDs first.

## Troubleshooting

- **`Cannot find package '@playwright/test'`**: Run the driver from the repo root (`immich-folio/`), not from `/tmp` or another directory. `@playwright/test` is in `node_modules/` here.

- **Health returns 404 (returns HTML from a different app)**: Port 3000 is another app. Check the actual port: `grep "Local:" /tmp/immich-folio-dev.log` and pass it to the driver.

- **`EADDRINUSE` on restart**: The previous dev server is still running. `pkill -f "next dev"` before relaunching.

- **`gallery.yaml must define at least one album or subpage`**: Your `content/gallery.yaml` is empty or only has comments. Add at least one real Immich album UUID under `albums:` or `subpages:`.

- **Security warning about `AUTH_SECRET`**: Set `AUTH_SECRET` in `.env.local`. In development the app generates a temporary one per session (cookies break on restart). In production it hard-fails if unset.
