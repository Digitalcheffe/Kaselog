import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import KaseListPage from '../pages/KaseListPage'
import { KasesProvider } from '../contexts/KasesContext'
import type { KaseResponse } from '../api/types'

// ── Mock the API client ──────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  kases: {
    list:   vi.fn(),
    create: vi.fn(),
    pin:    vi.fn(),
    unpin:  vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock useNavigate so we can assert on it without needing full routing
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { kases as kasesApi } from '../api/client'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeKase(overrides: Partial<KaseResponse> = {}): KaseResponse {
  return {
    id: 'kase-1',
    title: 'Proxmox Cluster',
    description: 'Home lab cluster setup',
    logCount: 5,
    isPinned: false,
    latestLogTitle: 'VLAN trunk config',
    latestLogPreview: 'Trunk mode on Proxmox nodes.',
    latestLogUpdatedAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <KasesProvider>
        <KaseListPage />
      </KasesProvider>
    </MemoryRouter>,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('KaseListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders list items from mocked data', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'k1', title: 'Proxmox Cluster', logCount: 12 }),
      makeKase({ id: 'k2', title: 'OPNsense Migration', logCount: 7, description: null }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Proxmox Cluster')).toBeInTheDocument()
      expect(screen.getByText('OPNsense Migration')).toBeInTheDocument()
    })

    expect(screen.getByText('12 logs')).toBeInTheDocument()
    expect(screen.getByText('7 logs')).toBeInTheDocument()
  })

  it('renders empty state when API returns empty array', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('No kases yet')).toBeInTheDocument()
      expect(screen.getByText('Create your first kase to start logging')).toBeInTheDocument()
    })
  })

  it('opens New Kase form on button click with Title autofocused', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([])
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByText('No kases yet'))

    const buttons = screen.getAllByRole('button', { name: /\+ New Kase/i })
    await user.click(buttons[0])

    expect(screen.getByRole('dialog', { name: 'New Kase' })).toBeInTheDocument()

    const titleInput = screen.getByPlaceholderText('e.g. Proxmox Cluster')
    expect(document.activeElement).toBe(titleInput)
  })

  it('shows error and does not call API when Title is empty', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([])
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByText('No kases yet'))

    const buttons = screen.getAllByRole('button', { name: /\+ New Kase/i })
    await user.click(buttons[0])

    await user.click(screen.getByRole('button', { name: 'Create Kase' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Title is required')
    expect(kasesApi.create).not.toHaveBeenCalled()
  })

  it('calls POST and navigates to /kases/{id} on valid submit', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([])
    vi.mocked(kasesApi.create).mockResolvedValue(
      makeKase({ id: 'new-kase-id', title: 'My New Kase' }),
    )
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByText('No kases yet'))

    const buttons = screen.getAllByRole('button', { name: /\+ New Kase/i })
    await user.click(buttons[0])

    await user.type(screen.getByPlaceholderText('e.g. Proxmox Cluster'), 'My New Kase')
    await user.click(screen.getByRole('button', { name: 'Create Kase' }))

    await waitFor(() => {
      expect(kasesApi.create).toHaveBeenCalledWith({ title: 'My New Kase', description: null })
      expect(mockNavigate).toHaveBeenCalledWith('/kases/new-kase-id')
    })
  })

  it('shows friendly error message on API failure', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([])
    vi.mocked(kasesApi.create).mockRejectedValue(new Error('Server error'))
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByText('No kases yet'))

    const buttons = screen.getAllByRole('button', { name: /\+ New Kase/i })
    await user.click(buttons[0])

    await user.type(screen.getByPlaceholderText('e.g. Proxmox Cluster'), 'My Kase')
    await user.click(screen.getByRole('button', { name: 'Create Kase' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error')
    })
  })
})

// ── Pinned Kases tests ─────────────────────────────────────────────────────

