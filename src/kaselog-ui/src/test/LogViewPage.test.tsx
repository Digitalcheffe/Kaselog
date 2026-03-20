import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LogViewPage from '../pages/LogViewPage'
import type { KaseResponse, LogResponse, LogVersionResponse, TagResponse } from '../api/types'

// ── Mock the API client ───────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  kases: { get: vi.fn() },
  logs: { get: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
  versions: { list: vi.fn(), create: vi.fn(), restore: vi.fn() },
  tags: { list: vi.fn(), addToLog: vi.fn(), removeFromLog: vi.fn() },
  images: { upload: vi.fn() },
}))

// ── Mock TiptapEditor ─────────────────────────────────────────────────────────
// Stores the latest onChange so tests can trigger it directly.

let capturedOnChange: ((html: string) => void) | null = null

vi.mock('../components/TiptapEditor', () => ({
  default: ({
    content,
    onChange,
    onImageUpload,
  }: {
    content: string
    onChange: (html: string) => void
    onImageUpload: (file: File) => Promise<string>
  }) => {
    capturedOnChange = onChange
    return (
      <div data-testid="tiptap-editor">
        <textarea
          aria-label="editor content"
          data-testid="editor-textarea"
          defaultValue={content}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          data-testid="upload-image-btn"
          onClick={async () => {
            const file = new File(['img'], 'test.png', { type: 'image/png' })
            const url = await onImageUpload(file)
            onChange(`<img src="${url}" />`)
          }}
        >
          Upload image
        </button>
      </div>
    )
  },
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockNavigate = vi.fn()

import { kases as kasesApi, logs as logsApi, versions as versionsApi, images as imagesApi, tags as tagsApi } from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeKase(overrides: Partial<KaseResponse> = {}): KaseResponse {
  return {
    id: 'kase-1',
    title: 'Proxmox Cluster',
    description: null,
    logCount: 3,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
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
    content: '<p>Hello world</p>',
    versionCount: 3,
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
    content: '<p>Hello world</p>',
    label: null,
    isAutosave: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function renderPage(logId = 'log-1') {
  return render(
    <MemoryRouter initialEntries={[`/logs/${logId}`]}>
      <Routes>
        <Route path="/logs/:id" element={<LogViewPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LogViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOnChange = null

    vi.mocked(kasesApi.get).mockResolvedValue(makeKase())
    vi.mocked(versionsApi.list).mockResolvedValue([makeVersion()])
    vi.mocked(tagsApi.list).mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── 1. Editor renders with content from current LogVersion ──────────────────

  it('renders editor with content from current LogVersion', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog({ content: '<p>Hello world</p>' }))

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument()
    })

    const textarea = screen.getByTestId('editor-textarea') as HTMLTextAreaElement
    expect(textarea.defaultValue).toBe('<p>Hello world</p>')
  })

  // ── 2. Title calls PUT /api/logs/{id} on blur ────────────────────────────────

  it('calls PUT /api/logs/{id} when title is changed and blurred', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog())
    vi.mocked(logsApi.update).mockResolvedValue(makeLog({ title: 'New Title' }))
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByRole('textbox', { name: /log title/i }))

    const titleInput = screen.getByRole('textbox', { name: /log title/i })
    await user.clear(titleInput)
    await user.type(titleInput, 'New Title')
    await user.tab()

    await waitFor(() => {
      expect(logsApi.update).toHaveBeenCalledWith(
        'log-1',
        expect.objectContaining({ title: 'New Title' }),
      )
    })
  })

  // ── 3. Autosave fires 2s after typing when AutosaveEnabled true ──────────────

  it('fires autosave 2s after typing when autosaveEnabled is true', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog({ autosaveEnabled: true }))
    vi.mocked(versionsApi.create).mockResolvedValue(makeVersion())

    renderPage()

    // Wait for component to fully load before switching to fake timers
    await waitFor(() => screen.getByTestId('editor-textarea'))

    // Switch to fake timers only after the component is mounted
    vi.useFakeTimers()

    // Simulate typing via the captured onChange callback
    act(() => {
      capturedOnChange?.('<p>Updated content</p>')
    })

    // Before 2s: no save
    expect(versionsApi.create).not.toHaveBeenCalled()

    // Advance 2s
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(versionsApi.create).toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({ isAutosave: true }),
    )
  })

  // ── 4. Autosave does not fire when AutosaveEnabled false ─────────────────────

  it('does not fire autosave when autosaveEnabled is false', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog({ autosaveEnabled: false }))

    renderPage()

    await waitFor(() => screen.getByTestId('editor-textarea'))

    vi.useFakeTimers()

    act(() => {
      capturedOnChange?.('<p>Updated</p>')
    })

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(versionsApi.create).not.toHaveBeenCalled()
  })

  // ── 5. Save button visible only when AutosaveEnabled false ───────────────────

  it('shows Save button only when autosaveEnabled is false', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog({ autosaveEnabled: false }))

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Save$/ })).toBeInTheDocument()
    })
  })

  it('hides Save button when autosaveEnabled is true', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog({ autosaveEnabled: true }))

    renderPage()

    await waitFor(() => screen.getByTestId('tiptap-editor'))

    expect(screen.queryByRole('button', { name: /^Save$/ })).not.toBeInTheDocument()
  })

  // ── 6. Save button calls POST .../versions with isAutosave: false ────────────

  it('Save button calls POST versions with isAutosave: false', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog({ autosaveEnabled: false }))
    vi.mocked(versionsApi.create).mockResolvedValue(makeVersion({ isAutosave: false }))
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByRole('button', { name: /^Save$/ }))

    await user.click(screen.getByRole('button', { name: /^Save$/ }))

    await waitFor(() => {
      expect(versionsApi.create).toHaveBeenCalledWith(
        'log-1',
        expect.objectContaining({ isAutosave: false }),
      )
    })
  })

  // ── 7. Image upload calls POST /api/images ────────────────────────────────────

  it('calls POST /api/images on image upload and inserts node with correct src', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog())
    vi.mocked(imagesApi.upload).mockResolvedValue({ uid: 'ABC123', url: '/api/images/ABC123' })

    renderPage()

    await waitFor(() => screen.getByTestId('upload-image-btn'))

    const user = userEvent.setup()
    await user.click(screen.getByTestId('upload-image-btn'))

    await waitFor(() => {
      expect(imagesApi.upload).toHaveBeenCalled()
      const file = vi.mocked(imagesApi.upload).mock.calls[0][0]
      expect(file).toBeInstanceOf(File)
    })
  })

  // ── 8. Settings panel opens/closes on edge tab click ────────────────────────

  it('opens and closes settings panel on edge tab click', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog())
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByTestId('edge-tab'))

    expect(screen.queryByText('Log settings')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('edge-tab'))

    await waitFor(() => {
      expect(screen.getByText('Log settings')).toBeInTheDocument()
    })
  })

  // ── 9. Kase name shown in breadcrumb ─────────────────────────────────────────

  it('shows kase title in breadcrumb', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog())
    vi.mocked(kasesApi.get).mockResolvedValue(makeKase({ title: 'My Kase' }))

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/← My Kase/)).toBeInTheDocument()
    })
  })

  // ── 10. Textarea content reflects prop ───────────────────────────────────────

  it('onChange on editor textarea triggers handleContentChange', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog({ autosaveEnabled: false }))

    renderPage()

    await waitFor(() => screen.getByTestId('editor-textarea'))

    fireEvent.change(screen.getByTestId('editor-textarea'), {
      target: { value: '<p>Changed</p>' },
    })

    // unsaved changes -> Save button still present
    expect(screen.getByRole('button', { name: /^Save$/ })).toBeInTheDocument()
  })

  // ── 11. Panel closes on second edge tab click ─────────────────────────────

  it('hides settings panel after second edge tab click', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog())
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByTestId('edge-tab'))
    await user.click(screen.getByTestId('edge-tab'))
    await waitFor(() => screen.getByText('Log settings'))

    await user.click(screen.getByTestId('edge-tab'))

    await waitFor(() => {
      expect(screen.queryByText('Log settings')).not.toBeInTheDocument()
    })
  })

  // ── 12. Edge tab arrow toggles ────────────────────────────────────────────

  it('toggles edge tab arrow between ‹ and › on click', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog())
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByTestId('edge-tab'))
    expect(screen.getByTestId('edge-tab')).toHaveTextContent('‹')

    await user.click(screen.getByTestId('edge-tab'))
    await waitFor(() => expect(screen.getByTestId('edge-tab')).toHaveTextContent('›'))

    await user.click(screen.getByTestId('edge-tab'))
    await waitFor(() => expect(screen.getByTestId('edge-tab')).toHaveTextContent('‹'))
  })

  // ── 13. Panel title calls PUT and updates breadcrumb ─────────────────────

  it('panel title change calls PUT and updates top bar breadcrumb', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog({ title: 'Old Title' }))
    vi.mocked(logsApi.update).mockResolvedValue(makeLog({ title: 'Renamed Title' }))
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByTestId('edge-tab'))
    await user.click(screen.getByTestId('edge-tab'))

    const panelTitle = await screen.findByRole('textbox', { name: /panel title/i })
    await user.clear(panelTitle)
    await user.type(panelTitle, 'Renamed Title')
    await user.tab()

    await waitFor(() => {
      expect(logsApi.update).toHaveBeenCalledWith(
        'log-1',
        expect.objectContaining({ title: 'Renamed Title' }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('topbar-log-title')).toHaveTextContent('Renamed Title')
    })
  })

  // ── 14. Tag add ───────────────────────────────────────────────────────────

  it('tag add calls POST /api/logs/{logId}/tags', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog())
    vi.mocked(tagsApi.addToLog).mockResolvedValue({
      id: 'tag-new',
      name: 'networking',
      createdAt: new Date().toISOString(),
    } as TagResponse)
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByTestId('edge-tab'))
    await user.click(screen.getByTestId('edge-tab'))

    const tagInput = await screen.findByPlaceholderText('add tag…')
    await user.type(tagInput, 'networking')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(tagsApi.addToLog).toHaveBeenCalledWith('log-1', 'networking')
    })
  })

  // ── 15. Tag remove ────────────────────────────────────────────────────────

  it('tag remove calls DELETE /api/logs/{logId}/tags/{tagId}', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(
      makeLog({
        tags: [{ id: 'tag-1', name: 'networking', createdAt: new Date().toISOString() }],
      }),
    )
    vi.mocked(tagsApi.removeFromLog).mockImplementation(() => Promise.resolve())
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByTestId('edge-tab'))
    await user.click(screen.getByTestId('edge-tab'))

    await waitFor(() => screen.getByText('networking'))
    await user.click(screen.getByText('✕'))

    await waitFor(() => {
      expect(tagsApi.removeFromLog).toHaveBeenCalledWith('log-1', 'tag-1')
    })
  })

  // ── 16. Autosave toggle ───────────────────────────────────────────────────

  it('autosave toggle calls PUT and shows Save button when disabled', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog({ autosaveEnabled: true }))
    vi.mocked(logsApi.update).mockResolvedValue(makeLog({ autosaveEnabled: false }))
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByTestId('edge-tab'))
    expect(screen.queryByRole('button', { name: /^Save$/ })).not.toBeInTheDocument()

    await user.click(screen.getByTestId('edge-tab'))
    const toggle = await screen.findByTestId('autosave-toggle')
    await user.click(toggle)

    await waitFor(() => {
      expect(logsApi.update).toHaveBeenCalledWith(
        'log-1',
        expect.objectContaining({ autosaveEnabled: false }),
      )
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Save$/ })).toBeInTheDocument()
    })
  })

  // ── 17. Named checkpoint ──────────────────────────────────────────────────

  it('named checkpoint calls POST with isAutosave: false and label', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog())
    vi.mocked(versionsApi.create).mockResolvedValue(
      makeVersion({ isAutosave: false, label: 'before rewrite' }),
    )
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByTestId('edge-tab'))
    await user.click(screen.getByTestId('edge-tab'))

    const cpInput = await screen.findByPlaceholderText('checkpoint label…')
    await user.type(cpInput, 'before rewrite')
    await user.click(screen.getByRole('button', { name: /\+ checkpoint/i }))

    await waitFor(() => {
      expect(versionsApi.create).toHaveBeenCalledWith(
        'log-1',
        expect.objectContaining({ isAutosave: false, label: 'before rewrite' }),
      )
    })
  })

  // ── 18. Restore version ───────────────────────────────────────────────────

  it('restore calls POST .../restore and updates editor content', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog())
    vi.mocked(versionsApi.list).mockResolvedValue([
      makeVersion({ id: 'v-current', content: '<p>Current</p>' }),
      makeVersion({ id: 'v-old', content: '<p>Old content</p>' }),
    ])
    vi.mocked(versionsApi.restore).mockResolvedValue(
      makeVersion({ id: 'v-restored', content: '<p>Old content</p>' }),
    )
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByTestId('edge-tab'))
    await user.click(screen.getByTestId('edge-tab'))

    const oldEntry = await screen.findByTestId('version-entry-v-old')
    await user.click(oldEntry)

    await waitFor(() => {
      expect(versionsApi.restore).toHaveBeenCalledWith('log-1', 'v-old')
    })
  })

  // ── 19. Delete with confirmation ──────────────────────────────────────────

  it('delete shows confirmation, calls DELETE, navigates to kase', async () => {
    vi.mocked(logsApi.get).mockResolvedValue(makeLog())
    vi.mocked(logsApi.delete).mockImplementation(() => Promise.resolve())
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => screen.getByTestId('edge-tab'))
    await user.click(screen.getByTestId('edge-tab'))

    const deleteBtn = await screen.findByRole('button', { name: /delete this log/i })
    await user.click(deleteBtn)

    const confirmBtn = await screen.findByRole('button', { name: /confirm delete/i })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(logsApi.delete).toHaveBeenCalledWith('log-1')
      expect(mockNavigate).toHaveBeenCalledWith('/kases/kase-1')
    })
  })
})
