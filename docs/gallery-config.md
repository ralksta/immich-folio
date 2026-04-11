# Gallery Configuration

All gallery structure is defined in `content/gallery.yaml`. Copy the example to get started:

```bash
cp content/gallery.yaml.example content/gallery.yaml
```

**Contents:**

- [Hero Images](#hero-images)
- [Standalone Albums](#standalone-albums)
- [Subpages & Categories](#subpages)
- [Grid Layout](#grid-layout)
- [EXIF on Hover](#exif-on-hover)
- [Footer](#footer)
- [About Page](#about-page)
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

### Sections

When a subpage contains many albums you can split them into **named sections**. A typographic table of contents with anchor links is automatically rendered above the albums. Sections are fully optional — omit them and you get the standard flat grid.

Each section can have:

| Field         | Type   | Required | Description                                 |
| ------------- | ------ | -------- | ------------------------------------------- |
| `title`       | string | ✅       | Section heading + anchor name               |
| `description` | string | ➖       | Optional subline under the heading          |
| `albums`      | list   | ✅       | Album UUIDs (same format as regular albums) |

Within the `albums` list you can use a plain UUID, a simple title override, or an object with `title` and `password`:

```yaml
albums:
  - 'album-uuid' # → uses the Immich album name
  - 'album-uuid': My Title # → displays "My Title" instead
  - 'album-uuid':
      title: My Private Title
      password: 'secure-password' # → adds a password gate to this specific album
```

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

## Grid Layout

Configure the photo grid globally or per-subpage:

```yaml
# Global defaults
grid:
  columns: 3 # number of columns (default: 3)
  gap: 12 # gap in pixels (default: 12)
  aspectRatio: '1' # "1", "3/2", "auto", etc. (default: "1")
  layout: masonry # "masonry" | "uniform" | "showcase" | "filmstrip" | "editorial-flow"

subpages:
  - name: Japan
    grid: # per-subpage override
      columns: 4
      layout: uniform
      aspectRatio: '3/2'
    albums:
      - ...
```

## EXIF on Hover

Show camera/lens/settings when hovering over photos (enabled by default):

```yaml
exifOnHover: false # set to false to disable
```

## Footer

Optional minimal footer with social links:

```yaml
footer:
  name: John Doe
  instagram: johndoe
  email: hello@example.com
  website: https://example.com
```

## About Page

Create `content/about.md` with YAML frontmatter:

```markdown
---
portrait: asset-uuid-for-your-portrait
name: Your Name
location: City, Country
gear:
  - Camera Body
  - Favorite Lens
---

Your bio text here. Supports full Markdown.
```

## Finding UUIDs

- **Album UUIDs**: In Immich, go to Albums → click an album → the UUID is in the URL bar
- **Asset UUIDs**: Click any photo → the UUID is in the URL bar
