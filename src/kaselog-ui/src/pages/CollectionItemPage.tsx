import { useState, useEffect, useRef, type ReactElement } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { collections as collectionsApi, kases as kasesApi, images as imagesApi } from '../api/client'
import { useIsMobile } from '../hooks/useMobile'
import type {
  CollectionResponse,
  CollectionFieldResponse,
  CollectionItemResponse,
  CollectionItemHistoryRecord,
  KaseResponse,
} from '../api/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface LayoutCell {
  kind: 'field' | 'divider' | 'label'
  fieldId?: string
  label?: string
  span: number
  rowSpan?: number
}

interface LayoutRow {
  cells: (LayoutCell | null)[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

const COLOR_MAP: Record<string, string> = {
  teal: '#1D9E75',
  blue: '#378ADD',
  purple: '#7F77DD',
  coral: '#D85A30',
  amber: '#BA7517',
}

// ── Sub-components ───────────────────────────────────────────────────────────

function RatingWidget({
  value,
  readOnly,
  onChange,
}: {
  value: number
  readOnly: boolean
  onChange: (n: number) => void
}) {
  const [hover, setHover] = useState(0)
  const display = readOnly ? value : (hover || value)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 0' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          data-testid={`star-${n}`}
          onClick={() => !readOnly && onChange(n)}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          style={{
            fontSize: 'var(--text-xl)',
            color: n <= display ? '#BA7517' : 'var(--border-mid)',
            cursor: readOnly ? 'default' : 'pointer',
            lineHeight: 1,
            transition: 'color 0.1s, transform 0.1s',
            transform: !readOnly && hover === n ? 'scale(1.15)' : 'none',
          }}
        >
          ★
        </span>
      ))}
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 4, fontFamily: 'var(--font-mono, monospace)' }}>
        {value}/5
      </span>
    </div>
  )
}

