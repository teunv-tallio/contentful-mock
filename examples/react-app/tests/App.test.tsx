import type { SeedData } from '@tallio/contentful-mock'
import { render, screen } from '@testing-library/react'

const { SPACE, seedData } = vi.hoisted(() => {
  const SPACE = 'test-space'
  const now = new Date().toISOString()
  const seedData: SeedData = {
    entries: [
      {
        sys: {
          id: 'hello-world',
          type: 'Entry',
          createdAt: now,
          updatedAt: now,
          version: 1,
          publishedVersion: 1,
          publishedAt: now,
          firstPublishedAt: now,
          space: { sys: { type: 'Link', linkType: 'Space', id: SPACE } },
          environment: { sys: { type: 'Link', linkType: 'Environment', id: 'master' } },
          contentType: { sys: { type: 'Link', linkType: 'ContentType', id: 'blogPost' } },
        },
        fields: {
          title: { 'en-US': 'Hello from the mock' },
          body: { 'en-US': 'No network required.' },
        },
      },
    ],
  }
  return { SPACE, seedData }
})

// Swap the real client (src/contentful.ts) for the mock one.
// vi.mock is hoisted, so the factory imports the mock lazily.
vi.mock('../src/contentful', async () => {
  const { MemoryStore, createDeliveryClient } = await import('@tallio/contentful-mock')
  const store = new MemoryStore()
  store.seed(SPACE, 'master', seedData)
  return { client: createDeliveryClient({ store, space: SPACE, environment: 'master' }) }
})

import { App } from '../src/App'

describe('App', () => {
  it('renders the entry fetched through the mock client', async () => {
    render(<App />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Hello from the mock' })).toBeInTheDocument()
    expect(screen.getByText('No network required.')).toBeInTheDocument()
  })
})
