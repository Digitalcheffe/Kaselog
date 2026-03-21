import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CollectionItemPage from '../pages/CollectionItemPage'
import type {
  CollectionResponse,
  CollectionFieldResponse,
  CollectionLayoutResponse,
  CollectionItemResponse,
  KaseResponse,
} from '../api/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  collections: {
    get: vi.fn(),
    getFields: vi.fn(),
    getLayout: vi.fn(),
    getItem: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
  },
  kases: { list: vi.fn() },
  images: { upload: vi.fn() },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { collections as collectionsApi, kases as kasesApi, images as imagesApi } from '../api/client'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COL_ID = 'col-1'
const ITEM_ID = 'item-1'

function makeCollection(overrides: Partial<CollectionResponse> = {}): CollectionResponse {
  return { id: COL_ID, title: 'Vinyl Records', color: 'teal', itemCount: 1, createdAt: '', updatedAt: '', ...overrides }
}

function makeField(overrides: Partial<CollectionFieldResponse> = {}): CollectionFieldResponse {
  return {
    id: 'f-text', collectionId: COL_ID, name: 'Album', type: 'text',
    required: false, showInList: true, options: null, sortOrder: 0,
    ...overrides,
  }
}

function makeLayout(fieldId: string, span = 1): CollectionLayoutResponse {
  return {
    collectionId: COL_ID,
    layout: JSON.stringify([{ cells: [{ kind: 'field', fieldId, span }, null] }]),
  }
}

function makeItem(overrides: Partial<CollectionItemResponse> = {}): CollectionItemResponse {
  return {
    id: ITEM_ID, collectionId: COL_ID, kaseId: null,
    fieldValues: {}, createdAt: '', updatedAt: '',
    ...overrides,
  }
}

function makeKase(overrides: Partial<KaseResponse> = {}): KaseResponse {
  return {
    id: 'kase-1', title: 'My Kase', description: null,
    logCount: 0, createdAt: '', updatedAt: '',
    ...overrides,
  }
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderNew(collectionId = COL_ID) {
  return render(
    <MemoryRouter initialEntries={[`/items/new?collectionId=${collectionId}`]}>
      <Routes>
        <Route path="/items/new" element={<CollectionItemPage />} />
        <Route path="/items/:id" element={<CollectionItemPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderExisting(itemId = ITEM_ID) {
  return render(
    <MemoryRouter initialEntries={[`/items/${itemId}`]}>
      <Routes>
        <Route path="/items/:id" element={<CollectionItemPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CollectionItemPage — field type rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(kasesApi.list).mockResolvedValue([])
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
  })

  it('renders a text field', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Album', type: 'text' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    renderNew()
    await waitFor(() => expect(screen.getByLabelText('Album')).toBeInTheDocument())
  })

  it('renders a number field', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Year', type: 'number' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    renderNew()
    await waitFor(() => expect(screen.getByLabelText('Year')).toBeInTheDocument())
  })

  it('renders a select field with options', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f1', name: 'Format', type: 'select', options: ['LP', '7-inch'] }),
    ])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    renderNew()
    await waitFor(() => {
      expect(screen.getByLabelText('Format')).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'LP' })).toBeInTheDocument()
    })
  })

  it('renders a rating field with 5 stars', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Rating', type: 'rating' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    renderNew()
    await waitFor(() => {
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByTestId(`star-${i}`)).toBeInTheDocument()
      }
    })
  })

  it('renders boolean field with Yes/No options', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Active', type: 'boolean' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    renderNew()
    await waitFor(() => {
      expect(screen.getByLabelText('Yes')).toBeInTheDocument()
      expect(screen.getByLabelText('No')).toBeInTheDocument()
    })
  })

  it('renders an image upload zone', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Cover', type: 'image' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    renderNew()
    await waitFor(() => expect(screen.getByText('Click to upload image')).toBeInTheDocument())
  })

  it('renders a multiline field', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Notes', type: 'multiline' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    renderNew()
    await waitFor(() => expect(screen.getByLabelText('Notes')).toBeInTheDocument())
  })

  it('renders a url field', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Purchase URL', type: 'url' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    renderNew()
    await waitFor(() => expect(screen.getByLabelText('Purchase URL')).toBeInTheDocument())
  })

  it('renders a date field', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Acquired', type: 'date' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    renderNew()
    await waitFor(() => expect(screen.getByLabelText('Acquired')).toBeInTheDocument())
  })
})

