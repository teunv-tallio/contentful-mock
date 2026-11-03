import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryStore } from '../../src/store/MemoryStore.js'
import {
  createDeliveryClient,
  createPreviewClient,
  PREVIEW_HOST,
} from '../../src/delivery/createDeliveryClient.js'
import { SPACE, ENV, LOCALE, makeEntry, makeAsset, makeContentType } from '../helpers.js'

const params = { space: SPACE, environment: ENV, locale: LOCALE }

let store: MemoryStore
let preview: ReturnType<typeof createPreviewClient>
let delivery: ReturnType<typeof createDeliveryClient>

beforeEach(() => {
  store = new MemoryStore()
  preview = createPreviewClient({ ...params, store })
  delivery = createDeliveryClient({ ...params, store })
})

// ─── Draft-only entries (never published) ────────────────────────────────────

describe('draft entries (never published)', () => {
  it('preview returns a draft entry that was never published', async () => {
    const entry = makeEntry('e1', 'blog', { title: { [LOCALE]: 'Draft' } })
    store.seed(SPACE, ENV, { entries: [entry] })

    const result = await preview.getEntry('e1')
    expect(result.sys.id).toBe('e1')
    expect(result.fields.title).toBe('Draft')
  })

  it('delivery throws 404 for a draft entry that was never published', async () => {
    const entry = makeEntry('e1', 'blog', { title: { [LOCALE]: 'Draft' } })
    store.seed(SPACE, ENV, { entries: [entry] })

    await expect(delivery.getEntry('e1')).rejects.toMatchObject({ status: 404 })
  })

  it('preview includes draft entries in getEntries', async () => {
    store.seed(SPACE, ENV, {
      entries: [
        makeEntry('e1', 'blog', { title: { [LOCALE]: 'Draft' } }),
        makeEntry('e2', 'blog', { title: { [LOCALE]: 'Published' } }, true),
      ],
    })

    const result = await preview.getEntries()
    expect(result.total).toBe(2)
  })

  it('delivery getEntries excludes draft entries', async () => {
    store.seed(SPACE, ENV, {
      entries: [
        makeEntry('e1', 'blog', { title: { [LOCALE]: 'Draft' } }),
        makeEntry('e2', 'blog', { title: { [LOCALE]: 'Published' } }, true),
      ],
    })

    const result = await delivery.getEntries()
    expect(result.total).toBe(1)
    expect(result.items[0].fields.title).toBe('Published')
  })
})

// ─── Updated-but-not-republished entries ─────────────────────────────────────

describe('entries with unpublished edits', () => {
  it('preview returns the latest draft fields, not the published snapshot', async () => {
    // Create, publish, then edit without republishing
    const cma = store
    const original = makeEntry('e1', 'blog', { title: { [LOCALE]: 'Original' } }, true)
    cma.seed(SPACE, ENV, { entries: [original] })

    // Simulate an edit that hasn't been republished
    const updated = {
      ...original,
      fields: { title: { [LOCALE]: 'Updated Draft' } },
      sys: { ...original.sys, version: 2 },
    }
    store.updateEntry(SPACE, ENV, updated)

    const previewResult = await preview.getEntry('e1')
    const deliveryResult = await delivery.getEntry('e1')

    expect(previewResult.fields.title).toBe('Updated Draft')
    expect(deliveryResult.fields.title).toBe('Original')
  })
})

// ─── Archived entries ─────────────────────────────────────────────────────────

describe('archived entries', () => {
  it('preview throws 404 for an archived entry', async () => {
    store.seed(SPACE, ENV, { entries: [makeEntry('e1', 'blog', { title: { [LOCALE]: 'Hi' } })] })
    store.archiveEntry(SPACE, ENV, 'e1')

    await expect(preview.getEntry('e1')).rejects.toMatchObject({ status: 404 })
  })

  it('preview getEntries excludes archived entries', async () => {
    store.seed(SPACE, ENV, {
      entries: [
        makeEntry('e1', 'blog', { title: { [LOCALE]: 'Archived' } }),
        makeEntry('e2', 'blog', { title: { [LOCALE]: 'Active' } }),
      ],
    })
    store.archiveEntry(SPACE, ENV, 'e1')

    const result = await preview.getEntries()
    expect(result.total).toBe(1)
    expect(result.items[0].sys.id).toBe('e2')
  })
})

// ─── Assets ──────────────────────────────────────────────────────────────────

describe('assets', () => {
  it('preview returns a draft asset', async () => {
    store.seed(SPACE, ENV, { assets: [makeAsset('a1', 'Draft image')] })

    const result = await preview.getAsset('a1')
    expect(result.sys.id).toBe('a1')
  })

  it('delivery throws 404 for an unpublished asset', async () => {
    store.seed(SPACE, ENV, { assets: [makeAsset('a1', 'Draft image')] })

    await expect(delivery.getAsset('a1')).rejects.toMatchObject({ status: 404 })
  })

  it('preview getAssets includes unpublished assets', async () => {
    store.seed(SPACE, ENV, {
      assets: [makeAsset('a1', 'Draft'), makeAsset('a2', 'Published', true)],
    })

    const result = await preview.getAssets()
    expect(result.total).toBe(2)
  })

  it('preview excludes archived assets', async () => {
    store.seed(SPACE, ENV, { assets: [makeAsset('a1', 'To archive')] })
    store.archiveAsset(SPACE, ENV, 'a1')

    await expect(preview.getAsset('a1')).rejects.toMatchObject({ status: 404 })
  })
})

// ─── Content types ────────────────────────────────────────────────────────────

describe('content types', () => {
  it('preview returns an unpublished content type', async () => {
    store.seed(SPACE, ENV, { contentTypes: [makeContentType('blog', 'Blog')] })

    const result = await preview.getContentType('blog')
    expect(result.sys.id).toBe('blog')
  })

  it('delivery throws 404 for an unpublished content type', async () => {
    store.seed(SPACE, ENV, { contentTypes: [makeContentType('blog', 'Blog')] })

    await expect(delivery.getContentType('blog')).rejects.toMatchObject({ status: 404 })
  })

  it('preview getContentTypes includes unpublished content types', async () => {
    store.seed(SPACE, ENV, {
      contentTypes: [
        makeContentType('draft-ct', 'Draft'),
        makeContentType('pub-ct', 'Published', true),
      ],
    })

    const result = await preview.getContentTypes()
    expect(result.total).toBe(2)
  })
})

// ─── host option passthrough ──────────────────────────────────────────────────

describe('host option', () => {
  it('createPreviewClient is equivalent to createDeliveryClient with preview host', async () => {
    store.seed(SPACE, ENV, { entries: [makeEntry('e1', 'blog', { title: { [LOCALE]: 'Draft' } })] })

    const viaFactory = createPreviewClient({ ...params, store })
    const viaHost = createDeliveryClient({ ...params, store, host: PREVIEW_HOST })

    const r1 = await viaFactory.getEntry('e1')
    const r2 = await viaHost.getEntry('e1')

    expect(r1.sys.id).toBe(r2.sys.id)
    expect(r1.fields.title).toBe(r2.fields.title)
  })
})
