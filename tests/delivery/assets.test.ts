import { describe, it, expect, beforeEach } from 'vitest'
import { createStore, makeAsset, SPACE, ENV, LOCALE } from '../helpers.js'
import { createDeliveryClient } from '../../src/delivery/createDeliveryClient.js'
import type { MemoryStore } from '../../src/store/MemoryStore.js'

let store: MemoryStore

function client() {
  return createDeliveryClient({ store, space: SPACE, environment: ENV, locale: LOCALE })
}

beforeEach(() => {
  store = createStore()
  store.seed(SPACE, ENV, {
    assets: [
      makeAsset('a1', 'Hero Image', true),
      makeAsset('a2', 'Logo', true),
      makeAsset('a3', 'Draft Asset'), // not published
    ],
  })
})

describe('getAsset', () => {
  it('returns a published asset', async () => {
    const result = await client().getAsset('a1')
    expect(result.sys.id).toBe('a1')
    expect(result.fields.title).toBe('Hero Image')
  })

  it('throws 404 for missing asset', async () => {
    await expect(client().getAsset('missing')).rejects.toMatchObject({ status: 404 })
  })

  it('throws 404 for unpublished asset', async () => {
    await expect(client().getAsset('a3')).rejects.toMatchObject({ status: 404 })
  })

  it('includes file info', async () => {
    const result = await client().getAsset('a1')
    expect(result.fields.file?.fileName).toBe('a1.jpg')
    expect(result.fields.file?.contentType).toBe('image/jpeg')
  })
})

describe('getAssets', () => {
  it('returns only published assets', async () => {
    const result = await client().getAssets()
    expect(result.total).toBe(2)
    expect(result.items).toHaveLength(2)
  })

  it('filters by title equality', async () => {
    const result = await client().getAssets({ 'fields.title': 'Logo' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].sys.id).toBe('a2')
  })

  it('supports limit and skip', async () => {
    const result = await client().getAssets({ limit: 1, skip: 0 })
    expect(result.items).toHaveLength(1)
    expect(result.total).toBe(2)
  })
})

describe('getAssetsWithCursor', () => {
  it('provides cursor pagination', async () => {
    const result = await client().getAssetsWithCursor({ limit: 1 })
    expect(result.items).toHaveLength(1)
    expect(result.nextPage).toBeDefined()
  })
})

describe('createAssetKey', () => {
  it('returns mock policy and secret', async () => {
    const result = await client().createAssetKey(Date.now() + 3600)
    expect(result.policy).toBe('mock-policy')
    expect(result.secret).toBe('mock-secret')
  })
})
