import type {
  EntryProps,
  AssetProps,
  ContentTypeProps,
  StoredEntry,
  StoredAsset,
  StoredContentType,
  SeedData,
} from './types.js'
import { ContentfulError } from '../utils/ContentfulError.js'

type StoreKey = string // `${spaceId}/${environmentId}/${entityId}`

function makeKey(spaceId: string, environmentId: string, entityId: string): StoreKey {
  return `${spaceId}/${environmentId}/${entityId}`
}

export class MemoryStore {
  private entries = new Map<StoreKey, StoredEntry>()
  private assets = new Map<StoreKey, StoredAsset>()
  private contentTypes = new Map<StoreKey, StoredContentType>()

  // ─── Entries ──────────────────────────────────────────────────────────────

  createEntry(spaceId: string, environmentId: string, props: EntryProps): EntryProps {
    const key = makeKey(spaceId, environmentId, props.sys.id)
    if (this.entries.has(key)) {
      throw new ContentfulError(409, 'Conflict', 'Entry with this ID already exists.')
    }
    this.entries.set(key, { props })
    return { ...props }
  }

  getEntry(
    spaceId: string,
    environmentId: string,
    entryId: string,
  ): StoredEntry {
    const key = makeKey(spaceId, environmentId, entryId)
    const stored = this.entries.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    return stored
  }

  updateEntry(spaceId: string, environmentId: string, props: EntryProps): EntryProps {
    const key = makeKey(spaceId, environmentId, props.sys.id)
    const stored = this.entries.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    stored.props = props
    return { ...props }
  }

  deleteEntry(spaceId: string, environmentId: string, entryId: string): void {
    const key = makeKey(spaceId, environmentId, entryId)
    if (!this.entries.has(key)) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    this.entries.delete(key)
  }

  publishEntry(spaceId: string, environmentId: string, entryId: string): EntryProps {
    const key = makeKey(spaceId, environmentId, entryId)
    const stored = this.entries.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    const now = new Date().toISOString()
    const publishedVersion = stored.props.sys.version
    const updated: EntryProps = {
      ...stored.props,
      sys: {
        ...stored.props.sys,
        publishedVersion,
        publishedAt: now,
        firstPublishedAt: stored.props.sys.firstPublishedAt ?? now,
        updatedAt: now,
      },
    }
    stored.props = updated
    stored.publishedProps = { ...updated }
    return { ...updated }
  }

  unpublishEntry(spaceId: string, environmentId: string, entryId: string): EntryProps {
    const key = makeKey(spaceId, environmentId, entryId)
    const stored = this.entries.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    if (!stored.publishedProps) {
      throw new ContentfulError(422, 'Unprocessable Entity', 'Entry is not published.')
    }
    const updated: EntryProps = {
      ...stored.props,
      sys: {
        ...stored.props.sys,
        publishedVersion: undefined,
        publishedAt: undefined,
        updatedAt: new Date().toISOString(),
      },
    }
    stored.props = updated
    stored.publishedProps = undefined
    return { ...updated }
  }

  archiveEntry(spaceId: string, environmentId: string, entryId: string): EntryProps {
    const key = makeKey(spaceId, environmentId, entryId)
    const stored = this.entries.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    const now = new Date().toISOString()
    const updated: EntryProps = {
      ...stored.props,
      sys: {
        ...stored.props.sys,
        archivedAt: now,
        archivedVersion: stored.props.sys.version,
        updatedAt: now,
      },
    }
    stored.props = updated
    stored.archivedProps = { ...updated }
    return { ...updated }
  }

  unarchiveEntry(spaceId: string, environmentId: string, entryId: string): EntryProps {
    const key = makeKey(spaceId, environmentId, entryId)
    const stored = this.entries.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    if (!stored.archivedProps) {
      throw new ContentfulError(422, 'Unprocessable Entity', 'Entry is not archived.')
    }
    const updated: EntryProps = {
      ...stored.props,
      sys: {
        ...stored.props.sys,
        archivedAt: undefined,
        archivedVersion: undefined,
        updatedAt: new Date().toISOString(),
      },
    }
    stored.props = updated
    stored.archivedProps = undefined
    return { ...updated }
  }

