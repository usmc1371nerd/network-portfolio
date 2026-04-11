import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deletePost, getPosts, type BlogPost } from '../services/api'

export function Dashboard() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const token = localStorage.getItem('jp_admin_token') ?? ''

  const loadPosts = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getPosts({ scope: 'all', token })
      setPosts(data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  const handleDelete = async (id: number) => {
    try {
      await deletePost(token, id)
      await loadPosts()
      setDeletingId(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed')
    }
  }

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'No date set'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <section>
      <h2>Dashboard</h2>
      <div className="link-row">
        <Link to="/admin/editor">Create New Post</Link>
      </div>
      {loading ? <p>Loading...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="card-grid">
        {posts.map((post) => (
          <article key={post.id} className="card">
            <h3>{post.title}</h3>
            <p>{post.excerpt}</p>
            <p className="meta">Status: {post.status}</p>
            <p className="meta">Published: {formatDate(post.published_at || post.created_at)}</p>
            <div className="link-row">
              <Link to={`/admin/edit/${post.id}`}>Edit</Link>
              {deletingId === post.id ? (
                <>
                  <button type="button" onClick={() => void handleDelete(post.id)}>
                    Confirm Delete
                  </button>
                  <button type="button" onClick={() => setDeletingId(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setDeletingId(post.id)}>
                  Delete
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
