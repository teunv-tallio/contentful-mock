// Covers the special cases documented on
// https://www.contentful.com/developers/docs/references/content-management-api/search-parameters/
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createStore,
  SPACE,
  ENV,
  LOCALE,
  makeEntry,
  makeAsset,
  makeContentType,
} from '../helpers.js'
import { createPlainClient } from '../../src/management/plain/createPlainClient.js'
import { createChainedClient } from '../../src/management/chained/createChainedClient.js'
import type { EntryProps } from '../../src/store/types.js'
import type { MemoryStore } from '../../src/store/MemoryStore.js'

let store: MemoryStore
let client: ReturnType<typeof createPlainClient>

const params = { spaceId: SPACE, environmentId: ENV }

function tag(id: string) {
  return { sys: { type: 'Link' as const, linkType: 'Tag' as const, id } }
}

function withTags(entry: EntryProps, ...tags: string[]): EntryProps {
  return { ...entry, metadata: { tags: tags.map(tag) } }
}

async function ids(query: Record<string, unknown>): Promise<string[]> {
  const res = await client.entry.getMany({ ...params, query })
  return res.items.map((e) => e.sys.id)
}

beforeEach(() => {
  store = createStore()
  client = createPlainClient({ store })

  const product = makeContentType('product', 'Product')
  product.displayField = 'name'
  const author = makeContentType('author', 'Author')
  author.displayField = 'fullName'
  const noDisplay = makeContentType('note', 'Note')
  noDisplay.displayField = ''

  store.seed(SPACE, ENV, {
    contentTypes: [product, author, noDisplay],
    entries: [
      withTags(
        makeEntry('p1', 'product', {
          name: { [LOCALE]: 'Blue cat toy', 'de-DE': 'Blaues Katzenspielzeug' },
          body: { [LOCALE]: 'my cat is <b>blue</b> and happy' },
          labels: { [LOCALE]: ['accessories', 'flowers'] },
          author: { [LOCALE]: { sys: { type: 'Link', linkType: 'Entry', id: 'a1' } } },
        }),
        'featured',
        'sale',
      ),
      withTags(
        makeEntry('p2', 'product', {
          name: { [LOCALE]: 'Red caterpillar' },
          body: { [LOCALE]: 'there is a caterpillar in my house' },
          labels: { [LOCALE]: ['accessories'] },
        }),
        'featured',
      ),
      makeEntry('p3', 'product', {
        name: { [LOCALE]: 'Blueberry cat' },
        body: { [LOCALE]: 'cat cat cat with blueberries and a blue catastrophic accident' },
      }),
      makeEntry('a1', 'author', { fullName: { [LOCALE]: 'Ada Lovelace' } }),
      makeEntry('a2', 'author', {}),
      makeEntry('n1', 'note', { text: { [LOCALE]: 'just a note' } }),
    ],
    assets: [
      { ...makeAsset('img1', 'Cat picture'), metadata: { tags: [tag('featured')] } },
      makeAsset('img2', 'Dog picture'),
    ],
  })
})

describe('include and locale are not supported by the CMA', () => {
  it('ignores include — links stay unresolved', async () => {
    const res = await client.entry.getMany({
      ...params,
      query: { 'sys.id': 'p1', include: 2 },
    })
    expect(res.items[0].fields.author[LOCALE]).toEqual({
      sys: { type: 'Link', linkType: 'Entry', id: 'a1' },
    })
  })

  it('ignores locale — fields stay locale-keyed with all locales', async () => {
    const res = await client.entry.getMany({
      ...params,
      query: { 'sys.id': 'p1', locale: 'de-DE' },
    })
    expect(res.items[0].fields.name).toEqual({
      [LOCALE]: 'Blue cat toy',
      'de-DE': 'Blaues Katzenspielzeug',
    })
  })
})

