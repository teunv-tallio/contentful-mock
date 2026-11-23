import { ContentfulError } from '../utils/ContentfulError.js'

export const DISPLAY_FIELD_TOKEN = 'fields._displayField'
const MAX_SELECT_PROPERTIES = 100
const MAX_SELECT_DEPTH = 2

export interface SelectOptions {
  // Whether the query targets a single content type (`content_type` is set).
  hasContentType: boolean
  // When given, entry semantics apply: `fields.*` selectors require a
  // content type and the CMA `fields._displayField` token is resolved with it.
  resolveDisplayField?: (contentTypeId: string) => string | undefined
}

interface SelectableDoc {
  sys: object
  fields: object
  metadata?: object
}

function invalidSelect(details: string): ContentfulError {
  return new ContentfulError(400, 'Bad Request', 'The query you sent was invalid.', {
    errors: [{ name: 'select', details }],
  })
}

export function parseSelect(select: unknown, options: SelectOptions): string[] | undefined {
  if (select === undefined || select === null || select === '') return undefined
  const tokens = [
    ...new Set(
      String(select)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ]
  if (tokens.length > MAX_SELECT_PROPERTIES) {
    throw invalidSelect(`Select can only contain up to ${MAX_SELECT_PROPERTIES} properties.`)
  }
  for (const token of tokens) {
    if (token.split('.').length > MAX_SELECT_DEPTH) {
      throw invalidSelect(`Select depth is limited to ${MAX_SELECT_DEPTH}: ${token}`)
    }
  }
  if (options.resolveDisplayField && !options.hasContentType) {
    const needsContentType = tokens.find(
      (t) => (t === 'fields' || t.startsWith('fields.')) && t !== DISPLAY_FIELD_TOKEN,
    )
    if (needsContentType) {
      throw invalidSelect(`Selecting "${needsContentType}" requires a content_type parameter.`)
    }
  }
  return tokens
}

// Project a single document onto the selected properties.
export function selectDoc<T extends SelectableDoc>(
  doc: T,
  tokens: string[],
  options: SelectOptions,
): Partial<T> {
  const source = doc as unknown as Record<string, Record<string, unknown> | undefined>
  const result: Record<string, unknown> = {}
  const whole = new Set(tokens.filter((t) => !t.includes('.')))

  for (const token of tokens) {
    const [top, key] = token.split('.')
    if (whole.has(top)) {
      if (source[top] !== undefined) result[top] = source[top]
      continue
    }
    let value: unknown
    let targetKey = key
    if (token === DISPLAY_FIELD_TOKEN && options.resolveDisplayField) {
      const contentTypeId = (doc.sys as { contentType?: { sys: { id: string } } }).contentType?.sys
        .id
      const displayField = contentTypeId ? options.resolveDisplayField(contentTypeId) : undefined
      if (!displayField) continue
      targetKey = displayField
      value = (doc.fields as Record<string, unknown>)[displayField]
    } else {
      value = source[top]?.[key]
    }
    if (value === undefined) continue
    const target = (result[top] ??= {}) as Record<string, unknown>
    target[targetKey] = value
  }
  return result as Partial<T>
}

export function applySelect<T extends SelectableDoc>(
  items: T[],
  select: unknown,
  options: SelectOptions,
): T[] {
  const tokens = parseSelect(select, options)
  if (!tokens) return items
  return items.map((item) => selectDoc(item, tokens, options) as T)
}
