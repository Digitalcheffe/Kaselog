import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LeftNav from '../components/LeftNav'
import { KasesProvider } from '../contexts/KasesContext'
import { CollectionsProvider } from '../contexts/CollectionsContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { UserProvider } from '../contexts/UserContext'
import type { KaseResponse, CollectionResponse } from '../api/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  kases: {
    list: vi.fn(),
    pin: vi.fn(),
    unpin: vi.fn(),
  },
  collections: {
    list: vi.fn(),
  },
  user: {
    get: vi.fn(),
    update: vi.fn(),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate, useMatch: () => null }
})

import { kases as kasesApi, collections as collectionsApi, user as userApi } from '../api/client'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeKase(overrides: Partial<KaseResponse> = {}): KaseResponse {
  return {
    id: 'kase-1',
    title: 'Proxmox Cluster',
    description: null,
    logCount: 5,
    isPinned: false,
    latestLogTitle: 'Setup notes',
    latestLogPreview: null,
    latestLogUpdatedAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    ...overrides,
  }
}

function makeCollection(overrides: Partial<CollectionResponse> = {}): CollectionResponse {
  return {
    id: 'col-1',
    title: 'Vinyl Records',
    color: 'teal',
    itemCount: 4,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function renderNav(onSearchOpen = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider>
        <UserProvider>
          <KasesProvider>
            <CollectionsProvider>
              <LeftNav onSearchOpen={onSearchOpen} />
            </CollectionsProvider>
          </KasesProvider>
        </UserProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LeftNav — pinned Kases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
    vi.mocked(collectionsApi.list).mockResolvedValue([])
    vi.mocked(userApi.get).mockResolvedValue({
      id: 'u1', firstName: null, lastName: null, email: null,
      theme: 'light', accent: 'teal', fontSize: 'medium',
      createdAt: '', updatedAt: '',
    })
  })

  it('pinned kases show a pin icon and appear before unpinned kases', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'pinned-1', title: 'Pinned Kase', isPinned: true }),
      makeKase({ id: 'unpinned-1', title: 'Regular Kase', isPinned: false }),
    ])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-pinned-1'))

    const pinnedEl = screen.getByTestId('nav-kase-pinned-1')
    const unpinnedEl = screen.getByTestId('nav-kase-unpinned-1')

    // The pinned nav item has a pin icon (SVG path)
    expect(pinnedEl.querySelector('svg')).toBeInTheDocument()

    // Pinned appears before unpinned in DOM
    expect(
      pinnedEl.compareDocumentPosition(unpinnedEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('renders a divider between pinned and unpinned nav kases', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'pinned-1', title: 'Pinned Kase', isPinned: true }),
      makeKase({ id: 'unpinned-1', title: 'Regular Kase', isPinned: false }),
    ])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-pin-divider'))

    expect(screen.getByTestId('nav-pin-divider')).toBeInTheDocument()
  })

  it('no divider rendered when no kases are pinned', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'k1', title: 'Kase A', isPinned: false }),
      makeKase({ id: 'k2', title: 'Kase B', isPinned: false }),
    ])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))

    expect(screen.queryByTestId('nav-pin-divider')).not.toBeInTheDocument()
  })

  it('right-click context menu shows "Pin Kase" for unpinned kase', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'k1', title: 'Unpinned Kase', isPinned: false }),
    ])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))

    fireEvent.contextMenu(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('context-menu-pin-action'))

    expect(screen.getByTestId('context-menu-pin-action')).toHaveTextContent('Pin Kase')
  })

  it('right-click context menu shows "Unpin Kase" for pinned kase', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'k1', title: 'Pinned Kase', isPinned: true }),
    ])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))

    fireEvent.contextMenu(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('context-menu-pin-action'))

    expect(screen.getByTestId('context-menu-pin-action')).toHaveTextContent('Unpin Kase')
  })

  it('clicking Pin Kase in context menu calls pin endpoint', async () => {
    const user = userEvent.setup()
    const unpinned = makeKase({ id: 'k1', isPinned: false })
    const pinned = { ...unpinned, isPinned: true }

    vi.mocked(kasesApi.list)
      .mockResolvedValueOnce([unpinned])
      .mockResolvedValueOnce([pinned])
    vi.mocked(kasesApi.pin).mockResolvedValue(pinned)

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))

    fireEvent.contextMenu(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('context-menu-pin-action'))
    await user.click(screen.getByTestId('context-menu-pin-action'))

    await waitFor(() => {
      expect(kasesApi.pin).toHaveBeenCalledWith('k1')
    })
  })

  it('context menu closes after action', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'k1', isPinned: false }),
    ])
    vi.mocked(kasesApi.pin).mockResolvedValue(makeKase({ id: 'k1', isPinned: true }))

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))

    fireEvent.contextMenu(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('context-menu-pin-action'))
    await user.click(screen.getByTestId('context-menu-pin-action'))

    await waitFor(() => {
      expect(screen.queryByTestId('kase-context-menu')).not.toBeInTheDocument()
    })
  })

  it('no pinned kases = no pin divider in nav', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'k1', isPinned: false }),
    ])
    vi.mocked(collectionsApi.list).mockResolvedValue([makeCollection()])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))

    // Collections section divider is present (between sections) but no pin divider
    expect(screen.queryByTestId('nav-pin-divider')).not.toBeInTheDocument()
  })
})
