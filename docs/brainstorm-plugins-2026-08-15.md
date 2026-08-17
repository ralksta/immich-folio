# Brainstorm: Plugin architecture

_As of 2026-08-15 · Base: v0.11.0 (dev, after #462) · Focus: how third-party code
could dock onto Folio without tearing down the security promise_

This document complements [`ideas.md`](ideas.md), [`brainstorm.md`](brainstorm.md),
[`brainstorm-2026-08-05.md`](brainstorm-2026-08-05.md) and
[`brainstorm-2026-08-15.md`](brainstorm-2026-08-15.md). Plugins appear in none of
those four lists — not even as a one-liner. That makes this not one feature among
many but an architecture decision that comes before the features: whoever makes it
determines which of the ideas listed there still have to be built in core, and
which somebody else can contribute.

Effort sizing as in the predecessors: XS (hours), S (1 day), M (2–5 days), L (weeks).

---

## 0. The seams that already exist

You don't invent a plugin system on a greenfield. Folio already has a joint in
seven places where a fixed list sits today and an extensible one could:

| Seam                                  | Today                                                         | As an extension point |
| ------------------------------------- | ------------------------------------------------------------- | --------------------- |
| `lib/config/theme.ts:99`              | `resolveTheme()` over seven fixed presets                     | theme packs           |
| `app/globals.css:2-7`                 | six `@import`s of `app/themes/*.css`                          | ditto — but see A2    |
| `lib/journal.ts:17`                   | `JournalBlock` as a closed union, renderer `switch` from :343 | custom block types    |
| `lib/config/schema.ts:261`            | `SettingsYaml` as a closed interface                          | plugin namespace      |
| `app/api/webhook/route.ts:31`         | three inbound Immich events                                   | **outbound** events   |
| `app/api/analytics/track/route.ts:45` | counters in `analytics.json`                                  | sink adapters         |
| `SettingsEditor.tsx:192-199`          | eight fixed admin sections                                    | UI slots              |

And the two places that are not a seam but a wall: `lib/immich.ts` is a singleton
with a hard-wired Immich client, and `proxy.ts:18` allows `script-src` by nonce
only (`'strict-dynamic'`, no `'unsafe-inline'` fallback). Both matter for judging
the loading models.

---

## A. Four loading models

The real question is not "which extension points" but **"how does foreign code get
into a running instance"**. Everything else follows from that.

### A1. Build-time plugins — **S for the scaffolding, but the wrong audience**

An npm dependency plus a registry file (`folio.plugins.ts`) read at build time. By
far the simplest technically: no sandboxing problem, full type safety, tree
shaking, everything Next.js can do anyway.

**The catch is not technical but demographic.** The audience for a self-hosted
portfolio runs `docker compose pull`. Anyone who builds their own image can
already fork today — for them a plugin system changes little. So build-time
plugins serve exactly the users who need the system least.

**Keep it anyway:** as a documented power-user path and as the basis for the
bundled "first-party" plugins. Just not as _the_ answer.

### A2. Declarative runtime plugins — **S–M, safe, covers more than you'd think**

A directory `content/plugins/<id>/` holding a manifest, CSS, templates and
translation files — **no JavaScript**. Folio reads what is there at startup and
extends lists that are constants today.

What this covers: theme packs, layout variants, EXIF field labels, i18n packs,
grid presets, block types without their own logic.
What it does not: anything that has to compute or talk to the outside.

**The trade-off that deserves naming:** theme CSS is imported statically today
(`app/globals.css:2-7`) and ends up in the build output. A runtime theme pack
therefore needs a second delivery path — either a `<style>` tag in the layout (the
CSP permits it, `style-src` carries `'unsafe-inline'`, `proxy.ts:19`) or an
`/api/theme.css` route. Not a blocker, but it is work you don't see if you only
think "presets are already data".

### A3. Out-of-process plugins — **M, the actual target**

A plugin is its own container with an HTTP contract in both directions: Folio
pushes events out, the plugin may query defined endpoints and optionally returns
HTML fragments for declared UI slots.

```yaml
# docker-compose.override.yml
services:
  folio-print:
    image: ghcr.io/someone/folio-print-orders:1
    environment:
      FOLIO_URL: http://folio:3000
      FOLIO_PLUGIN_TOKEN: ${PRINT_TOKEN}
```

**Why this fits this project:** users already run Compose — a second service is
not a new concept but the existing one. The foreign code never runs in the Folio
process, never sees the Immich API key, cannot read `install.json` and cannot sign
an admin session. And the contract is language-neutral: a plugin written in Python
or Go is just as legitimate.

**Trade-offs:** latency for UI slots (manageable with a timeout and a "render
nothing" fallback); a second auth scheme (plugin token, not the admin session);
and the barrier to entry is higher than "drop in a file".

### A4. In-process JS from `content/plugins/` — **what I argue against**

This is the model everyone thinks of first, because WordPress does it that way.
For Folio it is the one option that voids the project's core promise.

Such a plugin runs in the same Node process as:

- the Immich API key (`lib/env.ts`),
- `AUTH_SECRET`, from which `lib/tokens.ts` derives the asset encryption key,
- the scrypt hash of the admin password from `content/install.json`,
- the signing key for admin sessions (`lib/admin/auth.ts`).

Node has no dependable sandbox for this. `vm` is not one — three lines get you back
out of the context. `worker_threads` separates memory but not the filesystem and
not the network. The Node permission API is process-wide, not per-module. Which
means: the sentence "the Immich server and the API key are never publicly exposed"
would afterwards only be as true as the most careless installed plugin.

On top of that, the CSP: client-side plugin JS would need the nonce from
`proxy.ts`. Whoever hands out the nonce disables `'strict-dynamic'` for that code —
XSS protection and plugin freedom are the same dial turned in two directions.

**If it should happen anyway**, then please under three conditions: installable
only via the admin panel (never auto-loaded from a directory), shown in the admin
with an unmistakable full-access warning, and off by default
(`PLUGINS_ALLOW_CODE=true`).

### Recommendation

**A2 + A3 first, A1 as a documented path, A4 not at all.** That covers what is
likely the largest share of realistic plugin wishes without anyone having to
rewrite the threat model.

---

## B. Manifest and capabilities

One manifest per plugin, read at startup, visible in the admin panel:

```yaml
# content/plugins/print-orders/plugin.yaml
id: print-orders
name: Print Orders
version: 1.2.0
kind: service # service | theme | blocks | locale
endpoint: http://folio-print:8080 # only for kind: service
capabilities:
  - events:album.published
  - events:proofing.submitted
  - ui:album-footer
settings: # generates the admin form
  provider: { type: enum, values: [prodigi, whitewall, saal] }
  markup: { type: number, default: 1.4 }
```

Three rules that should hold from the start, because they cannot be retrofitted
later:

**B1. Capabilities are declared and displayed.** The admin panel states what a
plugin may do — not as fine print but as a list shown before installation. There
is no `config:write` for third-party plugins.

**B2. Assets cross the plugin boundary only as tokens.** The rule from `CLAUDE.md`
— raw asset UUIDs never appear in the client — has to hold for plugins too, or it
is voided through the back door. Plugins receive `encodeAssetId()` tokens; anything
that needs the original needs its own, justified capability.

**B3. Plugin settings live in their own namespace.** `SettingsYaml`
(`lib/config/schema.ts:261`) stays closed; plugins write under `plugins.<id>.*`.
Otherwise the first plugin collides with the next core feature that wants the same
key name.

On distribution: a GitHub topic `immich-folio-plugin` plus a curated `plugins.json`
is entirely enough as a registry. Installation by URL, pinned to a hash — no
package server of our own, no signing scheme in v1.

---

## C. What people would actually plug in

Sorted by presumed demand, not by effort.

### C1. Client business

The strongest driver, because money is attached:

- **Print shop integration** (Prodigi, WhiteWall, Saal) with an "order a print"
  button at the album footer — the classic UI-slot case
- **Proofing selection → ZIP download**, expiring links, per-client download quota
- **Enquiry form** → SMTP, ntfy, Telegram, Discord, Matrix
- **Client login via magic link** instead of a static password gate
- **Invoice trigger** on album release (n8n, Lexoffice, sevDesk)

Note: C1 deliberately overlaps with section A of
[`brainstorm-2026-08-15.md`](brainstorm-2026-08-15.md) — conceived there as a core
feature, here as a plugin. That is precisely the decision this document raises:
expiring client links belong in core (they touch the access check), a print shop
does not (it touches one corner of the UI).

### C2. Reach

- **RSS/JSON feed**, IndexNow ping, extended sitemaps
- **POSSE**: auto-post to Mastodon/Bluesky/Pixelfed on journal publish
- **ActivityPub actor** for the journal — follow instead of subscribe
- **Newsletter** (Listmonk, Buttondown) on a new entry
- **Comments** via Isso, Commento, Giscus
- **Analytics forwarding** to Plausible/Umami/GoatCounter instead of the JSON
  counters (`app/api/analytics/track/route.ts`)

### C3. Craft and presentation

This will be the first real community contribution, because the barrier is lowest:

- **Theme packs** including fonts, grain, frames
- **Layout variants**: diptych/spread, contact sheet, kiosk/TV slideshow
- **EXIF panel extensions**: film simulation, readable lens names, camera badges,
  development recipe
- **Journal block types**: video, map, before/after slider, audio, gear list
- **Swappable map providers** (MapTiler, Thunderforest), GPX tracks, trip mode

### C4. Trust and protection

- **Watermarking in the image proxy**, tier-dependent (only `preview`, never
  `thumbnail`)
- **C2PA credentials**, IPTC preservation on original downloads
- **SSO** via OIDC/Authelia/Tailscale headers instead of per-page passwords
- **Hotlink protection**, per-album download rules

### C5. Operations

- **Source adapters** beyond Immich: local folder, PhotoPrism, Nextcloud, S3. The
  most expensive item on the list — `lib/immich.ts` is a singleton with request
  coalescing and an LRU; cutting an interface out of it is **L**, not M.
- **Static export snapshot** to S3/Netlify as an outage-proof mirror
- **Cache warmer** on cron, health-check ping to Uptime Kuma
- **i18n packs** for the UI strings
- **Auto alt text** via a local Ollama; derive the accent colour from the hero image

---

## D. Where I would cut

An MVP that is useful on its own — even if a second step never comes:

### D1. Outbound events — **S, useful immediately**

`album.published`, `journal.published`, `proofing.submitted`, each with an
HMAC-SHA256 signature over the raw body — a mirror image of the inbound webhook
(`app/api/webhook/route.ts:64`), same mechanics, opposite direction. Target URLs in
`settings.yaml`.

This is the biggest lever per line of code: without any plugin concept at all it
puts newsletters, POSSE, notifications and half the client workflows within reach
of n8n or a shell script. And it is the foundation A3 later builds on, without
having to be taken back.

### D2. Theme packs from `content/themes/` — **S–M, largest visible effect**

Extends `resolveTheme()` (`lib/config/theme.ts:99`) with presets from the content
directory, plus the CSS delivery path from A2. Zero security risk, and it is what
people want to share.

### D3. Plugin namespace in `settings.yaml` — **S**

`plugins.<id>.*` plus an admin form generated from the manifest, so that D1 and D2
are configurable without touching `SettingsEditor` per plugin.

**Order:** D1 → D2 → D3 → A3. Everything beyond that (block types, source adapters,
UI slots) builds on it.

---

## E. What stays open

Three questions this document deliberately does not answer:

1. **Support load.** A plugin system moves bugs into foreign code but not the
   issues. "My gallery is broken" still lands here. That argues for A3 (a plugin
   crash is a container crash, not a 500 in Folio) and against A4.
2. **Versioning the contract.** From plugin number two onwards, every change to
   event payloads or manifest fields is a breaking change. An `apiVersion` in the
   manifest from day one costs nothing and saves a lot later.
3. **Whether there is demand at all.** A plugin system for zero plugins is wasted
   time. D1 is right even if the answer is no — it is a webhook, not an ecosystem.
   That is the actual reason to start there.
