import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import KaseViewPage from '../pages/KaseViewPage'
import { KasesProvider } from '../contexts/KasesContext'
import type { KaseResponse, TimelineEntryResponse, CollectionResponse } from '../api/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  kases: {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    pin: vi.fn(),
    unpin: vi.fn(),
  },
  timeline: {
    list: vi.fn(),
  },
  logs: {
    create: vi.fn(),
  },
  collections: {
    list: vi.fn(),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { kases as kasesApi, timeline as timelineApi, logs as logsApi, collections as collectionsApi } from '../api/client'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeKase(overrides: Partial<KaseResponse> = {}): KaseResponse {
  return {
    id: 'kase-1',
    title: 'Proxmox Cluster',
    description: 'Home lab cluster setup',
    logCount: 3,
    isPinned: false,
    latestLogTitle: 'VLAN Config',
    latestLogPreview: 'Trunk mode on nodes.',
    latestLogUpdatedAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    ...overrides,
  }
}

function makeEntry(overrides: Partial<TimelineEntryResponse> = {}): TimelineEntryResponse {
  return {
    entityType: 'log',
    id: 'log-1',
    title: 'VLAN trunk configuration',
    description: 'Trunk mode on Proxmox nodes.',
    versionCount: 3,
    tags: [],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    ...overrides,
  }
}

function makeCollection(overrides: Partial<CollectionResponse> = {}): CollectionResponse {
  return {
    id: 'col-1', title: 'Vinyl Records', color: 'teal',
    itemCount: 12, createdAt: '', updatedAt: '',
    ...overrides,
  }
}

function renderPage(kaseId = 'kase-1') {
  return render(
    <MemoryRouter initialEntries={[`/kases/${kaseId}`]}>
      <KasesProvider>
        <Routes>
          <Route path="/kases/:id" element={<KaseViewPage />} />
        </Routes>
      </KasesProvider>
    </MemoryRouter>,
  )
}

// ── Existing timeline tests ───────────────────────────────────────────────────

describe('KaseViewPage — timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(kasesApi.list).mockResolvedValue([])
    vi.mocked(collectionsApi.list).mockResolvedValue([])
  })

  it('renders timeline entries from mocked data', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'log-1', title: 'VLAN trunk configuration', versionCount: 3 }),
      makeEntry({ id: 'log-2', title: 'Installed node 3', versionCount: 1 }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('VLAN trunk configuration')).toBeInTheDocument()
      expect(screen.getByText('Installed node 3')).toBeInTheDocument()
    })
  })

  it('shows version badge with correct count', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'log-1', versionCount: 5 }),
      makeEntry({ id: 'log-2', title: 'Another log', versionCount: 1 }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('v5')).toBeInTheDocument()
      expect(screen.getByText('v1')).toBeInTheDocument()
    })
  })

  it('renders tag pills from log tags', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'log-1', tags: ['networking', 'proxmox'] }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('networking')).toBeInTheDocument()
      expect(screen.getByText('proxmox')).toBeInTheDocument()
    })
  })

  it('applies consistent color class for the same tag name across entries', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'log-1', tags: ['proxmox'] }),
      makeEntry({ id: 'log-2', title: 'Another log', tags: ['proxmox'] }),
    ])

    renderPage()

    await waitFor(() => {
      const tagPills = screen.getAllByText('proxmox')
      expect(tagPills).toHaveLength(2)
      expect(tagPills[0].className).toBe(tagPills[1].className)
    })
  })

  it('renders empty state when logs array is empty', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(timelineApi.list).mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Create a log or add a collection item/i)).toBeInTheDocument()
    })
  })

  it('renders 404 state when kase is not found', async () => {
    vi.mocked(kasesApi.get).mockRejectedValue(new Error('Kase with ID not found'))
    vi.mocked(timelineApi.list).mockResolvedValue([])

    renderPage('nonexistent-id')

    await waitFor(() => {
      expect(screen.getByText('Kase not found')).toBeInTheDocument()
    })
  })

  it('clicking a log entry navigates to /logs/{id}', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(timelineApi.list).mockResolvedValue([makeEntry({ id: 'log-abc', title: 'Click me' })])
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByText('Click me'))
    await user.click(screen.getByText('Click me'))

    expect(mockNavigate).toHaveBeenCalledWith('/logs/log-abc')
  })

  it('shows the kase title and log count in the top bar', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase({ title: 'My Kase', logCount: 7 }))
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'l1', title: 'Log A' }),
      makeEntry({ id: 'l2', title: 'Log B' }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('My Kase')).toBeInTheDocument()
      expect(screen.getByText('2 entries')).toBeInTheDocument()
    })
  })

  it('renders log descriptions when present', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'log-1', description: 'Some meaningful description text' }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Some meaningful description text')).toBeInTheDocument()
    })
  })
})

// ── New content modal tests ───────────────────────────────────────────────────

