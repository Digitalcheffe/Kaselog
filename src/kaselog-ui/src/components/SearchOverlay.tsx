import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { search as searchApi } from '../api/client'
import type { SearchResult } from '../api/types'
import { useIsMobile } from '../hooks/useMobile'

interface Props {
  onClose: () => void
}

// Deterministic tag color from name (same palette used across the app)
const TAG_PALETTES = [
  { bg: 'var(--tag-green-bg)', color: 'var(--tag-green-text)' },
  { bg: 'var(--tag-purple-bg)', color: 'var(--tag-purple-text)' },
  { bg: 'var(--tag-amber-bg)', color: 'var(--tag-amber-text)' },
  { bg: 'var(--tag-blue-bg)', color: 'var(--tag-blue-text)' },
  { bg: 'var(--tag-coral-bg)', color: 'var(--tag-coral-text)' },
]

function tagColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (Math.imul(31, hash) + name.charCodeAt(i)) | 0
  }
  return TAG_PALETTES[Math.abs(hash) % TAG_PALETTES.length]
}

// Map collection color name to CSS variable / hex
const COLLECTION_COLORS: Record<string, string> = {
  teal: '#1D9E75',
  blue: '#378ADD',
  purple: '#7F77DD',
  coral: '#D85A30',
  amber: '#BA7517',
}

function collectionDotColor(color: string | null | undefined): string {
  if (!color) return '#9a9890'
  return COLLECTION_COLORS[color.toLowerCase()] ?? '#9a9890'
}

export default function SearchOverlay({ onClose }: Props) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-focus input on open
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Escape key closes overlay
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Click outside closes overlay
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchApi.query({ q: value.trim() })
        setResults(r)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 200)
  }

  function handleLogClick(logId: string) {
    onClose()
    navigate(`/logs/${logId}`)
  }

  function handleItemClick(itemId: string) {
    onClose()
    navigate(`/items/${itemId}`)
  }

  function handleAdvancedSearch() {
    onClose()
    const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
    navigate(`/search${params}`)
  }

  const logs = results.filter(r => r.entityType === 'log' || !r.entityType)
  const items = results.filter(r => r.entityType === 'collection_item')
  const showResults = results.length > 0
  const showEmpty = !loading && query.trim() && results.length === 0

  const groupHeader = (label: string) => (
    <div style={{
      padding: '0.25rem 1rem 0.2rem',
      fontSize: 'var(--text-2xs)',
      fontWeight: 600,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      borderTop: '1px solid var(--border)',
    }}>
      {label}
    </div>
  )

  const resultButton = (
    children: React.ReactNode,
    key: string,
    onClick: () => void,
    isFirst: boolean,
  ) => (
    <button
      key={key}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.6rem',
        padding: '0.55rem 1rem',
        cursor: 'pointer',
        borderTop: isFirst ? 'none' : '1px solid var(--border)',
        background: 'transparent',
        width: '100%',
        textAlign: 'left',
        fontFamily: 'var(--font)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )

  return (
    <>
      {/* Dim backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--bg)',
          opacity: 0.5,
          zIndex: 40,
        }}
      />

      {/* Overlay panel */}
      <div
        ref={overlayRef}
        data-testid="search-overlay"
        style={isMobile ? {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100dvh',
          background: 'var(--bg)',
          border: 'none',
          borderRadius: '0px',
          boxShadow: 'none',
          overflow: 'hidden',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
        } : {
          position: 'fixed',
          top: 64,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(520px, calc(100vw - 2rem))',
          background: 'var(--bg)',
          border: '1px solid var(--border-mid)',
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          zIndex: 50,
        }}
      >
        {/* Search input row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.85rem 1rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <svg width="15" height="15" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" />
            <line x1="8.5" y1="8.5" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search logs..."
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            style={{
              flex: 1,
              fontSize: 'var(--text-base)',
              color: 'var(--text-primary)',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--font)',
            }}
          />
          <button
            onClick={onClose}
            aria-label="Close search"
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              padding: '2px 7px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              flexShrink: 0,
            }}
          >
            esc
          </button>
        </div>

        {/* Results — grouped by entity type */}
        {showResults && (
          <div style={isMobile ? { flex: 1, overflowY: 'auto' } : {}}>
            {/* Logs group */}
            {logs.length > 0 && (
              <>
                {groupHeader(`Logs · ${logs.length}`)}
                {logs.map((r, i) =>
                  resultButton(
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 'var(--text-base)',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        marginBottom: '0.15rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: r.tags.length ? '0.3rem' : 0 }}>
                        {r.kaseTitle}
                      </div>
                      {r.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {r.tags.map(tag => {
                            const c = tagColor(tag)
                            return (
                              <span key={tag} style={{
                                fontSize: 'var(--text-xs)',
                                padding: '1px 7px',
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
                    </div>,
                    r.logId,
                    () => handleLogClick(r.logId),
                    i === 0,
                  )
                )}
              </>
            )}

            {/* Collection items group */}
            {items.length > 0 && (
              <>
                {groupHeader(`Collection Items · ${items.length}`)}
                {items.map((r, i) =>
                  resultButton(
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                        {/* Collection dot */}
                        <span
                          data-testid={`collection-dot-${r.logId}`}
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 2,
                            background: collectionDotColor(r.collectionColor),
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                          {r.collectionTitle}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 'var(--text-base)',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        marginBottom: '0.15rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {r.title || r.collectionTitle}
                      </div>
                      {r.highlight && (
                        <div style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-tertiary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {r.highlight}
                        </div>
                      )}
                      {r.kaseTitle && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '0.1rem' }}>
                          Kase: {r.kaseTitle}
                        </div>
                      )}
                    </div>,
                    r.logId,
                    () => handleItemClick(r.logId),
                    i === 0 && logs.length === 0,
                  )
                )}
              </>
            )}
          </div>
        )}

        {showEmpty && (
          <div style={{ padding: '0.75rem 1rem', fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.6rem 1rem',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {showResults ? `${results.length} results for "${query}"` : 'Type to search all logs'}
          </div>
          <button
            onClick={handleAdvancedSearch}
            data-testid="advanced-search-link"
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              color: 'var(--accent)',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              fontFamily: 'var(--font)',
              padding: 0,
            }}
          >
            Advanced search →
          </button>
        </div>
      </div>
    </>
  )
}