describe('order=relevance', () => {
  it('orders full-text search results by relevance', async () => {
    expect(await ids({ query: 'cat', order: 'relevance' })).toEqual(['p3', 'p1', 'p2'])
  })

  it('supports reversing relevance order (ties broken by the next order field)', async () => {
    expect(await ids({ query: 'cat', order: '-relevance,-sys.id' })).toEqual(['p2', 'p1', 'p3'])
  })

  it('can be combined with other order fields as tie-breaker', async () => {
    expect(await ids({ query: 'blue', order: 'relevance,sys.id' })).toEqual(['p3', 'p1'])
  })

  it('keeps the default order when there is no search query', async () => {
    const all = await ids({})
    expect(await ids({ order: 'relevance' })).toEqual(all)
  })
})

describe('full-text search (query=)', () => {
  it('requires all terms to match, left-anchored, across fields', async () => {
    expect(await ids({ query: 'my cat is blue', order: 'sys.id' })).toEqual(['p1'])
    expect(await ids({ query: 'blue catas' })).toEqual(['p3'])
  })

  it('is case-insensitive and searches all locales', async () => {
    expect(await ids({ query: 'KATZEN' })).toEqual(['p1'])
  })

  it('ignores terms shorter than 2 characters', async () => {
    expect(await ids({ query: 'a caterpillar' })).toEqual(['p2'])
  })

  it('supports phrase search within a single field', async () => {
    expect(await ids({ query: '"my cat is blue"' })).toEqual(['p1'])
    // terms stay left-anchored inside a phrase: "Blueberry cat" matches too
    expect(await ids({ query: '"blue cat"', order: 'sys.id' })).toEqual(['p1', 'p3'])
    expect(await ids({ query: '"cat blue"' })).toEqual([])
  })

  it('also works on assets', async () => {
    const res = await client.asset.getMany({ ...params, query: { query: 'cat' } })
    expect(res.items.map((a) => a.sys.id)).toEqual(['img1'])
  })
})

describe('select=fields._displayField', () => {
  it('resolves display fields across content types without content_type', async () => {
    const res = await client.entry.getMany({
      ...params,
      query: { select: 'sys,fields._displayField', order: 'sys.id' },
    })
    const byId = Object.fromEntries(res.items.map((e) => [e.sys.id, e]))
    expect(byId.p1.fields).toEqual({
      name: { [LOCALE]: 'Blue cat toy', 'de-DE': 'Blaues Katzenspielzeug' },
    })
    expect(byId.a1.fields).toEqual({ fullName: { [LOCALE]: 'Ada Lovelace' } })
    expect(byId.p1.sys.id).toBe('p1')
  })

  it('can be used alone', async () => {
    const res = await client.entry.getMany({
      ...params,
      query: { select: 'fields._displayField', 'sys.id': 'a1' },
    })
    expect(res.items[0]).toEqual({ fields: { fullName: { [LOCALE]: 'Ada Lovelace' } } })
  })

  it('returns the entry without fields when there is no display field or no value', async () => {
    const res = await client.entry.getMany({
      ...params,
      query: { select: 'sys,fields._displayField', 'sys.id[in]': 'a2,n1' },
    })
    expect(res.items).toHaveLength(2)
    for (const item of res.items) expect(item.fields).toBeUndefined()
  })

  it('combines with other field selectors without duplicating the display field', async () => {
    const res = await client.entry.getMany({
      ...params,
      query: {
        content_type: 'product',
        'sys.id': 'p1',
        select: 'sys,fields.name,fields.body,fields._displayField',
      },
    })
    expect(Object.keys(res.items[0].fields).sort()).toEqual(['body', 'name'])
  })

  it('is a no-op when the bare fields selector is also present', async () => {
    const res = await client.entry.getMany({
      ...params,
      query: { content_type: 'product', 'sys.id': 'p1', select: 'sys,fields,fields._displayField' },
    })
    expect(Object.keys(res.items[0].fields).sort()).toEqual(['author', 'body', 'labels', 'name'])
  })

  it('works with the chained client', async () => {
    const env = await (await createChainedClient({ store }).getSpace(SPACE)).getEnvironment(ENV)
    const res = await env.getEntries({ select: 'sys,fields._displayField', 'sys.id': 'a1' })
    expect(res.items[0].fields).toEqual({ fullName: { [LOCALE]: 'Ada Lovelace' } })
  })
})

