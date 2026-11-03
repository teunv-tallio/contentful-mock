import { applyPatch, type Operation } from 'fast-json-patch'
import type { MemoryStore } from '../../store/MemoryStore.js'
import type {
  EntryProps,
  AssetProps,
  AssetFileData,
  ContentTypeProps,
  StoredEntryFields,
} from '../../store/types.js'
import { ContentfulError } from '../../utils/ContentfulError.js'
import { makeCollection, type Collection } from '../../utils/collection.js'
import { makeEntrySys, makeAssetSys, makeContentTypeSys, bumpVersion } from '../../utils/sys.js'
import { QueryEngine } from '../../query/QueryEngine.js'

export interface ManagementParams {
  spaceId: string
  environmentId: string
}

export interface EntryParams extends ManagementParams {
  entryId: string
}

export interface AssetParams extends ManagementParams {
  assetId: string
}

export interface ContentTypeParams extends ManagementParams {
  contentTypeId: string
}

const qe = new QueryEngine()

function makeEntryNamespace(store: MemoryStore) {
  return {
    get: async (params: EntryParams): Promise<EntryProps> => {
      return store.getEntry(params.spaceId, params.environmentId, params.entryId).props
    },

    getMany: async (
      params: ManagementParams & { query?: Record<string, unknown> },
    ): Promise<Collection<EntryProps>> => {
      const all = store.listEntries(params.spaceId, params.environmentId).map((s) => s.props)
      const query = (params.query ?? {}) as Record<string, string>
      const result = qe.filterEntries(all, query, 'en-US')
      return makeCollection(result.items, result.total, result.skip, result.limit)
    },

    getPublished: async (
      params: ManagementParams & { query?: Record<string, unknown> },
    ): Promise<Collection<EntryProps>> => {
      const all = store
        .listEntries(params.spaceId, params.environmentId)
        .filter((s) => s.publishedProps !== undefined)
        .map((s) => s.publishedProps!)
      const query = (params.query ?? {}) as Record<string, string>
      const result = qe.filterEntries(all, query, 'en-US')
      return makeCollection(result.items, result.total, result.skip, result.limit)
    },

    getManyWithCursor: async (
      params: ManagementParams & { query?: Record<string, unknown> },
    ): Promise<Collection<EntryProps> & { nextPage?: () => Promise<Collection<EntryProps>> }> => {
      const col = await makeEntryNamespace(store).getMany(params)
      const hasMore = col.skip + col.limit < col.total
      return {
        ...col,
        nextPage: hasMore
          ? async () =>
              makeEntryNamespace(store).getMany({
                ...params,
                query: { ...params.query, skip: col.skip + col.limit },
              })
          : undefined,
      }
    },

    getPublishedWithCursor: async (
      params: ManagementParams & { query?: Record<string, unknown> },
    ): Promise<Collection<EntryProps> & { nextPage?: () => Promise<Collection<EntryProps>> }> => {
      const col = await makeEntryNamespace(store).getPublished(params)
      const hasMore = col.skip + col.limit < col.total
      return {
        ...col,
        nextPage: hasMore
          ? async () =>
              makeEntryNamespace(store).getPublished({
                ...params,
                query: { ...params.query, skip: col.skip + col.limit },
              })
          : undefined,
      }
    },

    create: async (
      params: ManagementParams & { contentTypeId: string },
      data: { fields: StoredEntryFields; metadata?: EntryProps['metadata'] },
    ): Promise<EntryProps> => {
      const id = store.generateId()
      const props: EntryProps = {
        sys: makeEntrySys(id, params.spaceId, params.environmentId, params.contentTypeId),
        fields: data.fields,
        ...(data.metadata ? { metadata: data.metadata } : {}),
      }
      return store.createEntry(params.spaceId, params.environmentId, props)
    },

    createWithId: async (
      params: EntryParams & { contentTypeId: string },
      data: { fields: StoredEntryFields; metadata?: EntryProps['metadata'] },
    ): Promise<EntryProps> => {
      const props: EntryProps = {
        sys: makeEntrySys(
          params.entryId,
          params.spaceId,
          params.environmentId,
          params.contentTypeId,
        ),
        fields: data.fields,
        ...(data.metadata ? { metadata: data.metadata } : {}),
      }
      return store.createEntry(params.spaceId, params.environmentId, props)
    },

    update: async (params: EntryParams, data: Partial<EntryProps>): Promise<EntryProps> => {
      const current = store.getEntry(params.spaceId, params.environmentId, params.entryId).props
      const updated = bumpVersion({
        ...current,
        fields: data.fields ?? current.fields,
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
      })
      return store.updateEntry(params.spaceId, params.environmentId, updated)
    },

    patch: async (params: EntryParams, ops: Operation[]): Promise<EntryProps> => {
      const current = store.getEntry(params.spaceId, params.environmentId, params.entryId).props
      const patched = applyPatch(JSON.parse(JSON.stringify(current)), ops).newDocument as EntryProps
      const updated = bumpVersion(patched)
      return store.updateEntry(params.spaceId, params.environmentId, updated)
    },

    delete: async (params: EntryParams): Promise<void> => {
      store.deleteEntry(params.spaceId, params.environmentId, params.entryId)
    },

    publish: async (params: EntryParams, _data?: Partial<EntryProps>): Promise<EntryProps> => {
      return store.publishEntry(params.spaceId, params.environmentId, params.entryId)
    },

    unpublish: async (params: EntryParams): Promise<EntryProps> => {
      return store.unpublishEntry(params.spaceId, params.environmentId, params.entryId)
    },

    archive: async (params: EntryParams): Promise<EntryProps> => {
      return store.archiveEntry(params.spaceId, params.environmentId, params.entryId)
    },

    unarchive: async (params: EntryParams): Promise<EntryProps> => {
      return store.unarchiveEntry(params.spaceId, params.environmentId, params.entryId)
    },

    references: async (
      params: EntryParams & { include?: number },
    ): Promise<{ resolved: { entries: EntryProps[]; assets: AssetProps[] } }> => {
      const entry = store.getEntry(params.spaceId, params.environmentId, params.entryId).props
      const depth = params.include ?? 1
      const visitedEntries = new Map<string, EntryProps>()
      const visitedAssets = new Map<string, AssetProps>()

      function collectRefs(fields: StoredEntryFields, currentDepth: number) {
        if (currentDepth <= 0) return
        for (const localized of Object.values(fields)) {
          for (const value of Object.values(localized)) {
            processValue(value, currentDepth)
          }
        }
      }

      function processValue(value: unknown, currentDepth: number) {
        if (!value || typeof value !== 'object') return
        if (Array.isArray(value)) {
          value.forEach((v) => processValue(v, currentDepth))
          return
        }
        const obj = value as Record<string, unknown>
        const sys = obj['sys'] as Record<string, unknown> | undefined
        if (sys?.['type'] === 'Link') {
          const id = sys['id'] as string
          if (sys['linkType'] === 'Entry' && !visitedEntries.has(id)) {
            try {
              const linked = store.getEntry(params.spaceId, params.environmentId, id).props
              visitedEntries.set(id, linked)
              collectRefs(linked.fields, currentDepth - 1)
            } catch {
              // ignore not found
            }
          }
          if (sys['linkType'] === 'Asset' && !visitedAssets.has(id)) {
            try {
              const linked = store.getAsset(params.spaceId, params.environmentId, id).props
              visitedAssets.set(id, linked)
            } catch {
              // ignore not found
            }
          }
        }
      }

      collectRefs(entry.fields, depth)
      return {
        resolved: {
          entries: [entry, ...visitedEntries.values()],
          assets: [...visitedAssets.values()],
        },
      }
    },
  }
}

