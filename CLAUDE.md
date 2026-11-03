# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project summary

`@tallio/contentful-mock` is an in-memory mock for the Contentful Delivery API (CDA) and Contentful Management API (CMA). It is designed as a drop-in replacement for the official `contentful` (v11) and `contentful-management` (v12) npm packages, without needing a real Contentful account or network access.

## Commands

```bash
npm run build       # Compile TypeScript → dist/ (CJS + ESM + .d.ts)
npm run test        # Run all tests once (vitest run)
npm run test:watch  # Watch mode
npm run lint        # ESLint (src + tests)
npm run format      # Prettier auto-format (src + tests)
```

To run a single test file:

```bash
npx vitest run tests/delivery/entries.test.ts
```

## Architecture

```
MemoryStore  ←  shared in-memory database for both client types
     │
     ├── QueryEngine  ←  filtering, sorting, pagination for delivery queries
     │
     ├── Delivery client (createDeliveryClient)
     │     Returns CDA-format responses (locale-unwrapped fields, CDA sys shape)
     │
     ├── Management plain client (createPlainClient)
     │     entry / asset / contentType namespaces, CMA-format
     │
     └── Management chained client (createChainedClient)
           space → environment → entity hierarchy, CMA-format
```

### Key concepts

**CMA vs CDA field format:**
- CMA (stored in `MemoryStore`): `{ fields: { title: { "en-US": "Hello" } } }` — locale-keyed
- CDA (returned by delivery client): `{ fields: { title: "Hello" } }` — locale unwrapped using the requested locale

**Publish flow:** Entities exist in two states inside `StoredEntry` / `StoredAsset` / `StoredContentType`:
- `props` — the latest draft (always present)
- `publishedProps` — snapshot taken at publish time (only present when published)

The delivery client reads exclusively from `publishedProps`. The management client always reads from `props`.

**Link resolution:** The delivery client resolves `{ sys: { type: 'Link', linkType: 'Entry', id: '...' } }` objects in fields up to `include` levels deep (default 1). See `src/delivery/transformers.ts`.

**Error types:** `ContentfulError` (src/utils/ContentfulError.ts) is thrown for 404, 409, and 422 conditions.

## Source layout

```
src/
  index.ts                         Public exports
  store/
    MemoryStore.ts                 In-memory CRUD + state machine for entries, assets, content types
    types.ts                       Internal store types (EntryProps, AssetProps, ContentTypeProps, etc.)
  query/
    QueryEngine.ts                 Filter + sort + paginate CMA-stored entries/assets
    operators.ts                   Individual operator implementations ([lt], [match], [near], etc.)
  delivery/
    createDeliveryClient.ts        Mock CDA factory
    transformers.ts                CMA format → CDA format (toCdaEntry, toCdaAsset, resolveLinks)
  management/
    plain/PlainClient.ts           Mock CMA plain client (entry/asset/contentType namespaces)
    chained/ChainedClient.ts       Mock CMA chained client (space → env → entity)
  utils/
    sys.ts                         Helpers to generate sys objects (makeEntrySys, bumpVersion, etc.)
    collection.ts                  makeCollection helper for Array responses
    ContentfulError.ts             Error class with status/statusText/details

tests/
  helpers.ts                       Shared test factories (makeEntry, makeAsset, makeContentType)
  delivery/                        CDA tests
  management/                      CMA tests
```
