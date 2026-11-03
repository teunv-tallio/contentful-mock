import { describe, it, expect, beforeEach } from 'vitest'
import { createStore, makeContentType, SPACE, ENV, LOCALE } from '../helpers.js'
import { createDeliveryClient } from '../../src/delivery/createDeliveryClient.js'
import type { MemoryStore } from '../../src/store/MemoryStore.js'

let store: MemoryStore

function client() {
  return createDeliveryClient({ store, space: SPACE, environment: ENV, locale: LOCALE })
}

beforeEach(() => {
  store = createStore()
  store.seed(SPACE, ENV, {
    contentTypes: [
      makeContentType('blogPost', 'Blog Post', true),
      makeContentType('page', 'Page', true),
      makeContentType('draft', 'Draft CT'), // not published
    ],
  })
})

describe('getContentType', () => {
  it('returns a published content type', async () => {
    const result = await client().getContentType('blogPost')
    expect(result.sys.id).toBe('blogPost')
    expect(result.name).toBe('Blog Post')
    expect(result.fields).toHaveLength(1)
  })

  it('throws 404 for missing content type', async () => {
    await expect(client().getContentType('missing')).rejects.toMatchObject({ status: 404 })
  })

  it('throws 404 for unpublished content type', async () => {
    await expect(client().getContentType('draft')).rejects.toMatchObject({ status: 404 })
  })
})

describe('getContentTypes', () => {
  it('returns only published content types', async () => {
    const result = await client().getContentTypes()
    expect(result.total).toBe(2)
    expect(result.items.map((ct) => ct.sys.id).sort()).toEqual(['blogPost', 'page'])
  })

  it('filters by name text query', async () => {
    const result = await client().getContentTypes({ query: 'blog' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].sys.id).toBe('blogPost')
  })

  it('includes fields in response', async () => {
    const result = await client().getContentTypes()
    expect(result.items[0].fields).toBeDefined()
    expect(result.items[0].fields.length).toBeGreaterThan(0)
  })
})
