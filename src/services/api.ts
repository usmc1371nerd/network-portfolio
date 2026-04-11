export type PostStatus = 'draft' | 'published'

export type BlogPost = {
  id: number
  title: string
  slug: string
  excerpt: string
  content: string
  status: PostStatus
  created_at: string
  updated_at: string
}

type LoginResponse = {
  token: string
}

function getDefaultApiBase(): string {
  if (import.meta.env.DEV) {
    return 'http://localhost:4000/api'
  }

  const hostname = window.location.hostname.replace(/^www\./, '')
  return `https://api.${hostname}/api`
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? getDefaultApiBase()

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(errorBody?.error ?? 'Request failed')
  }

  return (await response.json()) as T
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function getPosts(options?: { scope?: 'published' | 'all'; token?: string }): Promise<BlogPost[]> {
  const scope = options?.scope ?? 'published'
  const query = scope === 'all' ? '?scope=all' : ''

  return request<BlogPost[]>(`/posts${query}`, {
    headers: options?.token
      ? {
          Authorization: `Bearer ${options.token}`,
        }
      : undefined,
  })
}

export async function getPostBySlug(slug: string): Promise<BlogPost> {
  return request<BlogPost>(`/posts/${encodeURIComponent(slug)}`)
}

export async function createPost(token: string, payload: Partial<BlogPost>): Promise<BlogPost> {
  return request<BlogPost>('/posts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function updatePost(token: string, id: number, payload: Partial<BlogPost>): Promise<BlogPost> {
  return request<BlogPost>(`/posts/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function deletePost(token: string, id: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/posts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}
