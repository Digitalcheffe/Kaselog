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
  entityType: string
  title: string
  content: string
  highlight: string
  tags: string[]
  updatedAt: string
  // Collection item fields
  collectionId: string | null
  collectionTitle: string | null
  collectionColor: string | null
}

export interface UserResponse {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  theme: string
  accent: string
  fontSize: string
  createdAt: string
  updatedAt: string
}

export interface CollectionResponse {
  id: string
  title: string
  color: string
  itemCount: number
  createdAt: string
  updatedAt: string
}

export interface CollectionFieldResponse {
  id: string
  collectionId: string
  name: string
  type: string
  required: boolean
  showInList: boolean
  options: string[] | null
  sortOrder: number
}

export interface CollectionLayoutResponse {
  collectionId: string
  layout: string
}

export interface CollectionItemResponse {
  id: string
  collectionId: string
  kaseId: string | null
  fieldValues: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface TimelineSummaryField {
  name: string
  value: string
}

export interface TimelineEntryResponse {
  entityType: 'log' | 'collection_item'
  id: string
  createdAt: string
  updatedAt: string
  // Log-specific
  title?: string | null
  description?: string | null
  versionCount?: number | null
  tags?: string[]
  // Collection item-specific
  collectionId?: string | null
  collectionTitle?: string | null
  collectionColor?: string | null
  kaseId?: string | null
  itemTitle?: string | null
  summaryFields?: TimelineSummaryField[]
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
  fontSize?: string | null
}

export interface CreateVersionRequest {
  content: string
  label?: string | null
  isAutosave?: boolean
}
