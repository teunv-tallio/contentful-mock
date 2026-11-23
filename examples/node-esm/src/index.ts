// Plain Node.js ES module consuming the built package (dist/index.js).
// Guards against ESM-only load failures such as issue #1, where a named import
// from a CommonJS dependency crashed the package at import time.
import assert from 'node:assert/strict'
import { MemoryStore, createDeliveryClient, createPlainClient } from '@tallio-be/contentful-mock'

const store = new MemoryStore()
const plain = createPlainClient({ store })
const params = { spaceId: 'space', environmentId: 'master' }

const entry = await plain.entry.create(
  { ...params, contentTypeId: 'post' },
  { fields: { title: { 'en-US': 'Hello' } } },
)

// entry.patch uses fast-json-patch, the dependency that broke the ESM build.
const patched = await plain.entry.patch(
  { ...params, entryId: entry.sys.id },
  [{ op: 'replace', path: '/fields/title/en-US', value: 'Patched' }],
)
assert.equal(patched.fields.title['en-US'], 'Patched')

const delivery = createDeliveryClient({ store })
assert.equal(typeof delivery.getEntries, 'function')

console.log('ESM consumer OK')
