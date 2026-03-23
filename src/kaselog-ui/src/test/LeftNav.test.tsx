import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LeftNav from '../components/LeftNav'
import { KasesProvider } from '../contexts/KasesContext'
import { CollectionsProvider } from '../contexts/CollectionsContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { UserProvider } from '../contexts/UserContext'
import type { KaseResponse, CollectionResponse } from '../api/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  kases: {
    list:   vi.fn(),
    pin:    vi.fn(),
    unpin:  vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  collections: {
    list: vi.fn(),
  },
  user: {
    get:    vi.fn(),
    update: vi.fn(),
  },
}))

const mockNavigate = vi.fn()
// Keep real useMatch so activeKaseId detection works via MemoryRouter path
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { kases as kasesApi, collections as collectionsApi, user as userApi } from '../api/client'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeKase(overrides: Partial<KaseResponse> = {}): KaseResponse {
  return {
    id: 'kase-1',
    title: 'Proxmox Cluster',
    description: 'Home lab setup',
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

// ── Render helper ──────────────────────────────────────────────────────────────
// Wraps LeftNav in a full context stack. Pass `path` to simulate an active route
// (used for active kase detection via useMatch).

function renderNav({ path = '/' }: { path?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={
          <ThemeProvider>
            <UserProvider>
              <KasesProvider>
                <CollectionsProvider>
                  <LeftNav onSearchOpen={vi.fn()} />
                </CollectionsProvider>
              </KasesProvider>
            </UserProvider>
          </ThemeProvider>
        } />
      </Routes>
    </MemoryRouter>,
  )
}

// Shared beforeEach defaults
function setupDefaultMocks() {
  vi.mocked(collectionsApi.list).mockResolvedValue([])
  vi.mocked(userApi.get).mockResolvedValue({
    id: 'u1', firstName: null, lastName: null, email: null,
    theme: 'light', accent: 'teal', fontSize: 'medium',
    createdAt: '', updatedAt: '',
  })
}

// ── Tests: pinned Kases (existing behaviour, preserved) ───────────────────────

describe('LeftNav — pinned Kases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
    setupDefaultMocks()
  })

  it('pinned kases show a pin icon and appear before unpinned kases', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'pinned-1', title: 'Pinned Kase', isPinned: true }),
      makeKase({ id: 'unpinned-1', title: 'Regular Kase', isPinned: false }),
    ])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-pinned-1'))

    const pinnedEl   = screen.getByTestId('nav-kase-pinned-1')
    const unpinnedEl = screen.getByTestId('nav-kase-unpinned-1')

    expect(pinnedEl.querySelector('svg')).toBeInTheDocument()
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
    const user     = userEvent.setup()
    const unpinned = makeKase({ id: 'k1', isPinned: false })
    const pinned   = { ...unpinned, isPinned: true }

    vi.mocked(kasesApi.list)
      .mockResolvedValueOnce([unpinned])
      .mockResolvedValueOnce([pinned])
    vi.mocked(kasesApi.pin).mockResolvedValue(pinned)

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))
    fireEvent.contextMenu(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('context-menu-pin-action'))
    await user.click(screen.getByTestId('context-menu-pin-action'))

    await waitFor(() => expect(kasesApi.pin).toHaveBeenCalledWith('k1'))
  })

  it('context menu closes after action', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', isPinned: false })])
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
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', isPinned: false })])
    vi.mocked(collectionsApi.list).mockResolvedValue([makeCollection()])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))
    expect(screen.queryByTestId('nav-pin-divider')).not.toBeInTheDocument()
  })
})

// ── Tests: section header navigation ─────────────────────────────────────────

