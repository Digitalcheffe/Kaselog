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
  CollectionItemHistoryRecord,
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
const FIELD_ID = '00000000-0000-0000-0000-000000000003'

function makeCollection(): CollectionResponse {
  return { id: COL_ID, title: 'Vinyl Records', color: 'teal', itemCount: 1, createdAt: '', updatedAt: '' }
}

function makeField(): CollectionFieldResponse {
  return {
    id: FIELD_ID, collectionId: COL_ID, name: 'Album', type: 'text',
    required: false, showInList: true, options: null, sortOrder: 0,
  }
}

function makeLayout(): CollectionLayoutResponse {
  return {
    collectionId: COL_ID,
    layout: JSON.stringify([{ cells: [{ kind: 'field', fieldId: FIELD_ID, span: 1 }, null] }]),
  }
}

function makeItem(): CollectionItemResponse {
  return {
    id: ITEM_ID, collectionId: COL_ID, kaseId: null,
    fieldValues: { [FIELD_ID]: 'Dark Side of the Moon' },
    createdAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-01T10:00:00Z',
  }
}

function makeHistoryRecord(overrides: Partial<CollectionItemHistoryRecord> = {}): CollectionItemHistoryRecord {
  return {
    id: '00000000-0000-0000-0000-000000000099',
    collectionItemId: ITEM_ID,
    fieldValues: { [FIELD_ID]: 'Previous Album' },
    changeSummary: 'Updated: Album',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    ...overrides,
  }
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderExisting() {
  return render(
    <MemoryRouter initialEntries={[`/items/${ITEM_ID}`]}>
      <Routes>
        <Route path="/items/:id" element={<CollectionItemPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
  vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField()])
  vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout())
  vi.mocked(collectionsApi.getItem).mockResolvedValue(makeItem())
  vi.mocked(kasesApi.list).mockResolvedValue([])
  vi.mocked(collectionsApi.getItemHistory).mockResolvedValue([])
  vi.clearAllMocks()
  vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
  vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField()])
  vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout())
  vi.mocked(collectionsApi.getItem).mockResolvedValue(makeItem())
  vi.mocked(kasesApi.list).mockResolvedValue([])
  vi.mocked(collectionsApi.getItemHistory).mockResolvedValue([])
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CollectionItemPage — history section', () => {
  it('history section is collapsed on mount', async () => {
    renderExisting()

    await waitFor(() => screen.getByTestId('history-section'))

    // The toggle button is visible but the list/empty state is not
    expect(screen.getByTestId('history-toggle')).toBeInTheDocument()
    expect(screen.queryByTestId('history-list')).not.toBeInTheDocument()
    expect(screen.queryByTestId('history-empty')).not.toBeInTheDocument()
  })

  it('clicking the History toggle expands the section and calls GET history', async () => {
    const ue = userEvent.setup()
    renderExisting()

    await waitFor(() => screen.getByTestId('history-toggle'))
    await ue.click(screen.getByTestId('history-toggle'))

    await waitFor(() => {
      expect(collectionsApi.getItemHistory).toHaveBeenCalledWith(COL_ID, ITEM_ID)
    })
  })

  it('history rows render changeSummary and a relative timestamp', async () => {
    const record = makeHistoryRecord()
    vi.mocked(collectionsApi.getItemHistory).mockResolvedValue([record])

    const ue = userEvent.setup()
    renderExisting()

    await waitFor(() => screen.getByTestId('history-toggle'))
    await ue.click(screen.getByTestId('history-toggle'))

    await waitFor(() => screen.getByTestId('history-list'))

    expect(screen.getByText('Updated: Album')).toBeInTheDocument()
    // Relative time should contain "hour" since the record is 2 hours ago
    expect(screen.getByText(/hour/i)).toBeInTheDocument()
  })

  it('empty state renders when history array is empty', async () => {
    vi.mocked(collectionsApi.getItemHistory).mockResolvedValue([])

    const ue = userEvent.setup()
    renderExisting()

    await waitFor(() => screen.getByTestId('history-toggle'))
    await ue.click(screen.getByTestId('history-toggle'))

    await waitFor(() => screen.getByTestId('history-empty'))
    expect(screen.getByTestId('history-empty')).toBeInTheDocument()
  })
})
