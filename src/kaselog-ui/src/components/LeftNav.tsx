import { useState, useEffect } from 'react'
import { Link, useMatch, useNavigate } from 'react-router-dom'
import { kases as kasesApi } from '../api/client'
import type { KaseResponse } from '../api/types'

interface LeftNavProps {
  onSearchOpen: () => void
}

export default function LeftNav({ onSearchOpen }: LeftNavProps) {
  const [kaseList, setKaseList] = useState<KaseResponse[]>([])
  const navigate = useNavigate()
  const kaseMatch = useMatch('/kases/:id')
  const activeKaseId = kaseMatch?.params.id

  useEffect(() => {
    kasesApi.list().then(setKaseList).catch(() => {})
  }, [])

  async function handleNewKase() {
    try {
      const created = await kasesApi.create({ title: 'New Kase' })
      setKaseList(prev => [created, ...prev])
      navigate(`/kases/${created.id}`)
    } catch {
      // silently ignore — shell-level error handling deferred
    }
  }

  return (
    <nav style={{
      width: 'var(--nav-width)',
      minWidth: 'var(--nav-width)',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '1rem 1rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          KaseLog
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1, letterSpacing: '0.02em' }}>
          private ops journal
        </div>
      </div>

      {/* New Kase */}
      <button
        onClick={handleNewKase}
        style={{
          margin: '0.6rem 0.6rem 0.25rem',
          padding: '0.45rem 0.75rem',
          background: 'var(--bg)',
          border: '1px solid var(--border-mid)',
          borderRadius: 'var(--radius)',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          textAlign: 'center',
          fontFamily: 'var(--font)',
        }}
      >
        + New Kase
      </button>

      {/* Section label */}
      <div style={{
        fontSize: 9,
        fontWeight: 600,
        color: 'var(--text-tertiary)',
        padding: '0.5rem 1rem 0.25rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Kases
      </div>

      {/* Kase list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.4rem' }}>
        {kaseList.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '0.5rem 0.6rem', fontStyle: 'italic' }}>
            No kases yet
          </div>
        )}
        {kaseList.map(kase => {
          const isActive = activeKaseId === kase.id
          return (
            <Link key={kase.id} to={`/kases/${kase.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '0.45rem 0.6rem',
                borderRadius: 6,
                cursor: 'pointer',
                marginBottom: 1,
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
              }}>
                <div style={{
                  fontSize: 12,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 500 : 400,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {kase.title}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {kase.logCount} {kase.logCount === 1 ? 'log' : 'logs'}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Search — pinned */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '0.6rem', background: 'var(--bg-secondary)' }}>
        <button
          onClick={onSearchOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.65rem',
            borderRadius: 7,
            background: 'var(--bg)',
            border: '1px solid var(--border-mid)',
            cursor: 'pointer',
            width: '100%',
            fontFamily: 'var(--font)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
            <line x1="8.5" y1="8.5" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
          </svg>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flex: 1, textAlign: 'left' }}>
            Search logs...
          </span>
        </button>
      </div>
    </nav>
  )
}
