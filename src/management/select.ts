import type { MemoryStore } from '../store/MemoryStore.js'
import type { EntryProps, AssetProps } from '../store/types.js'
import { applySelect } from '../query/select.js'

// Apply `select` to CMA entries, resolving the `fields._displayField` token
// against each entry's content type (draft props, as the CMA does).
export function selectEntries(
  store: MemoryStore,
  spaceId: string,
  environmentId: string,
  items: EntryProps[],
  query: Record<string, unknown>,
): EntryProps[] {
  return applySelect(items, query['select'], {
    hasContentType: query['content_type'] !== undefined,
    resolveDisplayField: (contentTypeId) => {
      try {
        return store.getContentType(spaceId, environmentId, contentTypeId).props.displayField
      } catch {
        return undefined
      }
    },
  })
}

export function selectAssets(items: AssetProps[], query: Record<string, unknown>): AssetProps[] {
  return applySelect(items, query['select'], { hasContentType: true })
}