describe('LeftNav — section header navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
    setupDefaultMocks()
    vi.mocked(kasesApi.list).mockResolvedValue([])
  })

  it('clicking the Kases section header label navigates to /kases', async () => {
    const user = userEvent.setup()
    renderNav()

    await waitFor(() => screen.getByTestId('kases-section-header'))
    await user.click(screen.getByTestId('kases-section-header'))

    expect(mockNavigate).toHaveBeenCalledWith('/kases')
  })

  it('"All Kases →" link navigates to /kases', async () => {
    const user = userEvent.setup()
    renderNav()

    await waitFor(() => screen.getByTestId('all-kases-link'))
    await user.click(screen.getByTestId('all-kases-link'))

    expect(mockNavigate).toHaveBeenCalledWith('/kases')
  })

  it('clicking the Collections section header label navigates to /collections', async () => {
    const user = userEvent.setup()
    renderNav()

    await waitFor(() => screen.getByTestId('collections-section-header'))
    await user.click(screen.getByTestId('collections-section-header'))

    expect(mockNavigate).toHaveBeenCalledWith('/collections')
  })

  it('"All Collections →" link navigates to /collections', async () => {
    const user = userEvent.setup()
    renderNav()

    await waitFor(() => screen.getByTestId('all-collections-link'))
    await user.click(screen.getByTestId('all-collections-link'))

    expect(mockNavigate).toHaveBeenCalledWith('/collections')
  })
})

// ── Tests: Kase row interactions ──────────────────────────────────────────────

describe('LeftNav — Kase row interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
    setupDefaultMocks()
  })

  it('clicking a Kase row opens the management panel, does NOT navigate', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', title: 'My Kase' })])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))
    await user.click(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('kase-management-panel'))

    expect(screen.getByTestId('kase-management-panel')).toBeInTheDocument()
    // Row click must NOT navigate to /kases/k1
    expect(mockNavigate).not.toHaveBeenCalledWith('/kases/k1')
  })

  it('clicking the chevron on a Kase row navigates into the Kase without opening the panel', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', title: 'My Kase' })])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-arrow-k1'))
    await user.click(screen.getByTestId('nav-kase-arrow-k1'))

    expect(mockNavigate).toHaveBeenCalledWith('/kases/k1')
    expect(screen.queryByTestId('kase-management-panel')).not.toBeInTheDocument()
  })
})

// ── Tests: Kase management panel — edit form ──────────────────────────────────

describe('LeftNav — Kase management panel: edit form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
    setupDefaultMocks()
  })

  it('panel opens pre-populated with the kase title and description', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'k1', title: 'Proxmox Cluster', description: 'Home lab setup' }),
    ])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))
    await user.click(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('kase-management-panel'))

    expect(screen.getByTestId<HTMLInputElement>('panel-title-input').value).toBe('Proxmox Cluster')
    expect(screen.getByTestId<HTMLTextAreaElement>('panel-description-input').value).toBe('Home lab setup')
  })

  it('Save button is disabled when no field has changed', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1' })])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))
    await user.click(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('panel-save-btn'))

    expect(screen.getByTestId('panel-save-btn')).toBeDisabled()
  })

  it('Save button enables once a field value changes', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', title: 'Old Title' })])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))
    await user.click(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('panel-title-input'))

    const titleInput = screen.getByTestId('panel-title-input')
    await user.tripleClick(titleInput)
    await user.type(titleInput, 'New Title')

    expect(screen.getByTestId('panel-save-btn')).not.toBeDisabled()
  })

  it('saving with a blank title shows a validation error and does not call the API', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', title: 'Some Kase' })])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))
    await user.click(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('panel-title-input'))

    // Clear the title input so it becomes empty (still dirty vs original)
    const titleInput = screen.getByTestId('panel-title-input')
    await user.clear(titleInput)

    // Save button is now enabled (dirty) but title is blank — should show validation
    await user.click(screen.getByTestId('panel-save-btn'))

    expect(screen.getByRole('alert')).toHaveTextContent('Title is required')
    expect(kasesApi.update).not.toHaveBeenCalled()
  })

  it('successful save updates the Kase title in the nav without full reload', async () => {
    const user     = userEvent.setup()
    const original = makeKase({ id: 'k1', title: 'Old Title', description: null })
    const updated  = { ...original, title: 'New Title' }

    // Use mockImplementation so strict-mode double list calls all return [original]
    // until update fires, at which point subsequent list calls return [updated].
    vi.mocked(kasesApi.list).mockResolvedValue([original])
    vi.mocked(kasesApi.update).mockImplementation(async () => {
      vi.mocked(kasesApi.list).mockResolvedValue([updated])
      return updated
    })

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))
    await user.click(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('panel-title-input'))

    // clear() empties the field; type() fills it — this reliably replaces the value in jsdom
    const titleInput = screen.getByTestId('panel-title-input')
    await user.clear(titleInput)
    await user.type(titleInput, 'New Title')

    await user.click(screen.getByTestId('panel-save-btn'))

    await waitFor(() => {
      expect(kasesApi.update).toHaveBeenCalledWith('k1', expect.objectContaining({ title: 'New Title' }))
    })

    // After context refresh, nav shows updated title
    await waitFor(() => expect(screen.getAllByText('New Title').length).toBeGreaterThanOrEqual(1))
  })
})