function makeAssetNamespace(store: MemoryStore) {
  return {
    get: async (params: AssetParams): Promise<AssetProps> => {
      return store.getAsset(params.spaceId, params.environmentId, params.assetId).props
    },

    getMany: async (
      params: ManagementParams & { query?: Record<string, unknown> },
    ): Promise<Collection<AssetProps>> => {
      const all = store.listAssets(params.spaceId, params.environmentId).map((s) => s.props)
      const query = (params.query ?? {}) as Record<string, string>
      const result = qe.filterAssets(all, query, 'en-US')
      return makeCollection(result.items, result.total, result.skip, result.limit)
    },

    getManyWithCursor: async (
      params: ManagementParams & { query?: Record<string, unknown> },
    ): Promise<Collection<AssetProps> & { nextPage?: () => Promise<Collection<AssetProps>> }> => {
      const col = await makeAssetNamespace(store).getMany(params)
      const hasMore = col.skip + col.limit < col.total
      return {
        ...col,
        nextPage: hasMore
          ? async () =>
              makeAssetNamespace(store).getMany({
                ...params,
                query: { ...params.query, skip: col.skip + col.limit },
              })
          : undefined,
      }
    },

    getPublished: async (
      params: ManagementParams & { query?: Record<string, unknown> },
    ): Promise<Collection<AssetProps>> => {
      const all = store
        .listAssets(params.spaceId, params.environmentId)
        .filter((s) => s.publishedProps !== undefined)
        .map((s) => s.publishedProps!)
      const query = (params.query ?? {}) as Record<string, string>
      const result = qe.filterAssets(all, query, 'en-US')
      return makeCollection(result.items, result.total, result.skip, result.limit)
    },

    getPublishedWithCursor: async (
      params: ManagementParams & { query?: Record<string, unknown> },
    ): Promise<Collection<AssetProps> & { nextPage?: () => Promise<Collection<AssetProps>> }> => {
      const col = await makeAssetNamespace(store).getPublished(params)
      const hasMore = col.skip + col.limit < col.total
      return {
        ...col,
        nextPage: hasMore
          ? async () =>
              makeAssetNamespace(store).getPublished({
                ...params,
                query: { ...params.query, skip: col.skip + col.limit },
              })
          : undefined,
      }
    },

    create: async (
      params: ManagementParams,
      data: { fields: AssetProps['fields']; metadata?: AssetProps['metadata'] },
    ): Promise<AssetProps> => {
      const id = store.generateId()
      const props: AssetProps = {
        sys: makeAssetSys(id, params.spaceId, params.environmentId),
        fields: data.fields,
        ...(data.metadata ? { metadata: data.metadata } : {}),
      }
      return store.createAsset(params.spaceId, params.environmentId, props)
    },

    createWithId: async (
      params: AssetParams,
      data: { fields: AssetProps['fields']; metadata?: AssetProps['metadata'] },
    ): Promise<AssetProps> => {
      const props: AssetProps = {
        sys: makeAssetSys(params.assetId, params.spaceId, params.environmentId),
        fields: data.fields,
        ...(data.metadata ? { metadata: data.metadata } : {}),
      }
      return store.createAsset(params.spaceId, params.environmentId, props)
    },

    update: async (params: AssetParams, data: Partial<AssetProps>): Promise<AssetProps> => {
      const current = store.getAsset(params.spaceId, params.environmentId, params.assetId).props
      const updated = bumpVersion({
        ...current,
        fields: data.fields ?? current.fields,
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
      })
      return store.updateAsset(params.spaceId, params.environmentId, updated)
    },

    delete: async (params: AssetParams): Promise<void> => {
      store.deleteAsset(params.spaceId, params.environmentId, params.assetId)
    },

    publish: async (params: AssetParams, _data?: Partial<AssetProps>): Promise<AssetProps> => {
      return store.publishAsset(params.spaceId, params.environmentId, params.assetId)
    },

    unpublish: async (params: AssetParams): Promise<AssetProps> => {
      return store.unpublishAsset(params.spaceId, params.environmentId, params.assetId)
    },

    archive: async (params: AssetParams): Promise<AssetProps> => {
      return store.archiveAsset(params.spaceId, params.environmentId, params.assetId)
    },

    unarchive: async (params: AssetParams): Promise<AssetProps> => {
      return store.unarchiveAsset(params.spaceId, params.environmentId, params.assetId)
    },

    createFromFiles: async (
      params: ManagementParams,
      files: {
        fields: {
          title: AssetProps['fields']['title']
          description?: AssetProps['fields']['description']
          file: Record<string, AssetFileData & { file?: Buffer | string }>
        }
      },
    ): Promise<AssetProps> => {
      const id = store.generateId()
      const fileFieldWithUrls: AssetProps['fields']['file'] = {}
      for (const [locale, f] of Object.entries(files.fields.file)) {
        const { file: content, ...fileData } = f
        if (content !== undefined) {
          store.storeFile(params.spaceId, params.environmentId, id, locale, content)
        }
        fileFieldWithUrls[locale] = {
          ...fileData,
          url: store.getAssetUrl(params.spaceId, id, locale, f.fileName),
        }
      }
      const props: AssetProps = {
        sys: makeAssetSys(id, params.spaceId, params.environmentId),
        fields: { ...files.fields, file: fileFieldWithUrls },
      }
      return store.createAsset(params.spaceId, params.environmentId, props)
    },

    processForLocale: async (
      params: AssetParams,
      asset: AssetProps,
      locale: string,
    ): Promise<AssetProps> => {
      const fileData = asset.fields.file[locale]
      if (fileData && !fileData.url) {
        const updated = {
          ...asset,
          fields: {
            ...asset.fields,
            file: {
              ...asset.fields.file,
              [locale]: {
                ...fileData,
                url: store.getAssetUrl(params.spaceId, asset.sys.id, locale, fileData.fileName),
              },
            },
          },
        }
        return store.updateAsset(params.spaceId, params.environmentId, updated)
      }
      return asset
    },

    processForAllLocales: async (params: AssetParams, asset: AssetProps): Promise<AssetProps> => {
      const updatedFile: AssetProps['fields']['file'] = {}
      for (const [locale, fileData] of Object.entries(asset.fields.file)) {
        updatedFile[locale] = fileData.url
          ? fileData
          : {
              ...fileData,
              url: store.getAssetUrl(params.spaceId, asset.sys.id, locale, fileData.fileName),
            }
      }
      const hasChanges = Object.keys(updatedFile).some(
        (l) => updatedFile[l].url !== asset.fields.file[l]?.url,
      )
      if (!hasChanges) return asset
      const updated = { ...asset, fields: { ...asset.fields, file: updatedFile } }
      return store.updateAsset(params.spaceId, params.environmentId, updated)
    },
  }
}

