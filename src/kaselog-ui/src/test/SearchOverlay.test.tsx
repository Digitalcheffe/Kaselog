import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SearchOverlay from '../components/SearchOverlay'
import type { SearchResult } from '../api/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  search: { query: vi.fn() },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { search as searchApi } from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    logId: 'log-1',
    kaseId: 'kase-1',
    kaseTitle: 'Proxmox Cluster',
    title: 'VLAN trunk configuration',
    content: 'Setting up VLAN trunk on the switch.',
    highlight: 'Setting up VLAN trunk on the switch.',
    tags: ['networking', 'vlan'],
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

const mockOnClose = vi.fn()

function renderOverlay() {
  return render(
    <MemoryRouter initialEntries={['/kases/kase-1']}>
      <SearchOverlay onClose={mockOnClose} />
    </MemoryRouter>,
  )
}

/** Wait longer than the 200ms debounce so the search fires. */
const waitForDebounce = () => new Promise(r => setTimeout(r, 250))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SearchOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the overlay with search input', () => {
    vi.mocked(searchApi.query).mockResolvedValue([])
    renderOverlay()
    expect(screen.getByTestId('search-overlay')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search logs...')).toBeInTheDocument()
  })

  it('calls onClose when Escape key is pressed', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([])
    renderOverlay()

    await userEvent.keyboard('{Escape}')

    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  it('updates results on input with correct q param (debounced)', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([makeResult()])
    const user = userEvent.setup({ delay: null })
    renderOverlay()

    await user.type(screen.getByPlaceholderText('Search logs...'), 'vlan')
    await waitForDebounce()

    await waitFor(() => {
      expect(searchApi.query).toHaveBeenCalledWith({ q: 'vlan' })
    })
  })

  it('shows results after search', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([
      makeResult({ logId: 'log-1', title: 'VLAN trunk configuration' }),
      makeResult({ logId: 'log-2', title: 'OPNsense VLAN routing' }),
    ])
    const user = userEvent.setup({ delay: null })
    renderOverlay()

    await user.type(screen.getByPlaceholderText('Search logs...'), 'vlan')
    await waitForDebounce()

    await waitFor(() => {
      expect(screen.getByText('VLAN trunk configuration')).toBeInTheDocument()
      expect(screen.getByText('OPNsense VLAN routing')).toBeInTheDocument()
    })
  })

  it('clicking result navigates to /logs/{id} and closes overlay', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([
      makeResult({ logId: 'log-abc', title: 'VLAN trunk configuration' }),
    ])
    const user = userEvent.setup({ delay: null })
    renderOverlay()

    await user.type(screen.getByPlaceholderText('Search logs...'), 'vlan')
    await waitForDebounce()
    await waitFor(() => screen.getByText('VLAN trunk configuration'))

    await user.click(screen.getByText('VLAN trunk configuration'))

    expect(mockNavigate).toHaveBeenCalledWith('/logs/log-abc')
    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  it('clicking Advanced search navigates to /search with query and closes overlay', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([])
    const user = userEvent.setup({ delay: null })
    renderOverlay()

    await user.type(screen.getByPlaceholderText('Search logs...'), 'vlan')
    await waitForDebounce()

    await user.click(screen.getByTestId('advanced-search-link'))

    expect(mockNavigate).toHaveBeenCalledWith('/search?q=vlan')
    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  it('shows empty state when query has no results', async () => {
    vi.mocked(searchApi.query).mockResolvedValue([])
    const user = userEvent.setup({ delay: null })
    renderOverlay()

    await user.type(screen.getByPlaceholderText('Search logs...'), 'noresults')
    await waitForDebounce()

    await waitFor(() => {
      expect(screen.getByText(/No results for/)).toBeInTheDocument()
    })
  })
})
