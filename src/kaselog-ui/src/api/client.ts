import type {
  ApiResponse,
  KaseResponse,
  LogResponse,
  LogVersionResponse,
  SearchResult,
  CreateKaseRequest,
  UpdateKaseRequest,
  CreateLogRequest,
  UpdateLogRequest,
  CreateVersionRequest,
} from './types'

// ── Base request helper ───────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (res.status === 204) return undefined as unknown as T
  const envelope: ApiResponse<T> = await res.json() as ApiResponse<T>
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
