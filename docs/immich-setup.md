# Immich setup

What Immich Folio needs from your Immich server: a version, an API key with the right permissions, and for one feature a server setting.

**Contents:**

- [Requirements](#requirements)
- [API key permissions](#api-key-permissions)
- [Full-size images for HEIC and RAW zoom](#full-size-images-for-heic-and-raw-zoom)
- [Which albums are published](#which-albums-are-published)

## Requirements

- **Immich 3.0 or newer.** Immich 3.0 changed how album assets are retrieved; earlier versions are not supported as of v0.9.0. On an older server, albums render with the correct title but no photos, and the map stays empty. The app logs a warning naming this as the likely cause.
- Node.js 20+ (or just use the Docker image).

## API key permissions

Create a dedicated API key in Immich under **Account Settings → API Keys**. Immich Folio only needs **read access** — it never modifies your library.

| Permission       | Required                    | Used for                                                                                                                                     |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `album.read`     | ✅ Yes                      | List and fetch album metadata & photo lists                                                                                                  |
| `asset.read`     | ✅ Yes                      | Fetch asset metadata, EXIF data and search results                                                                                           |
| `asset.view`     | ✅ Yes                      | Stream image/video files (thumbnail, preview, video playback)                                                                                |
| `asset.download` | Only for zoom and downloads | Stream originals: [photo zoom](gallery-features.md#photo-zoom) on JPEG/AVIF and [originals download](gallery-features.md#originals-download) |

> **Zoom and downloads need `asset.download`.** Without it Immich answers `403` for the original file, so the zoom button reports that full resolution is unavailable and downloads fail. Leave it off if you use neither feature.

> **No write permissions needed.** `album.create`, `asset.upload`, `asset.delete`, etc. can all be left **off**.

> **Tip (Admin Panel):** The Admin Panel also uses `POST /search/metadata` to browse your full library for the hero image picker. This is covered by `asset.read` — no additional permission required.

## Full-size images for HEIC and RAW zoom

[Photo zoom](gallery-features.md#photo-zoom) on formats a browser cannot display (HEIC, RAW and similar) uses Immich's full-size rendition. Turn on _Administration › Settings › Image Settings › Full-size image_ (JPEG format) and run the _Generate Thumbnails_ job for existing photos. JPEG and AVIF photos zoom without this setting.

## Which albums are published

Only the albums listed in `content/gallery.yaml` are reachable. Whether an album is shared in Immich makes no difference: the allowlist in `gallery.yaml` is the whole protection, and the admin panel can publish any album of the account.
