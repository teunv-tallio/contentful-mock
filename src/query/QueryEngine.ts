import type { EntryProps, AssetProps, StoredEntryFields } from '../store/types.js'
import {
  opEq,
  opNe,
  opAll,
  opLt,
  opLte,
  opGt,
  opGte,
  opExists,
  opIn,
  opNin,
  opMatch,
  opNear,
  opWithin,
} from './operators.js'
import { parseSearch, isEmptySearch, searchableValues, scoreSearch } from './fullText.js'

export type DeliveryQuery = Record<string, string | number | boolean | undefined>

type OperatorFn = (fieldValue: unknown, queryValue: string) => boolean

const OPERATORS: Record<string, OperatorFn> = {
  eq: opEq,
  ne: opNe,
  all: opAll,
  lt: opLt,
  lte: opLte,
  gt: opGt,
  gte: opGte,
  exists: opExists,
  in: opIn,
  nin: opNin,
  match: opMatch,
  near: opNear,
  within: opWithin,
}

// Get a nested value from an object using dot-path notation. Arrays along the
// path are mapped over, so `metadata.tags.sys.id` yields the list of tag IDs.
function getNestedValue(obj: unknown, path: string): unknown {
  if (path === '') return obj
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (Array.isArray(current)) {
      current = current
        .map((item) => getNestedValue(item, part))
        .flat()
        .filter((v) => v !== undefined)
      continue
    }
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

// Extract the locale-unwrapped value from a CMA-format localized field
function getLocalizedValue(fields: StoredEntryFields, fieldId: string, locale: string): unknown {
  const field = fields[fieldId]
  if (field === undefined) return undefined
  // Try requested locale, then first available
  if (locale in field) return field[locale]
  const firstKey = Object.keys(field)[0]
  return firstKey ? field[firstKey] : undefined
}

// Parse a query key like "fields.title[match]" → { path: "fields.title", operator: "match" }
// or "sys.id[in]" → { path: "sys.id", operator: "in" }
// or "fields.title" → { path: "fields.title", operator: "eq" }
function parseQueryKey(key: string): { path: string; operator: string } | null {
  const bracketMatch = key.match(/^(.+)\[(\w+)\]$/)
  if (bracketMatch) {
    return { path: bracketMatch[1], operator: bracketMatch[2] }
  }
  // Plain key — treat as equality
  if (
    key.startsWith('fields.') ||
    key.startsWith('sys.') ||
    key.startsWith('metadata.') ||
    key === 'content_type'
  ) {
    return { path: key, operator: 'eq' }
  }
  return null
}

interface QueryableDoc {
  sys: object
  fields: object
  metadata?: object
}

// Resolve a query path against a CMA-format document:
// - `fields.<id>[.<nested>]` → locale-unwrapped field value, then nested path
// - `sys.*` / `metadata.*`    → nested value on sys / metadata
function getDocValue(doc: QueryableDoc, path: string, locale: string): unknown {
  if (path.startsWith('fields.')) {
    const [fieldId, ...rest] = path.slice('fields.'.length).split('.')
    const value = getLocalizedValue(doc.fields as StoredEntryFields, fieldId, locale)
    return rest.length ? getNestedValue(value, rest.join('.')) : value
  }
  if (path.startsWith('sys.')) return getNestedValue(doc.sys, path.slice('sys.'.length))
  if (path === 'metadata' || path.startsWith('metadata.')) {
    return getNestedValue(doc.metadata, path.slice('metadata'.length).replace(/^\./, ''))
  }
  return undefined
}

export interface QueryResult<T> {
  items: T[]
  total: number
  skip: number
  limit: number
}

const NON_FILTER_PARAMS = ['limit', 'skip', 'order', 'select', 'include', 'locale', 'query']

export class QueryEngine {
  filterEntries(
    entries: EntryProps[],
    query: DeliveryQuery,
    locale: string,
  ): QueryResult<EntryProps> {
    return this.run(entries, query, locale, true)
  }

  filterAssets(
    assets: AssetProps[],
    query: DeliveryQuery,
    locale: string,
  ): QueryResult<AssetProps> {
    return this.run(assets, query, locale, false)
  }

  private run<T extends QueryableDoc>(
    docs: T[],
    query: DeliveryQuery,
    locale: string,
    isEntry: boolean,
  ): QueryResult<T> {
    let filtered = [...docs]

    for (const [rawKey, rawValue] of Object.entries(query)) {
      if (NON_FILTER_PARAMS.includes(rawKey)) continue
      if (rawValue === undefined) continue

      const queryValue = String(rawValue)

      if (isEntry && rawKey === 'content_type') {
        filtered = filtered.filter(
          (e) => (e as unknown as EntryProps).sys.contentType.sys.id === queryValue,
        )
        continue
      }

      const parsed = parseQueryKey(rawKey)
      if (!parsed) continue

      const { path, operator } = parsed
      const operatorFn = OPERATORS[operator]
      if (!operatorFn) continue

      filtered = filtered.filter((doc) => operatorFn(getDocValue(doc, path, locale), queryValue))
    }

    // Global full-text search (`query=`), scored for `order=relevance`
    const scores = new Map<T, number>()
    if (query['query'] !== undefined) {
      const search = parseSearch(String(query['query']))
      if (!isEmptySearch(search)) {
        for (const doc of filtered) {
          scores.set(
            doc,
            scoreSearch(searchableValues(doc.fields as Record<string, unknown>), search),
          )
        }
        filtered = filtered.filter((doc) => (scores.get(doc) ?? 0) > 0)
      }
    }

    if (query['order']) {
      const orderFields = String(query['order'])
        .split(',')
        .map((f) => f.trim())
      filtered.sort((a, b) => {
        for (const field of orderFields) {
          const desc = field.startsWith('-')
          const path = desc ? field.slice(1) : field
          // `relevance` (CMA only) sorts best match first; `-relevance` reverses it
          const cmp =
            path === 'relevance'
              ? (scores.get(b) ?? 0) - (scores.get(a) ?? 0)
              : compareValues(getDocValue(a, path, locale), getDocValue(b, path, locale))
          if (cmp !== 0) return desc ? -cmp : cmp
        }
        return 0
      })
    }

    const total = filtered.length
    const skip = Number(query['skip'] ?? 0)
    const limit = Math.min(Number(query['limit'] ?? 100), 1000)

    return { items: filtered.slice(skip, skip + limit), total, skip, limit }
  }
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === undefined || a === null) return -1
  if (b === undefined || b === null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}
