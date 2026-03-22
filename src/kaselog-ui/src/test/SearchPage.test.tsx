import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SearchPage from '../pages/SearchPage'
import type { KaseResponse, SearchResult, TagResponse, CollectionResponse } from '../api/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  search: { query: vi.fn() },
  kases: { list: vi.fn() },
  tags: { list: vi.fn() },
  collections: { list: vi.fn() },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { search as searchApi, kases as kasesApi, tags as tagsApi, collections as collectionsApi } from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLogResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    logId: 'log-1',
    kaseId: 'kase-1',
    kaseTitle: 'Proxmox Cluster',
    entityType: 'log',
    title: 'VLAN trunk configuration',
    content: 'Setting up VLAN trunk on the switch.',
    highlight: 'Setting up VLAN trunk on the switch.',
    tags: ['networking'],
    updatedAt: new Date().toISOString(),
    collectionId: null,
    collectionTitle: null,
    collectionColor: null,
    ...overrides,
  }
}

function makeItemResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    logId: 'item-1',
    kaseId: '',
    kaseTitle: '',
    entityType: 'collection_item',
    title: 'RTX 4090',
    content: 'NVIDIA RTX 4090',
    highlight: 'NVIDIA RTX 4090',
    tags: [],
    updatedAt: new Date().toISOString(),
    collectionId: 'col-1',
    collectionTitle: 'Hardware Inventory',
    collectionColor: 'teal',
    ...overrides,
  }
}

