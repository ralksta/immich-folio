# Contributing to Immich Folio

Thanks for your interest in contributing! 🎉

## Ways to contribute

- **Bug reports** — [Open a bug report issue](https://github.com/ralksta/immich-folio/issues/new?template=bug_report.md)
- **Feature requests** — [Open a feature request](https://github.com/ralksta/immich-folio/issues/new?template=feature_request.md)
- **Pull requests** — see below
- **Discussions** — [Ask questions or share ideas](https://github.com/ralksta/immich-folio/discussions)

## Branches

**Open pull requests against `dev`, not `main`.**

`dev` is where everything is integrated. `main` only ever moves through a
release: it is fast-forwarded from `dev`, tagged, and the tag triggers the
Docker image publish. A PR against `main` would put unreleased code into the
branch that is supposed to match the published image — so please branch off
`dev` and target it.

CI runs on pull requests to either branch, so a PR against `dev` is checked
exactly the same way.

If you opened a PR against `main` by accident, no need to redo the work — you
can change the target branch on the PR page under **Edit** next to the title.

## Development setup

```bash
# 1. Clone and switch to the integration branch
git clone https://github.com/ralksta/immich-folio.git
cd immich-folio
git checkout dev

# 2. Install
npm install

# 3. Configure
cp .env.local.example .env.local
cp content/gallery.yaml.example content/gallery.yaml
# Edit .env.local or set IMMICH_API_URL + IMMICH_API_KEY

# 4. Run
npm run dev       # http://localhost:3000
npm run build     # production build check
npm run doctor    # check the configuration if something looks wrong
```

## Before submitting a PR

```bash
npx tsc --noEmit   # must be 0 errors
npx vitest run     # all tests must pass
npm run build      # build must succeed
```

## Tests

Tests live in `__tests__/` next to the code they cover, and run in Node by
default — most of what is worth testing is plain logic.

A test that needs a DOM opts in per file, with this as its very first line:

```tsx
// @vitest-environment jsdom
```

Then render with `@testing-library/react` and call `cleanup` in `afterEach`.
See `app/admin/__tests__/SaveBar.test.tsx` for a worked example.

**Prefer extracting the logic over rendering it.** A pure function moved into
`lib/` — or into a sibling module, as `page-builder/albumEntries.ts` was — is
cheaper to test and stays tested when the markup around it changes. Reach for a
component test when the behaviour *is* the rendering: a state that hides a form,
a control that must stay disabled, a keyboard shortcut.

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

- [ ] Targets `dev`
- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes
- [ ] `npm run build` passes
- [ ] No secrets in the diff
- [ ] Documentation updated if needed

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
