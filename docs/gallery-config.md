# Gallery Configuration

The site is configured in two files in `content/`, and this guide is split to match:

| File            | Contains                                                                     |
| --------------- | ---------------------------------------------------------------------------- |
| `gallery.yaml`  | **Structure** — hero assets, albums, subpages, sections, per-album settings  |
| `settings.yaml` | **Behaviour and identity** — title, theme, grid defaults, footer, legal, SEO |

Copy the examples to get started:

```bash
cp content/gallery.yaml.example content/gallery.yaml
cp content/settings.yaml.example content/settings.yaml
```

`settings.yaml` is optional — without it, everything falls back to defaults.

> [!TIP]
> Prefer a visual interface? Enable the **[Admin Panel](admin-panel.md)** by setting `ADMIN_PASSWORD` in your environment. It provides a drag-and-drop page builder that writes to these same YAML files automatically.

**Guides:** [Gallery structure](gallery-config.md) (this page) · [Site settings](site-settings.md) · [Gallery features](gallery-features.md) · [System & security](security.md)

`content/gallery.yaml` holds the **structure** of the site: hero assets, albums, subpages and sections, per-album settings and content pages.

**Contents:**

- [Hero Images](#hero-images)
- [Standalone Albums](#standalone-albums)
- [Subpages & Categories](#subpages)
- [Per-Album Options](#per-album-options)
- [Photo Order Within an Album](#photo-order-within-an-album)
- [Content Pages](#content-pages)
- [Finding UUIDs](#finding-uuids)

## Hero Images

Single image or crossfade carousel on the homepage:

```yaml
# Single hero image
hero: 00000000-0000-0000-0000-000000000000

# Carousel (crossfade between multiple images)
hero:
  - 00000000-0000-0000-0000-000000000000
  - 11111111-1111-1111-1111-111111111111
  - 22222222-2222-2222-2222-222222222222
```

## Standalone Albums

Albums shown directly on the homepage as cards.

> [!NOTE]
> The thumbnail image for each album grid card is automatically synced with the explicit **\"Cover Image\"** you select for that album inside the Immich Web UI.

```yaml
albums:
  - 11111111-1111-1111-1111-111111111111
  - 22222222-2222-2222-2222-222222222222
```

## Subpages

Group multiple albums into named collections. URLs are auto-generated from the name.
The overall **Subpage Cover Image** shown on the homepage is automatically inherited from the Cover Image of the **first album** inside its list.

```yaml
subpages:
  - name: Japan # → /japan
    title: 'Trip to Japan' # Optional: overrides the page heading
    subtitle: '2024 adventures' # Optional: adds a subline under the heading
    albums:
      - 33333333-3333-3333-3333-333333333333 # Tokyo
      - 44444444-4444-4444-4444-444444444444 # Kyoto

  - name: Wedding – Smith # → /wedding-smith
    password: clientpass123 # Optional: subpage-level protection
    albums:
      - 55555555-5555-5555-5555-555555555555
      - 66666666-6666-6666-6666-666666666666:
          title: 'Private Highlights'
          password: 'album-secret-123' # Optional: album-level protection
```

Alternatively, you can use the object notation (recommended):

```yaml
subpages:
  'Japan':
    title: 'Trip to Japan'
    subtitle: '2024 adventures'
    albums:
      - 33333333-3333-3333-3333-333333333333
```

### Subpage Options

| Key         | Type    | Description                                                                                                      |
| ----------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `name`      | string  | Navigation label; the URL slug is derived from it                                                                |
| `title`     | string  | Page heading, defaults to `name`                                                                                 |
| `subtitle`  | string  | Subline under the heading                                                                                        |
| `password`  | string  | Gates the whole subpage — see [Password Protection](gallery-features.md#password-protection)                     |
| `albums`    | list    | Album UUIDs, optionally with [per-album options](#per-album-options)                                             |
| `sections`  | list    | Named groups of albums — see [Sections](#sections)                                                               |
| `grid`      | object  | Grid override for the photos on this page — see [Grid Layout](site-settings.md#grid-layout)                      |
| `coverGrid` | object  | Grid override for the album covers on this page — see [Album covers](site-settings.md#album-covers-on-a-subpage) |
| `proofing`  | boolean | Enables [client proofing](gallery-features.md#client-proofing) on this page                                      |
| `zoom`      | boolean | [Photo zoom](gallery-features.md#photo-zoom) for the albums on this page, over the site setting                  |
| `essayFile` | string  | Render a Markdown essay instead of a grid — see [Journal & Photo Essays](journal.md)                             |
| `essayText` | string  | Essay Markdown inline; written by the admin block editor                                                         |
| `enabled`   | boolean | `false` takes the page offline without deleting it                                                               |
| `hidden`    | boolean | **Experimental.** Reachable by direct link, but hidden from the navigation                                       |

```yaml
subpages:
  - name: Client Preview
    hidden: true # unlisted: not in the nav, still reachable at /client-preview
    proofing: true # visitors can mark favourites and export the selection
    password: 'clientpass123'
    albums:
      - 55555555-5555-5555-5555-555555555555

  - name: Old Series
    enabled: false # offline, keeps its configuration
    albums:
      - 66666666-6666-6666-6666-666666666666
```

> [!NOTE]
> `hidden` is unlisting, not access control. The URL is guessable — a slug is
> derived from the name — and nothing stops a visitor who has it. Combine it
> with `password` for anything that must stay private.

### Sections

When a subpage contains many albums you can split them into **named sections**. A typographic table of contents with anchor links is automatically rendered above the albums. Sections are fully optional — omit them and you get the standard flat grid.

Each section can have:

| Field         | Type   | Required | Description                                 |
| ------------- | ------ | -------- | ------------------------------------------- |
| `title`       | string | ✅       | Section heading + anchor name               |
| `description` | string | ➖       | Optional subline under the heading          |
| `albums`      | list   | ✅       | Album UUIDs (same format as regular albums) |

Within the `albums` list you can use a plain UUID, a simple title override, or an object — see [Per-Album Options](#per-album-options).

**Full example:**

```yaml
subpages:
  - name: Japan
    title: Japan
    subtitle: 'Travel through a land full of contrasts.'
    sections:
      - title: Tokyo
        description: 'Megacity, neon lights, silence in the noise.'
        albums:
          - '33333333-3333-3333-3333-333333333333'
          - '44444444-4444-4444-4444-444444444444': Shinjuku at night

      - title: Kyoto
        description: 'Temples and bamboo forests.'
        albums:
          - '55555555-5555-5555-5555-555555555555': Fushimi Inari
          - '66666666-6666-6666-6666-666666666666'

      - title: Osaka
        albums: # description is optional
          - '77777777-7777-7777-7777-777777777777'
```

> [!NOTE]
> Each section title is automatically converted to a URL-safe anchor (`#tokyo`, `#kyoto`, …). The TOC appearance (separator character, numbering style, section rule) is fully controlled by the active theme.

## Per-Album Options

Every album entry — standalone, on a subpage, or inside a section — accepts the
same three notations:

```yaml
albums:
  - 'album-uuid' # → uses the Immich album name
  - 'album-uuid': My Title # → displays "My Title" instead
  - 'album-uuid':
      title: My Private Title
      description: 'Shot on 35mm film in Vienna, spring 2025.'
      password: 'secure-password'
      heroImage: 'asset-uuid'
      sort: filename
      download: true
```

| Key             | Description                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `title`         | Display name instead of the Immich album name                                                   |
| `description`   | Shown below the album title                                                                     |
| `password`      | Gates this album alone — see [Password Protection](gallery-features.md#password-protection)     |
| `heroImage`     | Asset UUID overriding the album cover                                                           |
| `sort`          | Photo order — see [Photo Order Within an Album](#photo-order-within-an-album)                   |
| `assetOrder`    | Pinned asset UUIDs for `sort: manual`                                                           |
| `grid`          | **Experimental.** Grid override for this album only                                             |
| `coverPosition` | **Experimental.** Focal point for the cover crop                                                |
| `download`      | Offer originals for download — see [Originals download](gallery-features.md#originals-download) |
| `zoom`          | [Photo zoom](gallery-features.md#photo-zoom) for this album, over its page and the site setting |

### Per-album grid (experimental)

An album can override the grid it is shown in. It is merged over the subpage
grid, which is merged over the global default — so an album only has to state
what differs:

```yaml
albums:
  - 'album-uuid':
      title: Panoramas
      grid:
        layout: justified
        columns: 2
```

### Cover focal point (experimental)

Album covers are cropped to the card. `coverPosition` decides which part
survives the crop — the same values CSS `object-position` takes:

```yaml
albums:
  - 'album-uuid':
      coverPosition: '50% 25%' # or: "top", "center bottom", "left"
```

Useful when the automatic centre crop cuts off a horizon or a face.

## Photo Order Within an Album

By default a Folio album mirrors the Immich timeline. That is usually right, but a curated series has a narrative order that has nothing to do with capture time — and changing the sort on the Immich album would change it for the archive too. The optional `sort` key decouples the two.

| Mode       | Order                                                                                   |
| ---------- | --------------------------------------------------------------------------------------- |
| `immich`   | Default. Inherits the album's own `asc`/`desc` setting in Immich.                       |
| `newest`   | Capture time, newest first, regardless of the Immich setting.                           |
| `oldest`   | Capture time, oldest first.                                                             |
| `filename` | `originalFileName` in natural order — `IMG_2` before `IMG_10`.                          |
| `manual`   | Pinned photos first, in the order you set; everything else follows in the Immich order. |

```yaml
albums:
  - 'album-uuid' # no sort key → Immich order, exactly as before
  - 'album-uuid':
      sort: filename # an entry may carry only a sort, with no title override
  - 'album-uuid':
      title: Hokkaido, in sequence
      sort: manual
      assetOrder: # pinned, in this order
        - 'asset-uuid-opening-frame'
        - 'asset-uuid-second-frame'
```

`sort` works the same on standalone, subpage and section albums.

### About `manual`

`manual` is a pinned **prefix**, not a full permutation: `assetOrder` lists only the photos you placed by hand, and everything else follows in the album's Immich order. Curating an opening sequence therefore costs a handful of UUIDs rather than one per photo in the album.

This also makes the album resilient to changes in Immich. Photos removed from the album are ignored, and photos added later appear at the end rather than being hidden — so `gallery.yaml` never has to be kept in sync by hand.

The `/admin` page builder has a drag & drop editor for this (album → **Photo order** → **Manual** → **Reorder photos**), which is considerably easier than writing asset UUIDs by hand. It only writes a cleaned-up `assetOrder` when you explicitly apply it.

> [!NOTE]
> Two consequences worth knowing. On a subpage with several albums, `sort` orders photos _within_ each album — the albums themselves stay in the order they are listed in. And lightbox permalinks (`#photo-3`) are positional, so changing an album's sort moves where a previously shared link lands.

> [!TIP]
> `immich` means "inherit the album's sort setting from Immich", which is capture-time order in one direction or the other. It is not the manual drag order from the Immich web UI — Immich does not expose that order through its API, so Folio cannot reproduce it. Use `manual` for a hand-picked sequence.

## Content Pages

Pages beyond the gallery — pricing and packages, workshops, press, a booking
FAQ — are content pages. Each one is a file, `content/pages/<slug>.md`, served
at `/<slug>`.

```markdown
---
title: 'Pricing'
description: 'Packages and rates for portrait and wedding sessions'
draft: true
---

## Portrait sessions

One hour on location, 25 edited photos.

![0a1b2c3d-…:wide](A session in the Highlands)
```

The frontmatter keys are `title`, `description` (used for search engines and
link previews), `password` and `draft`. The body uses the journal's block
syntax ([Journal & Photo Essays](journal.md)): headings, text and photo blocks
(`:wide` or `:fullbleed`). A page has no date, no reading time and no index,
and it has no map block.

### In the menu

A page appears in the header menu through a reference among the subpages in
`gallery.yaml`, at the position it should take:

```yaml
subpages:
  - name: Landscapes
    albums:
      - 'album-uuid-1'
  - page: pricing
```

A page without a reference is still reachable at `/<slug>`, but it is not in
the menu, which suits a page that is only shared by link. The menu stays flat:
a page cannot sit inside a subpage's sections. A reference to a page whose file
does not exist is skipped, and the config doctor reports it.

### Slugs

A page's slug must not be taken by a subpage, a standalone album, a journal
entry or one of the built-in routes (`about`, `map`, `journal`, `impressum`,
`privacy`, `install`, `admin`, `gate`, `api`, `proof`, `contact`). The admin
panel refuses to save a page on such a slug, and the doctor reports a collision
in a hand-edited file. Renaming a page's slug breaks old links: there are no
automatic redirects.

### Draft and password

A draft is visible only to a signed-in admin, and it is left out of the menu and
the sitemap. A `password` locks the page like a journal entry, with its own
cookie (`lb_auth_page_<slug>`). The site password, when one is set, applies
before either. Password-protected pages are not listed in the sitemap.

### In the admin panel

Admin → Pages lists pages next to the subpages, with a document icon and a
PAGE tag, and a separate "Not in menu" group for pages without a reference.
**+ New page** creates one (it starts blank and as a draft). Select a page to
edit its title, URL, draft flag, password and description, and to switch
"Show in menu"; dragging a page into or out of "Not in menu" does the same.
The menu change is saved with **Save Changes**, like any other change to the
structure. **Edit content →** opens the journal's block editor with a live
preview. Every save keeps a backup in `content/pages/.backups/`, and deleting a
page that is in the menu also removes its `gallery.yaml` reference; both files
are backed up first.

## Finding UUIDs

- **Album UUIDs**: In Immich, go to Albums → click an album → the UUID is in the URL bar
- **Asset UUIDs**: Click any photo → the UUID is in the URL bar

---

See also: [Site settings](site-settings.md), [Gallery features](gallery-features.md), [System & security](security.md), [Journal & photo essays](journal.md).
