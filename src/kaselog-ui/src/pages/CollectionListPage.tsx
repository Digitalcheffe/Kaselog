import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collections as collectionsApi } from '../api/client'
import type { CollectionResponse, CollectionFieldResponse, CollectionItemResponse } from '../api/types'
import { useIsMobile } from '../hooks/useMobile'

const COLOR_MAP: Record<string, string> = {
  teal:   '#1D9E75',
  blue:   '#378ADD',
  purple: '#7F77DD',
  coral:  '#D85A30',
  amber:  '#BA7517',
}

function getItemTitle(item: CollectionItemResponse, fields: CollectionFieldResponse[]): string {
  const titleField = fields.find(f => f.type === 'text' || f.type === 'select')
  if (!titleField) return '—'
  const val = item.fieldValues[titleField.id]
  return typeof val === 'string' && val ? val : '—'
}

function Stars({ n }: { n: number }) {
  const filled = Math.max(0, Math.min(5, Number(n) || 0))
  return (
    <span style={{ color: '#BA7517', fontSize: 'var(--text-xs)', letterSpacing: -1 }}>
      {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
    </span>
  )
}

function CellValue({ field, value }: { field: CollectionFieldResponse; value: unknown }) {
  if (value == null || value === '') return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
  if (field.type === 'rating') return <Stars n={Number(value)} />
  if (field.type === 'boolean') return <span>{value === true || value === 'true' ? 'Yes' : 'No'}</span>
  if (field.type === 'date') return <span>{String(value).slice(0, 10)}</span>
  if (field.type === 'url') return (
    <a href={String(value)} target="_blank" rel="noopener noreferrer"
      style={{ color: 'var(--accent)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      onClick={e => e.stopPropagation()}>
      {String(value)}
    </a>
  )
  return <span>{String(value)}</span>
}

interface ColVisibility {
  fieldId: string
  visible: boolean
}

export default function CollectionListPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [collection, setCollection] = useState<CollectionResponse | null>(null)
  const [fields, setFields] = useState<CollectionFieldResponse[]>([])
  const [items, setItems] = useState<CollectionItemResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [collectionLoading, setCollectionLoading] = useState(true)

  // Column visibility: title field locked, others default showInList
  const [colVisibility, setColVisibility] = useState<ColVisibility[]>([])
  const [colPickerOpen, setColPickerOpen] = useState(false)

  // Search
  const [searchText, setSearchText] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Field filters: fieldId → selected value
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({})
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Sort
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Fetch collection + fields once
  useEffect(() => {
    if (!id) return
    Promise.all([
      collectionsApi.get(id),
      collectionsApi.getFields(id),
    ]).then(([col, flds]) => {
      setCollection(col)
      const listFields = flds.filter(f => f.showInList)
      setFields(listFields)
      setColVisibility(listFields.map((f, i) => ({ fieldId: f.id, visible: i === 0 || f.showInList })))
    }).catch(() => {}).finally(() => setCollectionLoading(false))
  }, [id])

  // Fetch items whenever search/filters/sort change
  const fetchItems = useCallback(() => {
    if (!id) return
    setLoading(true)
    const activeFilters: Record<string, string> = {}
    for (const [fid, val] of Object.entries(fieldFilters)) {
      if (val) activeFilters[fid] = val
    }
    collectionsApi.getItems(id, {
      q: searchText || undefined,
      fieldFilters: Object.keys(activeFilters).length ? activeFilters : undefined,
      sort: sortField ?? undefined,
      dir: sortDir,
    }).then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, searchText, fieldFilters, sortField, sortDir])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearchText(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {}, 0) // fetchItems will fire via useEffect
  }

  const handleSortClick = (fieldId: string) => {
    if (sortField === fieldId) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(fieldId)
      setSortDir('asc')
    }
  }

  const titleField = fields[0]
  const restFields = fields.slice(1)

  const visibleFields = [
    ...(titleField ? [{ ...titleField, locked: true }] : []),
    ...restFields.map(f => ({
      ...f,
      locked: false,
    })),
  ].filter(f => {
    if (f.id === titleField?.id) return true
    const cv = colVisibility.find(c => c.fieldId === f.id)
    return cv ? cv.visible : true
  })

  const hiddenCount = colVisibility.filter(c => {
    if (c.fieldId === titleField?.id) return false
    return !c.visible
  }).length

  const activeFilterCount = Object.values(fieldFilters).filter(Boolean).length
  const hasFilters = !!searchText || activeFilterCount > 0

  const clearAll = () => {
    setSearchText('')
    setFieldFilters({})
  }

  const pillFields = fields.filter(f => f.type === 'select' || f.type === 'boolean')

  const dotColor = collection ? (COLOR_MAP[collection.color] ?? '#1D9E75') : '#1D9E75'

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => { setOpenDropdown(null); setColPickerOpen(false) }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  if (!collection && !collectionLoading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-tertiary)' }}>Collection not found.</div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        height: 48, minHeight: 48,
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 1.25rem', gap: '0.75rem',
        background: 'var(--bg)', flexShrink: 0,
      }}>
        {collection && (
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        )}
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {collection?.title ?? '…'}
        </div>
        <div style={{
          fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
          padding: '2px 8px', background: 'var(--bg-secondary)',
          borderRadius: 99, border: '1px solid var(--border)', whiteSpace: 'nowrap',
        }}>
          {items.length} items
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate(`/collections/${id}/design`)}
          style={{
            fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
            padding: '4px 10px', borderRadius: 6,
            border: '1px solid var(--border)',
            cursor: 'pointer', background: 'var(--bg)',
            fontFamily: 'var(--font)', whiteSpace: 'nowrap',
          }}
        >
          Edit schema
        </button>
        <button
          onClick={() => navigate(`/items/new?collectionId=${id}`)}
          style={{
            fontSize: 'var(--text-sm)', fontWeight: 500, color: 'white',
            background: 'var(--accent)', padding: '5px 12px',
            borderRadius: 6, border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font)', whiteSpace: 'nowrap',
          }}
        >
          + Add item
        </button>
      </div>

      {/* Filter bar */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '0.5rem 1.25rem',
        display: 'flex', alignItems: 'center',
        gap: '0.4rem', minHeight: 44,
        background: 'var(--bg)', flexShrink: 0,
        overflowX: 'auto',
      }}>
        {/* Text search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-mid)',
          borderRadius: 7, padding: '0.3rem 0.6rem',
          minWidth: 155, flexShrink: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" />
            <line x1="8.5" y1="8.5" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={searchText}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder={`Search ${collection?.title ?? 'items'}…`}
            style={{
              fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
              border: 'none', outline: 'none',
              background: 'transparent', fontFamily: 'var(--font)',
              width: 120,
            }}
          />
        </div>

        {/* Field filter pills */}
        {pillFields.map(f => {
          const activeVal = fieldFilters[f.id] ?? ''
          const isActive = !!activeVal
          return (
            <div
              key={f.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '4px 9px', borderRadius: 6, fontSize: 'var(--text-xs)',
                cursor: 'pointer',
                border: `1px solid ${isActive ? 'rgba(29,158,117,0.35)' : 'var(--border-mid)'}`,
                background: isActive ? 'var(--accent-light)' : 'var(--bg-secondary)',
                color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                flexShrink: 0, whiteSpace: 'nowrap', position: 'relative',
              }}
              onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === f.id ? null : f.id); setColPickerOpen(false) }}
            >
              <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>{f.name}</span>
              <span>{activeVal || 'Any'}</span>
              <span style={{ fontSize: 'var(--text-2xs)', opacity: 0.45 }}>▾</span>

              {/* Dropdown */}
              {openDropdown === f.id && (
                <div
                  style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0,
                    background: 'var(--bg)', border: '1px solid var(--border-mid)',
                    borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                    zIndex: 50, minWidth: 160, overflow: 'hidden',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Clear / Any option */}
                  <div
                    style={{ padding: '0.4rem 0.65rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={() => { setFieldFilters(prev => { const n = { ...prev }; delete n[f.id]; return n }); setOpenDropdown(null) }}
                  >
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', width: 14 }}>{!activeVal ? '✓' : ''}</span>
                    Any
                  </div>
                  {f.type === 'boolean' ? (
                    ['true', 'false'].map(v => (
                      <div
                        key={v}
                        style={{ padding: '0.4rem 0.65rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        onClick={() => { setFieldFilters(prev => ({ ...prev, [f.id]: v })); setOpenDropdown(null) }}
                      >
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', width: 14 }}>{activeVal === v ? '✓' : ''}</span>
                        {v === 'true' ? 'Yes' : 'No'}
                      </div>
                    ))
                  ) : (
                    (f.options ?? []).map(opt => (
                      <div
                        key={opt}
                        style={{ padding: '0.4rem 0.65rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        onClick={() => { setFieldFilters(prev => ({ ...prev, [f.id]: opt })); setOpenDropdown(null) }}
                      >
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', width: 14 }}>{activeVal === opt ? '✓' : ''}</span>
                        {opt}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}

        <div style={{ flex: 1, minWidth: '0.25rem' }} />

        {hasFilters && (
          <>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {items.length} results
            </span>
            <span
              style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
              onClick={clearAll}
            >
              Clear
            </span>
          </>
        )}

        {/* Columns button */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '4px 10px', borderRadius: 6, fontSize: 'var(--text-xs)',
            cursor: 'pointer', userSelect: 'none', flexShrink: 0, whiteSpace: 'nowrap',
            border: hiddenCount > 0 ? '1px solid rgba(29,158,117,0.35)' : '1px solid var(--border-mid)',
            background: hiddenCount > 0 ? 'var(--accent-light)' : 'var(--bg-secondary)',
            color: hiddenCount > 0 ? 'var(--accent)' : 'var(--text-secondary)',
            position: 'relative',
          }}
          onClick={e => { e.stopPropagation(); setColPickerOpen(o => !o); setOpenDropdown(null) }}
          aria-label="Columns"
        >
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none" style={{ flexShrink: 0, opacity: 0.55 }}>
            <rect x="0.5" y="0.5" width="3" height="10" rx="1" stroke="currentColor" strokeWidth="1.1" />
            <rect x="4.75" y="0.5" width="3" height="10" rx="1" stroke="currentColor" strokeWidth="1.1" />
            <rect x="9" y="0.5" width="3" height="10" rx="1" stroke="currentColor" strokeWidth="1.1" />
          </svg>
          Columns
          {hiddenCount > 0 && (
            <span style={{
              fontSize: 'var(--text-xs)', background: 'var(--accent)', color: 'white',
              borderRadius: 99, padding: '1px 5px', marginLeft: 1,
            }}>
              {colVisibility.filter(c => c.fieldId !== titleField?.id).length - hiddenCount}/{colVisibility.filter(c => c.fieldId !== titleField?.id).length}
            </span>
          )}

          {/* Column picker panel */}
          {colPickerOpen && (
            <div
              style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0, left: 'auto',
                background: 'var(--bg)', border: '1px solid var(--border-mid)',
                borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
                zIndex: 60, width: 230, overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                padding: '0.65rem 0.9rem 0.5rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Columns
                </span>
                <span
                  style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', cursor: 'pointer' }}
                  onClick={() => setColVisibility(cv => cv.map(c => ({ ...c, visible: true })))}
                >
                  Show all
                </span>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {fields.map((f, i) => {
                  const isTitle = i === 0
                  const cv = colVisibility.find(c => c.fieldId === f.id)
                  const visible = isTitle ? true : (cv?.visible ?? true)
                  return (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.5rem 0.9rem', cursor: isTitle ? 'default' : 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onClick={() => {
                        if (isTitle) return
                        setColVisibility(cv => cv.map(c => c.fieldId === f.id ? { ...c, visible: !c.visible } : c))
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{f.name}</div>
                        {isTitle && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>always visible</div>}
                      </div>
                      <div style={{
                        width: 30, height: 17, borderRadius: 9, position: 'relative',
                        background: isTitle ? 'var(--bg-tertiary)' : visible ? 'var(--accent)' : 'var(--border-mid)',
                        opacity: isTitle ? 0.5 : 1,
                        cursor: isTitle ? 'default' : 'pointer',
                        flexShrink: 0,
                        transition: 'background 0.2s',
                      }}>
                        <div style={{
                          position: 'absolute', top: 2, width: 13, height: 13,
                          borderRadius: '50%', background: 'white',
                          transition: 'left 0.2s',
                          left: (isTitle || visible) ? 15 : 2,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{
                padding: '0.5rem 0.9rem', borderTop: '1px solid var(--border)',
                display: 'flex', justifyContent: 'flex-end',
              }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  {colVisibility.filter(c => c.visible).length} of {fields.length} shown
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table (desktop) */}
      {!isMobile && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '0 1.25rem', height: 34, minHeight: 34,
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-secondary)', flexShrink: 0, overflow: 'hidden',
          }}>
            {visibleFields.map(f => {
              const sorted = sortField === f.id
              return (
                <div
                  key={f.id}
                  style={{
                    fontSize: 'var(--text-xs)', fontWeight: 600,
                    color: sorted ? 'var(--accent)' : 'var(--text-tertiary)',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem',
                    userSelect: 'none', overflow: 'hidden', whiteSpace: 'nowrap',
                    paddingRight: '1rem', flexShrink: 0, flex: 1, minWidth: 80,
                  }}
                  onClick={() => handleSortClick(f.id)}
                >
                  {f.name}
                  {sorted && <span style={{ fontSize: 'var(--text-2xs)', opacity: 0.7 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </div>
              )
            })}
          </div>

          {/* Rows */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '2rem 1.25rem', fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>Loading…</div>
            ) : items.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', padding: '3rem',
              }}>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--text-secondary)' }}>No items match</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Try adjusting your search or filters</div>
                {hasFilters && (
                  <span
                    style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', cursor: 'pointer', marginTop: '0.5rem' }}
                    onClick={clearAll}
                  >
                    Clear filters
                  </span>
                )}
              </div>
            ) : (
              items.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '0 1.25rem', height: 44,
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', overflow: 'hidden',
                    transition: 'background 0.1s',
                  }}
                  onClick={() => navigate(`/items/${item.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {visibleFields.map((f, i) => (
                    <div
                      key={f.id}
                      style={{
                        fontSize: i === 0 ? 'var(--text-base)' : 'var(--text-sm)',
                        fontWeight: i === 0 ? 500 : 400,
                        color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        paddingRight: '1rem', flexShrink: 0, flex: 1, minWidth: 80,
                      }}
                    >
                      {i === 0
                        ? (getItemTitle(item, fields) || '—')
                        : <CellValue field={f} value={item.fieldValues[f.id]} />
                      }
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Card list (mobile) */}
      {isMobile && (
        <div
          data-testid="collection-cards-mobile"
          style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}
        >
          {loading ? (
            <div style={{ padding: '2rem', fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', padding: '3rem 1rem',
            }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--text-secondary)' }}>No items match</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Try adjusting your search or filters</div>
              {hasFilters && (
                <span
                  style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', cursor: 'pointer', marginTop: '0.5rem' }}
                  onClick={clearAll}
                >
                  Clear filters
                </span>
              )}
            </div>
          ) : (
            items.map(item => (
              <div
                key={item.id}
                onClick={() => navigate(`/items/${item.id}`)}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '0.85rem 1rem',
                  marginBottom: '0.6rem',
                  cursor: 'pointer',
                  minHeight: 64,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                <div style={{
                  fontSize: 'var(--text-base)', fontWeight: 500,
                  color: 'var(--text-primary)', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {getItemTitle(item, fields) || '—'}
                </div>
                {visibleFields.slice(1, 4).map(f => {
                  const val = item.fieldValues[f.id]
                  if (val == null || val === '') return null
                  return (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex', gap: '0.4rem', alignItems: 'baseline',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>{f.name}:</span>
                      <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <CellValue field={f} value={val} />
                      </span>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
