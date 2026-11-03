import type { MemoryStore } from '../../store/MemoryStore.js'
import type {
  EntryProps,
  AssetProps,
  ContentTypeProps,
  StoredEntryFields,
} from '../../store/types.js'
import { makeEntrySys, makeAssetSys, makeContentTypeSys, bumpVersion } from '../../utils/sys.js'
import { makeCollection } from '../../utils/collection.js'
import { QueryEngine } from '../../query/QueryEngine.js'

const qe = new QueryEngine()

// ─── Entry entity ──────────────────────────────────────────────────────────

function makeEntryEntity(
  store: MemoryStore,
  spaceId: string,
  environmentId: string,
  props: EntryProps,
) {
  let current = props

  return {
    ...current,
    get sys() {
      return current.sys
    },
    get fields() {
      return current.fields
    },
    get metadata() {
      return current.metadata
    },
    update: async (data?: { fields?: StoredEntryFields }) => {
      const updated = bumpVersion({ ...current, fields: data?.fields ?? current.fields })
      current = store.updateEntry(spaceId, environmentId, updated)
      return makeEntryEntity(store, spaceId, environmentId, current)
    },
    delete: async () => {
      store.deleteEntry(spaceId, environmentId, current.sys.id)
    },
    publish: async () => {
      current = store.publishEntry(spaceId, environmentId, current.sys.id)
      return makeEntryEntity(store, spaceId, environmentId, current)
    },
    unpublish: async () => {
      current = store.unpublishEntry(spaceId, environmentId, current.sys.id)
      return makeEntryEntity(store, spaceId, environmentId, current)
    },
    archive: async () => {
      current = store.archiveEntry(spaceId, environmentId, current.sys.id)
      return makeEntryEntity(store, spaceId, environmentId, current)
    },
    unarchive: async () => {
      current = store.unarchiveEntry(spaceId, environmentId, current.sys.id)
      return makeEntryEntity(store, spaceId, environmentId, current)
    },
  }
}

// ─── Asset entity ──────────────────────────────────────────────────────────

function makeAssetEntity(
  store: MemoryStore,
  spaceId: string,
  environmentId: string,
  props: AssetProps,
) {
  let current = props

  return {
    ...current,
    get sys() {
      return current.sys
    },
    get fields() {
      return current.fields
    },
    update: async (data?: { fields?: AssetProps['fields'] }) => {
      const updated = bumpVersion({ ...current, fields: data?.fields ?? current.fields })
      current = store.updateAsset(spaceId, environmentId, updated)
      return makeAssetEntity(store, spaceId, environmentId, current)
    },
    delete: async () => {
      store.deleteAsset(spaceId, environmentId, current.sys.id)
    },
    publish: async () => {
      current = store.publishAsset(spaceId, environmentId, current.sys.id)
      return makeAssetEntity(store, spaceId, environmentId, current)
    },
    unpublish: async () => {
      current = store.unpublishAsset(spaceId, environmentId, current.sys.id)
      return makeAssetEntity(store, spaceId, environmentId, current)
    },
    archive: async () => {
      current = store.archiveAsset(spaceId, environmentId, current.sys.id)
      return makeAssetEntity(store, spaceId, environmentId, current)
    },
    unarchive: async () => {
      current = store.unarchiveAsset(spaceId, environmentId, current.sys.id)
      return makeAssetEntity(store, spaceId, environmentId, current)
    },
  }
}

// ─── ContentType entity ────────────────────────────────────────────────────

function makeContentTypeEntity(
  store: MemoryStore,
  spaceId: string,
  environmentId: string,
  props: ContentTypeProps,
) {
  let current = props

  return {
    ...current,
    get sys() {
      return current.sys
    },
    get name() {
      return current.name
    },
    get fields() {
      return current.fields
    },
    update: async (data?: Partial<Omit<ContentTypeProps, 'sys'>>) => {
      const updated = bumpVersion({
        ...current,
        name: data?.name ?? current.name,
        description: data?.description ?? current.description,
        displayField: data?.displayField ?? current.displayField,
        fields: data?.fields ?? current.fields,
      })
      current = store.updateContentType(spaceId, environmentId, updated)
      return makeContentTypeEntity(store, spaceId, environmentId, current)
    },
    delete: async () => {
      store.deleteContentType(spaceId, environmentId, current.sys.id)
    },
    publish: async () => {
      current = store.publishContentType(spaceId, environmentId, current.sys.id)
      return makeContentTypeEntity(store, spaceId, environmentId, current)
    },
    unpublish: async () => {
      current = store.unpublishContentType(spaceId, environmentId, current.sys.id)
      return makeContentTypeEntity(store, spaceId, environmentId, current)
    },
  }
}

// ─── Environment entity ────────────────────────────────────────────────────

