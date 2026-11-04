import { createClient } from 'contentful'

// The real Contentful client. Tests replace this module with the mock client.
export const client = createClient({
  space: import.meta.env.VITE_CONTENTFUL_SPACE_ID,
  accessToken: import.meta.env.VITE_CONTENTFUL_ACCESS_TOKEN,
})
