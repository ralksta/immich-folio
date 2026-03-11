# Portfolio Backlog & Ideas

Eine konsolidierte Liste an Features und Ideen für zukünftige Versionen, bereinigt um alles, was bereits implementiert wurde.

## 🏆 Quick Wins (High Impact / Low Effort)

| Idea                           | Effort | Impact                                             |
| ------------------------------ | ------ | -------------------------------------------------- |
| **Slideshow mode**             | Low    | High — exhibition ready (Auto-advance 3s/5s/10s)   |
| **Fullscreen API in lightbox** | Low    | Medium — immersive (Chrome-free)                   |
| **Download originals**         | Low    | High — client delivery (Button in lightbox)        |
| **Photo of the Day**           | Low    | Medium — return visits (Auto-rotate hero image)    |
| **Keyboard shortcut hints**    | Low    | Medium — `?` button for shortcuts (arrows, Esc, F) |
| **Photo sharing**              | Low    | Medium — "Copy link" button in lightbox            |

---

## 🌍 Bigger Features & Enhancements

- **ISR / Stale-While-Revalidate** — Replace `force-dynamic` with Incremental Static Regeneration + on-demand revalidation.
- **Client proofing** — Let clients favorite/select photos in password-protected galleries.
- **Map view** — Minimal world map from EXIF city/country data, each dot links to an album.
- **EXIF analytics page** — Visual breakdown of shooting patterns: most-used focal lengths, aperture distribution.
- **Before/After slider** — Drag-to-reveal comparison component for retouching showcases.
- **Watermarking** — Server-side watermark overlay on proxied images.
- **Internationalization (i18n)** — Multi-language UI support (DE/EN).

---

## 📖 Deep Dive Feature Plan: Photo Stories / Essays

_Vertical scroll format with images + text interspersed, like a photo essay. A major portfolio differentiator._

### Proposed Architecture

**How it works:**
The photographer writes standard Markdown files in `content/stories/`.
We extend the standard Markdown image syntax to pull images directly from Immich using the asset UUID:

```md
# My trip to Japan

Here is some text introducing the story.

![Kyoto street at night](asset:b8c2d...)
```

### Implementation Layers

1. **Parser Layer (`lib/storyParser.ts`)**
   - Parse markdown files using `marked`.
   - Identify `asset:UUID` image nodes.
   - Batch-fetch necessary `ImmichAsset` data to generate `ThumbHash` and Proxy-URLs.
   - Return a structured array of blocks (e.g. `{ type: 'text', html: '...' }`, `{ type: 'image', assetId: '...', url: '...' }`).

2. **Routing Layer**
   - `app/stories/page.tsx`: Index page showing cards for all stories (sorted by date).
   - `app/stories/[slug]/page.tsx`: The essay reader.

3. **Design Layer**
   - Immersive, single-column reading experience.
   - Consecutive images can automatically adapt to side-by-side or masonry presentation depending on aspect ratios.
   - Typography should be highly legible, matching the chosen global theme.