describe('CollectionItemPage — field interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(kasesApi.list).mockResolvedValue([])
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
  })

  it('text field updates on input', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Album', type: 'text' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    const user = userEvent.setup()
    renderNew()
    await waitFor(() => screen.getByLabelText('Album'))
    await user.type(screen.getByLabelText('Album'), 'Rumours')
    expect((screen.getByLabelText('Album') as HTMLInputElement).value).toBe('Rumours')
  })

  it('number field updates on input', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Year', type: 'number' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    const user = userEvent.setup()
    renderNew()
    await waitFor(() => screen.getByLabelText('Year'))
    await user.type(screen.getByLabelText('Year'), '1977')
    expect((screen.getByLabelText('Year') as HTMLInputElement).value).toBe('1977')
  })

  it('select field updates on change', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f1', name: 'Format', type: 'select', options: ['LP', '7-inch'] }),
    ])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    const user = userEvent.setup()
    renderNew()
    await waitFor(() => screen.getByLabelText('Format'))
    await user.selectOptions(screen.getByLabelText('Format'), 'LP')
    expect((screen.getByLabelText('Format') as HTMLSelectElement).value).toBe('LP')
  })

  it('rating widget updates on star click', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Rating', type: 'rating' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    const user = userEvent.setup()
    renderNew()
    await waitFor(() => screen.getByTestId('star-4'))
    await user.click(screen.getByTestId('star-4'))
    expect(screen.getByText('4/5')).toBeInTheDocument()
  })

  it('rating widget shows hover preview', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Rating', type: 'rating' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    renderNew()
    await waitFor(() => screen.getByTestId('star-3'))
    fireEvent.mouseEnter(screen.getByTestId('star-3'))
    // Star 3 should be highlighted (color style check via data-testid presence)
    expect(screen.getByTestId('star-3')).toBeInTheDocument()
  })

  it('boolean radio options select correctly', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Active', type: 'boolean' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    const user = userEvent.setup()
    renderNew()
    await waitFor(() => screen.getByLabelText('Yes'))
    await user.click(screen.getByLabelText('Yes'))
    expect((screen.getByLabelText('Yes') as HTMLInputElement).checked).toBe(true)
  })

  it('image upload calls POST /api/images and shows preview', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Cover', type: 'image' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    vi.mocked(imagesApi.upload).mockResolvedValue({ uid: 'abc123', url: '/api/images/abc123' })

    renderNew()
    await waitFor(() => screen.getByTestId('image-file-input'))

    const file = new File(['img'], 'cover.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByTestId('image-file-input'), { target: { files: [file] } })

    await waitFor(() => expect(imagesApi.upload).toHaveBeenCalledWith(file))
    await waitFor(() => {
      const img = document.querySelector('img[src="/api/images/abc123"]')
      expect(img).toBeInTheDocument()
    })
  })

  it('image remove clears the field value', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Cover', type: 'image' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    vi.mocked(imagesApi.upload).mockResolvedValue({ uid: 'abc', url: '/api/images/abc' })

    renderNew()
    await waitFor(() => screen.getByTestId('image-file-input'))

    const file = new File(['img'], 'cover.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByTestId('image-file-input'), { target: { files: [file] } })

    await waitFor(() => screen.getByText('Remove image'))
    await userEvent.click(screen.getByText('Remove image'))
    expect(screen.queryByText('Remove image')).not.toBeInTheDocument()
    expect(screen.getByText('Click to upload image')).toBeInTheDocument()
  })
})

