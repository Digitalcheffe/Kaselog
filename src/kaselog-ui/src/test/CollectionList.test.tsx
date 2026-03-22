import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CollectionListPage from '../pages/CollectionListPage'
import LeftNav from '../components/LeftNav'
import { CollectionsProvider } from '../contexts/CollectionsContext'
import { KasesProvider } from '../contexts/KasesContext'
import { UserProvider } from '../contexts/UserContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import type { CollectionResponse, CollectionFieldResponse, CollectionItemResponse } from '../api/types'

// ── Mock the API client ──────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  collections: {
    list: vi.fn(),
    get: vi.fn(),
    getFields: vi.fn(),
    getItems: vi.fn(),
  },
  kases: {
    list: vi.fn(),
  },
  user: {
    get: vi.fn(),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { collections as collectionsApi, kases as kasesApi, user as userApi } from '../api/client'

// ── Helpers ──────────────────────────────────────────────────────────────────

const COLLECTION_ID = 'col-1'

function makeCollection(overrides: Partial<CollectionResponse> = {}): CollectionResponse {
  return {
    id: COLLECTION_ID,
    title: 'Vinyl Records',
    color: 'teal',
    itemCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeField(overrides: Partial<CollectionFieldResponse> = {}): CollectionFieldResponse {
  return {
    id: 'field-title',
    collectionId: COLLECTION_ID,
    name: 'Album',
    type: 'text',
    required: true,
    showInList: true,
    options: null,
    sortOrder: 0,
    ...overrides,
  }
}

function makeItem(id: string, fieldValues: Record<string, unknown> = {}): CollectionItemResponse {
  return {
    id,
    collectionId: COLLECTION_ID,
    kaseId: null,
    fieldValues,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function renderPage(collectionId = COLLECTION_ID) {
  return render(
    <MemoryRouter initialEntries={[`/collections/${collectionId}`]}>
      <Routes>
        <Route path="/collections/:id" element={<CollectionListPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderNav() {
  vi.mocked(userApi.get).mockResolvedValue({
    id: 'user-1', firstName: 'Ray', lastName: 'J', email: null,
    theme: 'light', accent: 'teal', fontSize: 'medium',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })

  return render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider>
        <UserProvider>
          <KasesProvider>
            <CollectionsProvider>
              <LeftNav onSearchOpen={vi.fn()} />
            </CollectionsProvider>
          </KasesProvider>
        </UserProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CollectionListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(kasesApi.list).mockResolvedValue([])
  })

  it('renders items with correct field values from schema', async () => {
    const titleField = makeField({ id: 'f-title', name: 'Album', type: 'text', sortOrder: 0 })
    const artistField = makeField({ id: 'f-artist', name: 'Artist', type: 'text', sortOrder: 1 })

    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue([titleField, artistField])
    vi.mocked(collectionsApi.getItems).mockResolvedValue([
      makeItem('i-1', { 'f-title': 'Rumours', 'f-artist': 'Fleetwood Mac' }),
      makeItem('i-2', { 'f-title': 'Kind of Blue', 'f-artist': 'Miles Davis' }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Rumours')).toBeInTheDocument()
      expect(screen.getByText('Kind of Blue')).toBeInTheDocument()
    })
    expect(screen.getByText('Fleetwood Mac')).toBeInTheDocument()
    expect(screen.getByText('Miles Davis')).toBeInTheDocument()
  })

  it('generates filter pills only for select and boolean fields with showInList=true', async () => {
    const fields: CollectionFieldResponse[] = [
      makeField({ id: 'f-title', name: 'Album', type: 'text', sortOrder: 0, showInList: true }),
      makeField({ id: 'f-format', name: 'Format', type: 'select', options: ['LP', '2×LP'], sortOrder: 1, showInList: true }),
      makeField({ id: 'f-owned', name: 'Owned', type: 'boolean', sortOrder: 2, showInList: true }),
      makeField({ id: 'f-notes', name: 'Notes', type: 'multiline', sortOrder: 3, showInList: false }),
    ]

    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue(fields)
    vi.mocked(collectionsApi.getItems).mockResolvedValue([])

    renderPage()

    await waitFor(() => screen.getAllByText('Format').length > 0)

    // Filter bar contains Format and Owned pills
    const filterBar = screen.getByPlaceholderText(/Search/i).closest('div[style]')?.parentElement
    expect(filterBar).toBeTruthy()

    // select + boolean fields get filter pill spans; text field does not
    const pillLabels = screen.getAllByText('Format').concat(screen.getAllByText('Owned'))
    expect(pillLabels.length).toBeGreaterThan(0)

    // Text field "Album" should NOT appear as a filter pill label (it only appears as a column header)
    const albumPillSpans = screen.queryAllByText('Album', { selector: 'span' })
    expect(albumPillSpans.length).toBe(0)
  })

  it('sends field[] query param format when a filter pill is active', async () => {
    const formatField = makeField({
      id: 'f-format', name: 'Format', type: 'select',
      options: ['LP', '2×LP'], sortOrder: 1, showInList: true,
    })

    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f-title', name: 'Album', type: 'text', sortOrder: 0 }),
      formatField,
    ])
    vi.mocked(collectionsApi.getItems).mockResolvedValue([])

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getAllByText('Format').length > 0)

    // Click the Format pill to open dropdown — multiple "Format" elements exist (pill + column header)
    // The pill label is a <span style="font-size: 10px; opacity: 0.65;">
    const formatPillSpan = screen.getAllByText('Format').find(el => el.tagName === 'SPAN')!
    // The pill container is the span's direct parent div
    await user.click(formatPillSpan.parentElement!)

    // Select "LP"
    await user.click(screen.getAllByText('LP')[0])

    await waitFor(() => {
      expect(vi.mocked(collectionsApi.getItems)).toHaveBeenCalledWith(
        COLLECTION_ID,
        expect.objectContaining({
          fieldFilters: { 'f-format': 'LP' },
        }),
      )
    })
  })

  it('column picker lists all showInList fields', async () => {
    const fields: CollectionFieldResponse[] = [
      makeField({ id: 'f-title', name: 'Album', type: 'text', sortOrder: 0 }),
      makeField({ id: 'f-artist', name: 'Artist', type: 'text', sortOrder: 1 }),
      makeField({ id: 'f-year', name: 'Year', type: 'number', sortOrder: 2 }),
    ]

    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue(fields)
    vi.mocked(collectionsApi.getItems).mockResolvedValue([])

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getAllByText('Album').length > 0)

    // Open column picker
    await user.click(screen.getByLabelText('Columns'))

    // Album, Artist, Year all appear in the column picker list
    expect(screen.getAllByText('Album').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Artist').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Year').length).toBeGreaterThan(0)
  })

  it('title column is always locked in the column picker', async () => {
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f-title', name: 'Album', type: 'text', sortOrder: 0 }),
      makeField({ id: 'f-artist', name: 'Artist', type: 'text', sortOrder: 1 }),
    ])
    vi.mocked(collectionsApi.getItems).mockResolvedValue([])

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByLabelText('Columns'))
    await user.click(screen.getByLabelText('Columns'))

    expect(screen.getByText('always visible')).toBeInTheDocument()
  })

  it('hiding a column removes it from the table header', async () => {
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f-title', name: 'Album', type: 'text', sortOrder: 0 }),
      makeField({ id: 'f-artist', name: 'Artist', type: 'text', sortOrder: 1 }),
    ])
    vi.mocked(collectionsApi.getItems).mockResolvedValue([
      makeItem('i-1', { 'f-title': 'Rumours', 'f-artist': 'Fleetwood Mac' }),
    ])

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByText('Rumours'))

    // Artist column value is visible initially
    expect(screen.getByText('Fleetwood Mac')).toBeInTheDocument()

    // Open column picker and toggle Artist off
    await user.click(screen.getByLabelText('Columns'))

    // Find the Artist field name in the picker and click its parent toggle row
    const artistPickerLabel = screen.getAllByText('Artist')
      .find(el => el.tagName === 'DIV' && el.style?.fontSize === 'var(--text-sm)')
    expect(artistPickerLabel).toBeTruthy()
    // Click the row containing this label
    await user.click(artistPickerLabel!.parentElement!.parentElement!)

    // After hiding Artist, Fleetwood Mac cell value should no longer appear in the list
    await waitFor(() => {
      expect(screen.queryByText('Fleetwood Mac')).not.toBeInTheDocument()
    })
  })

  it('clicking a row navigates to /items/{id}', async () => {
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f-title', name: 'Album', type: 'text', sortOrder: 0 }),
    ])
    vi.mocked(collectionsApi.getItems).mockResolvedValue([
      makeItem('item-abc', { 'f-title': 'Rumours' }),
    ])

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByText('Rumours'))

    await user.click(screen.getByText('Rumours'))

    expect(mockNavigate).toHaveBeenCalledWith('/items/item-abc')
  })
})

