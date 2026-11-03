import type { EntryProps, AssetProps, StoredEntryFields } from '../store/types.js'
import {
  opEq,
  opNe,
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

export type DeliveryQuery = Record<string, string | number | boolean | undefined>

type OperatorFn = (fieldValue: unknown, queryValue: string) => boolean

const OPERATORS: Record<string, OperatorFn> = {
  eq: opEq,
  ne: opNe,
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

// Get a nested value from an object using dot-path notation
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
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
  if (key.startsWith('fields.') || key.startsWith('sys.') || key === 'content_type') {
    return { path: key, operator: 'eq' }
  }
  return null
}

function getEntryFieldValue(entry: EntryProps, path: string, locale: string): unknown {
  if (path.startsWith('fields.')) {
    const fieldId = path.slice('fields.'.length)
    return getLocalizedValue(entry.fields, fieldId, locale)
  }
  if (path.startsWith('sys.')) {
    const sysPath = path.slice('sys.'.length)
    return getNestedValue(entry.sys as unknown as Record<string, unknown>, sysPath)
  }
  return undefined
}

function getAssetFieldValue(asset: AssetProps, path: string, locale: string): unknown {
  if (path.startsWith('fields.')) {
    const fieldId = path.slice('fields.'.length)
    const field = (asset.fields as unknown as StoredEntryFields)[fieldId]
    if (!field) return undefined
    return locale in field ? field[locale] : Object.values(field)[0]
  }
  if (path.startsWith('sys.')) {
    const sysPath = path.slice('sys.'.length)
    return getNestedValue(asset.sys as unknown as Record<string, unknown>, sysPath)
  }
  return undefined
}

export interface QueryResult<T> {
  items: T[]
  total: number
  skip: number
  limit: number
}

export class QueryEngine {
  filterEntries(
    entries: EntryProps[],
    query: DeliveryQuery,
    locale: string,
  ): QueryResult<EntryProps> {
    let filtered = [...entries]

    // Apply filters
    for (const [rawKey, rawValue] of Object.entries(query)) {
      if (['limit', 'skip', 'order', 'select', 'include', 'locale'].includes(rawKey)) continue
      if (rawValue === undefined) continue

      const queryValue = String(rawValue)

      if (rawKey === 'content_type') {
        filtered = filtered.filter((e) => e.sys.contentType.sys.id === queryValue)
        continue
      }

      const parsed = parseQueryKey(rawKey)
      if (!parsed) continue

      const { path, operator } = parsed
      const operatorFn = OPERATORS[operator]
      if (!operatorFn) continue

      filtered = filtered.filter((entry) => {
        const value = getEntryFieldValue(entry, path, locale)
        return operatorFn(value, queryValue)
      })
    }

    // Sort
    if (query['order']) {
      const orderStr = String(query['order'])
      const orderFields = orderStr.split(',').map((f) => f.trim())
      filtered.sort((a, b) => {
        for (const field of orderFields) {
          const desc = field.startsWith('-')
          const path = desc ? field.slice(1) : field
          const aVal = getEntryFieldValue(a, path, locale)
          const bVal = getEntryFieldValue(b, path, locale)
          const cmp = compareValues(aVal, bVal)
          if (cmp !== 0) return desc ? -cmp : cmp
        }
        return 0
      })
    }

    const total = filtered.length
    const skip = Number(query['skip'] ?? 0)
    const limit = Math.min(Number(query['limit'] ?? 100), 1000)

    const items = filtered.slice(skip, skip + limit)

    return { items, total, skip, limit }
  }

  filterAssets(
    assets: AssetProps[],
    query: DeliveryQuery,
    locale: string,
  ): QueryResult<AssetProps> {
    let filtered = [...assets]

    for (const [rawKey, rawValue] of Object.entries(query)) {
      if (['limit', 'skip', 'order', 'select', 'include', 'locale'].includes(rawKey)) continue
      if (rawValue === undefined) continue

      const queryValue = String(rawValue)
      const parsed = parseQueryKey(rawKey)
      if (!parsed) continue

      const { path, operator } = parsed
      const operatorFn = OPERATORS[operator]
      if (!operatorFn) continue

      filtered = filtered.filter((asset) => {
        const value = getAssetFieldValue(asset, path, locale)
        return operatorFn(value, queryValue)
      })
    }

    if (query['order']) {
      const orderStr = String(query['order'])
      const orderFields = orderStr.split(',').map((f) => f.trim())
      filtered.sort((a, b) => {
        for (const field of orderFields) {
          const desc = field.startsWith('-')
          const path = desc ? field.slice(1) : field
          const aVal = getAssetFieldValue(a, path, locale)
          const bVal = getAssetFieldValue(b, path, locale)
          const cmp = compareValues(aVal, bVal)
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
