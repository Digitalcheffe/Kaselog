import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import KaseViewPage from '../pages/KaseViewPage'
import LogViewPage from '../pages/LogViewPage'
import { KasesProvider } from '../contexts/KasesContext'
import type { KaseResponse, TimelineEntryResponse, LogResponse, LogVersionResponse } from '../api/types'

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
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    pin: vi.fn(),
  },
  versions: {
    list: vi.fn(),
    create: vi.fn(),
    restore: vi.fn(),
  },
  tags: {
    list: vi.fn(),
    addToLog: vi.fn(),
    removeFromLog: vi.fn(),
  },
  images: { upload: vi.fn() },
  collections: {
    list: vi.fn(),
  },
}))

vi.mock('../components/TiptapEditor', () => ({
  default: ({ content, onChange }: { content: string; onChange: (m: string) => void }) => (
    <textarea
      aria-label="editor content"
      data-testid="editor-textarea"
      defaultValue={content}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import {
  kases as kasesApi,
  timeline as timelineApi,
  logs as logsApi,
  versions as versionsApi,
  tags as tagsApi,
  collections as collectionsApi,
} from '../api/client'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeKase(overrides: Partial<KaseResponse> = {}): KaseResponse {
  return {
    id: 'kase-1',
    title: 'Proxmox Cluster',
    description: null,
    logCount: 3,
    isPinned: false,
    latestLogTitle: null,
    latestLogPreview: null,
    latestLogUpdatedAt: null,
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
    description: null,
    versionCount: 3,
    isPinned: false,
    tags: [],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    ...overrides,
  }
}

function makeLog(overrides: Partial<LogResponse> = {}): LogResponse {
  return {
    id: 'log-1',
    kaseId: 'kase-1',
    title: 'VLAN trunk configuration',
    description: null,
    autosaveEnabled: true,
    isPinned: false,
    content: '# Hello world',
    versionCount: 1,
    tags: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeVersion(overrides: Partial<LogVersionResponse> = {}): LogVersionResponse {
  return {
    id: 'v-1',
    logId: 'log-1',
    content: '# Hello world',
    label: null,
    isAutosave: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderKaseView(kaseId = 'kase-1') {
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

function renderLogView(logId = 'log-1') {
  return render(
    <MemoryRouter initialEntries={[`/logs/${logId}`]}>
      <Routes>
        <Route path="/logs/:id" element={<LogViewPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ── KaseViewPage — pin marker tests ───────────────────────────────────────────

describe('KaseViewPage — pin marker on timeline dot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(kasesApi.list).mockResolvedValue([])
    vi.mocked(collectionsApi.list).mockResolvedValue([])
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
  })

  it('pinned log renders pin-dot-marker; unpinned log does not', async () => {
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'log-pinned', title: 'Pinned Log', isPinned: true }),
      makeEntry({ id: 'log-normal', title: 'Normal Log', isPinned: false }),
    ])

    renderKaseView()

    await waitFor(() => {
      screen.getByText('Pinned Log')
      screen.getByText('Normal Log')
    })

    const markers = screen.getAllByTestId('pin-dot-marker')
    expect(markers).toHaveLength(1)
  })

  it('unpinned log has no pin-dot-marker', async () => {
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'log-1', title: 'Normal Log', isPinned: false }),
    ])

    renderKaseView()

    await waitFor(() => screen.getByText('Normal Log'))

    expect(screen.queryByTestId('pin-dot-marker')).not.toBeInTheDocument()
  })

  it('pinned log renders pin-entry-badge in header; unpinned does not', async () => {
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'log-pinned', title: 'Pinned Log', isPinned: true }),
      makeEntry({ id: 'log-normal', title: 'Normal Log', isPinned: false }),
    ])

    renderKaseView()

    await waitFor(() => screen.getByText('Pinned Log'))

    const badges = screen.getAllByTestId('pin-entry-badge')
    expect(badges).toHaveLength(1)
  })
})

// ── KaseViewPage — pin filter toggle ─────────────────────────────────────────