function makeContentTypeNamespace(store: MemoryStore) {
  return {
    get: async (params: ContentTypeParams): Promise<ContentTypeProps> => {
      return store.getContentType(params.spaceId, params.environmentId, params.contentTypeId).props
    },

    getMany: async (
      params: ManagementParams & { query?: Record<string, unknown> },
    ): Promise<Collection<ContentTypeProps>> => {
      let all = store.listContentTypes(params.spaceId, params.environmentId).map((s) => s.props)
      if (params.query?.['query']) {
        const q = String(params.query['query']).toLowerCase()
        all = all.filter(
          (ct) => ct.name.toLowerCase().includes(q) || ct.description?.toLowerCase().includes(q),
        )
      }
      const skip = Number(params.query?.['skip'] ?? 0)
      const limit = Math.min(Number(params.query?.['limit'] ?? 100), 1000)
      return makeCollection(all.slice(skip, skip + limit), all.length, skip, limit)
    },

    getManyWithCursor: async (
      params: ManagementParams & { query?: Record<string, unknown> },
    ): Promise<
      Collection<ContentTypeProps> & { nextPage?: () => Promise<Collection<ContentTypeProps>> }
    > => {
      const col = await makeContentTypeNamespace(store).getMany(params)
      const hasMore = col.skip + col.limit < col.total
      return {
        ...col,
        nextPage: hasMore
          ? async () =>
              makeContentTypeNamespace(store).getMany({
                ...params,
                query: { ...params.query, skip: col.skip + col.limit },
              })
          : undefined,
      }
    },

    create: async (
      params: ManagementParams,
      data: Omit<ContentTypeProps, 'sys'>,
    ): Promise<ContentTypeProps> => {
      const id = store.generateId()
      const props: ContentTypeProps = {
        sys: makeContentTypeSys(id, params.spaceId, params.environmentId),
        name: data.name,
        description: data.description,
        displayField: data.displayField,
        fields: data.fields,
        ...(data.metadata ? { metadata: data.metadata } : {}),
      }
      return store.createContentType(params.spaceId, params.environmentId, props)
    },

    createWithId: async (
      params: ContentTypeParams,
      data: Omit<ContentTypeProps, 'sys'>,
    ): Promise<ContentTypeProps> => {
      const props: ContentTypeProps = {
        sys: makeContentTypeSys(params.contentTypeId, params.spaceId, params.environmentId),
        name: data.name,
        description: data.description,
        displayField: data.displayField,
        fields: data.fields,
        ...(data.metadata ? { metadata: data.metadata } : {}),
      }
      return store.createContentType(params.spaceId, params.environmentId, props)
    },

    update: async (
      params: ContentTypeParams,
      data: Partial<ContentTypeProps>,
    ): Promise<ContentTypeProps> => {
      const current = store.getContentType(
        params.spaceId,
        params.environmentId,
        params.contentTypeId,
      ).props
      const updated = bumpVersion({
        ...current,
        name: data.name ?? current.name,
        description: data.description ?? current.description,
        displayField: data.displayField ?? current.displayField,
        fields: data.fields ?? current.fields,
      })
      return store.updateContentType(params.spaceId, params.environmentId, updated)
    },

    delete: async (params: ContentTypeParams): Promise<void> => {
      store.deleteContentType(params.spaceId, params.environmentId, params.contentTypeId)
    },

    publish: async (params: ContentTypeParams): Promise<ContentTypeProps> => {
      return store.publishContentType(params.spaceId, params.environmentId, params.contentTypeId)
    },

    unpublish: async (params: ContentTypeParams): Promise<ContentTypeProps> => {
      return store.unpublishContentType(params.spaceId, params.environmentId, params.contentTypeId)
    },

    omitAndDeleteField: async (
      params: ContentTypeParams,
      _contentType: ContentTypeProps,
      fieldId: string,
    ): Promise<ContentTypeProps> => {
      const current = store.getContentType(
        params.spaceId,
        params.environmentId,
        params.contentTypeId,
      ).props
      const updatedFields = current.fields.filter((f) => f.id !== fieldId)
      if (updatedFields.length === current.fields.length) {
        throw new ContentfulError(404, 'Not Found', `Field ${fieldId} not found.`)
      }
      const updated = bumpVersion({ ...current, fields: updatedFields })
      return store.updateContentType(params.spaceId, params.environmentId, updated)
    },
  }
}

export interface MockManagementClientOptions {
  store: MemoryStore
  defaultSpaceId?: string
  defaultEnvironmentId?: string
}

export function createPlainClient(options: MockManagementClientOptions) {
  const { store } = options
  return {
    entry: makeEntryNamespace(store),
    asset: makeAssetNamespace(store),
    contentType: makeContentTypeNamespace(store),
  }
}

export type MockPlainClient = ReturnType<typeof createPlainClient>
