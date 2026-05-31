# Contributing to Immich Folio

Thanks for your interest in contributing! 🎉

## Ways to contribute

- **Bug reports** — [Open a bug report issue](https://github.com/ralksta/immich-folio/issues/new?template=bug_report.md)
- **Feature requests** — [Open a feature request](https://github.com/ralksta/immich-folio/issues/new?template=feature_request.md)
- **Pull requests** — see below
- **Discussions** — [Ask questions or share ideas](https://github.com/ralksta/immich-folio/discussions)

## Development setup

```bash
# 1. Clone
git clone https://github.com/ralksta/immich-folio.git
cd immich-folio

# 2. Install
npm install

# 3. Configure
cp .env.local.example .env.local
cp content/gallery.yaml.example content/gallery.yaml
# Edit .env.local or set IMMICH_API_URL + IMMICH_API_KEY

# 4. Run
npm run dev       # http://localhost:3000
npm run build     # production build check
```

## Before submitting a PR

```bash
npx tsc --noEmit   # must be 0 errors
npx vitest run     # all tests must pass
npm run build      # build must succeed
```

## Code style

- **TypeScript** — strict mode, no `any` without justification
- **Components** — Server Components by default; use `'use client'` only when necessary
- **CSS** — vanilla CSS variables, no Tailwind, no CSS-in-JS
- **Naming** — descriptive names, no abbreviations in public APIs

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new hero style
fix: correct image aspect ratio on mobile
security: escape HTML in map popups
docs: update theming guide
chore: bump next to 15.x
```

## Pull Request checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes
- [ ] `npm run build` passes
- [ ] No secrets in the diff
- [ ] Documentation updated if needed

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