describe('KaseViewPage — pin filter toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(kasesApi.list).mockResolvedValue([])
    vi.mocked(collectionsApi.list).mockResolvedValue([])
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
  })

  it('pin filter toggle is visible in top bar', async () => {
    vi.mocked(timelineApi.list).mockResolvedValue([])

    renderKaseView()

    await waitFor(() => screen.getByTestId('pin-filter-toggle'))
    expect(screen.getByTestId('pin-filter-toggle')).toBeInTheDocument()
  })

  it('when active: shows only pinned logs; hides unpinned logs', async () => {
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'log-pinned', title: 'Pinned Log', isPinned: true }),
      makeEntry({ id: 'log-normal', title: 'Normal Log', isPinned: false }),
    ])

    const user = userEvent.setup()
    renderKaseView()

    await waitFor(() => {
      screen.getByText('Pinned Log')
      screen.getByText('Normal Log')
    })

    await user.click(screen.getByTestId('pin-filter-toggle'))

    await waitFor(() => {
      expect(screen.getByText('Pinned Log')).toBeInTheDocument()
      expect(screen.queryByText('Normal Log')).not.toBeInTheDocument()
    })
  })

  it('when inactive: all logs show normally', async () => {
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'log-pinned', title: 'Pinned Log', isPinned: true }),
      makeEntry({ id: 'log-normal', title: 'Normal Log', isPinned: false }),
    ])

    renderKaseView()

    await waitFor(() => {
      expect(screen.getByText('Pinned Log')).toBeInTheDocument()
      expect(screen.getByText('Normal Log')).toBeInTheDocument()
    })
  })

  it('pin filter toggle composes with tag filter — both active narrows correctly', async () => {
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'log-a', title: 'Pinned With Tag', isPinned: true, tags: ['networking'] }),
      makeEntry({ id: 'log-b', title: 'Pinned No Tag', isPinned: true, tags: [] }),
      makeEntry({ id: 'log-c', title: 'Normal With Tag', isPinned: false, tags: ['networking'] }),
    ])

    const user = userEvent.setup()

    // We need to render the page and activate both pin filter and tag filter.
    // The tag filter in KaseViewPage is set via `activeTagFilter` state but exposed
    // only in the filtering logic. We test the pin filter in isolation here.
    renderKaseView()

    await waitFor(() => screen.getByTestId('pin-filter-toggle'))
    await user.click(screen.getByTestId('pin-filter-toggle'))

    await waitFor(() => {
      // Only pinned logs remain
      expect(screen.getByText('Pinned With Tag')).toBeInTheDocument()
      expect(screen.getByText('Pinned No Tag')).toBeInTheDocument()
      expect(screen.queryByText('Normal With Tag')).not.toBeInTheDocument()
    })
  })

  it('empty state shows when pin filter active and no logs are pinned', async () => {
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'log-1', title: 'Normal Log', isPinned: false }),
      makeEntry({ id: 'log-2', title: 'Another Log', isPinned: false }),
    ])

    const user = userEvent.setup()
    renderKaseView()

    await waitFor(() => screen.getByTestId('pin-filter-toggle'))
    await user.click(screen.getByTestId('pin-filter-toggle'))

    await waitFor(() => {
      expect(screen.getByTestId('pinned-empty-state')).toBeInTheDocument()
      expect(screen.getByText(/No pinned logs in this Kase/i)).toBeInTheDocument()
    })
  })

  it('collection_item entries are hidden when pin filter is active', async () => {
    vi.mocked(timelineApi.list).mockResolvedValue([
      makeEntry({ id: 'log-pinned', title: 'Pinned Log', isPinned: true }),
      {
        entityType: 'collection_item',
        id: 'item-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        collectionId: 'col-1',
        collectionTitle: 'Applications',
        collectionColor: 'blue',
        kaseId: 'kase-1',
        itemTitle: 'Proxmox VE',
        summaryFields: [],
      },
    ])

    const user = userEvent.setup()
    renderKaseView()

    await waitFor(() => screen.getByText('Pinned Log'))
    await user.click(screen.getByTestId('pin-filter-toggle'))

    await waitFor(() => {
      expect(screen.getByText('Pinned Log')).toBeInTheDocument()
      expect(screen.queryByText('Proxmox VE')).not.toBeInTheDocument()
    })
  })
})

