# Documentation

Start at the [project README](../README.md) for the pitch, the feature list and
a quick start. [Features](features.md) has the full feature list with screenshots.

## Guides

| Guide                                       | Covers                                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **[Immich setup](immich-setup.md)**         | Immich version, API key permissions, full-size images for HEIC/RAW zoom                                         |
| **[Gallery Structure](gallery-config.md)**  | `gallery.yaml`: hero, albums, subpages, sections, photo order, content pages                                    |
| **[Site Settings](site-settings.md)**       | `settings.yaml`: grid, site behaviour, language, navigation, watermark, SEO, footer, about page                 |
| **[Gallery Features](gallery-features.md)** | Passwords, client proofing, photo zoom, original downloads                                                      |
| **[System & Security](security.md)**        | Rate limits, trusted proxies, token revocation                                                                  |
| **[Theming](theming.md)**                   | The twelve presets, custom colours and fonts, hero styles, grid layouts, with screenshots                       |
| **[Journal & Photo Essays](journal.md)**    | Long-form storytelling — file format, block syntax, drafts, per-entry passwords, Journal Studio                 |
| **[Admin Panel](admin-panel.md)**           | The visual editor at `/admin` — pages, journal, settings, analytics, backups, security                          |
| **[Deployment](deployment.md)**             | First-run wizard, environment variables, Docker, health check, reverse proxy, behaviour during an Immich outage |

Contributing? See [CONTRIBUTING.md](../CONTRIBUTING.md). Security policy:
[SECURITY.md](../SECURITY.md). Release history: [CHANGELOG.md](../CHANGELOG.md).

## Design notes

[admin-ux-concept.md](admin-ux-concept.md) describes the admin panel's layout and is still referenced from the code.

[`archive/`](archive/) holds working documents kept for context: brainstorms, an architecture review, an ideas backlog, the journal editor design notes and old implementation plans. They record thinking at a point in time and are **not maintained**. Where they disagree with the guides above, the guides are correct.

`screenshots/` holds the images used by the guides and the README.
