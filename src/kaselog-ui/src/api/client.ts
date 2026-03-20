import type {
  ApiResponse,
  KaseResponse,
  LogResponse,
  LogVersionResponse,
  TagResponse,
  SearchResult,
  UserResponse,
  CreateKaseRequest,
  UpdateKaseRequest,
  CreateLogRequest,
  UpdateLogRequest,
  CreateVersionRequest,
  UpdateUserRequest,
} from './types'

// ── Base request helper ───────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    })
  } catch {
    throw new Error('Network error — backend is not reachable.')
  }
  if (res.status === 204) return undefined as unknown as T
  let envelope: ApiResponse<T>
  try {
    envelope = await res.json() as ApiResponse<T>
  } catch {
    throw new Error(`Server returned an unexpected response (${res.status}).`)
  }
  if (!res.ok) {
    throw new Error(envelope.error?.detail ?? `Request failed: ${res.status}`)
  }
  return envelope.data as T
}

// ── Kases ─────────────────────────────────────────────────────────────────────

export const kases = {
  list: (): Promise<KaseResponse[]> =>
    request<KaseResponse[]>('/api/kases'),

  get: (id: string): Promise<KaseResponse> =>
    request<KaseResponse>(`/api/kases/${id}`),

  create: (body: CreateKaseRequest): Promise<KaseResponse> =>
    request<KaseResponse>('/api/kases', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: UpdateKaseRequest): Promise<KaseResponse> =>
    request<KaseResponse>(`/api/kases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: (id: string): Promise<void> =>
    request<void>(`/api/kases/${id}`, { method: 'DELETE' }),
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export const logs = {
  listByKase: (kaseId: string): Promise<LogResponse[]> =>
    request<LogResponse[]>(`/api/kases/${kaseId}/logs`),

  get: (id: string): Promise<LogResponse> =>
    request<LogResponse>(`/api/logs/${id}`),

  create: (kaseId: string, body: CreateLogRequest): Promise<LogResponse> =>
    request<LogResponse>(`/api/kases/${kaseId}/logs`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: UpdateLogRequest): Promise<LogResponse> =>
    request<LogResponse>(`/api/logs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: (id: string): Promise<void> =>
    request<void>(`/api/logs/${id}`, { method: 'DELETE' }),
}

// ── Log versions ──────────────────────────────────────────────────────────────

export const versions = {
  list: (logId: string): Promise<LogVersionResponse[]> =>
    request<LogVersionResponse[]>(`/api/logs/${logId}/versions`),

  get: (logId: string, versionId: string): Promise<LogVersionResponse> =>
    request<LogVersionResponse>(`/api/logs/${logId}/versions/${versionId}`),

  create: (logId: string, body: CreateVersionRequest): Promise<LogVersionResponse> =>
    request<LogVersionResponse>(`/api/logs/${logId}/versions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  restore: (logId: string, versionId: string): Promise<LogVersionResponse> =>
    request<LogVersionResponse>(
      `/api/logs/${logId}/versions/${versionId}/restore`,
      { method: 'POST' },
    ),
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export const tags = {
  list: (): Promise<TagResponse[]> =>
    request<TagResponse[]>('/api/tags'),

  addToLog: (logId: string, name: string): Promise<TagResponse> =>
    request<TagResponse>(`/api/logs/${logId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  removeFromLog: (logId: string, tagId: string): Promise<void> =>
    request<void>(`/api/logs/${logId}/tags/${tagId}`, { method: 'DELETE' }),
}

// ── Images ────────────────────────────────────────────────────────────────────

export const images = {
  upload: async (file: File): Promise<{ uid: string; url: string }> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/images', { method: 'POST', body: form })
    const envelope = await res.json() as ApiResponse<{ uid: string; url: string }>
    if (!res.ok) {
      throw new Error(envelope.error?.detail ?? `Upload failed: ${res.status}`)
    }
    return envelope.data as { uid: string; url: string }
  },
}

// ── User ──────────────────────────────────────────────────────────────────────

export const user = {
  get: (): Promise<UserResponse> =>
    request<UserResponse>('/api/user'),

  update: (body: UpdateUserRequest): Promise<UserResponse> =>
    request<UserResponse>('/api/user', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
}

// ── Search ────────────────────────────────────────────────────────────────────

export const search = {
  query: (params: {
    q?: string
    kaseId?: string
    tag?: string[]
    from?: string
    to?: string
  }): Promise<SearchResult[]> => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.kaseId) qs.set('kaseId', params.kaseId)
    if (params.tag) params.tag.forEach(t => qs.append('tag', t))
    if (params.from) qs.set('from', params.from)
    if (params.to) qs.set('to', params.to)
    return request<SearchResult[]>(`/api/search?${qs.toString()}`)
  },
}
