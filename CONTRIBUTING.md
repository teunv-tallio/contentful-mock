# Contributing

Thanks for your interest in improving `@tallio/contentful-mock`!

## Setup

```bash
git clone <repo-url>
cd contentful-mock
npm install
```

Requires Node.js 18 or newer.

## Workflow

1. Create a branch from `main`.
2. Make your change in `src/`, with tests in `tests/` (`tests/delivery/` for CDA, `tests/management/` for CMA). Shared factories live in `tests/helpers.ts`.
3. Run the checks before pushing:

```bash
npm run format   # Prettier
npm run lint     # ESLint
npm test         # Vitest
npm run build    # tsup (CJS + ESM + .d.ts)
```

To run a single test file: `npx vitest run tests/delivery/entries.test.ts`.

## Guidelines

- The mock should behave like the real Contentful APIs. When in doubt, compare against the official `contentful` / `contentful-management` packages and add a test for the behaviour.
- Keep CMA (locale-keyed fields, read from `props`) and CDA (locale-unwrapped fields, read from `publishedProps`) concerns separate. See `CLAUDE.md` for the architecture.
- Throw `ContentfulError` for 404, 409 and 422 conditions.
- Bug fixes should include a regression test.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, ...), matching the existing history.
- Keep pull requests focused, and describe what changed and why.
- All tests and lint checks must pass.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
