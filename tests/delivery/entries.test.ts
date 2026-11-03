import { describe, it, expect, beforeEach } from 'vitest'
import { createStore, makeEntry, makeContentType, SPACE, ENV, LOCALE } from '../helpers.js'
import { createDeliveryClient } from '../../src/delivery/createDeliveryClient.js'
import type { MemoryStore } from '../../src/store/MemoryStore.js'

let store: MemoryStore

function client() {
  return createDeliveryClient({ store, space: SPACE, environment: ENV, locale: LOCALE })
}

beforeEach(() => {
  store = createStore()
})

describe('getEntry', () => {
  it('returns a published entry', async () => {
    const ct = makeContentType('blogPost', 'Blog Post', true)
    store.seed(SPACE, ENV, { contentTypes: [ct] })
    const entry = makeEntry('entry1', 'blogPost', { title: { [LOCALE]: 'Hello' } }, true)
    store.seed(SPACE, ENV, { entries: [entry] })

    const result = await client().getEntry('entry1')
    expect(result.sys.id).toBe('entry1')
    expect(result.fields['title']).toBe('Hello')
  })

  it('throws 404 if entry does not exist', async () => {
    await expect(client().getEntry('missing')).rejects.toMatchObject({ status: 404 })
  })

  it('throws 404 if entry exists but is not published', async () => {
    const entry = makeEntry('entry1', 'blogPost', { title: { [LOCALE]: 'Draft' } })
    store.seed(SPACE, ENV, { entries: [entry] })
    await expect(client().getEntry('entry1')).rejects.toMatchObject({ status: 404 })
  })

  it('unwraps locale from fields', async () => {
    const entry = makeEntry('e1', 'ct', { title: { [LOCALE]: 'Title', 'fr-FR': 'Titre' } }, true)
    store.seed(SPACE, ENV, { entries: [entry] })
    const result = await client().getEntry('e1')
    expect(result.fields['title']).toBe('Title')
  })

  it('resolves linked entries at include=1', async () => {
    const childEntry = makeEntry('child', 'ct', { title: { [LOCALE]: 'Child' } }, true)
    const parentEntry = makeEntry(
      'parent',
      'ct',
      {
        child: {
          [LOCALE]: { sys: { type: 'Link', linkType: 'Entry', id: 'child' } },
        },
      },
      true,
    )
    store.seed(SPACE, ENV, { entries: [childEntry, parentEntry] })

    const result = await client().getEntry('parent', { include: 1 })
    const child = result.fields['child'] as { fields: { title: string } }
    expect(child.fields.title).toBe('Child')
  })
})

describe('getEntries', () => {
  beforeEach(() => {
    store.seed(SPACE, ENV, {
      entries: [
        makeEntry('e1', 'blogPost', { title: { [LOCALE]: 'First' }, order: { [LOCALE]: 1 } }, true),
        makeEntry(
          'e2',
          'blogPost',
          { title: { [LOCALE]: 'Second' }, order: { [LOCALE]: 2 } },
          true,
        ),
        makeEntry('e3', 'page', { title: { [LOCALE]: 'Page' } }, true),
        makeEntry('e4', 'blogPost', { title: { [LOCALE]: 'Draft' } }), // unpublished
      ],
    })
  })

  it('returns only published entries', async () => {
    const result = await client().getEntries()
    expect(result.items).toHaveLength(3)
    expect(result.total).toBe(3)
  })

  it('filters by content_type', async () => {
    const result = await client().getEntries({ content_type: 'blogPost' })
    expect(result.items).toHaveLength(2)
    expect(result.items.every((e) => e.sys.contentType.sys.id === 'blogPost')).toBe(true)
  })

  it('filters by field equality', async () => {
    const result = await client().getEntries({ content_type: 'blogPost', 'fields.title': 'First' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].sys.id).toBe('e1')
  })

  it('supports limit and skip', async () => {
    const result = await client().getEntries({ limit: 2, skip: 0 })
    expect(result.items).toHaveLength(2)
    expect(result.limit).toBe(2)
    expect(result.skip).toBe(0)
    expect(result.total).toBe(3)
  })

  it('supports order by field (asc)', async () => {
    const result = await client().getEntries({ content_type: 'blogPost', order: 'fields.order' })
    expect(result.items[0].fields['title']).toBe('First')
    expect(result.items[1].fields['title']).toBe('Second')
  })

  it('supports order by field (desc)', async () => {
    const result = await client().getEntries({ content_type: 'blogPost', order: '-fields.order' })
    expect(result.items[0].fields['title']).toBe('Second')
  })

  it('filters by sys.id[in]', async () => {
    const result = await client().getEntries({ 'sys.id[in]': 'e1,e2' })
    expect(result.items).toHaveLength(2)
  })
})

describe('getEntriesWithCursor', () => {
  it('returns nextPage when more items exist', async () => {
    for (let i = 0; i < 5; i++) {
      const e = makeEntry(`c${i}`, 'ct', { title: { [LOCALE]: `Entry ${i}` } }, true)
      store.seed(SPACE, ENV, { entries: [e] })
    }
    const result = await client().getEntriesWithCursor({ limit: 2, skip: 0 })
    expect(result.items).toHaveLength(2)
    expect(result.nextPage).toBeDefined()
    const page2 = await result.nextPage!()
    expect(page2.items).toHaveLength(2)
  })

  it('nextPage is undefined on last page', async () => {
    const e = makeEntry('only1', 'ct', { title: { [LOCALE]: 'Only' } }, true)
    store.seed(SPACE, ENV, { entries: [e] })
    const result = await client().getEntriesWithCursor({ limit: 10 })
    expect(result.nextPage).toBeUndefined()
  })
})

describe('parseEntries', () => {
  it('is an identity transform', () => {
    const data = { sys: { type: 'Array' }, total: 0, skip: 0, limit: 10, items: [] }
    expect(client().parseEntries(data)).toBe(data)
  })
})
