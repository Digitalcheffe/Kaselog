import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { search as searchApi } from '../api/client'
import type { SearchResult } from '../api/types'

export default function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)

  async function handleSearch(q: string) {
    setQuery(q)
    if (!q.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    try {
      const r = await searchApi.query({ q: q.trim() })
      setResults(r)
      setSearched(true)
    } catch {
      setResults([])
      setSearched(true)
    }
  }

  return (
    <>
      {/* Top bar with search input */}
      <div style={{
        height: 48,
        minHeight: 48,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 1.25rem',
        gap: '0.75rem',
        flexShrink: 0,
      }}>
        <svg width="15" height="15" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
          <line x1="8.5" y1="8.5" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
        </svg>
        <input
          type="text"
          placeholder="Search logs..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
          autoFocus
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: 14,
            background: 'transparent',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font)',
          }}
        />
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
          cursor: 'pointer',
        }}>
          K
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
        {!searched && (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Type to search logs…</p>
        )}
        {searched && results.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No results for &ldquo;{query}&rdquo;</p>
        )}
        {results.length > 0 && (
          <div style={{ marginBottom: '0.75rem', fontSize: 12, color: 'var(--text-tertiary)' }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </div>
        )}
        {results.map(r => (
          <div
            key={r.logId}
            onClick={() => navigate(`/logs/${r.logId}`)}
            style={{
              marginBottom: '0.75rem',
              padding: '0.75rem 1rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              background: 'var(--bg)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              {r.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: '0.35rem' }}>
              {r.kaseTitle}
            </div>
            <div style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            } as React.CSSProperties}>
              {r.content}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