function ImageField({
  value,
  readOnly,
  onChange,
}: {
  value: string | null
  readOnly: boolean
  onChange: (url: string | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await imagesApi.upload(file)
      onChange(result.url)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (value) {
    return (
      <div style={{
        border: '1.5px solid var(--border-mid)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--bg-secondary)',
      }}>
        <img
          src={value}
          alt="Field image"
          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
        />
        {!readOnly && (
          <button
            onClick={() => onChange(null)}
            style={{
              width: '100%', padding: '6px', fontSize: 'var(--text-xs)',
              color: 'var(--accent)', background: 'transparent',
              border: 'none', borderTop: '1px solid var(--border)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Remove image
          </button>
        )}
      </div>
    )
  }

  if (readOnly) {
    return <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-base)' }}>—</span>
  }

  return (
    <>
      <div
        onClick={() => fileRef.current?.click()}
        style={{
          border: '1.5px dashed var(--border-mid)',
          borderRadius: 8,
          background: 'var(--bg-secondary)',
          cursor: 'pointer',
          padding: '1.5rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}
      >
        <span style={{ fontSize: 'var(--text-xl)', opacity: 0.4 }}>🖼</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
          {uploading ? 'Uploading…' : 'Click to upload image'}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', opacity: 0.7 }}>JPG, PNG, WEBP · max 10MB</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        data-testid="image-file-input"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </>
  )
}

// ── Field renderer ───────────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  readOnly,
  hasError,
  onChange,
}: {
  field: CollectionFieldResponse
  value: unknown
  readOnly: boolean
  hasError: boolean
  onChange: (v: unknown) => void
}) {
  const inputStyle: React.CSSProperties = {
    background: readOnly ? 'transparent' : 'var(--bg-secondary)',
    border: hasError ? '1px solid #E24B4A' : readOnly ? '1px solid transparent' : '1px solid var(--border-mid)',
    borderRadius: readOnly ? 0 : 7,
    padding: readOnly ? '2px 0' : '8px 11px',
    fontSize: 'var(--text-base)',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  }

  const str = value != null && value !== '' ? String(value) : ''

  switch (field.type) {
    case 'text':
      return (
        <input
          aria-label={field.name}
          readOnly={readOnly}
          value={str}
          placeholder={readOnly ? '' : `${field.name}…`}
          onChange={e => onChange(e.target.value)}
          style={inputStyle}
        />
      )
    case 'multiline':
      return (
        <textarea
          aria-label={field.name}
          readOnly={readOnly}
          value={str}
          placeholder={readOnly ? '' : 'Add notes…'}
          onChange={e => onChange(e.target.value)}
          rows={4}
          style={{
            ...inputStyle,
            resize: readOnly ? 'none' : 'vertical',
            lineHeight: 1.6,
            fontSize: 'var(--text-sm)',
          }}
        />
      )
    case 'number':
      return (
        <input
          aria-label={field.name}
          readOnly={readOnly}
          inputMode="numeric"
          value={str}
          placeholder={readOnly ? '' : '0'}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputStyle, fontFamily: 'var(--font-mono, monospace)' }}
        />
      )
    case 'date':
      return (
        <input
          aria-label={field.name}
          type="date"
          readOnly={readOnly}
          value={str}
          onChange={e => onChange(e.target.value)}
          style={inputStyle}
        />
      )
    case 'select': {
      if (readOnly) {
        return <span style={{ fontSize: 'var(--text-base)', color: str ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{str || '—'}</span>
      }
      return (
        <select
          aria-label={field.name}
          value={str}
          onChange={e => onChange(e.target.value)}
          style={{
            ...inputStyle,
            appearance: 'none' as const,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239a9890' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.7rem center',
            backgroundSize: '10px',
            paddingRight: '2rem',
            cursor: 'pointer',
          }}
        >
          <option value="">— select —</option>
          {(field.options ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }
    case 'rating':
      return (
        <RatingWidget
          value={Number(value) || 0}
          readOnly={readOnly}
          onChange={onChange}
        />
      )
    case 'url':
      if (readOnly && str) {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ opacity: 0.6 }}>🔗</span>
            <a href={str} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 'var(--text-base)', color: 'var(--accent)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {str}
            </a>
          </div>
        )
      }
      return (
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-base)', opacity: 0.4, pointerEvents: 'none' }}>🔗</span>
          <input
            aria-label={field.name}
            type="url"
            readOnly={readOnly}
            value={str}
            placeholder="https://…"
            onChange={e => onChange(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
      )
    case 'boolean': {
      const isYes = value === true || value === 'true'
      const isNo = value === false || value === 'false'
      if (readOnly) {
        return <span style={{ fontSize: 'var(--text-base)' }}>{isYes ? 'Yes' : isNo ? 'No' : '—'}</span>
      }
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
          {[{ label: 'Yes', val: true }, { label: 'No', val: false }].map(({ label, val }) => {
            const selected = val ? isYes : isNo
            return (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`bool-${field.id}`}
                  aria-label={label}
                  checked={selected}
                  onChange={() => onChange(val)}
                  style={{ display: 'none' }}
                />
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: selected ? 'none' : '1.5px solid var(--border-mid)',
                  background: selected ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
                </div>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>{label}</span>
              </label>
            )
          })}
        </div>
      )
    }
    case 'image':
      return (
        <ImageField
          value={str || null}
          readOnly={readOnly}
          onChange={onChange}
        />
      )
    default:
      return <span style={{ fontSize: 'var(--text-base)' }}>{str || '—'}</span>
  }
}

// ── Layout renderer ──────────────────────────────────────────────────────────

function FormLayout({
  layout,
  fields,
  values,
  errors,
  readOnly,
  onChange,
  isMobile = false,
}: {
  layout: LayoutRow[]
  fields: CollectionFieldResponse[]
  values: Record<string, unknown>
  errors: Set<string>
  readOnly: boolean
  onChange: (fieldId: string, value: unknown) => void
  isMobile?: boolean
}) {
  const fieldMap = Object.fromEntries(fields.map(f => [f.id, f]))

  // When no layout rows exist, auto-generate full-width rows from schema fields
  // so the form is never blank on collections that haven't been through the designer.
  const effectiveLayout: LayoutRow[] = layout.length > 0
    ? layout
    : fields.map(f => ({ cells: [{ kind: 'field' as const, fieldId: f.id, span: 2 }, null] }))

  // Compute cells blocked by rowSpan tiles above them
  const blocked = new Set<string>()
  effectiveLayout.forEach((row, ri) => {
    row.cells.forEach((cell, ci) => {
      if (cell?.kind === 'field') {
        const rs = cell.rowSpan ?? 1
        for (let r = 1; r < rs; r++) blocked.add(`${ri + r},${ci}`)
      }
    })
  })

  const items: ReactElement[] = []

  effectiveLayout.forEach((row, rowIdx) => {
    ;([0, 1] as const).forEach(colIdx => {
      const cell = row.cells[colIdx]
      const key = `${rowIdx}-${colIdx}`

      // Skip right col when left is full-width
      const c0 = row.cells[0]
      if (colIdx === 1 && c0 && (c0.span === 2 || c0.kind === 'divider' || c0.kind === 'label')) return

      // Skip blocked cells
      if (blocked.has(`${rowIdx},${colIdx}`)) return

      if (!cell) return

      const isFullWidth = cell.span === 2 || cell.kind === 'divider' || cell.kind === 'label'
      const rowSpan = cell.kind === 'field' ? (cell.rowSpan ?? 1) : 1
      const gridColumn = isFullWidth ? '1 / -1' : `${colIdx + 1}`
      const gridRow = `${rowIdx + 1} / span ${rowSpan}`

      if (cell.kind === 'divider') {
        items.push(
          <div key={key} style={{ gridColumn, gridRow, display: 'flex', alignItems: 'center', gap: 12, padding: '2px 0', margin: '4px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            {cell.label && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{cell.label}</span>}
            {cell.label && <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />}
          </div>
        )
        return
      }

      if (cell.kind === 'label') {
        items.push(
          <div key={key} style={{ gridColumn, gridRow, fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 0 2px' }}>
            {cell.label}
          </div>
        )
        return
      }

      const fieldId = cell.fieldId!
      const field = fieldMap[fieldId]
      if (!field) return

      items.push(
        <div key={key} style={{ gridColumn, gridRow, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 4 }}>
            {field.name}
            {field.required && <span style={{ color: '#A32D2D', fontSize: 'var(--text-xs)' }}>*</span>}
          </div>
          <FieldInput
            field={field}
            value={values[fieldId] ?? ''}
            readOnly={readOnly}
            hasError={errors.has(fieldId)}
            onChange={v => onChange(fieldId, v)}
          />
        </div>
      )
    })
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
      {items}
    </div>
  )
}

// ── History section ───────────────────────────────────────────────────────────

function HistorySection({
  collectionId,
  itemId,
}: {
  collectionId: string
  itemId: string
}) {
  const [open, setOpen] = useState(false)
  const [records, setRecords] = useState<CollectionItemHistoryRecord[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && records === null) {
      setLoading(true)
      setError(null)
      try {
        const data = await collectionsApi.getItemHistory(collectionId, itemId)
        setRecords(data)
      } catch {
        setError('Failed to load history.')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div
      data-testid="history-section"
      style={{
        marginTop: 16,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Toggle header */}
      <button
        data-testid="history-toggle"
        onClick={handleToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          History
        </span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', lineHeight: 1 }}>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {loading && (
            <div style={{ padding: '12px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              Loading…
            </div>
          )}
          {error && (
            <div style={{ padding: '12px 14px', fontSize: 'var(--text-sm)', color: '#B91C1C' }}>
              {error}
            </div>
          )}
          {!loading && !error && records !== null && records.length === 0 && (
            <div
              data-testid="history-empty"
              style={{ padding: '12px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}
            >
              No history yet.
            </div>
          )}
          {!loading && !error && records !== null && records.length > 0 && (
            <div data-testid="history-list">
              {records.map(r => (
                <div
                  key={r.id}
                  data-testid={`history-row-${r.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    padding: '9px 14px',
                    borderBottom: '1px solid var(--border)',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', flex: 1 }}>
                    {r.changeSummary}
                  </span>
                  <span
                    title={formatAbsoluteTime(r.createdAt)}
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flexShrink: 0, fontFamily: 'var(--font-mono, monospace)' }}
                  >
                    {formatRelativeTime(r.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CollectionItemPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const isNew = !id || id === 'new'
  const collectionIdParam = searchParams.get('collectionId') ?? ''
  const isMobile = useIsMobile()

  const [collection, setCollection] = useState<CollectionResponse | null>(null)
  const [fields, setFields] = useState<CollectionFieldResponse[]>([])
  const [layout, setLayout] = useState<LayoutRow[]>([])
  const [kases, setKases] = useState<KaseResponse[]>([])
  const [kasesLoading, setKasesLoading] = useState(true)
  const [kasesError, setKasesError] = useState(false)
  const [item, setItem] = useState<CollectionItemResponse | null>(null)

  const [values, setValues] = useState<Record<string, unknown>>({})
  const [kaseId, setKaseId] = useState<string>('')
  const [mode, setMode] = useState<'edit' | 'view'>(isNew ? 'edit' : 'view')
  const [errors, setErrors] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load collection/item data
  useEffect(() => {
    async function load() {
      try {
        if (isNew) {
          if (!collectionIdParam) { setLoadError('No collection specified.'); return }
          const [col, flds, layoutResp] = await Promise.all([
            collectionsApi.get(collectionIdParam),
            collectionsApi.getFields(collectionIdParam),
            collectionsApi.getLayout(collectionIdParam),
          ])
          setCollection(col)
          setFields(flds.sort((a, b) => a.sortOrder - b.sortOrder))
          setLayout(parseLayout(layoutResp.layout))
          const initialKaseId = searchParams.get('kaseId') ?? ''
          setKaseId(initialKaseId)
        } else {
          const itm = await collectionsApi.getItem(id!)
          setItem(itm)
          setKaseId(itm.kaseId ?? '')
          setValues(itm.fieldValues as Record<string, unknown>)

          const [col, flds, layoutResp] = await Promise.all([
            collectionsApi.get(itm.collectionId),
            collectionsApi.getFields(itm.collectionId),
            collectionsApi.getLayout(itm.collectionId),
          ])
          setCollection(col)
          setFields(flds.sort((a, b) => a.sortOrder - b.sortOrder))
          setLayout(parseLayout(layoutResp.layout))
        }
      } catch {
        setLoadError('Failed to load item.')
      }
    }
    load()
  }, [id, isNew, collectionIdParam, searchParams])

  // Load kases independently so a fetch failure does not break the form
  useEffect(() => {
    async function loadKases() {
      try {
        const kaseList = await kasesApi.list()
        setKases(kaseList)
      } catch {
        console.error('Failed to load kases for link selector')
        setKasesError(true)
      } finally {
        setKasesLoading(false)
      }
    }
    loadKases()
  }, [])

  function parseLayout(raw: string): LayoutRow[] {
    try { return JSON.parse(raw) as LayoutRow[] } catch { return [] }
  }

  function handleChange(fieldId: string, value: unknown) {
    setValues(prev => ({ ...prev, [fieldId]: value }))
    if (errors.has(fieldId)) {
      setErrors(prev => { const s = new Set(prev); s.delete(fieldId); return s })
    }
  }

  function handleKaseChange(newKaseId: string) {
    setKaseId(newKaseId)
  }

  async function handleSave() {
    // Validate required fields
    const missing = new Set(
      fields.filter(f => f.required && (values[f.id] == null || values[f.id] === '')).map(f => f.id)
    )
    if (missing.size > 0) {
      setErrors(missing)
      return
    }
    setErrors(new Set())
    setSaveError(null)
    setSaving(true)
    try {
      const payload = { kaseId: kaseId || null, fieldValues: values }
      if (isNew) {
        const created = await collectionsApi.createItem(collection!.id, payload)
        navigate(`/items/${created.id}`)
      } else {
        const updated = await collectionsApi.updateItem(item!.id, payload)
        setItem(updated)
        setValues(updated.fieldValues as Record<string, unknown>)
        setMode('view')
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save item. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return <div style={{ padding: '2rem', color: 'var(--text-tertiary)' }}>{loadError}</div>
  }

  const dotColor = collection ? (COLOR_MAP[collection.color] ?? '#1D9E75') : '#1D9E75'
  const collectionId = collection?.id ?? collectionIdParam

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        height: 48, minHeight: 48, flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 1.25rem', gap: '0.75rem',
        background: 'var(--bg)',
      }}>
        <button
          onClick={() => navigate(`/collections/${collectionId}`)}
          style={{
            fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', cursor: 'pointer',
            padding: '4px 8px', borderRadius: 5, background: 'transparent',
            border: 'none', fontFamily: 'inherit',
          }}
        >
          ← {collection?.title ?? 'Collection'}
        </button>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--border-mid)' }}>/</span>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>{collection?.title ?? '…'}</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--border-mid)' }}>/</span>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--text-primary)' }}>
          {isNew ? 'New item' : !fields.length ? '…' : (() => {
            const firstTextField = fields.find(f => f.type === 'text')
            if (!firstTextField) return 'New item'
            const val = values[firstTextField.id]
            return val && String(val).trim() ? String(val) : 'New item'
          })()}
        </span>
        <div style={{ flex: 1 }} />
        {!isNew && (
          <button
            onClick={() => setMode(m => m === 'edit' ? 'view' : 'edit')}
            style={{
              fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid var(--border)',
              cursor: 'pointer', background: 'var(--bg)',
              fontFamily: 'inherit',
            }}
          >
            {mode === 'edit' ? 'View mode' : 'Edit mode'}
          </button>
        )}
      </div>

      {/* Mode bar */}
      <div style={{
        height: 32, minHeight: 32, flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 1.25rem', gap: 6,
        background: 'var(--bg-secondary)',
      }}>
        {['edit', 'view'].map(m => (
          <button
            key={m}
            onClick={() => !isNew && setMode(m as 'edit' | 'view')}
            style={{
              fontSize: 'var(--text-xs)', fontWeight: 500,
              padding: '2px 8px', borderRadius: 99,
              cursor: isNew && m === 'view' ? 'default' : 'pointer',
              background: mode === m ? 'var(--accent)' : 'var(--bg)',
              color: mode === m ? 'white' : 'var(--text-secondary)',
              border: mode === m ? 'none' : '1px solid var(--border-mid)',
              fontFamily: 'inherit',
            }}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {mode === 'edit' && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            <span style={{ color: '#A32D2D' }}>*</span> Required fields
          </span>
        )}
      </div>

      {/* Form scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>
        <div data-testid="form-inner" style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <FormLayout
            layout={layout}
            fields={fields}
            values={values}
            errors={errors}
            readOnly={mode === 'view'}
            onChange={handleChange}
            isMobile={isMobile}
          />

          {/* Kase link */}
          <div style={{
            marginTop: 20, padding: '12px 14px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>Link to Kase</span>

            {mode === 'view' && !isNew ? (
              // View mode: show kase title as link, or "— none —"
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                {kaseId ? (
                  <>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      {kases.find(k => k.id === kaseId)?.title ?? kaseId}
                    </span>
                    <Link
                      to={`/kases/${kaseId}`}
                      style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      → open
                    </Link>
                  </>
                ) : (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>— none —</span>
                )}
              </div>
            ) : kasesLoading ? (
              <select
                disabled
                style={{
                  flex: 1, background: 'var(--bg)', border: '1px solid var(--border-mid)',
                  borderRadius: 6, padding: '5px 8px', fontSize: 'var(--text-sm)',
                  color: 'var(--text-tertiary)', fontFamily: 'inherit', outline: 'none',
                }}
              >
                <option>Loading kases…</option>
              </select>
            ) : kasesError ? (
              <select
                disabled
                style={{
                  flex: 1, background: 'var(--bg)', border: '1px solid var(--border-mid)',
                  borderRadius: 6, padding: '5px 8px', fontSize: 'var(--text-sm)',
                  color: 'var(--text-tertiary)', fontFamily: 'inherit', outline: 'none',
                }}
              >
                <option>Could not load kases</option>
              </select>
            ) : (
              <select
                aria-label="Link to Kase"
                value={kaseId}
                onChange={e => handleKaseChange(e.target.value)}
                style={{
                  flex: 1, background: 'var(--bg)', border: '1px solid var(--border-mid)',
                  borderRadius: 6, padding: '5px 8px', fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)', fontFamily: 'inherit',
                  outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">— none —</option>
                {kases.map(k => (
                  <option key={k.id} value={k.id}>{k.title}</option>
                ))}
              </select>
            )}

            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Optional — appears on the Kase timeline</span>
          </div>

          {/* Metadata footer */}
          {!isNew && item && (
            <div style={{
              marginTop: 16,
              display: 'flex', gap: 20,
              fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
            }}>
              <span>Created {formatDate(item.createdAt)}</span>
              <span>Updated {formatDate(item.updatedAt)}</span>
            </div>
          )}

          {/* History section — existing items only */}
          {!isNew && item && (
            <HistorySection
              collectionId={collection?.id ?? collectionIdParam}
              itemId={item.id}
            />
          )}
        </div>
      </div>

      {/* Action bar — edit mode only */}
      {mode === 'edit' && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 1.25rem',
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0, background: 'var(--bg)',
        }}>
          {saveError ? (
            <div style={{ fontSize: 'var(--text-xs)', color: '#B91C1C', flex: 1 }}>{saveError}</div>
          ) : (
            <div style={{ flex: 1 }} />
          )}
          <button
            onClick={() => isNew ? navigate(`/collections/${collectionId}`) : setMode('view')}
            style={{
              fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
              padding: '6px 14px', borderRadius: 6,
              border: '1px solid var(--border-mid)',
              cursor: 'pointer', background: 'var(--bg)',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              fontSize: 'var(--text-sm)', fontWeight: 500, color: 'white',
              background: 'var(--accent)', padding: '6px 20px',
              borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save item'}
          </button>
        </div>
      )}

      {/* View mode edit button */}
      {mode === 'view' && !isNew && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 1.25rem',
          display: 'flex', justifyContent: 'flex-end',
          flexShrink: 0, background: 'var(--bg)',
        }}>
          <button
            data-testid="edit-item-btn"
            onClick={() => setMode('edit')}
            style={{
              fontSize: 'var(--text-sm)', fontWeight: 500,
              color: 'var(--accent)',
              background: 'var(--accent-light)',
              padding: '6px 16px', borderRadius: 6,
              border: '1px solid rgba(29,158,117,0.25)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Edit
          </button>
        </div>
      )}
    </div>
  )
}
