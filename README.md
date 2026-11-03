# @tallio/contentful-mock

An in-memory mock for the [Contentful Delivery API](https://www.contentful.com/developers/docs/references/content-delivery-api/) and [Contentful Management API](https://www.contentful.com/developers/docs/references/content-management-api/). Use it in tests or local development without hitting real Contentful endpoints.

## Features

- Shared in-memory store: data seeded via the management client is immediately readable via the delivery client (once published)
- Full CDA query engine: field filters, operators (`[eq]`, `[ne]`, `[lt]`, `[lte]`, `[gt]`, `[gte]`, `[in]`, `[nin]`, `[exists]`, `[match]`, `[near]`, `[within]`), `limit`/`skip`, `order`, `include` link resolution
- CMA plain client (`client.entry.get(params)` style)
- CMA chained client (`space.getEnvironment(id)` style)
- Full publish / unpublish / archive / unarchive lifecycle
- TypeScript-first with strict types

## Installation

```bash
npm install --save-dev @tallio/contentful-mock
```

The official SDKs are optional peer dependencies. Install whichever you use:

```bash
npm install contentful                 # Delivery API
npm install contentful-management      # Management API
```

## Quick start

### Delivery client

```ts
import { MemoryStore, createDeliveryClient } from '@tallio/contentful-mock'
import { makeEntrySys } from '@tallio/contentful-mock/utils/sys' // or build sys yourself

const store = new MemoryStore()

// Seed content
store.seed('my-space', 'master', {
  entries: [
    {
      sys: {
        id: 'entry-1',
        type: 'Entry',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        publishedVersion: 1,
        publishedAt: new Date().toISOString(),
        firstPublishedAt: new Date().toISOString(),
        space: { sys: { type: 'Link', linkType: 'Space', id: 'my-space' } },
        environment: { sys: { type: 'Link', linkType: 'Environment', id: 'master' } },
        contentType: { sys: { type: 'Link', linkType: 'ContentType', id: 'blogPost' } },
      },
      fields: {
        title: { 'en-US': 'Hello World' },
        body: { 'en-US': 'This is the body.' },
      },
    },
  ],
})

const client = createDeliveryClient({
  store,
  space: 'my-space',
  environment: 'master',
  locale: 'en-US',
})

const entry = await client.getEntry('entry-1')
console.log(entry.fields.title) // 'Hello World'

const entries = await client.getEntries({ content_type: 'blogPost' })
console.log(entries.total) // 1
```

### Management plain client

```ts
import { MemoryStore, createPlainClient } from '@tallio/contentful-mock'

const store = new MemoryStore()
const client = createPlainClient({ store })

const params = { spaceId: 'my-space', environmentId: 'master' }

// Create a content type
const ct = await client.contentType.createWithId(
  { ...params, contentTypeId: 'blogPost' },
  {
    name: 'Blog Post',
    description: 'A blog post',
    displayField: 'title',
    fields: [
      { id: 'title', name: 'Title', type: 'Symbol', required: true, localized: false },
    ],
  },
)
await client.contentType.publish({ ...params, contentTypeId: ct.sys.id })

// Create and publish an entry
const entry = await client.entry.create(
  { ...params, contentTypeId: 'blogPost' },
  { fields: { title: { 'en-US': 'My Post' } } },
)
const published = await client.entry.publish({ ...params, entryId: entry.sys.id })
console.log(published.sys.publishedVersion) // 1
```

### Management chained client

```ts
import { MemoryStore, createChainedClient } from '@tallio/contentful-mock'

const store = new MemoryStore()
const client = createChainedClient({ store })

const space = await client.getSpace('my-space')
const env = await space.getEnvironment('master')

const entry = await env.createEntry('blogPost', {
  fields: { title: { 'en-US': 'Hello from chained client' } },
})
await entry.publish()
await entry.update({ fields: { title: { 'en-US': 'Updated title' } } })
await entry.delete()
```

### Shared store round-trip

The same `MemoryStore` instance is passed to both clients, so publishing via the management API makes content immediately available via the delivery API:

```ts
import { MemoryStore, createPlainClient, createDeliveryClient } from '@tallio/contentful-mock'

const store = new MemoryStore()
const mgmt = createPlainClient({ store })
const delivery = createDeliveryClient({ store, space: 'space', environment: 'master' })

const params = { spaceId: 'space', environmentId: 'master' }
const entry = await mgmt.entry.create({ ...params, contentTypeId: 'ct' }, {
  fields: { title: { 'en-US': 'Draft' } },
})

// Not yet published — delivery throws 404
await delivery.getEntry(entry.sys.id) // throws ContentfulError { status: 404 }

await mgmt.entry.publish({ ...params, entryId: entry.sys.id })
const fetched = await delivery.getEntry(entry.sys.id) // ✓
console.log(fetched.fields.title) // 'Draft'
```

## Seeding data

`store.seed(spaceId, environmentId, data)` bulk-loads entries, assets, and content types. Any entity whose `sys.publishedVersion` is set is treated as published.

```ts
store.seed('space', 'master', {
  contentTypes: [ /* ContentTypeProps[] */ ],
  entries: [ /* EntryProps[] */ ],
  assets: [ /* AssetProps[] */ ],
})
```

Call `store.reset()` between tests to clear all data.

## API reference

### `MemoryStore`

| Method | Description |
|--------|-------------|
| `seed(spaceId, envId, data)` | Bulk-load entries, assets, content types |
| `reset()` | Clear all data |
| `createEntry / getEntry / updateEntry / deleteEntry` | CRUD for entries |
| `publishEntry / unpublishEntry / archiveEntry / unarchiveEntry` | State changes |
| `createAsset / getAsset / updateAsset / deleteAsset` | CRUD for assets |
| `publishAsset / unpublishAsset / archiveAsset / unarchiveAsset` | State changes |
| `createContentType / getContentType / updateContentType / deleteContentType` | CRUD for content types |
| `publishContentType / unpublishContentType` | Publish state |

### `createDeliveryClient(options)`

```ts
interface MockDeliveryClientOptions {
  store: MemoryStore
  space?: string       // default: 'mock-space'
  environment?: string // default: 'master'
  locale?: string      // default: 'en-US'
}
```

| Method | Description |
|--------|-------------|
| `getEntry(id, query?)` | Fetch a single published entry. Throws 404 if not found or unpublished. |
| `getEntries(query?)` | List published entries with optional filtering. |
| `getEntriesWithCursor(query?)` | Like `getEntries` but returns `nextPage()` for cursor pagination. |
| `parseEntries(data)` | Identity transform — returns input unchanged. |
| `getAsset(id, query?)` | Fetch a single published asset. |
| `getAssets(query?)` | List published assets. |
| `getAssetsWithCursor(query?)` | Cursor-paginated assets. |
| `createAssetKey(expiresAt)` | Returns `{ policy: 'mock-policy', secret: 'mock-secret' }`. |
| `getContentType(id)` | Fetch a published content type. |
| `getContentTypes(query?)` | List published content types. |

### `createPlainClient(options)`

#### `client.entry`

| Method | Description |
|--------|-------------|
| `get(params)` | Fetch a single entry (draft) |
| `getMany(params)` | List all entries in an environment |
| `getPublished(params)` | List only published entries |
| `getManyWithCursor(params)` / `getPublishedWithCursor(params)` | Cursor-paginated variants |
| `create(params, data)` | Create entry (auto-generated ID) |
| `createWithId(params, data)` | Create entry with specific ID |
| `update(params, data)` | Update fields (bumps version) |
| `patch(params, ops)` | Apply JSON Patch operations |
| `delete(params)` | Delete entry |
| `publish(params)` | Publish entry |
| `unpublish(params)` | Unpublish entry |
| `archive(params)` | Archive entry |
| `unarchive(params)` | Unarchive entry |
| `references(params)` | Resolve linked entries and assets |

#### `client.asset`

Same shape as `client.entry` plus:

| Method | Description |
|--------|-------------|
| `createFromFiles(params, files)` | Creates asset with a mock CDN URL |
| `processForLocale(params, asset, locale)` | No-op (returns asset unchanged) |
| `processForAllLocales(params, asset)` | No-op (returns asset unchanged) |

#### `client.contentType`

| Method | Description |
|--------|-------------|
| `get / getMany / getManyWithCursor` | Read content types |
| `create / createWithId / update / delete` | CRUD |
| `publish / unpublish` | Publish state |
| `omitAndDeleteField(params, contentType, fieldId)` | Remove a field |

### `createChainedClient(options)`

```ts
const client = createChainedClient({ store })
const space = await client.getSpace(spaceId)
const env = await space.getEnvironment(environmentId)

// Environment methods
await env.createEntry(contentTypeId, data)
await env.createEntryWithId(contentTypeId, entryId, data)
await env.getEntry(id)
await env.getEntries(query?)

await env.createAsset(data)
await env.createAssetWithId(assetId, data)
await env.getAsset(id)
await env.getAssets(query?)

await env.createContentType(data)
await env.createContentTypeWithId(contentTypeId, data)
await env.getContentType(id)
await env.getContentTypes(query?)

// Entity methods (returned from create/get)
await entry.update(data?)
await entry.publish()
await entry.unpublish()
await entry.archive()
await entry.unarchive()
await entry.delete()
```

## Query operators

The delivery client and management `getMany` methods accept Contentful-style query parameters:

| Operator | Example | Description |
|----------|---------|-------------|
| _(none)_ | `'fields.title': 'Hello'` | Exact equality |
| `[ne]` | `'fields.title[ne]': 'Hello'` | Not equal |
| `[lt]` | `'fields.count[lt]': '10'` | Less than |
| `[lte]` | `'fields.count[lte]': '10'` | Less than or equal |
| `[gt]` | `'fields.count[gt]': '10'` | Greater than |
| `[gte]` | `'fields.count[gte]': '10'` | Greater than or equal |
| `[exists]` | `'fields.tags[exists]': 'true'` | Field exists (or not, with `false`) |
| `[in]` | `'fields.tags[in]': 'a,b,c'` | Value in comma-separated list |
| `[nin]` | `'fields.tags[nin]': 'a,b'` | Value NOT in list |
| `[match]` | `'fields.title[match]': 'hello'` | Fuzzy full-text search (Fuse.js) |
| `[near]` | `'fields.location[near]': '40.7,-74.0,10'` | Within `N` km of `lat,lon` |
| `[within]` | `'fields.location[within]': '0,0,60,60'` | Within bounding box `lat1,lon1,lat2,lon2` |

Pagination:

| Param | Description |
|-------|-------------|
| `limit` | Max results (default 100, max 1000) |
| `skip` | Offset (default 0) |
| `order` | Comma-separated field paths; prefix `-` for descending (`-sys.createdAt`) |
| `select` | Comma-separated paths to project (not yet applied in this mock) |
| `locale` | Locale to use for field values |

## Link resolution (`include`)

Pass `include: N` (0–10) to the delivery client to resolve linked entries and assets:

```ts
const entry = await delivery.getEntry('parent-entry-id', { include: 2 })
// Fields containing Link objects are replaced with the resolved entry/asset
console.log(entry.fields.author.fields.name)
```

Circular links are automatically detected and skipped.

## Error handling

All errors thrown are instances of `ContentfulError`:

```ts
import { ContentfulError } from '@tallio/contentful-mock'

try {
  await delivery.getEntry('missing')
} catch (err) {
  if (err instanceof ContentfulError) {
    console.log(err.status)     // 404
    console.log(err.statusText) // 'Not Found'
    console.log(err.message)    // 'The resource could not be found.'
  }
}
```

| Status | Scenario |
|--------|----------|
| `404` | Entity not found or not published |
| `409` | Duplicate ID on create |
| `422` | Invalid state transition (e.g. unpublish a non-published entry) |

## Development

```bash
npm run build      # Compile TypeScript (CJS + ESM + types)
npm run test       # Run all tests with Vitest
npm run test:watch # Watch mode
npm run lint       # ESLint
npm run format     # Prettier
```
