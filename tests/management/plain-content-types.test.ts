import { describe, it, expect, beforeEach } from 'vitest'
import { createStore, SPACE, ENV } from '../helpers.js'
import { createPlainClient } from '../../src/management/plain/createPlainClient.js'
import type { MemoryStore } from '../../src/store/MemoryStore.js'
import type { ContentTypeProps } from '../../src/store/types.js'

let store: MemoryStore
let client: ReturnType<typeof createPlainClient>

const params = { spaceId: SPACE, environmentId: ENV }

function ctData(): Omit<ContentTypeProps, 'sys'> {
  return {
    name: 'Blog Post',
    description: 'A blog post',
    displayField: 'title',
    fields: [
      { id: 'title', name: 'Title', type: 'Symbol', required: true, localized: false },
      { id: 'body', name: 'Body', type: 'Text', required: false, localized: false },
    ],
  }
}

beforeEach(() => {
  store = createStore()
  client = createPlainClient({ store })
})

describe('create + get', () => {
  it('creates a content type', async () => {
    const created = await client.contentType.create(params, ctData())
    expect(created.sys.id).toBeDefined()
    expect(created.name).toBe('Blog Post')
    expect(created.fields).toHaveLength(2)
  })

  it('createWithId uses specified id', async () => {
    const created = await client.contentType.createWithId(
      { ...params, contentTypeId: 'blogPost' },
      ctData(),
    )
    expect(created.sys.id).toBe('blogPost')
  })

  it('throws 409 on duplicate id', async () => {
    await client.contentType.createWithId({ ...params, contentTypeId: 'dup' }, ctData())
    await expect(
      client.contentType.createWithId({ ...params, contentTypeId: 'dup' }, ctData()),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('throws 404 for missing content type', async () => {
    await expect(
      client.contentType.get({ ...params, contentTypeId: 'nope' }),
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('update', () => {
  it('updates name and bumps version', async () => {
    await client.contentType.createWithId({ ...params, contentTypeId: 'ct1' }, ctData())
    const updated = await client.contentType.update(
      { ...params, contentTypeId: 'ct1' },
      { name: 'Updated Name' },
    )
    expect(updated.name).toBe('Updated Name')
    expect(updated.sys.version).toBe(2)
  })
})

describe('delete', () => {
  it('deletes a content type', async () => {
    await client.contentType.createWithId({ ...params, contentTypeId: 'del-me' }, ctData())
    await client.contentType.delete({ ...params, contentTypeId: 'del-me' })
    await expect(
      client.contentType.get({ ...params, contentTypeId: 'del-me' }),
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('publish / unpublish', () => {
  it('publish sets publishedVersion', async () => {
    await client.contentType.createWithId({ ...params, contentTypeId: 'pub-ct' }, ctData())
    const published = await client.contentType.publish({ ...params, contentTypeId: 'pub-ct' })
    expect(published.sys.publishedVersion).toBeDefined()
    expect(published.sys.publishedCounter).toBe(1)
  })

  it('unpublish clears publishedVersion', async () => {
    await client.contentType.createWithId({ ...params, contentTypeId: 'unpub-ct' }, ctData())
    await client.contentType.publish({ ...params, contentTypeId: 'unpub-ct' })
    const unpublished = await client.contentType.unpublish({
      ...params,
      contentTypeId: 'unpub-ct',
    })
    expect(unpublished.sys.publishedVersion).toBeUndefined()
  })

  it('throws 422 when unpublishing non-published', async () => {
    await client.contentType.createWithId({ ...params, contentTypeId: 'np-ct' }, ctData())
    await expect(
      client.contentType.unpublish({ ...params, contentTypeId: 'np-ct' }),
    ).rejects.toMatchObject({ status: 422 })
  })
})

describe('getMany', () => {
  it('lists all content types', async () => {
    await client.contentType.create(params, ctData())
    await client.contentType.create(params, { ...ctData(), name: 'Page' })
    const col = await client.contentType.getMany(params)
    expect(col.total).toBe(2)
    expect(col.sys.type).toBe('Array')
  })

  it('filters by query string', async () => {
    await client.contentType.create(params, ctData())
    await client.contentType.create(params, { ...ctData(), name: 'Page', description: 'A page' })
    const col = await client.contentType.getMany({ ...params, query: { query: 'blog' } })
    expect(col.items).toHaveLength(1)
    expect(col.items[0].name).toBe('Blog Post')
  })
})

describe('omitAndDeleteField', () => {
  it('removes a field from the content type', async () => {
    const created = await client.contentType.createWithId(
      { ...params, contentTypeId: 'ct-omit' },
      ctData(),
    )
    const result = await client.contentType.omitAndDeleteField(
      { ...params, contentTypeId: 'ct-omit' },
      created,
      'body',
    )
    expect(result.fields.map((f) => f.id)).not.toContain('body')
    expect(result.fields).toHaveLength(1)
  })

  it('throws 404 for non-existent field', async () => {
    const created = await client.contentType.createWithId(
      { ...params, contentTypeId: 'ct-omit2' },
      ctData(),
    )
    await expect(
      client.contentType.omitAndDeleteField(
        { ...params, contentTypeId: 'ct-omit2' },
        created,
        'nonexistent',
      ),
    ).rejects.toMatchObject({ status: 404 })
  })
})
