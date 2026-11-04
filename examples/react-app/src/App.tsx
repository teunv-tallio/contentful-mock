import { useEffect, useState } from 'react'
import { client } from './contentful'

interface BlogPostFields {
  title: string
  body: string
}

const ENTRY_ID = import.meta.env.VITE_CONTENTFUL_ENTRY_ID ?? 'hello-world'

export function App() {
  const [post, setPost] = useState<BlogPostFields | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    client
      .getEntry(ENTRY_ID)
      .then((entry) => setPost(entry.fields as unknown as BlogPostFields))
      .catch((err: Error) => setError(err.message))
  }, [])

  if (error) return <p role="alert">Failed to load: {error}</p>
  if (!post) return <p>Loading…</p>

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
    </article>
  )
}