describe('KaseListPage — full row layout and pinning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('renders rows with title, description, latest log preview, and timestamp', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({
        id: 'k1',
        title: 'Proxmox Cluster',
        description: 'Home lab setup',
        latestLogTitle: 'VLAN Config',
        latestLogPreview: 'Trunk mode on nodes.',
        latestLogUpdatedAt: new Date(Date.now() - 3600000).toISOString(),
      }),
    ])

    renderPage()

    await waitFor(() => screen.getByTestId('kase-row-k1'))

    expect(screen.getByText('Proxmox Cluster')).toBeInTheDocument()
    expect(screen.getByText('Home lab setup')).toBeInTheDocument()
    expect(screen.getByText('VLAN Config')).toBeInTheDocument()
    expect(screen.getByText(/Trunk mode on nodes/i)).toBeInTheDocument()
    // Timestamp rendered (relative time, e.g. "1h ago")
    expect(screen.getByTestId('kase-row-k1')).toBeInTheDocument()
  })

  it('kases with no logs show "No logs yet" placeholder', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({
        id: 'k1',
        title: 'Empty Kase',
        logCount: 0,
        latestLogTitle: null,
        latestLogPreview: null,
        latestLogUpdatedAt: null,
      }),
    ])

    renderPage()

    await waitFor(() => screen.getByTestId('no-logs-k1'))

    expect(screen.getByTestId('no-logs-k1')).toHaveTextContent('No logs yet')
  })

  it('pinned kases render above the divider; unpinned below', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'pinned-1', title: 'Pinned Kase', isPinned: true }),
      makeKase({ id: 'unpinned-1', title: 'Unpinned Kase', isPinned: false }),
    ])

    renderPage()

    await waitFor(() => screen.getByTestId('kase-row-pinned-1'))

    const divider = screen.getByTestId('pin-divider')
    const pinnedRow = screen.getByTestId('kase-row-pinned-1')
    const unpinnedRow = screen.getByTestId('kase-row-unpinned-1')

    // Divider should exist
    expect(divider).toBeInTheDocument()

    // Pinned row must appear before divider in DOM
    expect(
      pinnedRow.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    // Unpinned row must appear after divider in DOM
    expect(
      divider.compareDocumentPosition(unpinnedRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('no divider rendered when zero kases are pinned', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'k1', title: 'Kase A', isPinned: false }),
      makeKase({ id: 'k2', title: 'Kase B', isPinned: false }),
    ])

    renderPage()

    await waitFor(() => screen.getByTestId('kase-row-k1'))

    expect(screen.queryByTestId('pin-divider')).not.toBeInTheDocument()
  })

  it('clicking pin icon calls pin endpoint and triggers refresh', async () => {
    const user = userEvent.setup()
    const unpinnedKase = makeKase({ id: 'k1', title: 'My Kase', isPinned: false })
    const pinnedKase = { ...unpinnedKase, isPinned: true }

    vi.mocked(kasesApi.list)
      .mockResolvedValueOnce([unpinnedKase])
      .mockResolvedValueOnce([pinnedKase])
    vi.mocked(kasesApi.pin).mockResolvedValue(pinnedKase)

    renderPage()

    await waitFor(() => screen.getByTestId('pin-btn-k1'))

    await user.click(screen.getByTestId('pin-btn-k1'))

    await waitFor(() => {
      expect(kasesApi.pin).toHaveBeenCalledWith('k1')
    })
  })

  it('clicking pin icon on a pinned kase calls unpin endpoint', async () => {
    const user = userEvent.setup()
    const pinnedKase = makeKase({ id: 'k1', title: 'My Kase', isPinned: true })
    const unpinnedKase = { ...pinnedKase, isPinned: false }

    vi.mocked(kasesApi.list)
      .mockResolvedValueOnce([pinnedKase])
      .mockResolvedValueOnce([unpinnedKase])
    vi.mocked(kasesApi.unpin).mockResolvedValue(unpinnedKase)

    renderPage()

    await waitFor(() => screen.getByTestId('pin-btn-k1'))

    await user.click(screen.getByTestId('pin-btn-k1'))

    await waitFor(() => {
      expect(kasesApi.unpin).toHaveBeenCalledWith('k1')
    })
  })
})

// ── Kase settings panel tests ──────────────────────────────────────────────