  listEntries(spaceId: string, environmentId: string): StoredEntry[] {
    const prefix = `${spaceId}/${environmentId}/`
    const result: StoredEntry[] = []
    for (const [key, value] of this.entries) {
      if (key.startsWith(prefix)) result.push(value)
    }
    return result
  }

  // ─── Assets ───────────────────────────────────────────────────────────────

  createAsset(spaceId: string, environmentId: string, props: AssetProps): AssetProps {
    const key = makeKey(spaceId, environmentId, props.sys.id)
    if (this.assets.has(key)) {
      throw new ContentfulError(409, 'Conflict', 'Asset with this ID already exists.')
    }
    this.assets.set(key, { props })
    return { ...props }
  }

  getAsset(spaceId: string, environmentId: string, assetId: string): StoredAsset {
    const key = makeKey(spaceId, environmentId, assetId)
    const stored = this.assets.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    return stored
  }

  updateAsset(spaceId: string, environmentId: string, props: AssetProps): AssetProps {
    const key = makeKey(spaceId, environmentId, props.sys.id)
    const stored = this.assets.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    stored.props = props
    return { ...props }
  }

  deleteAsset(spaceId: string, environmentId: string, assetId: string): void {
    const key = makeKey(spaceId, environmentId, assetId)
    if (!this.assets.has(key)) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    this.assets.delete(key)
  }

  publishAsset(spaceId: string, environmentId: string, assetId: string): AssetProps {
    const key = makeKey(spaceId, environmentId, assetId)
    const stored = this.assets.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    const now = new Date().toISOString()
    const updated: AssetProps = {
      ...stored.props,
      sys: {
        ...stored.props.sys,
        publishedVersion: stored.props.sys.version,
        publishedAt: now,
        firstPublishedAt: stored.props.sys.firstPublishedAt ?? now,
        updatedAt: now,
      },
    }
    stored.props = updated
    stored.publishedProps = { ...updated }
    return { ...updated }
  }

  unpublishAsset(spaceId: string, environmentId: string, assetId: string): AssetProps {
    const key = makeKey(spaceId, environmentId, assetId)
    const stored = this.assets.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    if (!stored.publishedProps) {
      throw new ContentfulError(422, 'Unprocessable Entity', 'Asset is not published.')
    }
    const updated: AssetProps = {
      ...stored.props,
      sys: {
        ...stored.props.sys,
        publishedVersion: undefined,
        publishedAt: undefined,
        updatedAt: new Date().toISOString(),
      },
    }
    stored.props = updated
    stored.publishedProps = undefined
    return { ...updated }
  }

  archiveAsset(spaceId: string, environmentId: string, assetId: string): AssetProps {
    const key = makeKey(spaceId, environmentId, assetId)
    const stored = this.assets.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    const now = new Date().toISOString()
    const updated: AssetProps = {
      ...stored.props,
      sys: {
        ...stored.props.sys,
        archivedAt: now,
        archivedVersion: stored.props.sys.version,
        updatedAt: now,
      },
    }
    stored.props = updated
    stored.archivedProps = { ...updated }
    return { ...updated }
  }

  unarchiveAsset(spaceId: string, environmentId: string, assetId: string): AssetProps {
    const key = makeKey(spaceId, environmentId, assetId)
    const stored = this.assets.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    if (!stored.archivedProps) {
      throw new ContentfulError(422, 'Unprocessable Entity', 'Asset is not archived.')
    }
    const updated: AssetProps = {
      ...stored.props,
      sys: {
        ...stored.props.sys,
        archivedAt: undefined,
        archivedVersion: undefined,
        updatedAt: new Date().toISOString(),
      },
    }
    stored.props = updated
    stored.archivedProps = undefined
    return { ...updated }
  }

  listAssets(spaceId: string, environmentId: string): StoredAsset[] {
    const prefix = `${spaceId}/${environmentId}/`
    const result: StoredAsset[] = []
    for (const [key, value] of this.assets) {
      if (key.startsWith(prefix)) result.push(value)
    }
    return result
  }

  // ─── Content Types ────────────────────────────────────────────────────────

  createContentType(
    spaceId: string,
    environmentId: string,
    props: ContentTypeProps,
  ): ContentTypeProps {
    const key = makeKey(spaceId, environmentId, props.sys.id)
    if (this.contentTypes.has(key)) {
      throw new ContentfulError(409, 'Conflict', 'Content type with this ID already exists.')
    }
    this.contentTypes.set(key, { props })
    return { ...props }
  }

