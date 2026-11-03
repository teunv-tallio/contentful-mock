export interface SysLink<L extends string = string> {
  sys: {
    type: 'Link'
    linkType: L
    id: string
  }
}

export interface BasicSys {
  id: string
  type: string
  createdAt: string
  updatedAt: string
  version: number
  space: SysLink<'Space'>
  environment: SysLink<'Environment'>
  publishedVersion?: number
  publishedAt?: string
  firstPublishedAt?: string
  archivedAt?: string
  archivedVersion?: number
}

export interface EntrySys extends BasicSys {
  type: 'Entry'
  contentType: SysLink<'ContentType'>
}

export interface AssetSys extends BasicSys {
  type: 'Asset'
}

export interface ContentTypeSys extends BasicSys {
  type: 'ContentType'
  publishedCounter?: number
}

export type LocalizedField<T> = Record<string, T>

export interface StoredEntryFields {
  [fieldId: string]: LocalizedField<unknown>
}

export interface EntryProps {
  sys: EntrySys
  fields: StoredEntryFields
  metadata?: {
    tags?: Array<{ sys: { type: 'Link'; linkType: 'Tag'; id: string } }>
  }
}

export interface AssetFileData {
  fileName: string
  contentType: string
  upload?: string
  url?: string
  details?: Record<string, unknown>
  uploadFrom?: Record<string, unknown>
}

export interface StoredAssetFields {
  title: LocalizedField<string>
  description?: LocalizedField<string>
  file: LocalizedField<AssetFileData>
}

export interface AssetProps {
  sys: AssetSys
  fields: StoredAssetFields
  metadata?: {
    tags?: Array<{ sys: { type: 'Link'; linkType: 'Tag'; id: string } }>
  }
}

export type FieldType =
  | 'Symbol'
  | 'Text'
  | 'RichText'
  | 'Integer'
  | 'Number'
  | 'Date'
  | 'Location'
  | 'Boolean'
  | 'Object'
  | 'Array'
  | 'Link'

export interface ContentTypeFieldValidation {
  in?: unknown[]
  linkContentType?: string[]
  linkMimetypeGroup?: string[]
  range?: { min?: number; max?: number }
  regexp?: { pattern: string; flags?: string }
  unique?: boolean
  size?: { min?: number; max?: number }
  prohibitRegexp?: { pattern: string; flags?: string }
  enabledNodeTypes?: string[]
  enabledMarks?: string[]
  message?: string
}

export interface ContentTypeFieldItem {
  type: string
  linkType?: string
  validations?: ContentTypeFieldValidation[]
}

export interface ContentTypeField {
  id: string
  name: string
  type: FieldType
  required: boolean
  localized: boolean
  disabled?: boolean
  omitted?: boolean
  deleted?: boolean
  linkType?: string
  items?: ContentTypeFieldItem
  validations?: ContentTypeFieldValidation[]
  apiName?: string
  defaultValue?: Record<string, unknown>
}

export interface ContentTypeProps {
  sys: ContentTypeSys
  name: string
  description: string
  displayField: string
  fields: ContentTypeField[]
  metadata?: {
    annotations?: Record<string, unknown>
  }
}

export interface StoredEntry {
  props: EntryProps
  publishedProps?: EntryProps
  archivedProps?: EntryProps
}

export interface StoredAsset {
  props: AssetProps
  publishedProps?: AssetProps
  archivedProps?: AssetProps
}

export interface StoredContentType {
  props: ContentTypeProps
  publishedProps?: ContentTypeProps
}

export interface SeedData {
  entries?: EntryProps[]
  assets?: AssetProps[]
  contentTypes?: ContentTypeProps[]
}
