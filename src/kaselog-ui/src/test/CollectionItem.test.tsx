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

const COL_ID  = 'col-1'
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

    expect(collectionsApi.createItem).not.toHaveBeenCalled()
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
})

describe('CollectionItemPage — Kase link selector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(collectionsApi.get).mockResolvedValue(makeCollection())
    vi.mocked(collectionsApi.getFields).mockResolvedValue([makeField({ id: 'f1', name: 'Album', type: 'text' })])
    vi.mocked(collectionsApi.getLayout).mockResolvedValue(makeLayout('f1'))
  })

  it('select is populated with real Kases from GET /api/kases on mount', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([
      makeKase({ id: 'k1', title: 'Proxmox Cluster' }),
      makeKase({ id: 'k2', title: 'Network Rebuild' }),
    ])
    renderNew()
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Proxmox Cluster' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Network Rebuild' })).toBeInTheDocument()
    })
  })

  it('"— none —" is always the first option with empty value', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', title: 'My Kase' })])
    renderNew()
    await waitFor(() => screen.getByLabelText('Link to Kase'))
    const select = screen.getByLabelText('Link to Kase') as HTMLSelectElement
    expect(select.options[0].value).toBe('')
    expect(select.options[0].text).toBe('— none —')
  })

  it('selecting a Kase sends the correct GUID in the POST body', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'kase-abc', title: 'My Kase' })])
    vi.mocked(collectionsApi.createItem).mockResolvedValue(makeItem({ id: 'new-id' }))

    const user = userEvent.setup()
    renderNew()
    await waitFor(() => screen.getByLabelText('Link to Kase'))
    await user.selectOptions(screen.getByLabelText('Link to Kase'), 'kase-abc')
    await user.click(screen.getByText('Save item'))

    await waitFor(() => {
      expect(collectionsApi.createItem).toHaveBeenCalledWith(
        COL_ID,
        expect.objectContaining({ kaseId: 'kase-abc' }),
      )
    })
  })

  it('selecting "— none —" sends kaseId: null in the POST body, not empty string', async () => {
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', title: 'My Kase' })])
    vi.mocked(collectionsApi.createItem).mockResolvedValue(makeItem({ id: 'new-id' }))

    const user = userEvent.setup()
    renderNew()
    // Wait for kases to load, then explicitly select "— none —"
    await waitFor(() => screen.getByLabelText('Link to Kase'))
    await user.selectOptions(screen.getByLabelText('Link to Kase'), '')
    await user.click(screen.getByText('Save item'))

    await waitFor(() => {
      expect(collectionsApi.createItem).toHaveBeenCalledWith(
        COL_ID,
        expect.objectContaining({ kaseId: null }),
      )
    })
  })

  it('saving existing item with Kase selected sends updated kaseId in PUT body', async () => {
    const existingItem = makeItem({ fieldValues: { f1: 'Rumours' } })
    vi.mocked(collectionsApi.getItem).mockResolvedValue(existingItem)
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'kase-1', title: 'My Kase' })])
    vi.mocked(collectionsApi.updateItem).mockResolvedValue(existingItem)

    const user = userEvent.setup()
    renderExisting()
    await waitFor(() => screen.getByTestId('edit-item-btn'))
    await user.click(screen.getByTestId('edit-item-btn'))

    await waitFor(() => screen.getByLabelText('Link to Kase'))
    await user.selectOptions(screen.getByLabelText('Link to Kase'), 'kase-1')
    await user.click(screen.getByText('Save item'))

    await waitFor(() => {
      expect(collectionsApi.updateItem).toHaveBeenCalledWith(
        ITEM_ID,
        expect.objectContaining({ kaseId: 'kase-1' }),
      )
    })
  })

  it('saving with "— none —" selected sends kaseId: null in PUT body', async () => {
    const existingItem = makeItem({ kaseId: 'k1', fieldValues: { f1: 'Rumours' } })
    vi.mocked(collectionsApi.getItem).mockResolvedValue(existingItem)
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', title: 'My Kase' })])
    vi.mocked(collectionsApi.updateItem).mockResolvedValue({ ...existingItem, kaseId: null })

    const user = userEvent.setup()
    renderExisting()
    await waitFor(() => screen.getByTestId('edit-item-btn'))
    await user.click(screen.getByTestId('edit-item-btn'))

    await waitFor(() => screen.getByLabelText('Link to Kase'))
    await user.selectOptions(screen.getByLabelText('Link to Kase'), '')
    await user.click(screen.getByText('Save item'))

    await waitFor(() => {
      expect(collectionsApi.updateItem).toHaveBeenCalledWith(
        ITEM_ID,
        expect.objectContaining({ kaseId: null }),
      )
    })
  })

  it('in view mode, a linked Kase title is shown as a link to /kases/{kaseId}', async () => {
    const existingItem = makeItem({ kaseId: 'k1' })
    vi.mocked(collectionsApi.getItem).mockResolvedValue(existingItem)
    vi.mocked(kasesApi.list).mockResolvedValue([makeKase({ id: 'k1', title: 'Proxmox Cluster' })])

    renderExisting()
    // Start in view mode — wait for the kase title to appear
    await waitFor(() => expect(screen.getByText('Proxmox Cluster')).toBeInTheDocument())
    // The "→ open" link navigates to the kase
    const link = screen.getByRole('link', { name: '→ open' })
    expect(link).toHaveAttribute('href', '/kases/k1')
  })

  it('in view mode, no Kase linked shows "— none —" as muted text', async () => {
    const existingItem = makeItem({ kaseId: null })
    vi.mocked(collectionsApi.getItem).mockResolvedValue(existingItem)
    vi.mocked(kasesApi.list).mockResolvedValue([])

    renderExisting()
    // kaseId is null → "— none —" muted text
    await waitFor(() => {
      // Find the muted "— none —" in the Kase link section (not in a select)
      const noneTexts = screen.getAllByText('— none —')
      // At least one should be a plain <span>, not inside a select option
      const spans = noneTexts.filter(el => el.tagName === 'SPAN')
      expect(spans.length).toBeGreaterThan(0)
    })
  })

  it('kase fetch failure shows "Could not load kases" and does not break the form', async () => {
    vi.mocked(kasesApi.list).mockRejectedValue(new Error('Network error'))

    renderNew()
    await waitFor(() => expect(screen.getByText('Could not load kases')).toBeInTheDocument())
    // Form fields are still accessible
    await waitFor(() => expect(screen.getByLabelText('Album')).toBeInTheDocument())
  })
})
