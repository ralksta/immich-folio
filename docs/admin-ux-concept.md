# Admin UX concept

A proposal for reworking the admin panel so it reads as calmly as the portfolio it edits. This document is the plan; the pull request that adds it implements the first stage (shell, overview, visual language) so there is something to look at.

## What is wrong today

Seen on a real install (Studio Modern preset):

- **The header is doing too much.** Seven tabs, a status pill and four buttons share one row. Navigation, global actions and system state compete, and nothing says which of them matters.
- **Red means everything.** The admin inherits the preset accent, and every switched-on card gets a thick accent border. On Studio Modern a settings page is a wall of red frames, so the colour no longer marks the one thing that needs attention.
- **There is no starting point.** `/admin` redirects to the page builder. Unread messages, a failing Immich connection or a missing privacy policy are only found by visiting the right tab.
- **Pages do not share a layout.** Settings has a sidebar, Analytics a centred column, Diagnostics its own grid. Titles, descriptions and actions sit in a different place on each.
- **It does not look like the site.** The portfolio has a clear typographic voice: Archivo for text, IBM Plex Mono in uppercase for labels, square red markers, hairline rules. The admin uses a generic system font and rounded cards.

## Principles

1. **The photographs are the loudest thing.** The chrome is monochrome. Colour is reserved for state.
2. **One accent, few uses.** The preset accent marks exactly three things: the current place (the nav marker), the primary action on a screen, and switches that are on. Everything else is grey. Warnings stay amber and errors red, independent of the preset (as `--admin-warning` already does).
3. **The same frame everywhere.** Every screen has a page header (kicker, title, one sentence, actions on the right) and content below it at one maximum width.
4. **Say what needs attention before it is asked for.** The overview surfaces unread messages, health and gaps; the nav carries counts.
5. **Borrow the site's voice.** Headings and body in the site's own fonts, labels in its caption font, uppercase and letter-spaced, as on the public pages.

## Information architecture

A left sidebar replaces the tab row, grouped by what the owner is doing:

| Group    | Entries                             |
| -------- | ----------------------------------- |
| —        | **Overview** (new)                  |
| Content  | Pages · Journal                     |
| Visitors | Messages (unread count) · Analytics |
| Site     | Settings                            |
| System   | Diagnostics (health dot) · Help     |

Global actions move out of the header into the sidebar foot: _View site_, _Backups_, _Reload_, _Sign out_, plus the version. The header row disappears; each screen's own header takes its place.

### Overview (`/admin`)

The first screen after signing in. Everything on it is a link to where it is acted on:

- **Needs attention**: unread messages, a doctor warning or error, a missing privacy policy. Empty when there is nothing, with a single calm line saying so.
- **At a glance**: pages published, journal entries (drafts), photos on the home page hero, views in the last 7 days.
- **Quick actions**: new journal entry, edit pages, open the site.

## Visual language

| Token   | Today                                   | Proposed                                                                                |
| ------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| Surface | #111 / #1a1a1a cards with 12px radius   | #0c0c0c canvas, #141414 panels, 4px radius                                              |
| Borders | 1px #2e2e2e, 2px accent on active cards | 1px hairline everywhere; active cards keep the hairline, their switch carries the state |
| Type    | system UI font                          | the site's `--font-sans`; labels in `--font-caption`, uppercase, 0.12em tracking        |
| Accent  | on borders, icons, headings, switches   | nav marker, primary button, on-switches                                                 |
| Density | 36px controls, mixed spacing            | 36px controls, an 8px spacing scale                                                     |

Light mode follows the same rules with inverted surfaces.

## Stages

1. **Shell, overview, visual language** (this PR): sidebar with groups and counts, `/admin` overview, tokens and typography, calmer cards. No screen's behaviour changes.
2. **Page headers**: one `PageHeader` component on every screen; remove the per-screen title variants.
3. **Forms**: one field, switch and dialog pattern (#694); replaces `confirm()` with an inline confirmation.
4. **Page builder** (done): the structure (hero, subpages, standalone albums) as an always-visible list on the left, the selected entry edited in a panel on the right instead of an overlay, with Edit / Live preview in the panel header. Builds on the split in #608.
5. **Mobile**: the sidebar collapses into a sheet; not a priority for how the panel is used today, but the grid should not break.

## Not changing

- The admin stays English (see `docs/gallery-config.md`).
- Folio stays a read-only Immich client; nothing in this plan writes to Immich.
- The live preview in the page builder stays; it is how the owner checks changes.
