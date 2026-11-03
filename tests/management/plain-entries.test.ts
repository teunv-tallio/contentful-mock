import { describe, it, expect, beforeEach } from 'vitest'
import { createStore, SPACE, ENV, LOCALE } from '../helpers.js'
import { createPlainClient } from '../../src/management/plain/createPlainClient.js'
import type { MemoryStore } from '../../src/store/MemoryStore.js'

let store: MemoryStore
let client: ReturnType<typeof createPlainClient>

const params = { spaceId: SPACE, environmentId: ENV }

beforeEach(() => {
  store = createStore()
  client = createPlainClient({ store })
})

describe('create + get', () => {
  it('creates an entry and retrieves it', async () => {
    const created = await client.entry.create(
      { ...params, contentTypeId: 'blogPost' },
      { fields: { title: { [LOCALE]: 'My Post' } } },
    )
    expect(created.sys.id).toBeDefined()
    expect(created.fields.title[LOCALE]).toBe('My Post')
    expect(created.sys.version).toBe(1)

    const retrieved = await client.entry.get({ ...params, entryId: created.sys.id })
    expect(retrieved.sys.id).toBe(created.sys.id)
  })

  it('createWithId uses specified id', async () => {
    const created = await client.entry.createWithId(
      { ...params, entryId: 'my-custom-id', contentTypeId: 'blogPost' },
      { fields: { title: { [LOCALE]: 'Custom' } } },
    )
    expect(created.sys.id).toBe('my-custom-id')
  })

  it('throws 409 on duplicate id', async () => {
    await client.entry.createWithId(
      { ...params, entryId: 'dup', contentTypeId: 'blogPost' },
      { fields: {} },
    )
    await expect(
      client.entry.createWithId(
        { ...params, entryId: 'dup', contentTypeId: 'blogPost' },
        { fields: {} },
      ),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('throws 404 for missing entry', async () => {
    await expect(client.entry.get({ ...params, entryId: 'nope' })).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('update', () => {
  it('increments version on update', async () => {
    const created = await client.entry.create(
      { ...params, contentTypeId: 'blogPost' },
      { fields: { title: { [LOCALE]: 'Original' } } },
    )
    const updated = await client.entry.update(
      { ...params, entryId: created.sys.id },
      { fields: { title: { [LOCALE]: 'Updated' } } },
    )
    expect(updated.sys.version).toBe(2)
    expect(updated.fields.title[LOCALE]).toBe('Updated')
  })
})

describe('patch', () => {
  it('applies JSON patch operations', async () => {
    const created = await client.entry.createWithId(
      { ...params, entryId: 'patch-me', contentTypeId: 'blogPost' },
      { fields: { title: { [LOCALE]: 'Before' } } },
    )
    const patched = await client.entry.patch({ ...params, entryId: created.sys.id }, [
      { op: 'replace', path: '/fields/title/en-US', value: 'After' },
    ])
    expect(patched.fields.title[LOCALE]).toBe('After')
  })
})

describe('delete', () => {
  it('deletes an entry', async () => {
    const created = await client.entry.create(
      { ...params, contentTypeId: 'blogPost' },
      { fields: {} },
    )
    await client.entry.delete({ ...params, entryId: created.sys.id })
    await expect(client.entry.get({ ...params, entryId: created.sys.id })).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('publish / unpublish lifecycle', () => {
  it('publishes and sets publishedVersion', async () => {
    const created = await client.entry.create(
      { ...params, contentTypeId: 'blogPost' },
      { fields: { title: { [LOCALE]: 'Publish me' } } },
    )
    const published = await client.entry.publish({ ...params, entryId: created.sys.id })
    expect(published.sys.publishedVersion).toBeDefined()
    expect(published.sys.publishedAt).toBeDefined()
    expect(published.sys.firstPublishedAt).toBeDefined()
  })

  it('unpublishes a published entry', async () => {
    const created = await client.entry.create(
      { ...params, contentTypeId: 'blogPost' },
      { fields: {} },
    )
    await client.entry.publish({ ...params, entryId: created.sys.id })
    const unpublished = await client.entry.unpublish({ ...params, entryId: created.sys.id })
    expect(unpublished.sys.publishedVersion).toBeUndefined()
  })

  it('throws 422 when unpublishing a non-published entry', async () => {
    const created = await client.entry.create(
      { ...params, contentTypeId: 'blogPost' },
      { fields: {} },
    )
    await expect(
      client.entry.unpublish({ ...params, entryId: created.sys.id }),
    ).rejects.toMatchObject({ status: 422 })
  })
})

describe('archive / unarchive lifecycle', () => {
  it('archives and unarchives an entry', async () => {
    const created = await client.entry.create(
      { ...params, contentTypeId: 'blogPost' },
      { fields: {} },
    )
    const archived = await client.entry.archive({ ...params, entryId: created.sys.id })
    expect(archived.sys.archivedAt).toBeDefined()

    const unarchived = await client.entry.unarchive({ ...params, entryId: created.sys.id })
    expect(unarchived.sys.archivedAt).toBeUndefined()
  })

  it('throws 422 when unarchiving a non-archived entry', async () => {
    const created = await client.entry.create(
      { ...params, contentTypeId: 'blogPost' },
      { fields: {} },
    )
    await expect(
      client.entry.unarchive({ ...params, entryId: created.sys.id }),
    ).rejects.toMatchObject({ status: 422 })
  })
})

describe('getMany', () => {
  it('returns all entries in environment', async () => {
    for (let i = 0; i < 3; i++) {
      await client.entry.create({ ...params, contentTypeId: 'blogPost' }, { fields: {} })
    }
    const col = await client.entry.getMany(params)
    expect(col.total).toBe(3)
    expect(col.items).toHaveLength(3)
    expect(col.sys.type).toBe('Array')
  })
})

describe('getPublished', () => {
  it('returns only published entries', async () => {
    const e1 = await client.entry.create({ ...params, contentTypeId: 'blogPost' }, { fields: {} })
    await client.entry.create({ ...params, contentTypeId: 'blogPost' }, { fields: {} })
    await client.entry.publish({ ...params, entryId: e1.sys.id })

    const col = await client.entry.getPublished(params)
    expect(col.total).toBe(1)
    expect(col.items[0].sys.id).toBe(e1.sys.id)
  })
})

describe('references', () => {
  it('returns entry and its direct linked entries', async () => {
    const child = await client.entry.createWithId(
      { ...params, entryId: 'ref-child', contentTypeId: 'page' },
      { fields: { title: { [LOCALE]: 'Child' } } },
    )
    const parent = await client.entry.createWithId(
      { ...params, entryId: 'ref-parent', contentTypeId: 'blogPost' },
      {
        fields: {
          child: { [LOCALE]: { sys: { type: 'Link', linkType: 'Entry', id: child.sys.id } } },
        },
      },
    )

    const refs = await client.entry.references({ ...params, entryId: parent.sys.id, include: 1 })
    const ids = refs.resolved.entries.map((e) => e.sys.id)
    expect(ids).toContain('ref-parent')
    expect(ids).toContain('ref-child')
  })
})
