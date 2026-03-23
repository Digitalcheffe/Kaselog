import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Shell from '../components/Shell'
import SearchOverlay from '../components/SearchOverlay'
import CollectionListPage from '../pages/CollectionListPage'
import { KasesProvider } from '../contexts/KasesContext'
import { CollectionsProvider } from '../contexts/CollectionsContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { UserProvider } from '../contexts/UserContext'
import type { CollectionFieldResponse, CollectionItemResponse, CollectionResponse } from '../api/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  kases: {
    list: vi.fn(),
    pin: vi.fn(),
    unpin: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  collections: {
    list: vi.fn(),
    get: vi.fn(),
    getFields: vi.fn(),
    getItems: vi.fn(),
  },
  user: {
    get: vi.fn(),
    update: vi.fn(),
  },
  search: {
    query: vi.fn(),
  },
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

import { kases as kasesApi, collections as collectionsApi, user as userApi } from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  window.dispatchEvent(new Event('resize'))
}

function renderShell(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Shell />}>
          <Route path="*" element={<div data-testid="page-content">Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function makeCollection(overrides: Partial<CollectionResponse> = {}): CollectionResponse {
  return {
    id: 'col-1',
    title: 'Vinyl Records',
    color: 'teal',
    itemCount: 2,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function makeField(overrides: Partial<CollectionFieldResponse> = {}): CollectionFieldResponse {
  return {
    id: 'f1',
    collectionId: 'col-1',
    name: 'Title',
    type: 'text',
    required: false,
    showInList: true,
    options: null,
    sortOrder: 0,
    ...overrides,
  }
}

function makeItem(overrides: Partial<CollectionItemResponse> = {}): CollectionItemResponse {
  return {
    id: 'item-1',
    collectionId: 'col-1',
    kaseId: null,
    fieldValues: { f1: 'Abbey Road' },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function setupDefaultMocks() {
  vi.mocked(kasesApi.list).mockResolvedValue([])
  vi.mocked(collectionsApi.list).mockResolvedValue([])
  vi.mocked(userApi.get).mockResolvedValue({
    id: 'u1', firstName: null, lastName: null, email: null,
    theme: 'light', accent: 'teal', fontSize: 'medium',
    createdAt: '', updatedAt: '',
  })
}

// ── Tests: nav visibility ─────────────────────────────────────────────────────

describe('Mobile responsive — nav visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  afterEach(() => {
    setViewportWidth(1024)
  })

  it('hides left nav and shows bottom nav at 390px (iPhone 14)', async () => {
    setViewportWidth(390)
    renderShell()

    await waitFor(() => {
      expect(screen.queryByTestId('left-nav')).not.toBeInTheDocument()
      expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()
    })
  })

  it('hides left nav and shows bottom nav at 414px (iPhone 14 Plus)', async () => {
    setViewportWidth(414)
    renderShell()

    await waitFor(() => {
      expect(screen.queryByTestId('left-nav')).not.toBeInTheDocument()
      expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()
    })
  })

  it('shows left nav and hides bottom nav at 1024px (desktop)', async () => {
    setViewportWidth(1024)
    renderShell()

    await waitFor(() => {
      expect(screen.getByTestId('left-nav')).toBeInTheDocument()
      expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument()
    })
  })

  it('shows left nav and hides bottom nav at 769px (just above breakpoint)', async () => {
    setViewportWidth(769)
    renderShell()

    await waitFor(() => {
      expect(screen.getByTestId('left-nav')).toBeInTheDocument()
      expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument()
    })
  })
})

// ── Tests: bottom nav touch targets ──────────────────────────────────────────

describe('Mobile responsive — bottom nav touch targets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
    setViewportWidth(390)
  })

  afterEach(() => {
    setViewportWidth(1024)
  })

  it('bottom nav tabs have minimum 44px touch target (minHeight style)', async () => {
    renderShell()

    await waitFor(() => screen.getByTestId('bottom-nav'))

    const bottomNav = screen.getByTestId('bottom-nav')
    const tabs = bottomNav.querySelectorAll('button')
    expect(tabs.length).toBeGreaterThanOrEqual(3)

    tabs.forEach(tab => {
      // Bottom nav height is 56px; the minHeight style on each tab is 56px
      const minHeight = parseInt(tab.style.minHeight || '0', 10)
      expect(minHeight).toBeGreaterThanOrEqual(44)
    })
  })

  it('bottom nav contains Kases, Collections, Search, and Profile tabs', async () => {
    renderShell()

    await waitFor(() => screen.getByTestId('bottom-nav'))

    expect(screen.getByRole('button', { name: 'Kases' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collections' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument()
  })
})

// ── Tests: collection list card layout ────────────────────────────────────────

describe('Mobile responsive — collection list card layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField()])
    vi.mocked(collectionsApi.getItems).mockResolvedValue([
      makeItem({ id: 'item-1', fieldValues: { f1: 'Abbey Road' } }),
      makeItem({ id: 'item-2', fieldValues: { f1: 'Rumours' } }),
    ])
  })

  afterEach(() => {
    setViewportWidth(1024)
  })

  it('renders single-column card layout at 390px (mobile)', async () => {
    setViewportWidth(390)

    render(
      <MemoryRouter initialEntries={['/collections/col-1']}>
        <Routes>
          <Route path="/collections/:id" element={
            <ThemeProvider>
              <UserProvider>
                <KasesProvider>
                  <CollectionsProvider>
                    <CollectionListPage />
                  </CollectionsProvider>
                </KasesProvider>
              </UserProvider>
            </ThemeProvider>
          } />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('collection-cards-mobile')).toBeInTheDocument()
    })
    expect(screen.getByText('Abbey Road')).toBeInTheDocument()
    expect(screen.getByText('Rumours')).toBeInTheDocument()
  })

  it('does not render mobile cards at 1024px (desktop)', async () => {
    setViewportWidth(1024)

    render(
      <MemoryRouter initialEntries={['/collections/col-1']}>
        <Routes>
          <Route path="/collections/:id" element={
            <ThemeProvider>
              <UserProvider>
                <KasesProvider>
                  <CollectionsProvider>
                    <CollectionListPage />
                  </CollectionsProvider>
                </KasesProvider>
              </UserProvider>
            </ThemeProvider>
          } />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.queryByTestId('collection-cards-mobile')).not.toBeInTheDocument()
    })
  })
})