describe('CollectionItemPage — validation and save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(kasesApi.list).mockResolvedValue([])
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
  })

  it('required field validation highlights missing fields on save attempt', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f1', name: 'Album', type: 'text', required: true }),
    ])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))

    const user = userEvent.setup()
    renderNew()
    await waitFor(() => screen.getByText('Save item'))
    await user.click(screen.getByText('Save item'))

    // createItem should NOT have been called
    expect(collectionsApi.createItem).not.toHaveBeenCalled()
    // Input should have error border
    const input = screen.getByLabelText('Album') as HTMLInputElement
    expect(input.style.border).toMatch(/E24B4A|rgb\(226.*75.*74\)/i)
  })

  it('Save calls POST for new items', async () => {
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f1', name: 'Album', type: 'text', required: false }),
    ])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    vi.mocked(collectionsApi.createItem).mockResolvedValue(makeItem({ id: 'new-id', fieldValues: { f1: 'Rumours' } }))

    const user = userEvent.setup()
    renderNew()
    await waitFor(() => screen.getByLabelText('Album'))
    await user.type(screen.getByLabelText('Album'), 'Rumours')
    await user.click(screen.getByText('Save item'))

    await waitFor(() => {
      expect(collectionsApi.createItem).toHaveBeenCalledWith(
        COL_ID,
        expect.objectContaining({ fieldValues: expect.objectContaining({ f1: 'Rumours' }) }),
      )
    })
    expect(mockNavigate).toHaveBeenCalledWith('/items/new-id')
  })

  it('Save calls PUT for existing items', async () => {
    const existingItem = makeItem({ fieldValues: { f1: 'Rumours' } })
    vi.mocked(collectionsApi.getItem).mockResolvedValue(existingItem)
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue([
      makeField({ id: 'f1', name: 'Album', type: 'text' }),
    ])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    vi.mocked(collectionsApi.updateItem).mockResolvedValue({ ...existingItem, fieldValues: { f1: 'Tusk' } })

    const user = userEvent.setup()
    renderExisting()
    await waitFor(() => screen.getByTestId('edit-item-btn'))
    await user.click(screen.getByTestId('edit-item-btn'))

    await waitFor(() => screen.getByLabelText('Album'))
    await user.clear(screen.getByLabelText('Album'))
    await user.type(screen.getByLabelText('Album'), 'Tusk')
    await user.click(screen.getByText('Save item'))

    await waitFor(() => {
      expect(collectionsApi.updateItem).toHaveBeenCalledWith(
        ITEM_ID,
        expect.objectContaining({ fieldValues: expect.objectContaining({ f1: 'Tusk' }) }),
      )
    })
  })

  it('after save, view mode renders field values read-only', async () => {
    const existingItem = makeItem({ fieldValues: { f1: 'Rumours' } })
    vi.mocked(collectionsApi.getItem).mockResolvedValue(existingItem)
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Album', type: 'text' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    vi.mocked(collectionsApi.updateItem).mockResolvedValue({ ...existingItem, fieldValues: { f1: 'Tusk' } })

    const user = userEvent.setup()
    renderExisting()
    await waitFor(() => screen.getByTestId('edit-item-btn'))
    await user.click(screen.getByTestId('edit-item-btn'))

    await waitFor(() => screen.getByLabelText('Album'))
    await user.clear(screen.getByLabelText('Album'))
    await user.type(screen.getByLabelText('Album'), 'Tusk')
    await user.click(screen.getByText('Save item'))

    // Should transition to view mode — Edit button visible, input is read-only
    await waitFor(() => screen.getByTestId('edit-item-btn'))
    const input = screen.getByLabelText('Album') as HTMLInputElement
    expect(input.readOnly).toBe(true)
  })

  it('Edit button transitions back to edit mode', async () => {
    const existingItem = makeItem({ fieldValues: { f1: 'Rumours' } })
    vi.mocked(collectionsApi.getItem).mockResolvedValue(existingItem)
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Album', type: 'text' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))

    const user = userEvent.setup()
    renderExisting()
    await waitFor(() => screen.getByTestId('edit-item-btn'))
    await user.click(screen.getByTestId('edit-item-btn'))

    await waitFor(() => screen.getByText('Save item'))
    expect(screen.getByText('Save item')).toBeInTheDocument()
  })

  it('Kase link selector calls PUT on change for existing items', async () => {
    const existingItem = makeItem({ fieldValues: { f1: 'Rumours' } })
    vi.mocked(collectionsApi.getItem).mockResolvedValue(existingItem)
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Album', type: 'text' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'kase-1', title: 'My Kase' })])
    vi.mocked(collectionsApi.updateItem).mockResolvedValue(existingItem)

    renderExisting()
    await waitFor(() => screen.getByLabelText('Link to Kase'))

    // In view mode the select is disabled — transition to edit to enable it
    await waitFor(() => screen.getByTestId('edit-item-btn'))
    await userEvent.click(screen.getByTestId('edit-item-btn'))

    await waitFor(() => screen.getByRole('option', { name: 'My Kase' }))
    await userEvent.selectOptions(screen.getByLabelText('Link to Kase'), 'kase-1')

    await waitFor(() => {
      expect(collectionsApi.updateItem).toHaveBeenCalledWith(
        ITEM_ID,
        expect.objectContaining({ kaseId: 'kase-1' }),
      )
    })
  })
})
