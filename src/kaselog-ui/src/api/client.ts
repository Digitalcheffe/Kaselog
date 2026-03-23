import type {
  ApiResponse,
  KaseResponse,
  LogResponse,
  LogVersionResponse,
  TagResponse,
  SearchResult,
  UserResponse,
  CollectionResponse,
  CollectionFieldResponse,
  CollectionLayoutResponse,
  CollectionItemResponse,
  CollectionItemHistoryRecord,
  TimelineEntryResponse,
  CreateKaseRequest,
  UpdateKaseRequest,
  CreateLogRequest,
  UpdateLogRequest,
  PinLogRequest,
  CreateVersionRequest,
  UpdateUserRequest,
} from './types'

// ── Base request helper ───────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      cache: 'no-store',
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

  pin: (id: string): Promise<KaseResponse> =>
    request<KaseResponse>(`/api/kases/${id}/pin`, { method: 'POST' }),

  unpin: (id: string): Promise<KaseResponse> =>
    request<KaseResponse>(`/api/kases/${id}/unpin`, { method: 'POST' }),

  /** Triggers a file download for the given export format. */
  export: async (id: string, format: 'markdown' | 'pdf'): Promise<void> => {
    const res = await fetch(`/api/kases/${id}/export?format=${format}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Export failed: ${res.status}`)
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') ?? ''
    const nameMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition)
    const fileName = nameMatch ? nameMatch[1].replace(/['"]/g, '') : `kase.${format === 'pdf' ? 'pdf' : 'md'}`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  },
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

  pin: (id: string, body: PinLogRequest): Promise<LogResponse> =>
    request<LogResponse>(`/api/logs/${id}/pin`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  /** Triggers a file download for the given export format. */
  export: async (id: string, format: 'markdown' | 'pdf'): Promise<void> => {
    const res = await fetch(`/api/logs/${id}/export?format=${format}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Export failed: ${res.status}`)
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') ?? ''
    const nameMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition)
    const fileName = nameMatch ? nameMatch[1].replace(/['"]/g, '') : `log.${format === 'pdf' ? 'pdf' : 'md'}`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  },
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

// ── Collections ───────────────────────────────────────────────────────────────

export const collections = {
  list: (): Promise<CollectionResponse[]> =>
    request<CollectionResponse[]>('/api/collections'),

  get: (id: string): Promise<CollectionResponse> =>
    request<CollectionResponse>(`/api/collections/${id}`),

  create: (body: { title: string; color: string }): Promise<CollectionResponse> =>
    request<CollectionResponse>('/api/collections', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: { title: string; color: string }): Promise<CollectionResponse> =>
    request<CollectionResponse>(`/api/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  getFields: (id: string): Promise<CollectionFieldResponse[]> =>
    request<CollectionFieldResponse[]>(`/api/collections/${id}/fields`),

  createField: (
    id: string,
    body: { name: string; type: string; required: boolean; showInList: boolean; options: string[] | null },
  ): Promise<CollectionFieldResponse> =>
    request<CollectionFieldResponse>(`/api/collections/${id}/fields`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateField: (
    collectionId: string,
    fieldId: string,
    body: { name: string; required: boolean; showInList: boolean; options: string[] | null },
  ): Promise<CollectionFieldResponse> =>
    request<CollectionFieldResponse>(`/api/collections/${collectionId}/fields/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteField: (collectionId: string, fieldId: string): Promise<void> =>
    request<void>(`/api/collections/${collectionId}/fields/${fieldId}`, { method: 'DELETE' }),

  reorderFields: (collectionId: string, fieldIds: string[]): Promise<void> =>
    request<void>(`/api/collections/${collectionId}/fields/reorder`, {
      method: 'PUT',
      body: JSON.stringify(fieldIds),
    }),

  getLayout: (id: string): Promise<CollectionLayoutResponse> =>
    request<CollectionLayoutResponse>(`/api/collections/${id}/layout`),

  updateLayout: (id: string, layout: unknown[]): Promise<void> =>
    request<void>(`/api/collections/${id}/layout`, {
      method: 'PUT',
      body: JSON.stringify({ layout: JSON.stringify(layout) }),
    }),

  getItems: (
    id: string,
    params: {
      q?: string
      kaseId?: string
      fieldFilters?: Record<string, string>
      sort?: string
      dir?: 'asc' | 'desc'
      page?: number
      pageSize?: number
    } = {},
  ): Promise<CollectionItemResponse[]> => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.kaseId) qs.set('kaseId', params.kaseId)
    if (params.fieldFilters) {
      for (const [fieldId, value] of Object.entries(params.fieldFilters)) {
        qs.set(`field[${fieldId}]`, value)
      }
    }
    if (params.sort) qs.set('sort', params.sort)
    if (params.dir) qs.set('dir', params.dir)
    if (params.page != null) qs.set('page', String(params.page))
    if (params.pageSize != null) qs.set('pageSize', String(params.pageSize))
    const query = qs.toString()
    return request<CollectionItemResponse[]>(
      `/api/collections/${id}/items${query ? `?${query}` : ''}`,
    )
  },

  getItem: (id: string): Promise<CollectionItemResponse> =>
    request<CollectionItemResponse>(`/api/items/${id}`),

  createItem: (
    collectionId: string,
    body: { kaseId?: string | null; fieldValues: Record<string, unknown> },
  ): Promise<CollectionItemResponse> =>
    request<CollectionItemResponse>(`/api/collections/${collectionId}/items`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateItem: (
    id: string,
    body: { kaseId?: string | null; fieldValues: Record<string, unknown> },
  ): Promise<CollectionItemResponse> =>
    request<CollectionItemResponse>(`/api/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteItem: (id: string): Promise<void> =>
    request<void>(`/api/items/${id}`, { method: 'DELETE' }),

  getItemHistory: (collectionId: string, itemId: string): Promise<CollectionItemHistoryRecord[]> =>
    request<CollectionItemHistoryRecord[]>(
      `/api/collections/${collectionId}/items/${itemId}/history`,
    ),
}

// ── Kase timeline ─────────────────────────────────────────────────────────────

export const timeline = {
  list: (kaseId: string): Promise<TimelineEntryResponse[]> =>
    request<TimelineEntryResponse[]>(`/api/kases/${kaseId}/timeline`),
}

// ── Search ────────────────────────────────────────────────────────────────────

export const search = {
  query: (params: {
    q?: string
    kaseId?: string
    collectionId?: string
    type?: string
    tag?: string[]
    from?: string
    to?: string
  }): Promise<SearchResult[]> => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.kaseId) qs.set('kaseId', params.kaseId)
    if (params.collectionId) qs.set('collectionId', params.collectionId)
    if (params.type) qs.set('type', params.type)
    if (params.tag) params.tag.forEach(t => qs.append('tag', t))
    if (params.from) qs.set('from', params.from)
    if (params.to) qs.set('to', params.to)
    return request<SearchResult[]>(`/api/search?${qs.toString()}`)
  },
}
