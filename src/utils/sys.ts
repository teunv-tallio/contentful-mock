import type { EntrySys, AssetSys, ContentTypeSys, SysLink } from '../store/types.js'

let counter = 0
export function generateId(): string {
  return `mock-${Date.now()}-${++counter}`
}

export function makeSpaceLink(spaceId: string): SysLink {
  return { sys: { type: 'Link', linkType: 'Space', id: spaceId } }
}

export function makeEnvironmentLink(environmentId: string): SysLink {
  return { sys: { type: 'Link', linkType: 'Environment', id: environmentId } }
}

export function makeContentTypeLink(contentTypeId: string): SysLink {
  return { sys: { type: 'Link', linkType: 'ContentType', id: contentTypeId } }
}

export function makeEntrySys(
  id: string,
  spaceId: string,
  environmentId: string,
  contentTypeId: string,
): EntrySys {
  const now = new Date().toISOString()
  return {
    id,
    type: 'Entry',
    createdAt: now,
    updatedAt: now,
    version: 1,
    space: makeSpaceLink(spaceId),
    environment: makeEnvironmentLink(environmentId),
    contentType: makeContentTypeLink(contentTypeId),
  }
}

export function makeAssetSys(id: string, spaceId: string, environmentId: string): AssetSys {
  const now = new Date().toISOString()
  return {
    id,
    type: 'Asset',
    createdAt: now,
    updatedAt: now,
    version: 1,
    space: makeSpaceLink(spaceId),
    environment: makeEnvironmentLink(environmentId),
  }
}

export function makeContentTypeSys(
  id: string,
  spaceId: string,
  environmentId: string,
): ContentTypeSys {
  const now = new Date().toISOString()
  return {
    id,
    type: 'ContentType',
    createdAt: now,
    updatedAt: now,
    version: 1,
    space: makeSpaceLink(spaceId),
    environment: makeEnvironmentLink(environmentId),
  }
}

export function bumpVersion<T extends { sys: { version: number; updatedAt: string } }>(
  props: T,
): T {
  return {
    ...props,
    sys: {
      ...props.sys,
      version: props.sys.version + 1,
      updatedAt: new Date().toISOString(),
    },
  }
}