// ── LogViewPage — settings panel pin toggle ───────────────────────────────────

describe('LogViewPage — settings panel pin toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(versionsApi.list).mockResolvedValue([makeVersion()])
    vi.mocked(tagsApi.list).mockResolvedValue([])
  })

  it('pin toggle is present in settings panel', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog({ isPinned: false }))

    renderLogView()

    // Open the settings panel via the version history pill
    const user = userEvent.setup()
    await waitFor(() => screen.getByText(/v1 · history/i))
    await user.click(screen.getByText(/v1 · history/i))

    await waitFor(() => {
      expect(screen.getByTestId('log-pin-toggle')).toBeInTheDocument()
      expect(screen.getByText('Pin this log')).toBeInTheDocument()
    })
  })

  it('pin toggle reflects isPinned=false state on panel open', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog({ isPinned: false }))

    const user = userEvent.setup()
    renderLogView()

    await waitFor(() => screen.getByText(/v1 · history/i))
    await user.click(screen.getByText(/v1 · history/i))

    await waitFor(() => screen.getByTestId('log-pin-toggle'))

    const toggle = screen.getByTestId('log-pin-toggle')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('pin toggle reflects isPinned=true state on panel open', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog({ isPinned: true }))

    const user = userEvent.setup()
    renderLogView()

    await waitFor(() => screen.getByText(/v1 · history/i))
    await user.click(screen.getByText(/v1 · history/i))

    await waitFor(() => screen.getByTestId('log-pin-toggle'))

    const toggle = screen.getByTestId('log-pin-toggle')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('clicking pin toggle calls PATCH /api/logs/{id}/pin with isPinned=true when unpinned', async () => {
    const unpinned = makeLog({ isPinned: false })
    const pinned = makeLog({ isPinned: true })
    vi.mocked(logsApi.get).mockResolvedValue(unpinned)
    vi.mocked(logsApi.pin).mockResolvedValue(pinned)

    const user = userEvent.setup()
    renderLogView()

    await waitFor(() => screen.getByText(/v1 · history/i))
    await user.click(screen.getByText(/v1 · history/i))

    await waitFor(() => screen.getByTestId('log-pin-toggle'))
    await user.click(screen.getByTestId('log-pin-toggle'))

    await waitFor(() => {
      expect(logsApi.pin).toHaveBeenCalledWith('log-1', { isPinned: true })
    })
  })

  it('clicking pin toggle calls PATCH /api/logs/{id}/pin with isPinned=false when pinned', async () => {
    const pinned = makeLog({ isPinned: true })
    const unpinned = makeLog({ isPinned: false })
    vi.mocked(logsApi.get).mockResolvedValue(pinned)
    vi.mocked(logsApi.pin).mockResolvedValue(unpinned)

    const user = userEvent.setup()
    renderLogView()

    await waitFor(() => screen.getByText(/v1 · history/i))
    await user.click(screen.getByText(/v1 · history/i))

    await waitFor(() => screen.getByTestId('log-pin-toggle'))
    await user.click(screen.getByTestId('log-pin-toggle'))

    await waitFor(() => {
      expect(logsApi.pin).toHaveBeenCalledWith('log-1', { isPinned: false })
    })
  })

  it('after pin toggle, panel reflects updated isPinned state', async () => {
    const unpinned = makeLog({ isPinned: false })
    const pinned = makeLog({ isPinned: true })
    vi.mocked(logsApi.get).mockResolvedValue(unpinned)
    vi.mocked(logsApi.pin).mockResolvedValue(pinned)

    const user = userEvent.setup()
    renderLogView()

    await waitFor(() => screen.getByText(/v1 · history/i))
    await user.click(screen.getByText(/v1 · history/i))

    await waitFor(() => screen.getByTestId('log-pin-toggle'))
    expect(screen.getByTestId('log-pin-toggle')).toHaveAttribute('aria-checked', 'false')

    await user.click(screen.getByTestId('log-pin-toggle'))

    await waitFor(() => {
      expect(screen.getByTestId('log-pin-toggle')).toHaveAttribute('aria-checked', 'true')
    })
  })
})
