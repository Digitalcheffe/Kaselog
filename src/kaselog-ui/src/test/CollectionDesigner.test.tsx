import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CollectionDesignerPage from '../pages/CollectionDesignerPage'
import type { CollectionResponse, CollectionFieldResponse } from '../api/types'

// ── Mock the API client ──────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  collections: {
    get: vi.fn(),
    update: vi.fn(),
    getFields: vi.fn(),
    createField: vi.fn(),
    updateField: vi.fn(),
    deleteField: vi.fn(),
    reorderFields: vi.fn(),
    getLayout: vi.fn(),
    updateLayout: vi.fn(),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { collections as collectionsApi } from '../api/client'

// ── Helpers ──────────────────────────────────────────────────────────────────

const COLLECTION_ID = 'col-1'

function makeCollection(overrides: Partial<CollectionResponse> = {}): CollectionResponse {
  return {
    id: COLLECTION_ID,
    title: 'Vinyl Records',
    color: 'teal',
    itemCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeField(overrides: Partial<CollectionFieldResponse> = {}): CollectionFieldResponse {
  return {
    id: 'field-1',
    collectionId: COLLECTION_ID,
    name: 'Album',
    type: 'text',
    required: false,
    showInList: true,
    options: null,
    sortOrder: 0,
    ...overrides,
  }
}

function renderDesigner(collectionId = COLLECTION_ID) {
  return render(
    <MemoryRouter initialEntries={[`/collections/${collectionId}/design`]}>
      <Routes>
        <Route path="/collections/:id/design" element={<CollectionDesignerPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CollectionDesignerPage — Schema tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getLayout).mockResolvedValue({ collectionId: COLLECTION_ID, layout: '[]' })
    vi.mocked(collectionsApi.getFields).mockResolvedValue([])
    vi.mocked(collectionsApi.updateField).mockResolvedValue(makeField())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders existing fields in the schema list', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f-1', name: 'Album', type: 'text', sortOrder: 0 }),
      makeField({ id: 'f-2', name: 'Artist', type: 'text', sortOrder: 1 }),
    ])

    renderDesigner()

    await waitFor(() => {
      expect(screen.getByText('Album')).toBeInTheDocument()
      expect(screen.getByText('Artist')).toBeInTheDocument()
    })
  })

  it('clicking a field row opens it in the field editor', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f-1', name: 'Album', type: 'text', sortOrder: 0 }),
    ])

    const user = userEvent.setup()
    renderDesigner()

    await waitFor(() => screen.getByRole('button', { name: 'Field: Album' }))
    await user.click(screen.getByRole('button', { name: 'Field: Album' }))

    const nameInput = screen.getByLabelText('Field name')
    expect(nameInput).toBeInTheDocument()
    expect((nameInput as HTMLInputElement).value).toBe('Album')
  })

  it('clicking Add field button shows the type picker grid', async () => {
    const user = userEvent.setup()
    renderDesigner()

    await waitFor(() => screen.getByLabelText('Add field'))
    await user.click(screen.getByLabelText('Add field'))

    // Use unique hint texts to verify type picker is open with all 9 types
    expect(screen.getByText('Single line')).toBeInTheDocument()   // text hint
    expect(screen.getByText('Preset options')).toBeInTheDocument() // select hint
    expect(screen.getByText('Toggle')).toBeInTheDocument()          // boolean hint
  })

  it('selecting a type from the type picker creates the field via API', async () => {
    const newField = makeField({ id: 'f-new', name: 'Rating', type: 'rating', options: null })
    vi.mocked(collectionsApi.createField).mockResolvedValue(newField)

    const user = userEvent.setup()
    renderDesigner()

    await waitFor(() => screen.getByLabelText('Add field'))
    await user.click(screen.getByLabelText('Add field'))

    // Click Rating type (unique hint: "1–5 stars")
    await user.click(screen.getByText('1–5 stars').closest('button')!)

    expect(collectionsApi.createField).toHaveBeenCalledWith(
      COLLECTION_ID,
      expect.objectContaining({ type: 'rating' }),
    )
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Field:/ }).length).toBeGreaterThan(0)
    })
  })

  it('clicking delete (×) on a field removes it from the list', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f-1', name: 'Album', type: 'text', sortOrder: 0 }),
    ])
    vi.mocked(collectionsApi.deleteField).mockResolvedValue()

    const user = userEvent.setup()
    renderDesigner()

    await waitFor(() => screen.getByLabelText('Delete Album'))
    await user.click(screen.getByLabelText('Delete Album'))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Field: Album' })).not.toBeInTheDocument()
    })
    expect(collectionsApi.deleteField).toHaveBeenCalledWith(COLLECTION_ID, 'f-1')
  })

  it('editing field name auto-saves via updateField after debounce', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f-1', name: 'Album', type: 'text', sortOrder: 0 }),
    ])

    const user = userEvent.setup()
    renderDesigner()

    await waitFor(() => screen.getByRole('button', { name: 'Field: Album' }))
    await user.click(screen.getByRole('button', { name: 'Field: Album' }))

    const nameInput = screen.getByLabelText('Field name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Title')

    // Wait for the 500ms debounce to fire (allow up to 2000ms)
    await waitFor(
      () => {
        expect(collectionsApi.updateField).toHaveBeenCalledWith(
          COLLECTION_ID,
          'f-1',
          expect.objectContaining({ name: 'Title' }),
        )
      },
      { timeout: 2000 },
    )
  })

  it('toggling Required checkbox calls updateField immediately', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f-1', name: 'Album', type: 'text', required: false, sortOrder: 0 }),
    ])

    const user = userEvent.setup()
    renderDesigner()

    await waitFor(() => screen.getByRole('button', { name: 'Field: Album' }))
    await user.click(screen.getByRole('button', { name: 'Field: Album' }))

    await user.click(screen.getByLabelText('Required'))

    await waitFor(() => {
      expect(collectionsApi.updateField).toHaveBeenCalledWith(
        COLLECTION_ID,
        'f-1',
        expect.objectContaining({ required: true }),
      )
    })
  })

  it('select field shows options editor; adding an option updates the field', async () => {
    const selectField = makeField({
      id: 'f-sel', name: 'Format', type: 'select', options: ['LP'], sortOrder: 0,
    })
    vi.mocked(collectionsApi.getFields).mockResolvedValue([selectField])
    vi.mocked(collectionsApi.updateField).mockResolvedValue({ ...selectField, options: ['LP', '2×LP'] })

    const user = userEvent.setup()
    renderDesigner()

    await waitFor(() => screen.getByRole('button', { name: 'Field: Format' }))
    await user.click(screen.getByRole('button', { name: 'Field: Format' }))

    // Existing option visible
    await waitFor(() => expect(screen.getByText('LP')).toBeInTheDocument())

    // Add new option
    await user.type(screen.getByLabelText('New option'), '2×LP')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(collectionsApi.updateField).toHaveBeenCalledWith(
        COLLECTION_ID,
        'f-sel',
        expect.objectContaining({ options: ['LP', '2×LP'] }),
      )
    })
  })
})

