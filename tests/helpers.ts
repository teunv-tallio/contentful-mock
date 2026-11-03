import { MemoryStore } from '../src/store/MemoryStore.js'
import type { EntryProps, AssetProps, ContentTypeProps } from '../src/store/types.js'
import { makeEntrySys, makeAssetSys, makeContentTypeSys } from '../src/utils/sys.js'

export const SPACE = 'test-space'
export const ENV = 'master'
export const LOCALE = 'en-US'

export function createStore() {
  return new MemoryStore()
}

export function makeEntry(
  id: string,
  contentTypeId: string,
  fields: Record<string, Record<string, unknown>>,
  published = false,
): EntryProps {
  const sys = makeEntrySys(id, SPACE, ENV, contentTypeId)
  const props: EntryProps = { sys, fields }
  if (published) {
    props.sys = {
      ...sys,
      publishedVersion: 1,
      publishedAt: new Date().toISOString(),
      firstPublishedAt: new Date().toISOString(),
    }
  }
  return props
}

export function makeAsset(id: string, title: string, published = false): AssetProps {
  const sys = makeAssetSys(id, SPACE, ENV)
  const props: AssetProps = {
    sys,
    fields: {
      title: { [LOCALE]: title },
      file: {
        [LOCALE]: {
          fileName: `${id}.jpg`,
          contentType: 'image/jpeg',
          url: `//mock.contentful.com/assets/${id}.jpg`,
        },
      },
    },
  }
  if (published) {
    props.sys = {
      ...sys,
      publishedVersion: 1,
      publishedAt: new Date().toISOString(),
      firstPublishedAt: new Date().toISOString(),
    }
  }
  return props
}

export function makeContentType(id: string, name: string, published = false): ContentTypeProps {
  const sys = makeContentTypeSys(id, SPACE, ENV)
  const props: ContentTypeProps = {
    sys,
    name,
    description: `${name} content type`,
    displayField: 'title',
    fields: [
      {
        id: 'title',
        name: 'Title',
        type: 'Symbol',
        required: true,
        localized: false,
      },
    ],
  }
  if (published) {
    props.sys = {
      ...sys,
      publishedVersion: 1,
      publishedAt: new Date().toISOString(),
      firstPublishedAt: new Date().toISOString(),
    }
  }
  return props
}