describe('KaseListPage — settings panel via gear icon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('clicking the gear icon opens the management panel without navigating', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', title: 'My Kase' })])

    renderPage()

    await waitFor(() => screen.getByTestId('settings-btn-k1'))
    await user.click(screen.getByTestId('settings-btn-k1'))

    await waitFor(() => screen.getByTestId('kase-management-panel'))
    expect(screen.getByTestId('kase-management-panel')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalledWith('/kases/k1')
  })

  it('clicking a kase row (not the gear) navigates to /kases/:id', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', title: 'My Kase' })])

    renderPage()

    await waitFor(() => screen.getByTestId('kase-row-k1'))

    // Click the title text inside the row (not the gear button)
    await user.click(screen.getByText('My Kase'))

    expect(mockNavigate).toHaveBeenCalledWith('/kases/k1')
    expect(screen.queryByTestId('kase-management-panel')).not.toBeInTheDocument()
  })

  it('panel opens pre-populated with title and description', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'k1', title: 'Proxmox Cluster', description: 'Home lab setup' }),
    ])

    renderPage()

    await waitFor(() => screen.getByTestId('settings-btn-k1'))
    await user.click(screen.getByTestId('settings-btn-k1'))

    await waitFor(() => screen.getByTestId('panel-title-input'))

    expect(screen.getByTestId<HTMLInputElement>('panel-title-input').value).toBe('Proxmox Cluster')
    expect(screen.getByTestId<HTMLTextAreaElement>('panel-description-input').value).toBe('Home lab setup')
  })

  it('Save button is disabled until a field changes', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1' })])

    renderPage()

    await waitFor(() => screen.getByTestId('settings-btn-k1'))
    await user.click(screen.getByTestId('settings-btn-k1'))

    await waitFor(() => screen.getByTestId('panel-save-btn'))
    expect(screen.getByTestId('panel-save-btn')).toBeDisabled()
  })

  it('blank title on save shows validation error without calling the API', async () => {
    const user = userEvent.setup()
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', title: 'Some Kase' })])

    renderPage()

    await waitFor(() => screen.getByTestId('settings-btn-k1'))
    await user.click(screen.getByTestId('settings-btn-k1'))

    await waitFor(() => screen.getByTestId('panel-title-input'))

    await user.clear(screen.getByTestId('panel-title-input'))
    await user.click(screen.getByTestId('panel-save-btn'))

    expect(screen.getByRole('alert')).toHaveTextContent('Title is required')
    expect(kasesApi.update).not.toHaveBeenCalled()
  })

  it('successful save updates the kase title in the list', async () => {
    const user     = userEvent.setup()
    const original = makeKase({ id: 'k1', title: 'Old Title', description: null })
    const updated  = { ...original, title: 'New Title' }

    vi.mocked(kasesApi.list).mockResolvedValue([original])
    vi.mocked(kasesApi.update).mockImplementation(async () => {
      vi.mocked(kasesApi.list).mockResolvedValue([updated])
      return updated
    })

    renderPage()

    await waitFor(() => screen.getByTestId('settings-btn-k1'))
    await user.click(screen.getByTestId('settings-btn-k1'))

    await waitFor(() => screen.getByTestId('panel-title-input'))

    await user.clear(screen.getByTestId('panel-title-input'))
    await user.type(screen.getByTestId('panel-title-input'), 'New Title')
    await user.click(screen.getByTestId('panel-save-btn'))

    await waitFor(() => {
      expect(kasesApi.update).toHaveBeenCalledWith('k1', expect.objectContaining({ title: 'New Title' }))
    })
  })

  it('pin toggle in panel calls correct endpoint', async () => {
    const user     = userEvent.setup()
    const unpinned = makeKase({ id: 'k1', isPinned: false })
    const pinned   = { ...unpinned, isPinned: true }

    vi.mocked(kasesApi.list).mockResolvedValue([unpinned])
    vi.mocked(kasesApi.pin).mockResolvedValue(pinned)

    renderPage()

    await waitFor(() => screen.getByTestId('settings-btn-k1'))
    await user.click(screen.getByTestId('settings-btn-k1'))

    await waitFor(() => screen.getByTestId('panel-pin-toggle'))
    await user.click(screen.getByTestId('panel-pin-toggle'))

    await waitFor(() => expect(kasesApi.pin).toHaveBeenCalledWith('k1'))
  })

  it('confirming delete calls DELETE and removes the kase from the list', async () => {
    const user = userEvent.setup()
    const kase = makeKase({ id: 'k1', title: 'Doomed Kase' })

    vi.mocked(kasesApi.list)
      .mockResolvedValueOnce([kase])
      .mockResolvedValueOnce([])
    vi.mocked(kasesApi.delete).mockResolvedValue(undefined)

    renderPage()

    await waitFor(() => screen.getByTestId('settings-btn-k1'))
    await user.click(screen.getByTestId('settings-btn-k1'))

    await waitFor(() => screen.getByTestId('panel-delete-btn'))
    await user.click(screen.getByTestId('panel-delete-btn'))

    await waitFor(() => screen.getByTestId('panel-confirm-delete-btn'))
    await user.click(screen.getByTestId('panel-confirm-delete-btn'))

    await waitFor(() => expect(kasesApi.delete).toHaveBeenCalledWith('k1'))
    await waitFor(() => expect(screen.queryByTestId('kase-management-panel')).not.toBeInTheDocument())
  })
})
