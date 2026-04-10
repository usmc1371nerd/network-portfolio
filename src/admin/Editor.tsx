import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createPost, getPosts, updatePost, type PostStatus } from '../services/api'

type EditorForm = {
  title: string
  slug: string
  excerpt: string
  content: string
  status: PostStatus
}

const initialForm: EditorForm = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  status: 'draft',
}

export function Editor() {
  const [form, setForm] = useState<EditorForm>(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { id } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('jp_admin_token') ?? ''
  const postId = useMemo(() => (id ? Number(id) : null), [id])

  useEffect(() => {
    const loadPost = async () => {
      if (!postId) {
        return
      }

      try {
        const posts = await getPosts({ scope: 'all', token })
        const existing = posts.find((post) => post.id === postId)

        if (!existing) {
          setError('Post not found')
          return
        }

        setForm({
          title: existing.title,
          slug: existing.slug,
          excerpt: existing.excerpt,
          content: existing.content,
          status: existing.status,
        })
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load post')
      }
    }

    void loadPost()
  }, [postId, token])

  const persist = async (status: PostStatus, forceUpdateButton = false) => {
    setLoading(true)
    setError(null)

    try {
      const payload = {
        ...form,
        status: forceUpdateButton ? form.status : status,
      }

      if (postId) {
        await updatePost(token, postId, payload)
      } else {
        await createPost(token, payload)
      }

      navigate('/admin/dashboard')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h2>{postId ? 'Edit Post' : 'Create Post'}</h2>
      <form className="simple-form" onSubmit={(event) => event.preventDefault()}>
        <label>
          Title
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            required
          />
        </label>
        <label>
          Slug
          <input
            value={form.slug}
            onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
            required
          />
        </label>
        <label>
          Excerpt
          <textarea
            rows={3}
            value={form.excerpt}
            onChange={(event) => setForm((prev) => ({ ...prev, excerpt: event.target.value }))}
            required
          />
        </label>
        <label>
          Markdown Content
          <textarea
            rows={12}
            value={form.content}
            onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
            required
          />
        </label>
        <label>
          Status
          <select
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as PostStatus }))}
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="link-row">
          <button type="button" onClick={() => void persist('draft')} disabled={loading}>
            Save Draft
          </button>
          <button type="button" onClick={() => void persist('published')} disabled={loading}>
            Publish Post
          </button>
          <button type="button" onClick={() => void persist(form.status, true)} disabled={loading}>
            Update Post
          </button>
        </div>
      </form>
    </section>
  )
}