// ── Tests: Kase management panel — pin toggle ─────────────────────────────────

describe('LeftNav — Kase management panel: pin toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
    setupDefaultMocks()
  })

  it('pin toggle reflects IsPinned = false on panel open', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', isPinned: false })])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))
    await user.click(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('panel-pin-toggle'))

    const toggle = screen.getByTestId('panel-pin-toggle')
    expect(toggle).toHaveAttribute('aria-label', 'Pin this kase')
  })

  it('pin toggle reflects IsPinned = true on panel open', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', isPinned: true })])

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))
    await user.click(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('panel-pin-toggle'))

    const toggle = screen.getByTestId('panel-pin-toggle')
    expect(toggle).toHaveAttribute('aria-label', 'Unpin this kase')
  })

  it('toggling pin calls the correct endpoint and immediately updates the nav pin indicator', async () => {
    const user     = userEvent.setup()
    const unpinned = makeKase({ id: 'k1', isPinned: false, title: 'My Kase' })
    const pinned   = { ...unpinned, isPinned: true }

    vi.mocked(kasesApi.list)
      .mockResolvedValueOnce([unpinned])
      .mockResolvedValueOnce([pinned])
    vi.mocked(kasesApi.pin).mockResolvedValue(pinned)

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))
    await user.click(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('panel-pin-toggle'))
    await user.click(screen.getByTestId('panel-pin-toggle'))

    await waitFor(() => expect(kasesApi.pin).toHaveBeenCalledWith('k1'))

    // Nav refresh: pinned kase now has pin icon in nav
    await waitFor(() => {
      const navItem = screen.getByTestId('nav-kase-k1')
      expect(navItem.querySelector('svg')).toBeInTheDocument()
    })
  })
})

// ── Tests: Kase management panel — delete ────────────────────────────────────

describe('LeftNav — Kase management panel: delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
    setupDefaultMocks()
  })

  it('confirming delete calls DELETE endpoint and removes Kase from nav', async () => {
    const user = userEvent.setup()
    const kase = makeKase({ id: 'k1', title: 'Doomed Kase' })

    vi.mocked(kasesApi.list)
      .mockResolvedValueOnce([kase])
      .mockResolvedValueOnce([])          // empty after delete
    vi.mocked(kasesApi.delete).mockResolvedValue(undefined)

    renderNav()

    await waitFor(() => screen.getByTestId('nav-kase-k1'))
    await user.click(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('panel-delete-btn'))
    await user.click(screen.getByTestId('panel-delete-btn'))

    await waitFor(() => screen.getByTestId('panel-confirm-delete-btn'))
    await user.click(screen.getByTestId('panel-confirm-delete-btn'))

    await waitFor(() => expect(kasesApi.delete).toHaveBeenCalledWith('k1'))

    // Panel closes and kase disappears from nav
    await waitFor(() => expect(screen.queryByTestId('kase-management-panel')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.queryByTestId('nav-kase-k1')).not.toBeInTheDocument())
  })

  it('delete navigates to /kases if the deleted Kase was the active route', async () => {
    const user = userEvent.setup()
    const kase = makeKase({ id: 'k1', title: 'Active Kase' })

    vi.mocked(kasesApi.list)
      .mockResolvedValueOnce([kase])
      .mockResolvedValueOnce([])
    vi.mocked(kasesApi.delete).mockResolvedValue(undefined)

    // Render with path /kases/k1 so useMatch detects this kase as active
    renderNav({ path: '/kases/k1' })

    await waitFor(() => screen.getByTestId('nav-kase-k1'))
    await user.click(screen.getByTestId('nav-kase-k1'))

    await waitFor(() => screen.getByTestId('panel-delete-btn'))
    await user.click(screen.getByTestId('panel-delete-btn'))

    await waitFor(() => screen.getByTestId('panel-confirm-delete-btn'))
    await user.click(screen.getByTestId('panel-confirm-delete-btn'))

    await waitFor(() => expect(kasesApi.delete).toHaveBeenCalledWith('k1'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/kases'))
  })
})
