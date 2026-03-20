// ── API envelope ─────────────────────────────────────────────────────────────

export interface ApiError {
  type: string
  title: string
  status: number
  detail: string | null
}

export interface ApiResponse<T> {
  data: T | null
  error: ApiError | null
  meta: unknown
}

// ── Domain models ────────────────────────────────────────────────────────────

export interface KaseResponse {
  id: string
  title: string
  description: string | null
  logCount: number
  createdAt: string
  updatedAt: string
}

export interface TagResponse {
  id: string
  name: string
  createdAt: string
}

export interface LogResponse {
  id: string
  kaseId: string
  title: string
  description: string | null
  autosaveEnabled: boolean
  content: string
  versionCount: number
  tags: TagResponse[]
  createdAt: string
  updatedAt: string
}

export interface LogVersionResponse {
  id: string
  logId: string
  content: string
  label: string | null
  isAutosave: boolean
  createdAt: string
}

export interface SearchResult {
  logId: string
  kaseId: string
  kaseTitle: string
  title: string
  content: string
  highlight: string
  tags: string[]
  updatedAt: string
}

export interface UserResponse {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  theme: string
  accent: string
  createdAt: string
  updatedAt: string
}

// ── Request bodies ────────────────────────────────────────────────────────────

export interface CreateKaseRequest {
  title: string
  description?: string | null
}

export interface UpdateKaseRequest {
  title: string
  description?: string | null
}

export interface CreateLogRequest {
  title: string
  description?: string | null
  autosaveEnabled?: boolean
}

export interface UpdateLogRequest {
  title: string
  description?: string | null
  autosaveEnabled?: boolean
}

export interface UpdateUserRequest {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  theme: string
  accent: string
}

export interface CreateVersionRequest {
  content: string
  label?: string | null
  isAutosave?: boolean
}
