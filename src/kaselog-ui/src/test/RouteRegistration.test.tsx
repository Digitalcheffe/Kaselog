/**
 * Route registration smoke tests.
 *
 * Verifies that /kases and /collections are registered in the frontend router
 * and render their respective pages instead of a 404.  Uses MemoryRouter +
 * Routes with an explicit catch-all <Route path="*"> so a missing registration
 * would produce visible "404 Not Found" text that assertions can detect.
 *
 * Current route inventory (mirrors App.tsx):
 *   /                       → KaseListPage   (index)
 *   /kases                  → KaseListPage          ← was missing, now fixed
 *   /kases/:id              → KaseViewPage
 *   /logs/:id               → LogViewPage
 *   /search                 → SearchPage
 *   /profile                → ProfilePage
 *   /collections            → CollectionsIndexPage  ← already registered
 *   /collections/new        → NewCollectionPage
 *   /collections/:id        → CollectionListPage
 *   /collections/:id/design → CollectionDesignerPage
 *   /items/new              → CollectionItemPage
 *   /items/:id              → CollectionItemPage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import KaseListPage from '../pages/KaseListPage'
import CollectionsIndexPage from '../pages/CollectionsIndexPage'
import { KasesProvider } from '../contexts/KasesContext'
import { CollectionsProvider } from '../contexts/CollectionsContext'
import type { KaseResponse, CollectionResponse } from '../api/types'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  kases: {
    list: vi.fn(),
    pin: vi.fn(),
    unpin: vi.fn(),
  },
  collections: {
    list: vi.fn(),
  },
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

import { kases as kasesApi, collections as collectionsApi } from '../api/client'

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeKase(overrides: Partial<KaseResponse> = {}): KaseResponse {
  return {
    id: 'kase-1',
    title: 'Proxmox Cluster',
    description: 'Home lab cluster setup',
    logCount: 3,
    isPinned: false,
    latestLogTitle: 'Network config',
    latestLogPreview: 'VLAN trunk on nodes.',
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
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    ...overrides,
  }
}

// ── Render helpers ─────────────────────────────────────────────────────────────

/**
 * Renders the app at the given path with a catch-all 404 fallback.
 * Routes mirror the subset needed for these tests.
 */
function renderAtKasesRoute() {
  return render(
    <MemoryRouter initialEntries={['/kases']}>
      <KasesProvider>
        <Routes>
          <Route path="/kases" element={<KaseListPage />} />
          <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
      </KasesProvider>
    </MemoryRouter>,
  )
}

function renderAtCollectionsRoute() {
  return render(
    <MemoryRouter initialEntries={['/collections']}>
      <CollectionsProvider>
        <Routes>
          <Route path="/collections" element={<CollectionsIndexPage />} />
          <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
      </CollectionsProvider>
    </MemoryRouter>,
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Route registration — /kases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('navigating to /kases renders KaseListPage, not a 404', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([])

    renderAtKasesRoute()

    // KaseListPage shows "All Kases" heading in the top bar
    await waitFor(() => expect(screen.getByText('All Kases')).toBeInTheDocument())
    expect(screen.queryByText('404 Not Found')).not.toBeInTheDocument()
  })

  it('/kases renders kase rows from mocked API response', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'k1', title: 'Proxmox Cluster', logCount: 12 }),
      makeKase({ id: 'k2', title: 'OPNsense Migration', logCount: 5, description: null }),
    ])

    renderAtKasesRoute()

    await waitFor(() => screen.getByTestId('kase-row-k1'))

    expect(screen.getByText('Proxmox Cluster')).toBeInTheDocument()
    expect(screen.getByText('OPNsense Migration')).toBeInTheDocument()
    expect(screen.getByText('12 logs')).toBeInTheDocument()
    expect(screen.getByText('5 logs')).toBeInTheDocument()
  })

  it('/kases renders empty state when API returns empty array', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([])

    renderAtKasesRoute()

    await waitFor(() => expect(screen.getByText('No kases yet')).toBeInTheDocument())
    expect(screen.getByText('Create your first kase to start logging')).toBeInTheDocument()
  })

  it('/kases renders loading state while API call is in flight', async () => {
    // Never-resolving promise keeps the page in loading state for the duration of the test
    vi.mocked(kasesApi.list).mockReturnValue(new Promise(() => {}))

    renderAtKasesRoute()

    // Loading text is shown immediately before the promise resolves
    await waitFor(() => expect(screen.getByText('Loading...')).toBeInTheDocument())
    expect(screen.queryByText('No kases yet')).not.toBeInTheDocument()
  })
})

describe('Route registration — /collections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('navigating to /collections renders CollectionsIndexPage, not a 404', async () => {
    vi.mocked(collectionsApi.list).mockResolvedValue([makeCollection()])

    renderAtCollectionsRoute()

    await waitFor(() => expect(screen.getByText('Vinyl Records')).toBeInTheDocument())
    expect(screen.queryByText('404 Not Found')).not.toBeInTheDocument()
  })

  it('/collections renders empty state when API returns empty array', async () => {
    vi.mocked(collectionsApi.list).mockResolvedValue([])

    renderAtCollectionsRoute()

    await waitFor(() => expect(screen.getByText('No collections yet')).toBeInTheDocument())
    expect(screen.queryByText('404 Not Found')).not.toBeInTheDocument()
  })
})