function makeKase(overrides: Partial<KaseResponse> = {}): KaseResponse {
  return {
    id: 'kase-1',
    title: 'Proxmox Cluster',
    description: null,
    logCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeTag(overrides: Partial<TagResponse> = {}): TagResponse {
  return {
    id: 'tag-1',
    name: 'networking',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeCollection(overrides: Partial<CollectionResponse> = {}): CollectionResponse {
  return {
    id: 'col-1',
    title: 'Hardware Inventory',
    color: 'teal',
    itemCount: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function renderPage(initialEntry = '/search') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SearchPage />
    </MemoryRouter>,
  )
}

/** Wait longer than the 200ms debounce. */
const waitForDebounce = () => new Promise(r => setTimeout(r, 250))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(kasesApi.list).mockResolvedValue([])
    vi.mocked(tagsApi.list).mockResolvedValue([])
    vi.mocked(collectionsApi.list).mockResolvedValue([])
  })

  it('renders search input and filter bar', () => {
    renderPage()
    expect(screen.getByPlaceholderText('Search all logs...')).toBeInTheDocument()
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument()
  })

  it('shows empty state when no results', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([])
    const user = userEvent.setup({ delay: null })
    renderPage()

    await user.type(screen.getByPlaceholderText('Search all logs...'), 'noresults')
    await waitForDebounce()

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })
  })

  it('results update on input with correct q param', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([makeLogResult()])
    const user = userEvent.setup({ delay: null })
    renderPage()

    await user.type(screen.getByPlaceholderText('Search all logs...'), 'vlan')
    await waitForDebounce()

    await waitFor(() => {
      expect(searchApi.query).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'vlan' }),
      )
    })
  })

  it('renders log result cards with title and kase', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([
      makeLogResult({ logId: 'log-1', title: 'VLAN trunk configuration', kaseTitle: 'Proxmox Cluster' }),
    ])
    const user = userEvent.setup({ delay: null })
    renderPage()

    await user.type(screen.getByPlaceholderText('Search all logs...'), 'vlan')
    await waitForDebounce()

    await waitFor(() => {
      expect(screen.getByText('VLAN trunk configuration')).toBeInTheDocument()
      expect(screen.getByText('Proxmox Cluster')).toBeInTheDocument()
    })
  })

  it('clicking log result navigates to /logs/{id}', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([
      makeLogResult({ logId: 'log-xyz', title: 'My Log' }),
    ])
    const user = userEvent.setup({ delay: null })
    renderPage()

    await user.type(screen.getByPlaceholderText('Search all logs...'), 'my')
    await waitForDebounce()

    await waitFor(() => screen.getByText('My Log'))

    await user.click(screen.getByTestId('result-card'))

    expect(mockNavigate).toHaveBeenCalledWith('/logs/log-xyz')
  })

  it('clicking collection item result navigates to /items/{id}', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([
      makeItemResult({ logId: 'item-xyz', title: 'RTX 4090' }),
    ])
    const user = userEvent.setup({ delay: null })
    renderPage()

    await user.type(screen.getByPlaceholderText('Search all logs...'), 'RTX')
    await waitForDebounce()

    await waitFor(() => screen.getByText('RTX 4090'))

    await user.click(screen.getByTestId('result-card'))

    expect(mockNavigate).toHaveBeenCalledWith('/items/item-xyz')
  })

  it('collection item card renders collection dot and name', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([
      makeItemResult({
        logId: 'item-1',
        title: 'RTX 4090',
        collectionTitle: 'Hardware Inventory',
        collectionColor: 'teal',
      }),
    ])
    const user = userEvent.setup({ delay: null })
    renderPage()

    await user.type(screen.getByPlaceholderText('Search all logs...'), 'RTX')
    await waitForDebounce()

    await waitFor(() => {
      expect(screen.getByText('Hardware Inventory')).toBeInTheDocument()
      expect(screen.getByTestId('collection-dot-item-1')).toBeInTheDocument()
    })
  })

  it('Kase filter adds kaseId param to search query', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'kase-abc', title: 'Proxmox Cluster' }),
    ])
    vi.mocked(searchApi.query).mockResolvedValue([])
    const user = userEvent.setup({ delay: null })
    renderPage()

    // Open kase dropdown and select a kase
    await user.click(screen.getByLabelText('Filter by kase'))
    await waitFor(() => screen.getByText('Proxmox Cluster'))
    await user.click(screen.getByText('Proxmox Cluster'))
    await waitForDebounce()

    await waitFor(() => {
      expect(searchApi.query).toHaveBeenCalledWith(
        expect.objectContaining({ kaseId: 'kase-abc' }),
      )
    })
  })

  it('Collection filter adds collectionId param to search query', async () => {
    vi.mocked(collectionsApi.list).mockResolvedValue([
      makeCollection({ id: 'col-abc', title: 'Hardware Inventory', color: 'teal' }),
    ])
    vi.mocked(searchApi.query).mockResolvedValue([])
    const user = userEvent.setup({ delay: null })
    renderPage()

    // Open collection dropdown and select a collection
    await user.click(screen.getByLabelText('Filter by collection'))
    await waitFor(() => screen.getByText('Hardware Inventory'))
    await user.click(screen.getByText('Hardware Inventory'))
    await waitForDebounce()

    await waitFor(() => {
      expect(searchApi.query).toHaveBeenCalledWith(
        expect.objectContaining({ collectionId: 'col-abc' }),
      )
    })
  })

  it('Type filter (logs only) adds type=log param to search query', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([])
    const user = userEvent.setup({ delay: null })
    renderPage()

    // Type a query first
    await user.type(screen.getByPlaceholderText('Search all logs...'), 'vlan')
    await waitForDebounce()
    await waitFor(() => expect(searchApi.query).toHaveBeenCalled())
    vi.clearAllMocks()
    vi.mocked(searchApi.query).mockResolvedValue([])

    // Open type dropdown and select Logs
    await user.click(screen.getByTestId('type-filter-button'))
    await waitFor(() => screen.getByTestId('type-option-log'))
    await user.click(screen.getByTestId('type-option-log'))
    await waitForDebounce()

    await waitFor(() => {
      expect(searchApi.query).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'log' }),
      )
    })
  })

  it('Type filter (collection items only) adds type=collection_item param', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([])
    const user = userEvent.setup({ delay: null })
    renderPage()

    // Type a query first
    await user.type(screen.getByPlaceholderText('Search all logs...'), 'vlan')
    await waitForDebounce()
    await waitFor(() => expect(searchApi.query).toHaveBeenCalled())
    vi.clearAllMocks()
    vi.mocked(searchApi.query).mockResolvedValue([])

    // Open type dropdown and select Collection Items
    await user.click(screen.getByTestId('type-filter-button'))
    await waitFor(() => screen.getByTestId('type-option-collection_item'))
    await user.click(screen.getByTestId('type-option-collection_item'))
    await waitForDebounce()

    await waitFor(() => {
      expect(searchApi.query).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'collection_item' }),
      )
    })
  })

  it('Tag filter adds tag param to search query', async () => {
    vi.mocked(tagsApi.list).mockResolvedValue([
      makeTag({ id: 'tag-1', name: 'networking' }),
    ])
    vi.mocked(searchApi.query).mockResolvedValue([])
    const user = userEvent.setup({ delay: null })
    renderPage()

    // Open tag dropdown and add networking
    await user.click(screen.getByLabelText('Add tag filter'))
    await waitFor(() => screen.getByText('networking'))
    await user.click(screen.getByText('networking'))
    await waitForDebounce()

    await waitFor(() => {
      expect(searchApi.query).toHaveBeenCalledWith(
        expect.objectContaining({ tag: ['networking'] }),
      )
    })
  })

  it('removing tag filter pill removes param and reruns search', async () => {
    vi.mocked(tagsApi.list).mockResolvedValue([
      makeTag({ id: 'tag-1', name: 'networking' }),
    ])
    vi.mocked(searchApi.query).mockResolvedValue([])
    const user = userEvent.setup({ delay: null })
    renderPage()

    // Type a query so removing the filter still triggers a search
    await user.type(screen.getByPlaceholderText('Search all logs...'), 'vlan')
    await waitForDebounce()
    await waitFor(() => expect(searchApi.query).toHaveBeenCalled())
    vi.clearAllMocks()
    vi.mocked(searchApi.query).mockResolvedValue([])

    // Add the tag filter
    await user.click(screen.getByLabelText('Add tag filter'))
    await waitFor(() => screen.getByText('networking'))
    await user.click(screen.getByText('networking'))
    await waitForDebounce()

    await waitFor(() => expect(searchApi.query).toHaveBeenCalledWith(
      expect.objectContaining({ tag: ['networking'] }),
    ))
    vi.clearAllMocks()
    vi.mocked(searchApi.query).mockResolvedValue([])

    // Remove the tag pill
    const pill = screen.getByTestId('tag-filter-pill-networking')
    const removeBtn = within(pill).getByLabelText('Remove tag filter networking')
    await user.click(removeBtn)
    await waitForDebounce()

    await waitFor(() => {
      const calls = vi.mocked(searchApi.query).mock.calls
      expect(calls.length).toBeGreaterThan(0)
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall.tag).toBeUndefined()
    })
  })

  it('removing kase filter pill removes kaseId param and reruns search', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'kase-abc', title: 'Proxmox Cluster' }),
    ])
    vi.mocked(searchApi.query).mockResolvedValue([])
    const user = userEvent.setup({ delay: null })
    renderPage()

    // Type a query so removing the filter still triggers a search
    await user.type(screen.getByPlaceholderText('Search all logs...'), 'vlan')
    await waitForDebounce()
    await waitFor(() => expect(searchApi.query).toHaveBeenCalled())
    vi.clearAllMocks()
    vi.mocked(searchApi.query).mockResolvedValue([])

    // Add kase filter
    await user.click(screen.getByLabelText('Filter by kase'))
    await waitFor(() => screen.getByText('Proxmox Cluster'))
    await user.click(screen.getByText('Proxmox Cluster'))
    await waitForDebounce()

    await waitFor(() => expect(searchApi.query).toHaveBeenCalledWith(
      expect.objectContaining({ kaseId: 'kase-abc' }),
    ))
    vi.clearAllMocks()
    vi.mocked(searchApi.query).mockResolvedValue([])

    // Remove kase pill
    const pill = screen.getByTestId('kase-filter-pill')
    const removeBtn = within(pill).getByLabelText('Remove kase filter Proxmox Cluster')
    await user.click(removeBtn)
    await waitForDebounce()

    await waitFor(() => {
      const calls = vi.mocked(searchApi.query).mock.calls
      expect(calls.length).toBeGreaterThan(0)
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall.kaseId).toBeUndefined()
    })
  })

  it('date range adds from/to params', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([])
    const user = userEvent.setup({ delay: null })
    renderPage()

    // Open date dropdown
    await user.click(screen.getByLabelText('Filter by date range'))
    expect(screen.getByTestId('date-dropdown')).toBeInTheDocument()

    // Set dates
    const fromInput = screen.getByTestId('date-from-input')
    const toInput = screen.getByTestId('date-to-input')
    await user.clear(fromInput)
    await user.type(fromInput, '2026-03-01')
    await user.clear(toInput)
    await user.type(toInput, '2026-03-20')

    // Apply
    await user.click(screen.getByText('Apply'))
    await waitForDebounce()

    await waitFor(() => {
      expect(searchApi.query).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-03-01', to: '2026-03-20' }),
      )
    })
  })
})
