import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { collections as collectionsApi } from '../api/client'
import type { CollectionResponse, CollectionFieldResponse } from '../api/types'

// ── Field type definitions ────────────────────────────────────────────────────

const FIELD_TYPES = [
  { type: 'text',      label: 'Text',     icon: 'T',  hint: 'Single line' },
  { type: 'multiline', label: 'Multiline', icon: '¶',  hint: 'Paragraph' },
  { type: 'number',    label: 'Number',   icon: '#',  hint: 'Int or decimal' },
  { type: 'date',      label: 'Date',     icon: '📅', hint: 'Calendar picker' },
  { type: 'select',    label: 'Select',   icon: '⌄',  hint: 'Preset options' },
  { type: 'rating',    label: 'Rating',   icon: '★',  hint: '1–5 stars' },
  { type: 'url',       label: 'URL',      icon: '🔗', hint: 'Link' },
  { type: 'boolean',   label: 'Yes / No', icon: '◐',  hint: 'Toggle' },
  { type: 'image',     label: 'Image',    icon: '🖼', hint: 'Photo or cover art' },
] as const

type FieldType = typeof FIELD_TYPES[number]['type']

function typeIcon(type: string): string {
  return FIELD_TYPES.find(ft => ft.type === type)?.icon ?? 'T'
}

// ── Layout types ──────────────────────────────────────────────────────────────

interface FieldCell { kind: 'field'; fieldId: string; span: 1 | 2; rowSpan?: 1 | 2 | 3 }
interface DividerCell { kind: 'divider'; label: string; span: 1 | 2 }
interface LabelCell { kind: 'label'; label: string; span: 1 | 2 }
type Cell = FieldCell | DividerCell | LabelCell | null
interface LayoutRow { cells: [Cell, Cell] }

function emptyRow(): LayoutRow { return { cells: [null, null] } }

// ── Palette drag item ─────────────────────────────────────────────────────────

interface DragItem {
  source: 'palette' | 'canvas'
  kind: 'field' | 'divider' | 'label'
  fieldId?: string
  label?: string
  fromRow?: number
  fromCol?: number
}

// ── Type picker ───────────────────────────────────────────────────────────────