describe('KaseViewPage — new content modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(kasesApi.list).mockResolvedValue([])
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(timelineApi.list).mockResolvedValue([])
    vi.mocked(collectionsApi.list).mockResolvedValue([])
  })

  it('modal opens on + New click', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getAllByRole('button', { name: /\+ New/i }))
    await user.click(screen.getAllByRole('button', { name: /\+ New/i })[0])

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New Log')).toBeInTheDocument()
    expect(screen.getByText('Add Collection Item')).toBeInTheDocument()
  })

  it('modal closes on Escape', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getAllByRole('button', { name: /\+ New/i }))
    await user.click(screen.getAllByRole('button', { name: /\+ New/i })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('modal closes on backdrop click', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getAllByRole('button', { name: /\+ New/i }))
    await user.click(screen.getAllByRole('button', { name: /\+ New/i })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('modal-backdrop'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Step 1 shows both New Log and Add Collection Item options', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getAllByRole('button', { name: /\+ New/i }))
    await user.click(screen.getAllByRole('button', { name: /\+ New/i })[0])

    expect(screen.getByText('New Log')).toBeInTheDocument()
    expect(screen.getByText('Add Collection Item')).toBeInTheDocument()
  })

  it('clicking New Log advances to Step 2a with title input', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getAllByRole('button', { name: /\+ New/i }))
    await user.click(screen.getAllByRole('button', { name: /\+ New/i })[0])
    await user.click(screen.getByText('New Log'))

    await waitFor(() => expect(screen.getByLabelText('Title')).toBeInTheDocument())
  })

  it('Step 2a cancel returns to Step 1', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getAllByRole('button', { name: /\+ New/i }))
    await user.click(screen.getAllByRole('button', { name: /\+ New/i })[0])
    await user.click(screen.getByText('New Log'))

    await waitFor(() => screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // Back to step 1 — both choices visible
    expect(screen.getByText('New Log')).toBeInTheDocument()
    expect(screen.getByText('Add Collection Item')).toBeInTheDocument()
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
  })

  it('Step 2a submit with empty title shows validation error and does not call API', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getAllByRole('button', { name: /\+ New/i }))
    await user.click(screen.getAllByRole('button', { name: /\+ New/i })[0])
    await user.click(screen.getByText('New Log'))

    await waitFor(() => screen.getByRole('button', { name: 'Create Log →' }))
    await user.click(screen.getByRole('button', { name: 'Create Log →' }))

    expect(screen.getByText('Title is required')).toBeInTheDocument()
    expect(logsApi.create).not.toHaveBeenCalled()
  })

  it('Step 2a submit with valid title calls POST and navigates to /logs/{id}', async () => {
    vi.mocked(logsApi.create).mockResolvedValue({
      id: 'new-log-id', kaseId: 'kase-1', title: 'My Session',
      description: null, autosaveEnabled: true, content: '', versionCount: 1, tags: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getAllByRole('button', { name: /\+ New/i }))
    await user.click(screen.getAllByRole('button', { name: /\+ New/i })[0])
    await user.click(screen.getByText('New Log'))

    await waitFor(() => screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'My Session')
    await user.click(screen.getByRole('button', { name: 'Create Log →' }))

    await waitFor(() => {
      expect(logsApi.create).toHaveBeenCalledWith('kase-1', expect.objectContaining({ title: 'My Session' }))
      expect(mockNavigate).toHaveBeenCalledWith('/logs/new-log-id')
    })
  })

  it('clicking Add Collection Item advances to Step 2b showing Collection list', async () => {
    vi.mocked(collectionsApi.list).mockResolvedValue([
      makeCollection({ id: 'col-1', title: 'Vinyl Records' }),
    ])

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getAllByRole('button', { name: /\+ New/i }))
    await user.click(screen.getAllByRole('button', { name: /\+ New/i })[0])
    await user.click(screen.getByText('Add Collection Item'))

    await waitFor(() => expect(screen.getByText('Vinyl Records')).toBeInTheDocument())
    expect(screen.getByText('Choose a collection')).toBeInTheDocument()
  })

  it('Step 2b clicking a Collection navigates to /items/new with correct params', async () => {
    vi.mocked(collectionsApi.list).mockResolvedValue([
      makeCollection({ id: 'col-1', title: 'Vinyl Records' }),
    ])

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getAllByRole('button', { name: /\+ New/i }))
    await user.click(screen.getAllByRole('button', { name: /\+ New/i })[0])
    await user.click(screen.getByText('Add Collection Item'))

    await waitFor(() => screen.getByText('Vinyl Records'))
    await user.click(screen.getByText('Vinyl Records'))

    expect(mockNavigate).toHaveBeenCalledWith('/items/new?collectionId=col-1&kaseId=kase-1')
  })

  it('Step 2b cancel returns to Step 1', async () => {
    vi.mocked(collectionsApi.list).mockResolvedValue([])

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getAllByRole('button', { name: /\+ New/i }))
    await user.click(screen.getAllByRole('button', { name: /\+ New/i })[0])
    await user.click(screen.getByText('Add Collection Item'))

    await waitFor(() => screen.getByText('Choose a collection'))
    await user.click(screen.getByRole('button', { name: '← back' }))

    expect(screen.getByText('New Log')).toBeInTheDocument()
    expect(screen.getByText('Add Collection Item')).toBeInTheDocument()
    expect(screen.queryByText('Choose a collection')).not.toBeInTheDocument()
  })
})

