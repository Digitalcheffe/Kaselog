import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { search as searchApi, kases as kasesApi, tags as tagsApi } from '../api/client'
import type { KaseResponse, SearchResult, TagResponse } from '../api/types'

// ── Tag color palette (deterministic hash, matches rest of app) ────────────────

const TAG_PALETTES = [
  { bg: 'var(--tag-green-bg)', color: 'var(--tag-green-text)', border: '#9FE1CB' },
  { bg: 'var(--tag-purple-bg)', color: 'var(--tag-purple-text)', border: '#C6C3F5' },
  { bg: 'var(--tag-amber-bg)', color: 'var(--tag-amber-text)', border: '#FAC775' },
  { bg: 'var(--tag-blue-bg)', color: 'var(--tag-blue-text)', border: '#A0C8EE' },
  { bg: 'var(--tag-coral-bg)', color: 'var(--tag-coral-text)', border: '#EEA38A' },
]

function tagColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (Math.imul(31, hash) + name.charCodeAt(i)) | 0
  }
  return TAG_PALETTES[Math.abs(hash) % TAG_PALETTES.length]
}

/** Wraps query terms in <mark> within plain text. Safe — highlight is stripped HTML from backend. */
function highlightTerms(text: string, q: string): string {
  if (!q.trim()) return text
  const terms = q.trim().split(/\s+/).filter(Boolean)
  let result = text
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>')
  }
  return result
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / 3600000)
    if (diffHours < 1) return 'just now'
    return `${diffHours}h ago`
  }
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Query and filter state ─────────────────────────────────────────────────
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [kaseFilter, setKaseFilter] = useState<{ id: string; title: string } | null>(null)
  const [tagFilters, setTagFilters] = useState<string[]>([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // ── Results ────────────────────────────────────────────────────────────────
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)

  // ── Typeahead state ────────────────────────────────────────────────────────
  const [allKases, setAllKases] = useState<KaseResponse[]>([])
  const [allTags, setAllTags] = useState<TagResponse[]>([])
  const [kaseDropdownOpen, setKaseDropdownOpen] = useState(false)
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false)
  const [kaseTypeahead, setKaseTypeahead] = useState('')
  const [tagTypeahead, setTagTypeahead] = useState('')
  const kaseDropdownRef = useRef<HTMLDivElement>(null)
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  const dateDropdownRef = useRef<HTMLDivElement>(null)

  // Load kases and tags for typeahead
  useEffect(() => {
    kasesApi.list().then(setAllKases).catch(() => {})
    tagsApi.list().then(setAllTags).catch(() => {})
  }, [])

  // Run search whenever query or filters change
  const runSearch = useCallback(async (
    q: string,
    kaseId: string | undefined,
    tags: string[],
    from: string,
    to: string,
  ) => {
    if (!q.trim() && !kaseId && tags.length === 0 && !from && !to) {
      setResults([])
      setSearched(false)
      return
    }
    try {
      const r = await searchApi.query({
        q: q.trim() || undefined,
        kaseId: kaseId || undefined,
        tag: tags.length ? tags : undefined,
        from: from || undefined,
        to: to || undefined,
      })
      setResults(r)
      setSearched(true)
    } catch {
      setResults([])
      setSearched(true)
    }
  }, [])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleSearch(
    q: string,
    kaseId: string | undefined,
    tags: string[],
    from: string,
    to: string,
  ) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q, kaseId, tags, from, to), 200)
  }

  // Run search on mount if URL has params
  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    if (q) runSearch(q, kaseFilter?.id, tagFilters, fromDate, toDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (kaseDropdownRef.current && !kaseDropdownRef.current.contains(e.target as Node))
        setKaseDropdownOpen(false)
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node))
        setTagDropdownOpen(false)
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node))
        setDateDropdownOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleQueryChange(q: string) {
    setQuery(q)
    const params: Record<string, string> = {}
    if (q.trim()) params.q = q.trim()
    setSearchParams(params, { replace: true })
    scheduleSearch(q, kaseFilter?.id, tagFilters, fromDate, toDate)
  }

  function selectKase(kase: KaseResponse | null) {
    setKaseFilter(kase)
    setKaseDropdownOpen(false)
    setKaseTypeahead('')
    scheduleSearch(query, kase?.id, tagFilters, fromDate, toDate)
  }

  function addTag(name: string) {
    if (tagFilters.includes(name)) {
      setTagDropdownOpen(false)
      setTagTypeahead('')
      return
    }
    const next = [...tagFilters, name]
    setTagFilters(next)
    setTagDropdownOpen(false)
    setTagTypeahead('')
    scheduleSearch(query, kaseFilter?.id, next, fromDate, toDate)
  }

  function removeTag(name: string) {
    const next = tagFilters.filter(t => t !== name)
    setTagFilters(next)
    scheduleSearch(query, kaseFilter?.id, next, fromDate, toDate)
  }

  function applyDateRange() {
    setDateDropdownOpen(false)
    scheduleSearch(query, kaseFilter?.id, tagFilters, fromDate, toDate)
  }

  function clearDateRange() {
    setFromDate('')
    setToDate('')
    setDateDropdownOpen(false)
    scheduleSearch(query, kaseFilter?.id, tagFilters, '', '')
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const filteredKases = allKases.filter(k =>
    k.title.toLowerCase().includes(kaseTypeahead.toLowerCase())
  )
  const filteredTags = allTags.filter(t =>
    t.name.toLowerCase().includes(tagTypeahead.toLowerCase()) &&
    !tagFilters.includes(t.name)
  )
  const hasDateFilter = fromDate || toDate
  const dateLabel = hasDateFilter
    ? `${fromDate || '…'} – ${toDate || 'today'}`
    : 'Date'

  return (
    <>
      {/* Top bar */}
      <div style={{
        height: 48,
        minHeight: 48,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 1.25rem',
        gap: '0.75rem',
        flexShrink: 0,
        background: 'var(--bg)',
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-mid)',
          borderRadius: 8,
          padding: '0.4rem 0.75rem',
        }}>
          <svg width="14" height="14" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" />
            <line x1="8.5" y1="8.5" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search all logs..."
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              fontSize: 13,
              color: 'var(--text-primary)',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--font)',
            }}
          />
        </div>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--accent-light)',
          border: '1px solid var(--border-mid)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--accent-text)',
          flexShrink: 0,
        }}>
          K
        </div>
      </div>

      {/* Filter bar */}
      <div
        data-testid="filter-bar"
        style={{
          borderBottom: '1px solid var(--border)',
          padding: '0.45rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          flexWrap: 'wrap',
          minHeight: 38,
          background: 'var(--bg)',
          position: 'relative',
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>Filters:</span>

        {/* Kase typeahead filter */}
        <div ref={kaseDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
          {kaseFilter ? (
            <span
              data-testid="kase-filter-pill"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '3px 9px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 500,
                background: 'var(--accent-light)',
                border: '1px solid var(--accent)',
                color: 'var(--accent-text)',
              }}
            >
              <span style={{ fontSize: 10, opacity: 0.7 }}>Kase:</span>
              {kaseFilter.title}
              <button
                onClick={() => selectKase(null)}
                aria-label={`Remove kase filter ${kaseFilter.title}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10, opacity: 0.6, fontFamily: 'var(--font)' }}
              >
                ✕
              </button>
            </span>
          ) : (
            <button
              onClick={() => { setKaseDropdownOpen(v => !v); setKaseTypeahead('') }}
              aria-label="Filter by kase"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '3px 9px',
                borderRadius: 6,
                fontSize: 11,
                cursor: 'pointer',
                border: '1px solid var(--border-mid)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font)',
              }}
            >
              <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>Kase:</span>
              All
              <span style={{ fontSize: 9, opacity: 0.4 }}>▾</span>
            </button>
          )}
          {kaseDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              background: 'var(--bg)',
              border: '1px solid var(--border-mid)',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              minWidth: 180,
              zIndex: 50,
            }}>
              <div style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
                <input
                  type="text"
                  placeholder="Search kases..."
                  value={kaseTypeahead}
                  onChange={e => setKaseTypeahead(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    fontSize: 12,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font)',
                  }}
                />
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {filteredKases.length === 0 && (
                  <div style={{ padding: '0.4rem 0.75rem', fontSize: 12, color: 'var(--text-tertiary)' }}>No kases found</div>
                )}
                {filteredKases.map(k => (
                  <button
                    key={k.id}
                    onClick={() => selectKase(k)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.4rem 0.75rem',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    {k.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active tag filter pills */}
        {tagFilters.map(tag => {
          const c = tagColor(tag)
          return (
            <span
              key={tag}
              data-testid={`tag-filter-pill-${tag}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '3px 9px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 500,
                background: c.bg,
                border: `1px solid ${c.border}`,
                color: c.color,
                flexShrink: 0,
              }}
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag filter ${tag}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10, opacity: 0.5, fontFamily: 'var(--font)' }}
              >
                ✕
              </button>
            </span>
          )
        })}

        {/* Date range filter */}
        <div ref={dateDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setDateDropdownOpen(v => !v)}
            aria-label="Filter by date range"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '3px 9px',
              borderRadius: 6,
              fontSize: 11,
              cursor: 'pointer',
              border: hasDateFilter ? '1px solid var(--accent)' : '1px solid var(--border-mid)',
              background: hasDateFilter ? 'var(--accent-light)' : 'var(--bg-secondary)',
              color: hasDateFilter ? 'var(--accent-text)' : 'var(--text-secondary)',
              fontFamily: 'var(--font)',
            }}
          >
            <span style={{ color: hasDateFilter ? 'var(--accent-text)' : 'var(--text-tertiary)', fontSize: 10 }}>Date:</span>
            {dateLabel}
            <span style={{ fontSize: 9, opacity: 0.4 }}>▾</span>
          </button>
          {dateDropdownOpen && (
            <div
              data-testid="date-dropdown"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                background: 'var(--bg)',
                border: '1px solid var(--border-mid)',
                borderRadius: 8,
                padding: '0.75rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                zIndex: 50,
                minWidth: 200,
              }}
            >
              <label style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.25rem' }}>From</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                data-testid="date-from-input"
                style={{
                  width: '100%',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-mid)',
                  borderRadius: 5,
                  padding: '0.35rem 0.5rem',
                  fontFamily: 'var(--font)',
                  outline: 'none',
                  marginBottom: '0.6rem',
                }}
              />
              <label style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.25rem' }}>To</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                data-testid="date-to-input"
                style={{
                  width: '100%',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-mid)',
                  borderRadius: 5,
                  padding: '0.35rem 0.5rem',
                  fontFamily: 'var(--font)',
                  outline: 'none',
                  marginBottom: '0.6rem',
                }}
              />
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={applyDateRange}
                  style={{
                    flex: 1,
                    padding: '0.4rem',
                    borderRadius: 5,
                    background: 'var(--accent)',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                  }}
                >
                  Apply
                </button>
                {hasDateFilter && (
                  <button
                    onClick={clearDateRange}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: 5,
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      fontSize: 12,
                      border: '1px solid var(--border-mid)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add tag filter */}
        <div ref={tagDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => { setTagDropdownOpen(v => !v); setTagTypeahead('') }}
            aria-label="Add tag filter"
            style={{
              padding: '3px 9px',
              borderRadius: 6,
              border: '1px dashed var(--border-mid)',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              background: 'transparent',
              fontFamily: 'var(--font)',
            }}
          >
            + tag
          </button>
          {tagDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              background: 'var(--bg)',
              border: '1px solid var(--border-mid)',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              minWidth: 160,
              zIndex: 50,
            }}>
              <div style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
                <input
                  type="text"
                  placeholder="Tag name..."
                  value={tagTypeahead}
                  onChange={e => setTagTypeahead(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    fontSize: 12,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font)',
                  }}
                />
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {filteredTags.length === 0 && (
                  <div style={{ padding: '0.4rem 0.75rem', fontSize: 12, color: 'var(--text-tertiary)' }}>No tags found</div>
                )}
                {filteredTags.map(t => {
                  const c = tagColor(t.name)
                  return (
                    <button
                      key={t.id}
                      onClick={() => addTag(t.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.4rem 0.75rem',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      <span style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 99,
                        background: c.bg,
                        color: c.color,
                        fontWeight: 500,
                      }}>
                        {t.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Result count */}
        {searched && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

        {/* Empty state — no search yet */}
        {!searched && (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
            Type to search logs, or use filters to browse by kase, tag, or date.
          </p>
        )}

        {/* Empty state — search returned nothing */}
        {searched && results.length === 0 && (
          <div
            data-testid="empty-state"
            style={{ padding: '2rem 0', textAlign: 'center' }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              No results
              {query.trim() ? ` for "${query}"` : ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Try different search terms or remove some filters.
            </div>
          </div>
        )}

        {/* Result cards */}
        {results.map(r => (
          <div
            key={r.logId}
            data-testid="result-card"
            onClick={() => navigate(`/logs/${r.logId}`)}
            style={{
              padding: '0.9rem 1.1rem',
              border: '1px solid var(--border)',
              borderRadius: 10,
              cursor: 'pointer',
              background: 'var(--bg)',
              transition: 'border-color 0.12s, box-shadow 0.12s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-mid)'
              ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
              ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', flex: 1, lineHeight: 1.3 }}>
                {r.title}
              </div>
              {r.updatedAt && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 1 }}>
                  {formatDate(r.updatedAt)}
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
              {r.kaseTitle}
            </div>

            {r.highlight && (
              <div
                style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '0.55rem' }}
                // Safe: backend strips HTML; we only add <mark> tags via highlightTerms
                dangerouslySetInnerHTML={{ __html: highlightTerms(r.highlight, query) }}
              />
            )}

            {r.tags && r.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {r.tags.map(tag => {
                  const c = tagColor(tag)
                  return (
                    <span key={tag} style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 99,
                      fontWeight: 500,
                      background: c.bg,
                      color: c.color,
                    }}>
                      {tag}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
