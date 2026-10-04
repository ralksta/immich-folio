# Contributors

Immich Folio is maintained by [@ralksta](https://github.com/ralksta) and made
better by the people below. Thank you — every one of these made the project
easier to live with.

- **[@lancetm714](https://github.com/lancetm714)** — built the setup wizard that
  turns a fresh install into a few clicks in the browser instead of hand-written
  config files. Also added custom favicons, so your portfolio gets its own icon
  in the browser tab, and made a gallery with no albums yet a perfectly valid
  starting point rather than an error. In v0.15.0, made client proofing work
  properly: the selection bar floats again with page transitions on, and it is
  readable in light mode. Also brought links to journal quote attributions. In
  v0.17.0, built the ZIP download: a whole album, or just the photos a client
  picked, as one archive of the originals — streamed, so even a large shoot
  arrives complete. In v0.18.0, kept accent-coloured buttons readable when the
  accent is light, and made a mistyped accent fall back to the theme instead of
  turning every button invisible. In v0.19.0, gave the proofing dialog's
  _Email to photographer_ an actual recipient.
- **[@RichKidsDev](https://github.com/RichKidsDev)** — noticed that the
  Impressum still cited the TMG, which the DDG replaced in 2024. That report
  turned into a proper overhaul in v0.18.0: the right law by default, a heading
  you can change for other countries, clickable contacts and a contact form as
  a second channel. In v0.19.0, reported that _Email to photographer_ opened a
  mail with nobody in the _To:_ line.
- **[@ImScheinox](https://github.com/ImScheinox)** — found and fixed portrait
  photos rendering as landscape tiles, because the grid ignored the camera's
  EXIF orientation flag. That brought the masonry layout's stagger back for
  anyone whose camera records portrait frames that way, which is most of them.
- **[Jules](https://jules.google.com)** — an automated reviewer that has been
  quietly hardening the project in the background: better screen-reader support
  in the photo grid, and a series of fixes keeping the public endpoints from
  being overwhelmed by traffic.
- **[Dependabot](https://github.com/dependabot)** — keeps every dependency
  current, which is most of the reason security fixes land here quickly.

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) to get
started. Pull requests target the `dev` branch.
