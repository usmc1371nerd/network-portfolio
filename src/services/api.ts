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
  published_at: string | null
}

type LoginResponse = {
  token: string
}

export type SetupStatus = {
  adminExists: boolean
  setupEnabled: boolean
}

function normalizeApiBase(apiBase: string): string {
  const trimmed = apiBase.trim().replace(/\/+$/, '')
  if (!trimmed) {
    return ''
  }

  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

function getDefaultApiBases(): string[] {
  if (import.meta.env.DEV) {
    return ['http://localhost:4000/api']
  }

  const hostname = window.location.hostname.replace(/^www\./, '')
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return ['http://localhost:4000/api']
  }

  const derivedSubdomainBase = `https://api.${hostname}/api`
  const sameOriginBase = `${window.location.origin.replace(/\/+$/, '')}/api`

  return [derivedSubdomainBase, sameOriginBase]
}

const configuredPrimaryBase = normalizeApiBase(import.meta.env.VITE_API_BASE_URL ?? '')
const configuredFallbackBases = (import.meta.env.VITE_API_BASE_FALLBACKS ?? '')
  .split(',')
  .map((base: string) => normalizeApiBase(base))
  .filter(Boolean)
const defaultBases = getDefaultApiBases()

const API_BASES = [
  configuredPrimaryBase,
  ...configuredFallbackBases,
  ...defaultBases,
]
  .filter(Boolean)
  .filter((base, index, bases) => bases.indexOf(base) === index)

let activeApiBase = API_BASES[0]

type RequestError = Error & { status?: number }

async function requestFromBase<T>(apiBase: string, path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null
    const error = new Error(errorBody?.error ?? `Request failed (${response.status})`) as RequestError
    error.status = response.status
    throw error
  }

  return (await response.json()) as T
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const canTryFallbackBases = method === 'GET' || method === 'HEAD'
  const candidateBases = canTryFallbackBases
    ? [activeApiBase, ...API_BASES.filter((base) => base !== activeApiBase)]
    : [activeApiBase]

  let latestError: unknown = null

  for (let index = 0; index < candidateBases.length; index += 1) {
    const apiBase = candidateBases[index]

    try {
      const payload = await requestFromBase<T>(apiBase, path, options)
      activeApiBase = apiBase
      return payload
    } catch (error) {
      latestError = error
      const errorStatus = (error as RequestError)?.status
      const isServerOrNetworkError = typeof errorStatus !== 'number' || errorStatus >= 500
      const hasMoreCandidates = index < candidateBases.length - 1

      if (!(canTryFallbackBases && isServerOrNetworkError && hasMoreCandidates)) {
        throw error
      }
    }
  }

  if (latestError instanceof Error) {
    throw latestError
  }

  throw new Error('Request failed')
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function getSetupStatus(): Promise<SetupStatus> {
  return request<SetupStatus>('/setup/status')
}

export async function bootstrapAdmin(
  email: string,
  password: string,
  setupSecret: string,
): Promise<LoginResponse> {
  return request<LoginResponse>('/setup/bootstrap-admin', {
    method: 'POST',
    body: JSON.stringify({ email, password, setupSecret }),
  })
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/account/change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
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
