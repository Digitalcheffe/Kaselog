import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import KaseViewPage from '../pages/KaseViewPage'
import type { KaseResponse, LogResponse, TagResponse } from '../api/types'

// ── Mock the API client ───────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  kases: {
    get: vi.fn(),
  },
  logs: {
    listByKase: vi.fn(),
    create: vi.fn(),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { kases as kasesApi, logs as logsApi } from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeKase(overrides: Partial<KaseResponse> = {}): KaseResponse {
  return {
    id: 'kase-1',
    title: 'Proxmox Cluster',
    description: 'Home lab cluster setup',
    logCount: 3,
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
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

function makeLog(overrides: Partial<LogResponse> = {}): LogResponse {
  return {
    id: 'log-1',
    kaseId: 'kase-1',
    title: 'VLAN trunk configuration',
    description: 'Trunk mode on Proxmox nodes.',
    autosaveEnabled: true,
    content: '',
    versionCount: 3,
    tags: [],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    ...overrides,
  }
}

function renderPage(kaseId = 'kase-1') {
  return render(
    <MemoryRouter initialEntries={[`/kases/${kaseId}`]}>
      <Routes>
        <Route path="/kases/:id" element={<KaseViewPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KaseViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders timeline entries from mocked data', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(logsApi.listByKase).mockResolvedValue([
      makeLog({ id: 'log-1', title: 'VLAN trunk configuration', versionCount: 3 }),
      makeLog({ id: 'log-2', title: 'Installed node 3', versionCount: 1 }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('VLAN trunk configuration')).toBeInTheDocument()
      expect(screen.getByText('Installed node 3')).toBeInTheDocument()
    })
  })

  it('shows version badge with correct count', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(logsApi.listByKase).mockResolvedValue([
      makeLog({ id: 'log-1', versionCount: 5 }),
      makeLog({ id: 'log-2', title: 'Another log', versionCount: 1 }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('v5')).toBeInTheDocument()
      expect(screen.getByText('v1')).toBeInTheDocument()
    })
  })

  it('renders tag pills from log tags', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(logsApi.listByKase).mockResolvedValue([
      makeLog({
        id: 'log-1',
        tags: [
          makeTag({ id: 't1', name: 'networking' }),
          makeTag({ id: 't2', name: 'proxmox' }),
        ],
      }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('networking')).toBeInTheDocument()
      expect(screen.getByText('proxmox')).toBeInTheDocument()
    })
  })

  it('applies consistent color class for the same tag name across entries', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(logsApi.listByKase).mockResolvedValue([
      makeLog({
        id: 'log-1',
        tags: [makeTag({ id: 't1', name: 'proxmox' })],
      }),
      makeLog({
        id: 'log-2',
        title: 'Another log',
        tags: [makeTag({ id: 't2', name: 'proxmox' })],
      }),
    ])

    renderPage()

    await waitFor(() => {
      const tagPills = screen.getAllByText('proxmox')
      expect(tagPills).toHaveLength(2)
      // Both pills must carry the same color class
      expect(tagPills[0].className).toBe(tagPills[1].className)
    })
  })

  it('renders empty state when logs array is empty', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(logsApi.listByKase).mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('No logs yet')).toBeInTheDocument()
    })
  })

  it('renders 404 state when kase is not found', async () => {
    vi.mocked(kasesApi.get).mockRejectedValue(new Error('Kase with ID not found'))
    vi.mocked(logsApi.listByKase).mockResolvedValue([])

    renderPage('nonexistent-id')

    await waitFor(() => {
      expect(screen.getByText('Kase not found')).toBeInTheDocument()
    })
  })

  it('clicking a log entry navigates to /logs/{id}', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(logsApi.listByKase).mockResolvedValue([
      makeLog({ id: 'log-abc', title: 'Click me' }),
    ])
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByText('Click me'))
    await user.click(screen.getByText('Click me'))

    expect(mockNavigate).toHaveBeenCalledWith('/logs/log-abc')
  })

  it('New Log button calls POST and navigates to /logs/{id}', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(logsApi.listByKase).mockResolvedValue([])
    vi.mocked(logsApi.create).mockResolvedValue(makeLog({ id: 'new-log-id' }))
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByText('No logs yet'))

    // There is a New Log button in the top bar and one inside the empty state
    const newLogBtn = screen.getAllByRole('button', { name: /\+ New Log/i })[0]
    await user.click(newLogBtn)

    await waitFor(() => {
      expect(logsApi.create).toHaveBeenCalledWith('kase-1', { title: 'New Log' })
      expect(mockNavigate).toHaveBeenCalledWith('/logs/new-log-id')
    })
  })

  it('shows the kase title and log count in the top bar', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase({ title: 'My Kase', logCount: 7 }))
    vi.mocked(logsApi.listByKase).mockResolvedValue([
      makeLog({ id: 'l1', title: 'Log A' }),
      makeLog({ id: 'l2', title: 'Log B' }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('My Kase')).toBeInTheDocument()
      expect(screen.getByText('2 logs')).toBeInTheDocument()
    })
  })

  it('renders log descriptions when present', async () => {
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(logsApi.listByKase).mockResolvedValue([
      makeLog({ id: 'log-1', description: 'Some meaningful description text' }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Some meaningful description text')).toBeInTheDocument()
    })
  })
})