function TypePicker({ onSelect }: { onSelect: (type: FieldType) => void }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
      padding: 12, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20,
    }}>
      {FIELD_TYPES.map(ft => (
        <button
          key={ft.type}
          onClick={() => onSelect(ft.type)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            gap: 2, padding: '6px 8px', border: '1px solid var(--border)',
            borderRadius: 4, cursor: 'pointer', background: 'var(--bg)',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {ft.icon} {ft.label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.75 }}>
            {ft.hint}
          </span>
        </button>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CollectionDesignerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [collection, setCollection] = useState<CollectionResponse | null>(null)
  const [fields, setFields] = useState<CollectionFieldResponse[]>([])
  const [layoutRows, setLayoutRows] = useState<LayoutRow[]>([emptyRow()])
  const [activeTab, setActiveTab] = useState<'schema' | 'layout'>('schema')
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [typePickerMode, setTypePickerMode] = useState<'add' | 'change'>('add')
  const [newOptionInput, setNewOptionInput] = useState('')
  const [saving, setSaving] = useState(false)

  // Drag state for schema reorder
  const dragFieldIndex = useRef<number | null>(null)
  // Drag state for layout
  const dragItemRef = useRef<DragItem | null>(null)
  const [dragOverCell, setDragOverCell] = useState<{ row: number; col: number } | null>(null)
  const [hoveredTile, setHoveredTile] = useState<{ row: number; col: number } | null>(null)

  // Debounce timer for field auto-save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load data ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    Promise.all([
      collectionsApi.get(id),
      collectionsApi.getFields(id),
      collectionsApi.getLayout(id).catch(() => null),
    ]).then(([col, fs, layout]) => {
      setCollection(col)
      setFields(fs.slice().sort((a, b) => a.sortOrder - b.sortOrder))
      if (layout?.layout) {
        try {
          const parsed = JSON.parse(layout.layout) as LayoutRow[]
          setLayoutRows(parsed.length > 0 ? parsed : [emptyRow()])
        } catch {
          setLayoutRows([emptyRow()])
        }
      }
    })
  }, [id])

  // ── Field auto-save ─────────────────────────────────────────────────────────

  const scheduleFieldSave = useCallback((field: CollectionFieldResponse) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!id) return
      await collectionsApi.updateField(id, field.id, {
        name: field.name,
        required: field.required,
        showInList: field.showInList,
        options: field.options,
      })
    }, 500)
  }, [id])

  const updateField = useCallback((updated: CollectionFieldResponse, immediate = false) => {
    setFields(prev => prev.map(f => f.id === updated.id ? updated : f))
    if (immediate) {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (id) {
        collectionsApi.updateField(id, updated.id, {
          name: updated.name,
          required: updated.required,
          showInList: updated.showInList,
          options: updated.options,
        })
      }
    } else {
      scheduleFieldSave(updated)
    }
  }, [id, scheduleFieldSave])

  // ── Field operations ────────────────────────────────────────────────────────

  const handleAddField = useCallback(async (type: FieldType) => {
    if (!id) return
    setShowTypePicker(false)
    const newField = await collectionsApi.createField(id, {
      name: FIELD_TYPES.find(ft => ft.type === type)?.label ?? 'New field',
      type,
      required: false,
      showInList: true,
      options: type === 'select' ? [] : null,
    })
    setFields(prev => [...prev, newField])
    setSelectedFieldId(newField.id)
  }, [id])

  const handleChangeType = useCallback(async (type: FieldType) => {
    if (!id || !selectedFieldId) return
    setShowTypePicker(false)
    const field = fields.find(f => f.id === selectedFieldId)
    if (!field) return
    const updated: CollectionFieldResponse = {
      ...field,
      type,
      options: type === 'select' ? (field.options ?? []) : null,
    }
    await collectionsApi.updateField(id, field.id, {
      name: updated.name,
      required: updated.required,
      showInList: updated.showInList,
      options: updated.options,
    })
    setFields(prev => prev.map(f => f.id === field.id ? updated : f))
  }, [id, selectedFieldId, fields])

  const handleDeleteField = useCallback(async (fieldId: string) => {
    if (!id) return
    await collectionsApi.deleteField(id, fieldId)
    setFields(prev => prev.filter(f => f.id !== fieldId))
    if (selectedFieldId === fieldId) setSelectedFieldId(null)
    // Remove from layout
    setLayoutRows(prev => prev.map(row => ({
      cells: [
        row.cells[0]?.kind === 'field' && row.cells[0].fieldId === fieldId ? null : row.cells[0],
        row.cells[1]?.kind === 'field' && row.cells[1].fieldId === fieldId ? null : row.cells[1],
      ] as [Cell, Cell],
    })))
  }, [id, selectedFieldId])

  // ── Schema drag-reorder ─────────────────────────────────────────────────────

  const handleSchemaReorder = useCallback(async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || !id) return
    const reordered = [...fields]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    const updated = reordered.map((f, i) => ({ ...f, sortOrder: i }))
    setFields(updated)
    await collectionsApi.reorderFields(id, updated.map(f => f.id))
  }, [fields, id])

  // ── Layout operations ───────────────────────────────────────────────────────

  const placedFieldIds = new Set(
    layoutRows.flatMap(row =>
      row.cells.filter((c): c is FieldCell => c?.kind === 'field').map(c => c.fieldId)
    )
  )

  const blockedCells = useMemo(() => {
    const s = new Set<string>()
    layoutRows.forEach((row, rowIdx) => {
      row.cells.forEach((cell, colIdx) => {
        if (cell?.kind === 'field') {
          const rs = (cell as FieldCell).rowSpan ?? 1
          for (let r = 1; r < rs; r++) s.add(`${rowIdx + r},${colIdx}`)
        }
      })
    })
    return s
  }, [layoutRows])

  const handleDrop = useCallback((rowIdx: number, colIdx: number) => {
    const item = dragItemRef.current
    if (!item) return
    setDragOverCell(null)

    setLayoutRows(prev => {
      const rows = prev.map(r => ({ cells: [...r.cells] as [Cell, Cell] }))

      // Remove from source if dragging from canvas
      if (item.source === 'canvas' && item.fromRow != null) {
        rows[item.fromRow].cells[item.fromCol ?? 0] = null
      }

      // Recompute blocked cells after source removal
      const blocked = new Set<string>()
      rows.forEach((row, ri) => {
        row.cells.forEach((cell, ci) => {
          if (cell?.kind === 'field') {
            const rs = (cell as FieldCell).rowSpan ?? 1
            for (let r = 1; r < rs; r++) blocked.add(`${ri + r},${ci}`)
          }
        })
      })

      // Reject drop on blocked or already-occupied cell
      if (blocked.has(`${rowIdx},${colIdx}`)) return rows
      const target = rows[rowIdx].cells[colIdx]
      if (target !== null) return rows

      const fld = item.kind === 'field' ? fields.find(f => f.id === item.fieldId) : undefined
      const newCell: Cell = item.kind === 'field'
        ? { kind: 'field', fieldId: item.fieldId!, span: 1, rowSpan: fld?.type === 'image' ? 2 : 1 }
        : item.kind === 'divider'
          ? { kind: 'divider', label: item.label ?? 'Divider', span: 2 }
          : { kind: 'label', label: item.label ?? 'Section', span: 2 }

      if (newCell.kind === 'divider' || newCell.kind === 'label') {
        rows[rowIdx].cells[0] = { ...newCell, span: 2 }
        rows[rowIdx].cells[1] = null
      } else {
        rows[rowIdx].cells[colIdx] = newCell
      }

      return rows
    })
    dragItemRef.current = null
  }, [fields])

  const handleRemoveTile = useCallback((rowIdx: number, colIdx: number) => {
    setLayoutRows(prev => {
      const rows = prev.map(r => ({ cells: [...r.cells] as [Cell, Cell] }))
      rows[rowIdx].cells[colIdx] = null
      return rows
    })
  }, [])

  const handleToggleSpan = useCallback((rowIdx: number, colIdx: number) => {
    setLayoutRows(prev => {
      const rows = prev.map(r => ({ cells: [...r.cells] as [Cell, Cell] }))
      const cell = rows[rowIdx].cells[colIdx]
      if (!cell) return prev
      if (cell.span === 1) {
        // Make full width — check other col is empty
        if (rows[rowIdx].cells[1 - colIdx] !== null) return prev
        rows[rowIdx].cells[0] = { ...cell, span: 2 }
        rows[rowIdx].cells[1] = null
      } else {
        // Make half width — put in col 0
        rows[rowIdx].cells[0] = { ...cell, span: 1 }
      }
      return rows
    })
  }, [])

  const updateCellLabel = useCallback((rowIdx: number, colIdx: number, newLabel: string) => {
    setLayoutRows(prev => {
      const rows = prev.map(r => ({ cells: [...r.cells] as [Cell, Cell] }))
      const cell = rows[rowIdx].cells[colIdx]
      if (!cell || (cell.kind !== 'divider' && cell.kind !== 'label')) return prev
      rows[rowIdx].cells[colIdx] = { ...cell, label: newLabel }
      return rows
    })
  }, [])

  const handleChangeRowSpan = useCallback((rowIdx: number, colIdx: number, delta: -1 | 1) => {
    setLayoutRows(prev => {
      const rows = prev.map(r => ({ cells: [...r.cells] as [Cell, Cell] }))
      const cell = rows[rowIdx].cells[colIdx]
      if (!cell || cell.kind !== 'field') return prev
      const fieldCell = cell as FieldCell
      const next = (Math.max(1, Math.min(3, (fieldCell.rowSpan ?? 1) + delta))) as 1 | 2 | 3
      rows[rowIdx].cells[colIdx] = { ...fieldCell, rowSpan: next }
      return rows
    })
  }, [])

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!id || !collection) return
    setSaving(true)
    try {
      await collectionsApi.update(id, { title: collection.title, color: collection.color })
      await collectionsApi.updateLayout(id, layoutRows)
      navigate(`/collections/${id}`)
    } finally {
      setSaving(false)
    }
  }, [id, collection, layoutRows, navigate])

  // ── Selected field ──────────────────────────────────────────────────────────

  const selectedField = fields.find(f => f.id === selectedFieldId) ?? null

  // ── Add option to select field ──────────────────────────────────────────────

  const handleAddOption = useCallback(() => {
    if (!selectedField || !newOptionInput.trim()) return
    const updated = {
      ...selectedField,
      options: [...(selectedField.options ?? []), newOptionInput.trim()],
    }
    setNewOptionInput('')
    updateField(updated)
  }, [selectedField, newOptionInput, updateField])

  const handleRemoveOption = useCallback((opt: string) => {
    if (!selectedField) return
    const updated = {
      ...selectedField,
      options: (selectedField.options ?? []).filter(o => o !== opt),
    }
    updateField(updated)
  }, [selectedField, updateField])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!collection) {
    return <div style={{ padding: 32, color: 'var(--text-muted)' }}>Loading…</div>
  }

  const placedCount = layoutRows.flatMap(r => r.cells).filter(c => c !== null).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
        borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)',
      }}>
        <Link to="/collections" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13 }}>
          ← Collections
        </Link>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: 'var(--text)' }}>{collection.title} — Designer</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '6px 14px', borderRadius: 4, border: 'none',
            background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13,
          }}
        >
          {saving ? 'Saving…' : 'Save collection'}
        </button>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
        padding: '0 16px', background: 'var(--surface)', flexShrink: 0,
      }}>
        {(['schema', 'layout'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              textTransform: 'capitalize',
            }}
          >
            {tab}
            <span style={{
              marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 10,
              background: 'var(--border)', color: 'var(--text-muted)',
            }}>
              {tab === 'schema' ? fields.length : `${placedCount} placed`}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

        {/* ── Schema tab ── */}
        {activeTab === 'schema' && (
          <>
            {/* Field list (left) */}
            <div style={{
              width: 320, borderRight: '1px solid var(--border)', display: 'flex',
              flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
            }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {fields.map((field, idx) => (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={() => { dragFieldIndex.current = idx }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => {
                      if (dragFieldIndex.current != null) {
                        handleSchemaReorder(dragFieldIndex.current, idx)
                        dragFieldIndex.current = null
                      }
                    }}
                    onClick={() => { setSelectedFieldId(field.id); setShowTypePicker(false) }}
                    role="button"
                    aria-label={`Field: ${field.name}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 4, marginBottom: 2,
                      cursor: 'pointer', background: selectedFieldId === field.id ? 'var(--accent-bg, rgba(29,158,117,0.08))' : 'transparent',
                      border: '1px solid',
                      borderColor: selectedFieldId === field.id ? 'var(--accent)' : 'transparent',
                    }}
                  >
                    <span style={{ cursor: 'grab', color: 'var(--text-muted)', fontSize: 14 }}>⠿</span>
                    <span style={{
                      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 4, background: 'var(--border)', fontSize: 12, flexShrink: 0,
                    }}>
                      {typeIcon(field.type)}
                    </span>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {field.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {field.type}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteField(field.id) }}
                      aria-label={`Delete ${field.name}`}
                      style={{
                        width: 20, height: 20, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', border: 'none', background: 'none',
                        cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14,
                        borderRadius: 3,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ padding: 12, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                {showTypePicker && typePickerMode === 'add' ? (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Choose field type
                    </div>
                    <TypePicker onSelect={handleAddField} />
                    <button
                      onClick={() => setShowTypePicker(false)}
                      style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setTypePickerMode('add'); setShowTypePicker(true) }}
                    aria-label="Add field"
                    style={{
                      width: '100%', padding: '8px 0', border: '1px dashed var(--border)',
                      borderRadius: 4, background: 'none', cursor: 'pointer',
                      color: 'var(--accent)', fontSize: 13, fontWeight: 500,
                    }}
                  >
                    + Add field
                  </button>
                )}
              </div>
            </div>

            {/* Field editor (right) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {selectedField ? (
                <div style={{ maxWidth: 400 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                    Field editor
                  </div>

                  {/* Name */}
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Name
                  </label>
                  <input
                    aria-label="Field name"
                    value={selectedField.name}
                    onChange={e => updateField({ ...selectedField, name: e.target.value })}
                    style={{
                      width: '100%', padding: '7px 10px', borderRadius: 4,
                      border: '1px solid var(--border)', background: 'var(--bg)',
                      color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', marginBottom: 14,
                    }}
                  />

                  {/* Type */}
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Type
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)',
                      fontSize: 13, color: 'var(--text)', background: 'var(--bg)',
                    }}>
                      {typeIcon(selectedField.type)} {FIELD_TYPES.find(ft => ft.type === selectedField.type)?.label ?? selectedField.type}
                    </span>
                    <button
                      onClick={() => { setTypePickerMode('change'); setShowTypePicker(v => !v) }}
                      style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Change type
                    </button>
                  </div>
                  {showTypePicker && typePickerMode === 'change' && (
                    <div style={{ marginBottom: 14 }}>
                      <TypePicker onSelect={handleChangeType} />
                    </div>
                  )}
                  {!(showTypePicker && typePickerMode === 'change') && <div style={{ marginBottom: 14 }} />}

                  {/* Options (select only) */}
                  {selectedField.type === 'select' && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Options
                      </label>
                      {(selectedField.options ?? []).map(opt => (
                        <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{opt}</span>
                          <button
                            onClick={() => handleRemoveOption(opt)}
                            aria-label={`Remove option ${opt}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          aria-label="New option"
                          value={newOptionInput}
                          onChange={e => setNewOptionInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddOption() }}
                          placeholder="Add option…"
                          style={{
                            flex: 1, padding: '5px 8px', borderRadius: 4,
                            border: '1px solid var(--border)', background: 'var(--bg)',
                            color: 'var(--text)', fontSize: 12,
                          }}
                        />
                        <button
                          onClick={handleAddOption}
                          style={{
                            padding: '5px 10px', borderRadius: 4, border: '1px solid var(--border)',
                            background: 'var(--bg)', cursor: 'pointer', fontSize: 12, color: 'var(--text)',
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Toggles */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        aria-label="Required"
                        checked={selectedField.required}
                        onChange={e => updateField({ ...selectedField, required: e.target.checked }, true)}
                      />
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>Required</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        aria-label="Show in list"
                        checked={selectedField.showInList}
                        onChange={e => updateField({ ...selectedField, showInList: e.target.checked }, true)}
                      />
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>Show in list</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  Select a field to edit
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Layout tab ── */}
        {activeTab === 'layout' && (
          <>
            {/* Palette (left) */}
            <div style={{
              width: 220, borderRight: '1px solid var(--border)', display: 'flex',
              flexDirection: 'column', overflowY: 'auto', padding: 12, flexShrink: 0,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Fields
              </div>
              {fields.map(field => {
                const placed = placedFieldIds.has(field.id)
                return (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={() => {
                      dragItemRef.current = { source: 'palette', kind: 'field', fieldId: field.id }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 8px', marginBottom: 2, borderRadius: 4,
                      border: '1px solid var(--border)', cursor: 'grab',
                      opacity: placed ? 0.5 : 1, background: 'var(--bg)',
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{typeIcon(field.type)}</span>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{field.name}</span>
                    {placed && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>placed</span>
                    )}
                  </div>
                )
              })}

              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>
                Layout elements
              </div>
              {[
                { kind: 'divider' as const, label: 'Divider' },
                { kind: 'label' as const, label: 'Section label' },
              ].map(el => (
                <div
                  key={el.kind}
                  draggable
                  onDragStart={() => {
                    dragItemRef.current = { source: 'palette', kind: el.kind, label: el.label }
                  }}
                  style={{
                    padding: '6px 8px', marginBottom: 2, borderRadius: 4,
                    border: '1px dashed var(--border)', cursor: 'grab',
                    fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg)',
                  }}
                >
                  {el.label}
                </div>
              ))}
            </div>

            {/* Canvas (right) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: '44px', gap: 8, marginBottom: 8 }}>
                {layoutRows.flatMap((row, rowIdx) =>
                  ([0, 1] as const).flatMap((colIdx) => {
                    const cell = row.cells[colIdx]
                    const key = `${rowIdx}-${colIdx}`

                    // Skip right col when left cell is full-width
                    if (colIdx === 1 && row.cells[0]?.span === 2) return []

                    // Skip blocked cells — the spanning tile above visually covers this space
                    if (blockedCells.has(`${rowIdx},${colIdx}`)) return []

                    const fieldCell = cell?.kind === 'field' ? cell as FieldCell : null
                    const rowSpan = fieldCell?.rowSpan ?? 1
                    const isFullWidth = cell?.span === 2
                    const isOver = dragOverCell?.row === rowIdx && dragOverCell?.col === colIdx
                    const isHov = hoveredTile?.row === rowIdx && hoveredTile?.col === colIdx

                    const gridRow = `${rowIdx + 1} / span ${rowSpan}`
                    const gridColumn = isFullWidth ? '1 / -1' : colIdx === 0 ? '1' : '2'

                    if (cell) {
                      const fieldType = cell.kind === 'field'
                        ? fields.find(f => f.id === (cell as FieldCell).fieldId)?.type ?? ''
                        : ''
                      const label = cell.kind === 'field'
                        ? fields.find(f => f.id === (cell as FieldCell).fieldId)?.name ?? 'Unknown'
                        : (cell as DividerCell | LabelCell).label

                      return [(
                        <div
                          key={key}
                          style={{
                            gridRow, gridColumn,
                            padding: '6px 8px',
                            border: '1px solid var(--accent)',
                            borderRadius: 4,
                            background: 'var(--accent-bg, rgba(29,158,117,0.06))',
                            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                            overflow: 'hidden', minWidth: 0,
                          }}
                          onMouseEnter={() => setHoveredTile({ row: rowIdx, col: colIdx })}
                          onMouseLeave={() => setHoveredTile(null)}
                        >
                          <span style={{ flex: 1, color: 'var(--text)', overflow: 'hidden', minWidth: 0 }}>
                            {cell.kind === 'field'
                              ? `${typeIcon(fieldType)} ${label}`
                              : cell.kind === 'divider'
                                ? (
                                    <input
                                      value={(cell as DividerCell).label}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => updateCellLabel(rowIdx, colIdx, e.target.value)}
                                      placeholder="Divider label…"
                                      style={{ width: '100%', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                                    />
                                  )
                                : (
                                    <input
                                      value={(cell as LabelCell).label}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => updateCellLabel(rowIdx, colIdx, e.target.value)}
                                      placeholder="Section label…"
                                      style={{ width: '100%', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                    />
                                  )
                            }
                          </span>
                          {isHov && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                              {fieldCell && (
                                <>
                                  <button
                                    onClick={() => handleChangeRowSpan(rowIdx, colIdx, -1)}
                                    title="Fewer rows"
                                    style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-muted)', opacity: (fieldCell.rowSpan ?? 1) <= 1 ? 0.35 : 1 }}
                                  >−</button>
                                  <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 18, textAlign: 'center' }}>{fieldCell.rowSpan ?? 1}R</span>
                                  <button
                                    onClick={() => handleChangeRowSpan(rowIdx, colIdx, 1)}
                                    title="More rows"
                                    style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-muted)', opacity: (fieldCell.rowSpan ?? 1) >= 3 ? 0.35 : 1 }}
                                  >+</button>
                                </>
                              )}
                              <button
                                onClick={() => handleToggleSpan(rowIdx, colIdx)}
                                title={cell.span === 2 ? 'Half width' : 'Full width'}
                                style={{ fontSize: 10, padding: '2px 5px', borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-muted)' }}
                              >
                                {cell.span === 2 ? '½' : '⟷'}
                              </button>
                              <button
                                onClick={() => handleRemoveTile(rowIdx, colIdx)}
                                aria-label={`Remove ${label}`}
                                style={{ fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                              >×</button>
                            </div>
                          )}
                        </div>
                      )]
                    }

                    return [(
                      <div
                        key={key}
                        onDragOver={e => { e.preventDefault(); setDragOverCell({ row: rowIdx, col: colIdx }) }}
                        onDragLeave={() => setDragOverCell(null)}
                        onDrop={() => handleDrop(rowIdx, colIdx)}
                        style={{
                          gridRow, gridColumn,
                          borderRadius: 4,
                          border: `2px dashed ${isOver ? 'var(--accent)' : 'var(--border)'}`,
                          background: isOver ? 'var(--accent-bg, rgba(29,158,117,0.06))' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, color: 'var(--text-muted)',
                        }}
                      >
                        {isOver ? 'Drop here' : ''}
                      </div>
                    )]
                  })
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setLayoutRows(prev => [...prev, emptyRow()])}
                  aria-label="Add row"
                  style={{
                    padding: '6px 12px', borderRadius: 4, border: '1px dashed var(--border)',
                    background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)',
                  }}
                >
                  + Add row
                </button>
                <button
                  onClick={() => setLayoutRows([emptyRow()])}
                  aria-label="Clear all"
                  style={{
                    padding: '6px 12px', borderRadius: 4, border: '1px solid var(--border)',
                    background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)',
                  }}
                >
                  Clear all
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
