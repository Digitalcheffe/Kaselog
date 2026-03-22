import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CollectionItemPage from '../pages/CollectionItemPage'
import type {
  CollectionResponse,
  CollectionFieldResponse,
  CollectionLayoutResponse,
  CollectionItemResponse,
} from '../api/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  collections: {
    get: vi.fn(),
    getFields: vi.fn(),
    getLayout: vi.fn(),
    getItem: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    getItemHistory: vi.fn(),
  },
  kases: { list: vi.fn() },
  images: { upload: vi.fn() },
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

import { collections as collectionsApi, kases as kasesApi } from '../api/client'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COL_ID  = '00000000-0000-0000-0000-000000000001'
const ITEM_ID = '00000000-0000-0000-0000-000000000002'

function makeCollection(): CollectionResponse {
  return { id: COL_ID, title: 'Vinyl Records', color: 'teal', itemCount: 1, createdAt: '', updatedAt: '' }
}

function makeField(overrides: Partial<CollectionFieldResponse> = {}): CollectionFieldResponse {
  return {
    id: 'f-text', collectionId: COL_ID, name: 'Album', type: 'text',
    required: false, showInList: true, options: null, sortOrder: 0,
    ...overrides,
  }
}

function emptyLayout(): CollectionLayoutResponse {
  return { collectionId: COL_ID, layout: '[]' }
}

function populatedLayout(fieldId: string): CollectionLayoutResponse {
  return {
    collectionId: COL_ID,
    layout: JSON.stringify([{ cells: [{ kind: 'field', fieldId, span: 2 }, null] }]),
  }
}

function makeItem(overrides: Partial<CollectionItemResponse> = {}): CollectionItemResponse {
  return {
    id: ITEM_ID, collectionId: COL_ID, kaseId: null,
    fieldValues: {}, createdAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-01T10:00:00Z',
    ...overrides,
  }
}

// ── Render helpers ─────────────────────────────────────────────────────────────

function renderNew() {
  return render(
    <MemoryRouter initialEntries={[`/items/new?collectionId=${COL_ID}`]}>
      <Routes>
        <Route path="/items/new" element={<CollectionItemPage />} />
        <Route path="/items/:id" element={<CollectionItemPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderExisting(itemId = ITEM_ID) {
  return render(
    <MemoryRouter initialEntries={[`/items/${itemId}`]}>
      <Routes>
        <Route path="/items/:id" element={<CollectionItemPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(kasesApi.list).mockResolvedValue([])
  vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
  vi.mocked(collectionsApi.getItemHistory).mockResolvedValue([])
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CollectionItemPage — layout fallback', () => {
  it('when layout is empty and schema has fields, all fields render as inputs in Edit mode', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f1', name: 'Album', type: 'text', sortOrder: 0 }),
      makeField({ id: 'f2', name: 'Artist', type: 'text', sortOrder: 1 }),
    ])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(emptyLayout())

    renderNew()

    await waitFor(() => {
      expect(screen.getByLabelText('Album')).toBeInTheDocument()
      expect(screen.getByLabelText('Artist')).toBeInTheDocument()
    })
  })

  it('when layout is empty and schema has fields, all field values render in View mode', async () => {
    const FIELD_ID = 'f-album'
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: FIELD_ID, name: 'Album', type: 'text', sortOrder: 0 }),
    ])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(emptyLayout())
    vi.mocked(collectionsApi.getItem).mockResolvedValue(
      makeItem({ fieldValues: { [FIELD_ID]: 'Kind of Blue' } }),
    )

    renderExisting()

    // Default mode for existing items is view
    await waitFor(() => screen.getByText('Kind of Blue'))
    expect(screen.getByText('Kind of Blue')).toBeInTheDocument()
  })

  it('when layout has rows, layout-based rendering is used', async () => {
    const PLACED_ID = 'f-placed'
    const UNPLACED_ID = 'f-unplaced'

    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: PLACED_ID, name: 'Title', type: 'text', sortOrder: 0 }),
      makeField({ id: UNPLACED_ID, name: 'Notes', type: 'text', sortOrder: 1 }),
    ])
    // Layout only places the first field
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(populatedLayout(PLACED_ID))

    renderNew()

    await waitFor(() => screen.getByLabelText('Title'))

    // The placed field renders; the unplaced field does NOT render in the layout
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.queryByLabelText('Notes')).not.toBeInTheDocument()
  })
})

describe('CollectionItemPage — form width', () => {
  it('form inner container has max-width 900px', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField()])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(populatedLayout('f-text'))

    renderNew()

    await waitFor(() => screen.getByTestId('form-inner'))

    const inner = screen.getByTestId('form-inner')
    expect(inner.style.maxWidth).toBe('900px')
  })
})

describe('CollectionItemPage — breadcrumb title', () => {
  it('breadcrumb shows the first text field value when item has data', async () => {
    const FIELD_ID = 'f-title'
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: FIELD_ID, name: 'Name', type: 'text', sortOrder: 0 }),
    ])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(populatedLayout(FIELD_ID))
    vi.mocked(collectionsApi.getItem).mockResolvedValue(
      makeItem({ fieldValues: { [FIELD_ID]: 'Dark Side of the Moon' } }),
    )

    renderExisting()

    await waitFor(() => screen.getByText('Dark Side of the Moon'))
    // The breadcrumb span renders the item title
    expect(screen.getByText('Dark Side of the Moon')).toBeInTheDocument()
  })

  it('breadcrumb shows "New item" when item has no value for the first text field', async () => {
    const FIELD_ID = 'f-title'
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: FIELD_ID, name: 'Name', type: 'text', sortOrder: 0 }),
    ])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(populatedLayout(FIELD_ID))
    vi.mocked(collectionsApi.getItem).mockResolvedValue(
      makeItem({ fieldValues: {} }), // no value for the text field
    )

    renderExisting()

    await waitFor(() => screen.getByTestId('form-inner'))

    // Should fall back to "New item" when value is missing
    const breadcrumbs = screen.getAllByText('New item')
    expect(breadcrumbs.length).toBeGreaterThanOrEqual(1)
  })

  it('breadcrumb shows "New item" for a new item (/items/new)', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField()])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(populatedLayout('f-text'))

    renderNew()

    await waitFor(() => screen.getByTestId('form-inner'))

    expect(screen.getByText('New item')).toBeInTheDocument()
  })
})
