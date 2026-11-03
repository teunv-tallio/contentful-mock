import type { EntryProps, AssetProps, ContentTypeProps } from '../store/types.js'

// CDA Entry sys shape
interface CdaEntrySys {
  id: string
  type: 'Entry'
  createdAt: string
  updatedAt: string
  locale: string
  revision: number
  contentType: { sys: { type: 'Link'; linkType: 'ContentType'; id: string } }
  space: { sys: { type: 'Link'; linkType: 'Space'; id: string } }
  environment: { sys: { type: 'Link'; linkType: 'Environment'; id: string } }
}

// CDA Asset sys shape
interface CdaAssetSys {
  id: string
  type: 'Asset'
  createdAt: string
  updatedAt: string
  locale: string
  revision: number
  space: { sys: { type: 'Link'; linkType: 'Space'; id: string } }
  environment: { sys: { type: 'Link'; linkType: 'Environment'; id: string } }
}

// Unwrap localized fields: { title: { "en-US": "Hello" } } → { title: "Hello" }
function unwrapFields(
  fields: Record<string, Record<string, unknown>>,
  locale: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [fieldId, localizedValue] of Object.entries(fields)) {
    if (locale in localizedValue) {
      result[fieldId] = localizedValue[locale]
    } else {
      const firstKey = Object.keys(localizedValue)[0]
      if (firstKey !== undefined) {
        result[fieldId] = localizedValue[firstKey]
      }
    }
  }
  return result
}

export interface CdaEntry {
  sys: CdaEntrySys
  fields: Record<string, unknown>
  metadata?: EntryProps['metadata']
}

export interface CdaAsset {
  sys: CdaAssetSys
  fields: {
    title?: string
    description?: string
    file?: {
      fileName: string
      contentType: string
      url?: string
      details?: Record<string, unknown>
    }
  }
  metadata?: AssetProps['metadata']
}

export interface CdaContentType {
  sys: {
    id: string
    type: 'ContentType'
    createdAt: string
    updatedAt: string
    revision: number
    space: { sys: { type: 'Link'; linkType: 'Space'; id: string } }
    environment: { sys: { type: 'Link'; linkType: 'Environment'; id: string } }
  }
  name: string
  description: string
  displayField: string
  fields: ContentTypeProps['fields']
}

export function toCdaEntry(props: EntryProps, locale: string): CdaEntry {
  return {
    sys: {
      id: props.sys.id,
      type: 'Entry',
      createdAt: props.sys.createdAt,
      updatedAt: props.sys.updatedAt,
      locale,
      revision: props.sys.publishedVersion ?? props.sys.version,
      contentType: props.sys.contentType,
      space: props.sys.space,
      environment: props.sys.environment,
    },
    fields: unwrapFields(props.fields as Record<string, Record<string, unknown>>, locale),
    ...(props.metadata ? { metadata: props.metadata } : {}),
  }
}

export function toCdaAsset(props: AssetProps, locale: string): CdaAsset {
  const title =
    locale in props.fields.title ? props.fields.title[locale] : Object.values(props.fields.title)[0]
  const description = props.fields.description
    ? locale in props.fields.description
      ? props.fields.description[locale]
      : Object.values(props.fields.description)[0]
    : undefined
  const file =
    locale in props.fields.file ? props.fields.file[locale] : Object.values(props.fields.file)[0]

  return {
    sys: {
      id: props.sys.id,
      type: 'Asset',
      createdAt: props.sys.createdAt,
      updatedAt: props.sys.updatedAt,
      locale,
      revision: props.sys.publishedVersion ?? props.sys.version,
      space: props.sys.space,
      environment: props.sys.environment,
    },
    fields: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(file
        ? {
            file: {
              fileName: file.fileName,
              contentType: file.contentType,
              ...(file.url ? { url: file.url } : {}),
              ...(file.details ? { details: file.details } : {}),
            },
          }
        : {}),
    },
    ...(props.metadata ? { metadata: props.metadata } : {}),
  }
}

export function toCdaContentType(props: ContentTypeProps): CdaContentType {
  return {
    sys: {
      id: props.sys.id,
      type: 'ContentType',
      createdAt: props.sys.createdAt,
      updatedAt: props.sys.updatedAt,
      revision: props.sys.publishedVersion ?? props.sys.version,
      space: props.sys.space,
      environment: props.sys.environment,
    },
    name: props.name,
    description: props.description,
    displayField: props.displayField,
    fields: props.fields,
  }
}

// Resolve links in CDA entry fields up to `depth` levels
export function resolveLinks(
  entry: CdaEntry,
  allEntries: Map<string, CdaEntry>,
  allAssets: Map<string, CdaAsset>,
  depth: number,
  visited = new Set<string>(),
): CdaEntry {
  if (depth <= 0 || visited.has(entry.sys.id)) return entry
  visited.add(entry.sys.id)

  const resolvedFields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entry.fields)) {
    // Pass depth (not depth-1): resolveValue decrements before recursing into resolveLinks
    resolvedFields[key] = resolveValue(value, allEntries, allAssets, depth, visited)
  }
  return { ...entry, fields: resolvedFields }
}

function resolveValue(
  value: unknown,
  allEntries: Map<string, CdaEntry>,
  allAssets: Map<string, CdaAsset>,
  depth: number,
  visited: Set<string>,
): unknown {
  if (!value || typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((v) => resolveValue(v, allEntries, allAssets, depth, visited))
  }

  const obj = value as Record<string, unknown>
  const sys = obj['sys'] as Record<string, unknown> | undefined
  if (sys && sys['type'] === 'Link') {
    const id = sys['id'] as string
    if (sys['linkType'] === 'Entry' && depth > 0) {
      const linked = allEntries.get(id)
      if (linked) return resolveLinks(linked, allEntries, allAssets, depth - 1, visited)
    }
    if (sys['linkType'] === 'Asset' && depth > 0) {
      const linked = allAssets.get(id)
      if (linked) return linked
    }
    return value // unresolved link
  }

  return value
}
