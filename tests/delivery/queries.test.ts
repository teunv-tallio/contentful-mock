import { describe, it, expect, beforeEach } from 'vitest'
import { createStore, SPACE, ENV, LOCALE } from '../helpers.js'
import { makeEntrySys } from '../../src/utils/sys.js'
import { createDeliveryClient } from '../../src/delivery/createDeliveryClient.js'
import type { EntryProps } from '../../src/store/types.js'
import type { MemoryStore } from '../../src/store/MemoryStore.js'

let store: MemoryStore

function client() {
  return createDeliveryClient({ store, space: SPACE, environment: ENV, locale: LOCALE })
}

function publishedEntry(id: string, fields: Record<string, unknown>): EntryProps {
  const localizedFields: Record<string, Record<string, unknown>> = {}
  for (const [k, v] of Object.entries(fields)) {
    localizedFields[k] = { [LOCALE]: v }
  }
  const sys = makeEntrySys(id, SPACE, ENV, 'testCt')
  return {
    sys: {
      ...sys,
      publishedVersion: 1,
      publishedAt: new Date().toISOString(),
      firstPublishedAt: new Date().toISOString(),
    },
    fields: localizedFields,
  }
}

beforeEach(() => {
  store = createStore()
  store.seed(SPACE, ENV, {
    entries: [
      publishedEntry('e1', { title: 'Apple', count: 10, active: true, score: 1.5 }),
      publishedEntry('e2', { title: 'Banana', count: 5, active: false, score: 2.5 }),
      publishedEntry('e3', { title: 'Cherry', count: 20, active: true, score: 3.0 }),
      publishedEntry('e4', { title: 'Apricot', count: 15 }), // no active field
    ],
  })
})

describe('[ne] operator', () => {
  it('filters not equal', async () => {
    const r = await client().getEntries({ 'fields.title[ne]': 'Apple' })
    expect(r.items.map((e) => e.fields['title'])).not.toContain('Apple')
    expect(r.items).toHaveLength(3)
  })
})

describe('[lt] / [lte] / [gt] / [gte] operators', () => {
  it('[lt] filters less than', async () => {
    const r = await client().getEntries({ 'fields.count[lt]': '10' })
    expect(r.items).toHaveLength(1)
    expect(r.items[0].fields['title']).toBe('Banana')
  })

  it('[lte] filters less than or equal', async () => {
    const r = await client().getEntries({ 'fields.count[lte]': '10' })
    expect(r.items).toHaveLength(2)
  })

  it('[gt] filters greater than', async () => {
    const r = await client().getEntries({ 'fields.count[gt]': '15' })
    expect(r.items).toHaveLength(1)
    expect(r.items[0].fields['title']).toBe('Cherry')
  })

  it('[gte] filters greater than or equal', async () => {
    const r = await client().getEntries({ 'fields.count[gte]': '15' })
    expect(r.items).toHaveLength(2)
  })
})

describe('[exists] operator', () => {
  it('[exists]=true returns only entries where field is set', async () => {
    const r = await client().getEntries({ 'fields.active[exists]': 'true' })
    expect(r.items).toHaveLength(3)
  })

  it('[exists]=false returns entries where field is missing', async () => {
    const r = await client().getEntries({ 'fields.active[exists]': 'false' })
    expect(r.items).toHaveLength(1)
    expect(r.items[0].fields['title']).toBe('Apricot')
  })
})

describe('[in] / [nin] operators', () => {
  it('[in] filters to matching values', async () => {
    const r = await client().getEntries({ 'fields.title[in]': 'Apple,Cherry' })
    expect(r.items).toHaveLength(2)
    expect(r.items.map((e) => e.fields['title']).sort()).toEqual(['Apple', 'Cherry'])
  })

  it('[nin] excludes matching values', async () => {
    const r = await client().getEntries({ 'fields.title[nin]': 'Apple,Cherry' })
    expect(r.items).toHaveLength(2)
    expect(r.items.map((e) => e.fields['title'])).not.toContain('Apple')
  })
})

describe('[match] operator', () => {
  it('fuzzy-matches on text field', async () => {
    const r = await client().getEntries({ 'fields.title[match]': 'appl' })
    // Should match "Apple" and potentially "Apricot" depending on threshold
    expect(r.items.length).toBeGreaterThan(0)
    const titles = r.items.map((e) => e.fields['title'])
    expect(titles).toContain('Apple')
  })

  it('returns empty for no match', async () => {
    const r = await client().getEntries({ 'fields.title[match]': 'zzz-no-match-zzz' })
    expect(r.items).toHaveLength(0)
  })
})

describe('[near] operator', () => {
  beforeEach(() => {
    store.reset()
    store.seed(SPACE, ENV, {
      entries: [
        publishedEntry('nyc', {
          title: 'New York',
          location: { lat: 40.7128, lon: -74.006 },
        }),
        publishedEntry('la', {
          title: 'Los Angeles',
          location: { lat: 34.0522, lon: -118.2437 },
        }),
      ],
    })
  })

  it('returns entries within distance', async () => {
    // Search near NYC (40.71, -74.01), within 10km
    const r = await client().getEntries({ 'fields.location[near]': '40.71,-74.01,10' })
    expect(r.items).toHaveLength(1)
    expect(r.items[0].fields['title']).toBe('New York')
  })

  it('returns empty when no entries in range', async () => {
    const r = await client().getEntries({ 'fields.location[near]': '51.5074,-0.1278,10' }) // London
    expect(r.items).toHaveLength(0)
  })
})

describe('[within] operator', () => {
  beforeEach(() => {
    store.reset()
    store.seed(SPACE, ENV, {
      entries: [
        publishedEntry('p1', { title: 'P1', location: { lat: 10, lon: 10 } }),
        publishedEntry('p2', { title: 'P2', location: { lat: 50, lon: 50 } }),
        publishedEntry('p3', { title: 'P3', location: { lat: 90, lon: 90 } }),
      ],
    })
  })

  it('filters points within bounding box', async () => {
    // bbox: 0,0 to 60,60
    const r = await client().getEntries({ 'fields.location[within]': '0,0,60,60' })
    expect(r.items).toHaveLength(2)
    const titles = r.items.map((e) => e.fields['title']).sort()
    expect(titles).toEqual(['P1', 'P2'])
  })
})

describe('sys.id[in] filter', () => {
  it('filters by list of IDs', async () => {
    const r = await client().getEntries({ 'sys.id[in]': 'e1,e3' })
    expect(r.items).toHaveLength(2)
    expect(r.items.map((e) => e.sys.id).sort()).toEqual(['e1', 'e3'])
  })
})
