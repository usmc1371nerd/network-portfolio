import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { getPostBySlug, type BlogPost } from '../services/api'

function getFriendlyBlogErrorMessage(message: string): string {
  return /internal server error/i.test(message)
    ? 'Sorry, we seem to have a failure to communicate.'
    : message
}

export function BlogPost() {
  const { slug } = useParams()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPost = async () => {
      if (!slug) {
        setError('Invalid post slug')
        setLoading(false)
        return
      }

      try {
        const data = await getPostBySlug(slug)
        setPost(data)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? getFriendlyBlogErrorMessage(loadError.message)
            : 'Failed to load post',
        )
      } finally {
        setLoading(false)
      }
    }

    void loadPost()
  }, [slug])

  if (loading) {
    return <p>Loading post...</p>
  }

  if (error || !post) {
    return <p>{error ?? 'Post not found'}</p>
  }

  return (
    <article>
      <h2>{post.title}</h2>
      <p className="meta">Published: {new Date(post.published_at || post.created_at).toLocaleDateString()}</p>
      <MarkdownRenderer markdown={post.content} />
    </article>
  )
}
