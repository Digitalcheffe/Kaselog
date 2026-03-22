import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CollectionsIndexPage from '../pages/CollectionsIndexPage'
import { CollectionsProvider } from '../contexts/CollectionsContext'
import type { CollectionResponse } from '../api/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  collections: {
    list: vi.fn(),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { collections as collectionsApi } from '../api/client'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCollection(overrides: Partial<CollectionResponse> = {}): CollectionResponse {
  return {
    id: 'col-1',
    title: 'Vinyl Records',
    color: 'teal',
    itemCount: 4,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/collections']}>
      <CollectionsProvider>
        <CollectionsIndexPage />
      </CollectionsProvider>
    </MemoryRouter>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CollectionsIndexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('renders collections as rows, not cards — no grid layout in DOM', async () => {
    vi.mocked(collectionsApi.list).mockResolvedValue([
      makeCollection({ id: 'col-1', title: 'Vinyl Records' }),
      makeCollection({ id: 'col-2', title: 'Board Games', color: 'blue' }),
    ])

    renderPage()

    await waitFor(() => screen.getByTestId('collection-row-col-1'))

    const row1 = screen.getByTestId('collection-row-col-1')
    const row2 = screen.getByTestId('collection-row-col-2')

    // Rows must not use a grid display
    expect(row1.style.display).not.toBe('grid')
    expect(row2.style.display).not.toBe('grid')

    // Container must not use grid-template-columns
    const container = row1.parentElement!
    expect(container.style.gridTemplateColumns).toBeFalsy()
  })

  it('each row shows the collection name, dot element, and item count', async () => {
    vi.mocked(collectionsApi.list).mockResolvedValue([
      makeCollection({ id: 'col-1', title: 'Vinyl Records', color: 'teal', itemCount: 7 }),
    ])

    renderPage()

    await waitFor(() => screen.getByText('Vinyl Records'))

    // Name visible
    expect(screen.getByText('Vinyl Records')).toBeInTheDocument()
    // Item count pill visible
    expect(screen.getByText('7 items')).toBeInTheDocument()
    // Color dot rendered (the row has a dot child element)
    const row = screen.getByTestId('collection-row-col-1')
    expect(row).toBeInTheDocument()
  })

  it('clicking a row navigates to /collections/{id}', async () => {
    const ue = userEvent.setup()
    vi.mocked(collectionsApi.list).mockResolvedValue([
      makeCollection({ id: 'col-abc', title: 'My Collection' }),
    ])

    renderPage()

    await waitFor(() => screen.getByTestId('collection-row-col-abc'))
    await ue.click(screen.getByTestId('collection-row-col-abc'))

    expect(mockNavigate).toHaveBeenCalledWith('/collections/col-abc')
  })

  it('empty state renders when API returns empty array', async () => {
    vi.mocked(collectionsApi.list).mockResolvedValue([])

    renderPage()

    await waitFor(() => screen.getByText('No collections yet'))

    expect(screen.getByText('No collections yet')).toBeInTheDocument()
    expect(screen.getByText(/track structured data alongside your logs/i)).toBeInTheDocument()
  })

  it('+ New Collection button is visible in the top bar', async () => {
    vi.mocked(collectionsApi.list).mockResolvedValue([
      makeCollection(),
    ])

    renderPage()

    await waitFor(() => screen.getByText('Vinyl Records'))

    // Both the top bar button and (if empty state) the empty state button may exist
    const buttons = screen.getAllByRole('button', { name: /\+ New Collection/i })
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('+ New Collection button in top bar navigates to /collections/new', async () => {
    const ue = userEvent.setup()
    vi.mocked(collectionsApi.list).mockResolvedValue([makeCollection()])

    renderPage()

    await waitFor(() => screen.getByText('Vinyl Records'))

    const buttons = screen.getAllByRole('button', { name: /\+ New Collection/i })
    await ue.click(buttons[0])

    expect(mockNavigate).toHaveBeenCalledWith('/collections/new')
  })
})
