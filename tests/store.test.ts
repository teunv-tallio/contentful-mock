import { describe, it, expect } from 'vitest'
import { MemoryStore } from '../src/store/MemoryStore.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('MemoryStore.generateId', () => {
  it('produces valid v4 UUIDs by default', () => {
    const store = new MemoryStore()
    expect(store.generateId()).toMatch(UUID_RE)
  })

  it('produces different IDs on consecutive calls without seed', () => {
    const store = new MemoryStore()
    expect(store.generateId()).not.toBe(store.generateId())
  })

  it('produces deterministic IDs with numeric seed', () => {
    const a = new MemoryStore({ seed: 42 })
    const b = new MemoryStore({ seed: 42 })
    expect(a.generateId()).toBe(b.generateId())
    expect(a.generateId()).toBe(b.generateId())
  })

  it('produces different IDs with different seeds', () => {
    const a = new MemoryStore({ seed: 1 })
    const b = new MemoryStore({ seed: 2 })
    expect(a.generateId()).not.toBe(b.generateId())
  })

  it('produces deterministic IDs with string seed', () => {
    const a = new MemoryStore({ seed: 'my-test-suite' })
    const b = new MemoryStore({ seed: 'my-test-suite' })
    expect(a.generateId()).toBe(b.generateId())
  })

  it('seeded IDs are still valid UUIDs', () => {
    const store = new MemoryStore({ seed: 'hello' })
    expect(store.generateId()).toMatch(UUID_RE)
    expect(store.generateId()).toMatch(UUID_RE)
  })
})

describe('MemoryStore.getAssetUrl', () => {
  it('returns a Contentful-format URL by default', () => {
    const store = new MemoryStore()
    const url = store.getAssetUrl('my-space', 'asset-1', 'en-US', 'photo.jpg')
    expect(url).toMatch(/^\/\/images\.ctfassets\.net\/my-space\/asset-1\/[a-f0-9]{32}\/photo\.jpg$/)
  })

  it('uses custom assetBaseUrl when configured', () => {
    const store = new MemoryStore({ assetBaseUrl: 'https://cdn.example.com' })
    const url = store.getAssetUrl('my-space', 'asset-1', 'en-US', 'photo.jpg')
    expect(url).toMatch(
      /^https:\/\/cdn\.example\.com\/my-space\/asset-1\/[a-f0-9]{32}\/photo\.jpg$/,
    )
  })

  it('produces the same token for the same inputs (deterministic)', () => {
    const store = new MemoryStore()
    const url1 = store.getAssetUrl('sp', 'a1', 'en-US', 'img.png')
    const url2 = store.getAssetUrl('sp', 'a1', 'en-US', 'img.png')
    expect(url1).toBe(url2)
  })
})

describe('MemoryStore file storage', () => {
  it('stores and retrieves binary file content', () => {
    const store = new MemoryStore()
    const data = Buffer.from('hello world')
    store.storeFile('sp', 'env', 'asset-1', 'en-US', data)
    expect(store.getFile('sp', 'env', 'asset-1', 'en-US')).toEqual(data)
  })

  it('returns undefined for missing file', () => {
    const store = new MemoryStore()
    expect(store.getFile('sp', 'env', 'missing', 'en-US')).toBeUndefined()
  })

  it('stores string content', () => {
    const store = new MemoryStore()
    store.storeFile('sp', 'env', 'asset-2', 'fr', 'text content')
    expect(store.getFile('sp', 'env', 'asset-2', 'fr')).toBe('text content')
  })

  it('clears files on reset()', () => {
    const store = new MemoryStore()
    store.storeFile('sp', 'env', 'asset-1', 'en-US', Buffer.from('data'))
    store.reset()
    expect(store.getFile('sp', 'env', 'asset-1', 'en-US')).toBeUndefined()
  })
})
