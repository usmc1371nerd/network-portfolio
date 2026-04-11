import { useEffect, useState } from 'react'
import { BlogCard } from '../components/BlogCard'
import { getPosts, type BlogPost } from '../services/api'

export function BlogList() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const data = await getPosts({ scope: 'published' })
        setPosts(data)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load posts')
      } finally {
        setLoading(false)
      }
    }

    void loadPosts()
  }, [])

  if (loading) {
    return <p>Loading posts...</p>
  }

  if (error) {
    return <p>{error}</p>
  }

  return (
    <section>
      <h2>Blog</h2>
      <div className="card-grid">
        {posts.map((post) => (
          <BlogCard
            key={post.id}
            title={post.title}
            excerpt={post.excerpt}
            slug={post.slug}
            publishDate={post.published_at || post.created_at}
          />
        ))}
      </div>
    </section>
  )
}