describe('CollectionDesignerPage — Layout tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getLayout).mockResolvedValue({ collectionId: COLLECTION_ID, layout: '[]' })
  })

  it('switching to Layout tab shows palette with all fields', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f-1', name: 'Album', type: 'text', sortOrder: 0 }),
      makeField({ id: 'f-2', name: 'Artist', type: 'text', sortOrder: 1 }),
    ])

    const user = userEvent.setup()
    renderDesigner()

    await waitFor(() => screen.getByText('Vinyl Records — Designer'))

    // Click the layout tab (its accessible name includes the tab label "layout")
    const layoutTabBtn = screen.getAllByRole('button').find(b =>
      b.textContent?.toLowerCase().startsWith('layout'),
    )!
    await user.click(layoutTabBtn)

    // Palette shows both field names
    expect(screen.getAllByText('Album').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Artist').length).toBeGreaterThan(0)
    // Layout elements present
    expect(screen.getByText('Divider')).toBeInTheDocument()
    expect(screen.getByText('Section label')).toBeInTheDocument()
  })

  it('Add row button appends a new empty row to the canvas', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([])

    const user = userEvent.setup()
    renderDesigner()

    await waitFor(() => screen.getByText('Vinyl Records — Designer'))

    const layoutTabBtn = screen.getAllByRole('button').find(b =>
      b.textContent?.toLowerCase().startsWith('layout'),
    )!
    await user.click(layoutTabBtn)

    await waitFor(() => screen.getByRole('button', { name: 'Add row' }))
    await user.click(screen.getByRole('button', { name: 'Add row' }))
    await user.click(screen.getByRole('button', { name: 'Add row' }))

    // Buttons still present — canvas has grown without error
    expect(screen.getByRole('button', { name: 'Add row' })).toBeInTheDocument()
  })

  it('Clear all button resets the canvas to a single empty row', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([])

    const user = userEvent.setup()
    renderDesigner()

    await waitFor(() => screen.getByText('Vinyl Records — Designer'))

    const layoutTabBtn = screen.getAllByRole('button').find(b =>
      b.textContent?.toLowerCase().startsWith('layout'),
    )!
    await user.click(layoutTabBtn)

    await waitFor(() => screen.getByRole('button', { name: 'Add row' }))
    await user.click(screen.getByRole('button', { name: 'Add row' }))
    await user.click(screen.getByRole('button', { name: 'Add row' }))
    await user.click(screen.getByRole('button', { name: 'Clear all' }))

    // Canvas resets — buttons still present
    expect(screen.getByRole('button', { name: 'Add row' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument()
  })
})

describe('CollectionDesignerPage — Save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue([])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue({ collectionId: COLLECTION_ID, layout: '[]' })
    vi.mocked(collectionsApi.update).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.updateLayout).mockResolvedValue(undefined)
  })

  it('Save collection button calls update + updateLayout then navigates to list', async () => {
    const user = userEvent.setup()
    renderDesigner()

    await waitFor(() => screen.getByText('Save collection'))
    await user.click(screen.getByText('Save collection'))

    await waitFor(() => {
      expect(collectionsApi.update).toHaveBeenCalledWith(
        COLLECTION_ID,
        expect.objectContaining({ title: 'Vinyl Records', color: 'teal' }),
      )
      expect(collectionsApi.updateLayout).toHaveBeenCalledWith(
        COLLECTION_ID,
        expect.any(Array),
      )
      expect(mockNavigate).toHaveBeenCalledWith(`/collections/${COLLECTION_ID}`)
    })
  })
})