// ── Kase settings panel tests ─────────────────────────────────────────────────

describe('KaseViewPage — Kase settings panel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(kasesApi.list).mockResolvedValue([])
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(timelineApi.list).mockResolvedValue([])
    vi.mocked(collectionsApi.list).mockResolvedValue([])
  })

  it('Kase settings panel opens on gear button click', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByLabelText('Kase settings'))
    await user.click(screen.getByLabelText('Kase settings'))

    expect(screen.getByTestId('kase-settings-panel')).toBeInTheDocument()
    expect(screen.getByLabelText('Kase title')).toBeInTheDocument()
  })

  it('Title change calls PUT /api/kases/{id} on blur', async () => {
    vi.mocked(kasesApi.update).mockResolvedValue(makeKase({ title: 'Updated Title' }))

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByLabelText('Kase settings'))
    await user.click(screen.getByLabelText('Kase settings'))

    await waitFor(() => screen.getByLabelText('Kase title'))
    const titleInput = screen.getByLabelText('Kase title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated Title')
    await user.tab() // trigger blur

    await waitFor(() => {
      expect(kasesApi.update).toHaveBeenCalledWith(
        'kase-1',
        expect.objectContaining({ title: 'Updated Title' }),
      )
    })
  })

  it('Delete shows confirmation dialog before calling API', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByLabelText('Kase settings'))
    await user.click(screen.getByLabelText('Kase settings'))

    await waitFor(() => screen.getByText('Delete this Kase'))
    await user.click(screen.getByText('Delete this Kase'))

    expect(screen.getByText(/Permanently delete this Kase/i)).toBeInTheDocument()
    expect(kasesApi.delete).not.toHaveBeenCalled()
  })

  it('Confirmed delete calls DELETE and navigates to /', async () => {
    vi.mocked(kasesApi.delete).mockResolvedValue()

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByLabelText('Kase settings'))
    await user.click(screen.getByLabelText('Kase settings'))

    await waitFor(() => screen.getByText('Delete this Kase'))
    await user.click(screen.getByText('Delete this Kase'))

    await waitFor(() => screen.getByLabelText('Confirm delete kase'))
    await user.click(screen.getByLabelText('Confirm delete kase'))

    await waitFor(() => {
      expect(kasesApi.delete).toHaveBeenCalledWith('kase-1')
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('Cancelled delete dismisses dialog without API call', async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByLabelText('Kase settings'))
    await user.click(screen.getByLabelText('Kase settings'))

    await waitFor(() => screen.getByText('Delete this Kase'))
    await user.click(screen.getByText('Delete this Kase'))

    await waitFor(() => screen.getByText(/Permanently delete/))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText(/Permanently delete/)).not.toBeInTheDocument()
    expect(kasesApi.delete).not.toHaveBeenCalled()
  })
})

// ── Settings panel — pin toggle tests ────────────────────────────────────────

describe('KaseViewPage — settings panel pin toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(kasesApi.list).mockResolvedValue([])
    vi.mocked(timelineApi.list).mockResolvedValue([])
    vi.mocked(collectionsApi.list).mockResolvedValue([])
  })

  it('pin toggle is visible in settings panel', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase({ isPinned: false }))
    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByLabelText('Kase settings'))
    await user.click(screen.getByLabelText('Kase settings'))

    await waitFor(() => screen.getByTestId('settings-pin-toggle'))
    expect(screen.getByText('Pin this Kase')).toBeInTheDocument()
    expect(screen.getByTestId('settings-pin-toggle')).toBeInTheDocument()
  })

  it('pin toggle reflects unpinned state — calls pin endpoint when clicked', async () => {
    const unpinned = makeKase({ isPinned: false })
    const pinned = { ...unpinned, isPinned: true }
    vi.mocked(kasesApi.get).mockResolvedValue(unpinned)
    vi.mocked(kasesApi.pin).mockResolvedValue(pinned)

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByLabelText('Kase settings'))
    await user.click(screen.getByLabelText('Kase settings'))

    await waitFor(() => screen.getByLabelText('Pin this kase'))
    await user.click(screen.getByLabelText('Pin this kase'))

    await waitFor(() => {
      expect(kasesApi.pin).toHaveBeenCalledWith('kase-1')
    })
  })

  it('pin toggle reflects pinned state — calls unpin endpoint when clicked', async () => {
    const pinned = makeKase({ isPinned: true })
    const unpinned = { ...pinned, isPinned: false }
    vi.mocked(kasesApi.get).mockResolvedValue(pinned)
    vi.mocked(kasesApi.unpin).mockResolvedValue(unpinned)

    const user = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByLabelText('Kase settings'))
    await user.click(screen.getByLabelText('Kase settings'))

    await waitFor(() => screen.getByLabelText('Unpin this kase'))
    await user.click(screen.getByLabelText('Unpin this kase'))

    await waitFor(() => {
      expect(kasesApi.unpin).toHaveBeenCalledWith('kase-1')
    })
  })
})