// ── Tests: search overlay full screen ─────────────────────────────────────────

describe('Mobile responsive — search overlay', () => {
  afterEach(() => {
    setViewportWidth(1024)
  })

  it('search overlay fills full screen at 390px (mobile)', () => {
    setViewportWidth(390)

    render(
      <MemoryRouter>
        <SearchOverlay onClose={() => {}} />
      </MemoryRouter>,
    )

    const overlay = screen.getByTestId('search-overlay')
    expect(overlay.style.top).toBe('0px')
    expect(overlay.style.left).toBe('0px')
    expect(overlay.style.width).toBe('100vw')
    expect(overlay.style.borderRadius).toBe('0px')
  })

  it('search overlay uses centered panel at 1024px (desktop)', () => {
    setViewportWidth(1024)

    render(
      <MemoryRouter>
        <SearchOverlay onClose={() => {}} />
      </MemoryRouter>,
    )

    const overlay = screen.getByTestId('search-overlay')
    expect(overlay.style.top).toBe('64px')
    expect(overlay.style.left).toBe('50%')
  })
})

// ── Tests: desktop layout unchanged ──────────────────────────────────────────

describe('Mobile responsive — desktop layout unchanged at 1024px', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
    setViewportWidth(1024)
  })

  it('left nav is present at desktop width', async () => {
    renderShell()
    await waitFor(() => {
      expect(screen.getByTestId('left-nav')).toBeInTheDocument()
    })
  })

  it('bottom nav is absent at desktop width', async () => {
    renderShell()
    await waitFor(() => {
      expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument()
    })
  })
})
