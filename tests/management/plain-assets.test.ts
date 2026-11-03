import { describe, it, expect, beforeEach } from 'vitest'
import { createStore, SPACE, ENV, LOCALE } from '../helpers.js'
import { createPlainClient } from '../../src/management/plain/createPlainClient.js'
import { MemoryStore } from '../../src/store/MemoryStore.js'
import type { AssetProps } from '../../src/store/types.js'

let store: MemoryStore
let client: ReturnType<typeof createPlainClient>

const params = { spaceId: SPACE, environmentId: ENV }

function assetFields(title: string): AssetProps['fields'] {
  return {
    title: { [LOCALE]: title },
    file: {
      [LOCALE]: {
        fileName: `${title.toLowerCase()}.jpg`,
        contentType: 'image/jpeg',
        url: `//mock.contentful.com/${title.toLowerCase()}.jpg`,
      },
    },
  }
}

beforeEach(() => {
  store = createStore()
  client = createPlainClient({ store })
})

describe('create + get', () => {
  it('creates an asset and retrieves it', async () => {
    const created = await client.asset.create(params, { fields: assetFields('Hero') })
    expect(created.sys.id).toBeDefined()
    expect(created.fields.title[LOCALE]).toBe('Hero')

    const retrieved = await client.asset.get({ ...params, assetId: created.sys.id })
    expect(retrieved.sys.id).toBe(created.sys.id)
  })

  it('createWithId uses specified id', async () => {
    const created = await client.asset.createWithId(
      { ...params, assetId: 'logo-id' },
      { fields: assetFields('Logo') },
    )
    expect(created.sys.id).toBe('logo-id')
  })

  it('throws 404 for missing asset', async () => {
    await expect(client.asset.get({ ...params, assetId: 'nope' })).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('update', () => {
  it('updates asset fields and bumps version', async () => {
    const created = await client.asset.create(params, { fields: assetFields('Before') })
    const updated = await client.asset.update(
      { ...params, assetId: created.sys.id },
      { fields: assetFields('After') },
    )
    expect(updated.sys.version).toBe(2)
    expect(updated.fields.title[LOCALE]).toBe('After')
  })
})

describe('delete', () => {
  it('deletes an asset', async () => {
    const created = await client.asset.create(params, { fields: assetFields('Temp') })
    await client.asset.delete({ ...params, assetId: created.sys.id })
    await expect(client.asset.get({ ...params, assetId: created.sys.id })).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('publish / unpublish', () => {
  it('publish sets publishedVersion', async () => {
    const created = await client.asset.create(params, { fields: assetFields('Pub') })
    const published = await client.asset.publish({ ...params, assetId: created.sys.id })
    expect(published.sys.publishedVersion).toBeDefined()
    expect(published.sys.firstPublishedAt).toBeDefined()
  })

  it('unpublish clears publishedVersion', async () => {
    const created = await client.asset.create(params, { fields: assetFields('Pub2') })
    await client.asset.publish({ ...params, assetId: created.sys.id })
    const unpublished = await client.asset.unpublish({ ...params, assetId: created.sys.id })
    expect(unpublished.sys.publishedVersion).toBeUndefined()
  })

  it('throws 422 when unpublishing non-published', async () => {
    const created = await client.asset.create(params, { fields: assetFields('NP') })
    await expect(
      client.asset.unpublish({ ...params, assetId: created.sys.id }),
    ).rejects.toMatchObject({ status: 422 })
  })
})

describe('archive / unarchive', () => {
  it('archives and unarchives an asset', async () => {
    const created = await client.asset.create(params, { fields: assetFields('Arc') })
    const archived = await client.asset.archive({ ...params, assetId: created.sys.id })
    expect(archived.sys.archivedAt).toBeDefined()

    const unarchived = await client.asset.unarchive({ ...params, assetId: created.sys.id })
    expect(unarchived.sys.archivedAt).toBeUndefined()
  })
})

describe('createFromFiles', () => {
  it('creates asset with contentful-format url', async () => {
    const created = await client.asset.createFromFiles(params, {
      fields: assetFields('Upload'),
    })
    expect(created.sys.id).toBeDefined()
    const locale = LOCALE
    const url = created.fields.file[locale].url
    expect(url).toContain('images.ctfassets.net')
    expect(url).toContain(SPACE)
    expect(url).toContain(created.sys.id)
    expect(url).toContain('upload.jpg')
  })

  it('stores file binary content when provided', async () => {
    const content = Buffer.from('fake image bytes')
    const created = await client.asset.createFromFiles(params, {
      fields: {
        title: { [LOCALE]: 'Binary upload' },
        file: { [LOCALE]: { fileName: 'img.png', contentType: 'image/png', file: content } },
      },
    })
    const stored = store.getFile(SPACE, ENV, created.sys.id, LOCALE)
    expect(stored).toEqual(content)
  })

  it('uses custom assetBaseUrl when configured', async () => {
    const customStore = new MemoryStore({ assetBaseUrl: 'https://cdn.example.com' })
    const customClient = createPlainClient({ store: customStore })
    const created = await customClient.asset.createFromFiles(
      { spaceId: SPACE, environmentId: ENV },
      { fields: assetFields('Custom') },
    )
    expect(created.fields.file[LOCALE].url).toMatch(/^https:\/\/cdn\.example\.com\//)
  })
})

describe('processForLocale / processForAllLocales', () => {
  it('returns asset unchanged', async () => {
    const created = await client.asset.create(params, { fields: assetFields('Proc') })
    const processed = await client.asset.processForLocale(
      { ...params, assetId: created.sys.id },
      created,
      LOCALE,
    )
    expect(processed).toEqual(created)

    const processedAll = await client.asset.processForAllLocales(
      { ...params, assetId: created.sys.id },
      created,
    )
    expect(processedAll).toEqual(created)
  })
})

describe('getMany', () => {
  it('returns all assets', async () => {
    await client.asset.create(params, { fields: assetFields('A1') })
    await client.asset.create(params, { fields: assetFields('A2') })
    const col = await client.asset.getMany(params)
    expect(col.total).toBe(2)
  })
})

describe('getPublished', () => {
  it('returns only published assets', async () => {
    const a1 = await client.asset.create(params, { fields: assetFields('P1') })
    await client.asset.create(params, { fields: assetFields('P2') })
    await client.asset.publish({ ...params, assetId: a1.sys.id })
    const col = await client.asset.getPublished(params)
    expect(col.total).toBe(1)
    expect(col.items[0].sys.id).toBe(a1.sys.id)
  })
})
