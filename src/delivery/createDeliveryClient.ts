import type { MemoryStore } from '../store/MemoryStore.js'
import type { DeliveryQuery } from '../query/QueryEngine.js'
import { QueryEngine } from '../query/QueryEngine.js'
import { ContentfulError } from '../utils/ContentfulError.js'
import { makeCollection } from '../utils/collection.js'
import {
  toCdaEntry,
  toCdaAsset,
  toCdaContentType,
  resolveLinks,
  type CdaEntry,
  type CdaAsset,
} from './transformers.js'

export interface MockDeliveryClientOptions {
  store: MemoryStore
  space?: string
  environment?: string
  locale?: string
}

const qe = new QueryEngine()

export function createDeliveryClient(options: MockDeliveryClientOptions) {
  const spaceId = options.space ?? 'mock-space'
  const environmentId = options.environment ?? 'master'
  const defaultLocale = options.locale ?? 'en-US'
  const { store } = options

  function resolveLocale(query?: DeliveryQuery): string {
    return String(query?.['locale'] ?? defaultLocale)
  }

  function getPublishedEntries() {
    return store
      .listEntries(spaceId, environmentId)
      .filter((s) => s.publishedProps !== undefined)
      .map((s) => s.publishedProps!)
  }

  function getPublishedAssets() {
    return store
      .listAssets(spaceId, environmentId)
      .filter((s) => s.publishedProps !== undefined)
      .map((s) => s.publishedProps!)
  }

  function getPublishedContentTypes() {
    return store
      .listContentTypes(spaceId, environmentId)
      .filter((s) => s.publishedProps !== undefined)
      .map((s) => s.publishedProps!)
  }

  function buildIncludesMap(locale: string, includeDepth: number) {
    if (includeDepth <= 0)
      return { entries: new Map<string, CdaEntry>(), assets: new Map<string, CdaAsset>() }
    const entriesMap = new Map<string, CdaEntry>()
    const assetsMap = new Map<string, CdaAsset>()
    for (const ep of getPublishedEntries()) {
      entriesMap.set(ep.sys.id, toCdaEntry(ep, locale))
    }
    for (const ap of getPublishedAssets()) {
      assetsMap.set(ap.sys.id, toCdaAsset(ap, locale))
    }
    return { entries: entriesMap, assets: assetsMap }
  }

  return {
    getEntry: async (id: string, query?: DeliveryQuery) => {
      const locale = resolveLocale(query)
      const stored = store.getEntry(spaceId, environmentId, id)
      if (!stored.publishedProps) {
        throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
      }
      const includeDepth = Number(query?.['include'] ?? 1)
      const { entries, assets } = buildIncludesMap(locale, includeDepth)
      const cdaEntry = toCdaEntry(stored.publishedProps, locale)
      return resolveLinks(cdaEntry, entries, assets, includeDepth)
    },

    getEntries: async (query?: DeliveryQuery) => {
      const locale = resolveLocale(query)
      const published = getPublishedEntries()
      const result = qe.filterEntries(published, query ?? {}, locale)
      const includeDepth = Number(query?.['include'] ?? 1)
      const { entries, assets } = buildIncludesMap(locale, includeDepth)

      const items = result.items.map((ep) => {
        const cdaEntry = toCdaEntry(ep, locale)
        return resolveLinks(cdaEntry, entries, assets, includeDepth)
      })

      return makeCollection(items, result.total, result.skip, result.limit)
    },

    getEntriesWithCursor: async (query?: DeliveryQuery) => {
      const result = await createDeliveryClient(options).getEntries(query)
      const hasMore = result.skip + result.limit < result.total
      return {
        ...result,
        nextPage: hasMore
          ? async () =>
              createDeliveryClient(options).getEntries({
                ...query,
                skip: result.skip + result.limit,
              })
          : undefined,
      }
    },

    parseEntries: <T>(data: T): T => data,

    getAsset: async (id: string, query?: DeliveryQuery) => {
      const locale = resolveLocale(query)
      const stored = store.getAsset(spaceId, environmentId, id)
      if (!stored.publishedProps) {
        throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
      }
      return toCdaAsset(stored.publishedProps, locale)
    },

    getAssets: async (query?: DeliveryQuery) => {
      const locale = resolveLocale(query)
      const published = getPublishedAssets()
      const result = qe.filterAssets(published, query ?? {}, locale)
      const items = result.items.map((ap) => toCdaAsset(ap, locale))
      return makeCollection(items, result.total, result.skip, result.limit)
    },

    getAssetsWithCursor: async (query?: DeliveryQuery) => {
      const result = await createDeliveryClient(options).getAssets(query)
      const hasMore = result.skip + result.limit < result.total
      return {
        ...result,
        nextPage: hasMore
          ? async () =>
              createDeliveryClient(options).getAssets({
                ...query,
                skip: result.skip + result.limit,
              })
          : undefined,
      }
    },

    createAssetKey: async (_expiresAt: number) => ({
      policy: 'mock-policy',
      secret: 'mock-secret',
    }),

    getContentType: async (id: string) => {
      const stored = store.getContentType(spaceId, environmentId, id)
      if (!stored.publishedProps) {
        throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
      }
      return toCdaContentType(stored.publishedProps)
    },

    getContentTypes: async (query?: { query?: string }) => {
      let contentTypes = getPublishedContentTypes()
      if (query?.query) {
        const q = query.query.toLowerCase()
        contentTypes = contentTypes.filter(
          (ct) => ct.name.toLowerCase().includes(q) || ct.description?.toLowerCase().includes(q),
        )
      }
      const items = contentTypes.map(toCdaContentType)
      return makeCollection(items, items.length, 0, items.length)
    },
  }
}

export type MockDeliveryClient = ReturnType<typeof createDeliveryClient>