describe('select restrictions', () => {
  it('requires content_type for standard field selectors on entries', async () => {
    await expect(
      client.entry.getMany({ ...params, query: { select: 'sys,fields.name' } }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('projects selected properties when content_type is given', async () => {
    const res = await client.entry.getMany({
      ...params,
      query: { content_type: 'author', select: 'sys.id,fields.fullName', 'sys.id': 'a1' },
    })
    expect(res.items[0]).toEqual({
      sys: { id: 'a1' },
      fields: { fullName: { [LOCALE]: 'Ada Lovelace' } },
    })
  })

  it('rejects select paths deeper than 2 levels', async () => {
    await expect(
      client.entry.getMany({
        ...params,
        query: { content_type: 'product', select: `fields.name.${LOCALE}` },
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rejects more than 100 properties', async () => {
    const select = Array.from({ length: 101 }, (_, i) => `fields.f${i}`).join(',')
    await expect(
      client.entry.getMany({ ...params, query: { content_type: 'product', select } }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('does not require content_type for assets', async () => {
    const res = await client.asset.getMany({
      ...params,
      query: { select: 'sys.id,fields.title', 'sys.id': 'img2' },
    })
    expect(res.items[0]).toEqual({
      sys: { id: 'img2' },
      fields: { title: { [LOCALE]: 'Dog picture' } },
    })
  })
})

describe('querying by tags', () => {
  it('metadata.tags.sys.id[in] matches entries with any of the tags', async () => {
    expect(await ids({ 'metadata.tags.sys.id[in]': 'sale,nope', order: 'sys.id' })).toEqual(['p1'])
    expect(await ids({ 'metadata.tags.sys.id[in]': 'featured', order: 'sys.id' })).toEqual([
      'p1',
      'p2',
    ])
  })

  it('metadata.tags.sys.id[all] matches entries with all of the tags', async () => {
    expect(await ids({ 'metadata.tags.sys.id[all]': 'featured,sale' })).toEqual(['p1'])
  })

  it('metadata.tags.sys.id[nin] excludes entries with the tags', async () => {
    expect(
      await ids({ content_type: 'product', 'metadata.tags.sys.id[nin]': 'sale', order: 'sys.id' }),
    ).toEqual(['p2', 'p3'])
  })

  it('metadata.tags[exists] checks for any tag', async () => {
    expect(await ids({ 'metadata.tags[exists]': 'true', order: 'sys.id' })).toEqual(['p1', 'p2'])
    expect(await ids({ content_type: 'product', 'metadata.tags[exists]': 'false' })).toEqual(['p3'])
  })

  it('filters assets by tag', async () => {
    const res = await client.asset.getMany({
      ...params,
      query: { 'metadata.tags.sys.id[in]': 'featured' },
    })
    expect(res.items.map((a) => a.sys.id)).toEqual(['img1'])
  })
})

describe('inherited CDA search semantics', () => {
  it('array equality matches when one item matches', async () => {
    expect(await ids({ content_type: 'product', 'fields.labels': 'flowers' })).toEqual(['p1'])
  })

  it('array inequality excludes entries where one item matches', async () => {
    expect(
      await ids({ content_type: 'product', 'fields.labels[ne]': 'flowers', order: 'sys.id' }),
    ).toEqual(['p2', 'p3'])
  })

  it('[all] requires every value to be present', async () => {
    expect(
      await ids({ content_type: 'product', 'fields.labels[all]': 'flowers,accessories' }),
    ).toEqual(['p1'])
  })

  it('filters on fields of a link object via a nested path', async () => {
    expect(await ids({ content_type: 'product', 'fields.author.sys.id': 'a1' })).toEqual(['p1'])
  })
})