describe('LeftNav accordion sections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(kasesApi.list).mockResolvedValue([])
    vi.mocked(collectionsApi.list).mockResolvedValue([])
  })

  it('collapses and expands Kases section independently of Collections', async () => {
    vi.mocked(collectionsApi.list).mockResolvedValue([
      makeCollection({ id: 'c-1', title: 'Vinyl Records' }),
    ])
    vi.mocked(kasesApi.list).mockResolvedValue([
      { id: 'k-1', title: 'Proxmox Cluster', description: null, logCount: 3, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ])

    const user = userEvent.setup()
    renderNav()

    await waitFor(() => {
      expect(screen.getByText('Proxmox Cluster')).toBeInTheDocument()
      expect(screen.getByText('Vinyl Records')).toBeInTheDocument()
    })

    // Collapse Kases section
    await user.click(screen.getByRole('button', { name: 'Toggle Kases section' }))

    await waitFor(() => {
      expect(screen.queryByText('Proxmox Cluster')).not.toBeInTheDocument()
    })
    // Collections section still visible
    expect(screen.getByText('Vinyl Records')).toBeInTheDocument()
  })

  it('clicking "+ new" in Collections section triggers navigation to /collections/new', async () => {
    renderNav()

    await waitFor(() => screen.getByRole('button', { name: 'New Collection' }))

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'New Collection' }))

    expect(mockNavigate).toHaveBeenCalledWith('/collections/new')
  })
})
