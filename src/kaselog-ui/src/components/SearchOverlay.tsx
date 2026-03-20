import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { search as searchApi } from '../api/client'
import type { SearchResult } from '../api/types'

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

/** Wraps all occurrences of query terms in <mark> tags within plain text. */
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

export default function SearchOverlay({ onClose }: Props) {
  const navigate = useNavigate()
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
    // Use capture so this runs before child click handlers
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

  function handleResultClick(logId: string) {
    onClose()
    navigate(`/logs/${logId}`)
  }

  function handleAdvancedSearch() {
    onClose()
    const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
    navigate(`/search${params}`)
  }

  const showResults = results.length > 0
  const showEmpty = !loading && query.trim() && results.length === 0

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
        style={{
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
              fontSize: 14,
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
              fontSize: 10,
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

        {/* Results */}
        {showResults && (
          <div>
            <div style={{
              padding: '0.25rem 1rem 0.3rem',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
            {results.map((r, i) => (
              <button
                key={r.logId}
                onClick={() => handleResultClick(r.logId)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  padding: '0.55rem 1rem',
                  cursor: 'pointer',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  background: 'transparent',
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: 'var(--font)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    marginBottom: '0.15rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: r.tags.length ? '0.3rem' : 0 }}>
                    {r.kaseTitle}
                  </div>
                  {r.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {r.tags.map(tag => {
                        const c = tagColor(tag)
                        return (
                          <span key={tag} style={{
                            fontSize: 10,
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
                </div>
              </button>
            ))}
          </div>
        )}

        {showEmpty && (
          <div style={{ padding: '0.75rem 1rem', fontSize: 13, color: 'var(--text-tertiary)' }}>
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
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {showResults ? `${results.length} results for "${query}"` : 'Type to search all logs'}
          </div>
          <button
            onClick={handleAdvancedSearch}
            data-testid="advanced-search-link"
            style={{
              fontSize: 11,
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