function makeEnvironmentEntity(store: MemoryStore, spaceId: string, environmentId: string) {
  return {
    sys: {
      id: environmentId,
      type: 'Environment',
      space: { sys: { type: 'Link', linkType: 'Space', id: spaceId } },
    },

    // Entries
    createEntry: async (contentTypeId: string, data: { fields: StoredEntryFields }) => {
      const id = store.generateId()
      const props: EntryProps = {
        sys: makeEntrySys(id, spaceId, environmentId, contentTypeId),
        fields: data.fields,
      }
      const created = store.createEntry(spaceId, environmentId, props)
      return makeEntryEntity(store, spaceId, environmentId, created)
    },

    createEntryWithId: async (
      contentTypeId: string,
      entryId: string,
      data: { fields: StoredEntryFields },
    ) => {
      const props: EntryProps = {
        sys: makeEntrySys(entryId, spaceId, environmentId, contentTypeId),
        fields: data.fields,
      }
      const created = store.createEntry(spaceId, environmentId, props)
      return makeEntryEntity(store, spaceId, environmentId, created)
    },

    getEntry: async (id: string) => {
      const stored = store.getEntry(spaceId, environmentId, id)
      return makeEntryEntity(store, spaceId, environmentId, stored.props)
    },

    getEntries: async (query?: Record<string, unknown>) => {
      const all = store.listEntries(spaceId, environmentId).map((s) => s.props)
      const result = qe.filterEntries(all, (query ?? {}) as Record<string, string>, 'en-US')
      const items = result.items.map((p) => makeEntryEntity(store, spaceId, environmentId, p))
      return makeCollection(items, result.total, result.skip, result.limit)
    },

    // Assets
    createAsset: async (data: { fields: AssetProps['fields'] }) => {
      const id = store.generateId()
      const props: AssetProps = {
        sys: makeAssetSys(id, spaceId, environmentId),
        fields: data.fields,
      }
      const created = store.createAsset(spaceId, environmentId, props)
      return makeAssetEntity(store, spaceId, environmentId, created)
    },

    createAssetWithId: async (assetId: string, data: { fields: AssetProps['fields'] }) => {
      const props: AssetProps = {
        sys: makeAssetSys(assetId, spaceId, environmentId),
        fields: data.fields,
      }
      const created = store.createAsset(spaceId, environmentId, props)
      return makeAssetEntity(store, spaceId, environmentId, created)
    },

    getAsset: async (id: string) => {
      const stored = store.getAsset(spaceId, environmentId, id)
      return makeAssetEntity(store, spaceId, environmentId, stored.props)
    },

    getAssets: async (query?: Record<string, unknown>) => {
      const all = store.listAssets(spaceId, environmentId).map((s) => s.props)
      const result = qe.filterAssets(all, (query ?? {}) as Record<string, string>, 'en-US')
      const items = result.items.map((p) => makeAssetEntity(store, spaceId, environmentId, p))
      return makeCollection(items, result.total, result.skip, result.limit)
    },

    // Content Types
    createContentType: async (data: Omit<ContentTypeProps, 'sys'>) => {
      const id = store.generateId()
      const props: ContentTypeProps = {
        sys: makeContentTypeSys(id, spaceId, environmentId),
        name: data.name,
        description: data.description,
        displayField: data.displayField,
        fields: data.fields,
      }
      const created = store.createContentType(spaceId, environmentId, props)
      return makeContentTypeEntity(store, spaceId, environmentId, created)
    },

    createContentTypeWithId: async (contentTypeId: string, data: Omit<ContentTypeProps, 'sys'>) => {
      const props: ContentTypeProps = {
        sys: makeContentTypeSys(contentTypeId, spaceId, environmentId),
        name: data.name,
        description: data.description,
        displayField: data.displayField,
        fields: data.fields,
      }
      const created = store.createContentType(spaceId, environmentId, props)
      return makeContentTypeEntity(store, spaceId, environmentId, created)
    },

    getContentType: async (id: string) => {
      const stored = store.getContentType(spaceId, environmentId, id)
      return makeContentTypeEntity(store, spaceId, environmentId, stored.props)
    },

    getContentTypes: async (query?: { query?: string }) => {
      let all = store.listContentTypes(spaceId, environmentId).map((s) => s.props)
      if (query?.query) {
        const q = query.query.toLowerCase()
        all = all.filter(
          (ct) => ct.name.toLowerCase().includes(q) || ct.description?.toLowerCase().includes(q),
        )
      }
      const items = all.map((p) => makeContentTypeEntity(store, spaceId, environmentId, p))
      return makeCollection(items, items.length, 0, items.length)
    },
  }
}

// ─── Space entity ──────────────────────────────────────────────────────────

function makeSpaceEntity(store: MemoryStore, spaceId: string) {
  return {
    sys: {
      id: spaceId,
      type: 'Space',
    },
    getEnvironment: async (environmentId: string) => {
      return makeEnvironmentEntity(store, spaceId, environmentId)
    },
  }
}

// ─── Chained client ────────────────────────────────────────────────────────

export interface MockManagementChainedOptions {
  store: MemoryStore
  defaultSpaceId?: string
  defaultEnvironmentId?: string
}

export function createChainedClient(options: MockManagementChainedOptions) {
  const { store } = options
  return {
    getSpace: async (spaceId: string) => makeSpaceEntity(store, spaceId),
  }
}

export type MockChainedClient = ReturnType<typeof createChainedClient>
