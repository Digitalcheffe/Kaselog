import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SearchPage from '../pages/SearchPage'
import type { KaseResponse, SearchResult, TagResponse } from '../api/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  search: { query: vi.fn() },
  kases: { list: vi.fn() },
  tags: { list: vi.fn() },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { search as searchApi, kases as kasesApi, tags as tagsApi } from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    logId: 'log-1',
    kaseId: 'kase-1',
    kaseTitle: 'Proxmox Cluster',
    title: 'VLAN trunk configuration',
    content: 'Setting up VLAN trunk on the switch.',
    highlight: 'Setting up VLAN trunk on the switch.',
    tags: ['networking'],
    updatedAt: new Date().toISOString(),
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
    vi.mocked(searchApi.query).mockResolvedValue([makeResult()])
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

  it('renders result cards with title and kase', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([
      makeResult({ logId: 'log-1', title: 'VLAN trunk configuration', kaseTitle: 'Proxmox Cluster' }),
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

  it('clicking result navigates to /logs/{id}', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([
      makeResult({ logId: 'log-xyz', title: 'My Log' }),
    ])
    const user = userEvent.setup({ delay: null })
    renderPage()

    await user.type(screen.getByPlaceholderText('Search all logs...'), 'my')
    await waitForDebounce()

    await waitFor(() => screen.getByText('My Log'))

    await user.click(screen.getByTestId('result-card'))

    expect(mockNavigate).toHaveBeenCalledWith('/logs/log-xyz')
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
