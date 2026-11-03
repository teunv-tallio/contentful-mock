import { describe, it, expect, beforeEach } from 'vitest'
import { createStore, SPACE, ENV, LOCALE } from '../helpers.js'
import { createChainedClient } from '../../src/management/chained/createChainedClient.js'
import { createDeliveryClient } from '../../src/delivery/createDeliveryClient.js'
import type { MemoryStore } from '../../src/store/MemoryStore.js'

let store: MemoryStore
let mgmt: ReturnType<typeof createChainedClient>
let delivery: ReturnType<typeof createDeliveryClient>

beforeEach(() => {
  store = createStore()
  mgmt = createChainedClient({ store })
  delivery = createDeliveryClient({ store, space: SPACE, environment: ENV, locale: LOCALE })
})

describe('space → environment navigation', () => {
  it('resolves space and environment', async () => {
    const space = await mgmt.getSpace(SPACE)
    expect(space.sys.id).toBe(SPACE)
    const env = await space.getEnvironment(ENV)
    expect(env.sys.id).toBe(ENV)
  })
})

describe('entry operations', () => {
  it('creates an entry', async () => {
    const space = await mgmt.getSpace(SPACE)
    const env = await space.getEnvironment(ENV)
    const entry = await env.createEntry('blogPost', {
      fields: { title: { [LOCALE]: 'Chained Entry' } },
    })
    expect(entry.sys.id).toBeDefined()
    expect(entry.fields.title[LOCALE]).toBe('Chained Entry')
  })

  it('updates an entry via entity method', async () => {
    const space = await mgmt.getSpace(SPACE)
    const env = await space.getEnvironment(ENV)
    const entry = await env.createEntry('blogPost', {
      fields: { title: { [LOCALE]: 'Before' } },
    })
    const updated = await entry.update({ fields: { title: { [LOCALE]: 'After' } } })
    expect(updated.fields.title[LOCALE]).toBe('After')
    expect(updated.sys.version).toBe(2)
  })

  it('publishes and unpublishes via entity methods', async () => {
    const space = await mgmt.getSpace(SPACE)
    const env = await space.getEnvironment(ENV)
    const entry = await env.createEntry('blogPost', { fields: {} })
    const published = await entry.publish()
    expect(published.sys.publishedVersion).toBeDefined()

    const unpublished = await entry.unpublish()
    expect(unpublished.sys.publishedVersion).toBeUndefined()
  })

  it('deletes an entry', async () => {
    const space = await mgmt.getSpace(SPACE)
    const env = await space.getEnvironment(ENV)
    const entry = await env.createEntry('blogPost', { fields: {} })
    await entry.delete()

    const fetched = env.getEntry(entry.sys.id)
    await expect(fetched).rejects.toMatchObject({ status: 404 })
  })

  it('archives and unarchives', async () => {
    const space = await mgmt.getSpace(SPACE)
    const env = await space.getEnvironment(ENV)
    const entry = await env.createEntry('blogPost', { fields: {} })
    const archived = await entry.archive()
    expect(archived.sys.archivedAt).toBeDefined()
    const unarchived = await entry.unarchive()
    expect(unarchived.sys.archivedAt).toBeUndefined()
  })

  it('getEntries returns all entries', async () => {
    const space = await mgmt.getSpace(SPACE)
    const env = await space.getEnvironment(ENV)
    await env.createEntry('blogPost', { fields: {} })
    await env.createEntry('blogPost', { fields: {} })
    const col = await env.getEntries()
    expect(col.total).toBe(2)
  })
})

describe('asset operations', () => {
  it('creates and publishes an asset', async () => {
    const space = await mgmt.getSpace(SPACE)
    const env = await space.getEnvironment(ENV)
    const asset = await env.createAsset({
      fields: {
        title: { [LOCALE]: 'My Asset' },
        file: {
          [LOCALE]: {
            fileName: 'img.jpg',
            contentType: 'image/jpeg',
            url: '//cdn.example.com/img.jpg',
          },
        },
      },
    })
    expect(asset.sys.id).toBeDefined()
    const published = await asset.publish()
    expect(published.sys.publishedVersion).toBeDefined()
  })
})

describe('content type operations', () => {
  it('creates and publishes a content type', async () => {
    const space = await mgmt.getSpace(SPACE)
    const env = await space.getEnvironment(ENV)
    const ct = await env.createContentType({
      name: 'Article',
      description: 'An article',
      displayField: 'title',
      fields: [{ id: 'title', name: 'Title', type: 'Symbol', required: true, localized: false }],
    })
    expect(ct.name).toBe('Article')
    const published = await ct.publish()
    expect(published.sys.publishedVersion).toBeDefined()
  })

  it('updates a content type', async () => {
    const space = await mgmt.getSpace(SPACE)
    const env = await space.getEnvironment(ENV)
    const ct = await env.createContentType({
      name: 'Old Name',
      description: '',
      displayField: 'title',
      fields: [],
    })
    const updated = await ct.update({ name: 'New Name' })
    expect(updated.name).toBe('New Name')
    expect(updated.sys.version).toBe(2)
  })
})

describe('round-trip: management create → delivery read', () => {
  it('entry created and published via chained client is readable via delivery client', async () => {
    // Create content type first
    const space = await mgmt.getSpace(SPACE)
    const env = await space.getEnvironment(ENV)
    const ct = await env.createContentTypeWithId('roundtrip-ct', {
      name: 'RoundTrip',
      description: '',
      displayField: 'title',
      fields: [{ id: 'title', name: 'Title', type: 'Symbol', required: true, localized: false }],
    })
    await ct.publish()

    // Create and publish entry
    const entry = await env.createEntry('roundtrip-ct', {
      fields: { title: { [LOCALE]: 'Round Trip Entry' } },
    })
    await entry.publish()

    // Read via delivery client
    const fetched = await delivery.getEntry(entry.sys.id)
    expect(fetched.fields['title']).toBe('Round Trip Entry')
    expect(fetched.sys.id).toBe(entry.sys.id)
  })

  it('unpublished entry is NOT readable via delivery client', async () => {
    const space = await mgmt.getSpace(SPACE)
    const env = await space.getEnvironment(ENV)
    const entry = await env.createEntry('ct', { fields: {} })
    // Not published
    await expect(delivery.getEntry(entry.sys.id)).rejects.toMatchObject({ status: 404 })
  })
})