  getContentType(
    spaceId: string,
    environmentId: string,
    contentTypeId: string,
  ): StoredContentType {
    const key = makeKey(spaceId, environmentId, contentTypeId)
    const stored = this.contentTypes.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    return stored
  }

  updateContentType(
    spaceId: string,
    environmentId: string,
    props: ContentTypeProps,
  ): ContentTypeProps {
    const key = makeKey(spaceId, environmentId, props.sys.id)
    const stored = this.contentTypes.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    stored.props = props
    return { ...props }
  }

  deleteContentType(spaceId: string, environmentId: string, contentTypeId: string): void {
    const key = makeKey(spaceId, environmentId, contentTypeId)
    if (!this.contentTypes.has(key)) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    this.contentTypes.delete(key)
  }

  publishContentType(
    spaceId: string,
    environmentId: string,
    contentTypeId: string,
  ): ContentTypeProps {
    const key = makeKey(spaceId, environmentId, contentTypeId)
    const stored = this.contentTypes.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    const now = new Date().toISOString()
    const updated: ContentTypeProps = {
      ...stored.props,
      sys: {
        ...stored.props.sys,
        publishedVersion: stored.props.sys.version,
        publishedAt: now,
        firstPublishedAt: stored.props.sys.firstPublishedAt ?? now,
        publishedCounter: (stored.props.sys.publishedCounter ?? 0) + 1,
        updatedAt: now,
      },
    }
    stored.props = updated
    stored.publishedProps = { ...updated }
    return { ...updated }
  }

  unpublishContentType(
    spaceId: string,
    environmentId: string,
    contentTypeId: string,
  ): ContentTypeProps {
    const key = makeKey(spaceId, environmentId, contentTypeId)
    const stored = this.contentTypes.get(key)
    if (!stored) {
      throw new ContentfulError(404, 'Not Found', 'The resource could not be found.')
    }
    if (!stored.publishedProps) {
      throw new ContentfulError(422, 'Unprocessable Entity', 'Content type is not published.')
    }
    const updated: ContentTypeProps = {
      ...stored.props,
      sys: {
        ...stored.props.sys,
        publishedVersion: undefined,
        publishedAt: undefined,
        updatedAt: new Date().toISOString(),
      },
    }
    stored.props = updated
    stored.publishedProps = undefined
    return { ...updated }
  }

  listContentTypes(spaceId: string, environmentId: string): StoredContentType[] {
    const prefix = `${spaceId}/${environmentId}/`
    const result: StoredContentType[] = []
    for (const [key, value] of this.contentTypes) {
      if (key.startsWith(prefix)) result.push(value)
    }
    return result
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  reset(): void {
    this.entries.clear()
    this.assets.clear()
    this.contentTypes.clear()
  }

  seed(spaceId: string, environmentId: string, data: SeedData): void {
    for (const ct of data.contentTypes ?? []) {
      try {
        this.createContentType(spaceId, environmentId, ct)
      } catch {
        this.updateContentType(spaceId, environmentId, ct)
      }
      if (ct.sys.publishedVersion !== undefined) {
        const key = makeKey(spaceId, environmentId, ct.sys.id)
        const stored = this.contentTypes.get(key)
        if (stored) stored.publishedProps = { ...ct }
      }
    }
    for (const asset of data.assets ?? []) {
      try {
        this.createAsset(spaceId, environmentId, asset)
      } catch {
        this.updateAsset(spaceId, environmentId, asset)
      }
      if (asset.sys.publishedVersion !== undefined) {
        const key = makeKey(spaceId, environmentId, asset.sys.id)
        const stored = this.assets.get(key)
        if (stored) stored.publishedProps = { ...asset }
      }
    }
    for (const entry of data.entries ?? []) {
      try {
        this.createEntry(spaceId, environmentId, entry)
      } catch {
        this.updateEntry(spaceId, environmentId, entry)
      }
      if (entry.sys.publishedVersion !== undefined) {
        const key = makeKey(spaceId, environmentId, entry.sys.id)
        const stored = this.entries.get(key)
        if (stored) stored.publishedProps = { ...entry }
      }
    }
  }
}
