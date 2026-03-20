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
    list: vi.fn(),
    create: vi.fn(),
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
