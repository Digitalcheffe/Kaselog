import { useState } from 'react'
import { useMatch, useNavigate } from 'react-router-dom'
import { useKases } from '../contexts/KasesContext'
import { useCollections } from '../contexts/CollectionsContext'
import { useUser } from '../contexts/UserContext'

const COLOR_MAP: Record<string, string> = {
  teal:   '#1D9E75',
  blue:   '#378ADD',
  purple: '#7F77DD',
  coral:  '#D85A30',
  amber:  '#BA7517',
}

const NAV_LIMIT = 5

interface LeftNavProps {
  onSearchOpen: () => void
}

function getInitials(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const f = firstName?.trim()[0]?.toUpperCase() ?? ''
  const l = lastName?.trim()[0]?.toUpperCase() ?? ''
  return f || l ? `${f}${l}` : 'U'
}

export default function LeftNav({ onSearchOpen }: LeftNavProps) {
  const { kaseList } = useKases()
  const { collectionList } = useCollections()
  const { user } = useUser()
  const navigate = useNavigate()
  const kaseMatch = useMatch('/kases/:id')
  const collectionMatch = useMatch('/collections/:id')
  const activeKaseId = kaseMatch?.params.id
  const activeCollectionId = collectionMatch?.params.id

  const [kasesOpen, setKasesOpen] = useState(true)
  const [collectionsOpen, setCollectionsOpen] = useState(true)

  const initials = getInitials(user?.firstName, user?.lastName)
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Profile'

  const visibleKases = kaseList.slice(0, NAV_LIMIT)
  const moreKases = kaseList.length - NAV_LIMIT
  const visibleCollections = collectionList.slice(0, NAV_LIMIT)
  const moreCollections = collectionList.length - NAV_LIMIT

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0.6rem 0.25rem 0.9rem',
    cursor: 'pointer',
    userSelect: 'none',
  }

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 'var(--text-2xs)',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  }

  const arrowStyle = (open: boolean): React.CSSProperties => ({
    fontSize: 'var(--text-2xs)',
    color: 'var(--text-tertiary)',
    transition: 'transform 0.2s',
    transform: open ? 'none' : 'rotate(-90deg)',
    display: 'inline-block',
  })

  const newBtnStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-tertiary)',
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
  }

  const navItemStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.38rem 0.55rem',
    borderRadius: 6,
    cursor: 'pointer',
    marginBottom: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: active ? 'var(--bg-tertiary)' : 'transparent',
  })

  const navItemNameStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 'var(--text-sm)',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontWeight: active ? 500 : 400,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  })

  const navItemCountStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-tertiary)',
    flexShrink: 0,
    marginLeft: '0.3rem',
  }

  const navMoreStyle: React.CSSProperties = {
    padding: '0.25rem 0.55rem',
    fontSize: 'var(--text-xs)',
    color: 'var(--accent)',
    cursor: 'pointer',
    display: 'inline-block',
    marginBottom: '0.25rem',
    borderRadius: 5,
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
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          KaseLog
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1, letterSpacing: '0.02em' }}>
          private ops journal
        </div>
      </div>

      {/* Nav body — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Kases section ── */}
        <div>
          <div
            role="button"
            aria-label="Toggle Kases section"
            style={sectionHeaderStyle}
            onClick={() => setKasesOpen(o => !o)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={arrowStyle(kasesOpen)}>▾</span>
              <span style={sectionLabelStyle}>Kases</span>
            </div>
            <button
              style={newBtnStyle}
              onClick={e => { e.stopPropagation(); navigate('/') }}
              aria-label="New Kase"
            >
              + new
            </button>
          </div>

          {kasesOpen && (
            <div style={{ padding: '0 0.4rem 0.4rem' }}>
              {visibleKases.length === 0 && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', padding: '0.35rem 0.55rem', fontStyle: 'italic' }}>
                  No kases yet
                </div>
              )}
              {visibleKases.map(kase => {
                const active = activeKaseId === kase.id
                return (
                  <div
                    key={kase.id}
                    style={navItemStyle(active)}
                    onClick={() => navigate(`/kases/${kase.id}`)}
                  >
                    <span style={navItemNameStyle(active)}>{kase.title}</span>
                    <span style={navItemCountStyle}>{kase.logCount}</span>
                  </div>
                )
              })}
              {moreKases > 0 && (
                <span
                  style={navMoreStyle}
                  onClick={() => navigate('/')}
                >
                  + {moreKases} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />

        {/* ── Collections section ── */}
        <div>
          <div
            role="button"
            aria-label="Toggle Collections section"
            style={sectionHeaderStyle}
            onClick={() => setCollectionsOpen(o => !o)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={arrowStyle(collectionsOpen)}>▾</span>
              <span style={sectionLabelStyle}>Collections</span>
            </div>
            <button
              style={newBtnStyle}
              onClick={e => { e.stopPropagation(); navigate('/collections/new') }}
              aria-label="New Collection"
            >
              + new
            </button>
          </div>

          {collectionsOpen && (
            <div style={{ padding: '0 0.4rem 0.4rem' }}>
              {visibleCollections.length === 0 && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', padding: '0.35rem 0.55rem', fontStyle: 'italic' }}>
                  No collections yet
                </div>
              )}
              {visibleCollections.map(col => {
                const active = activeCollectionId === col.id
                const dotColor = COLOR_MAP[col.color] ?? '#1D9E75'
                return (
                  <div
                    key={col.id}
                    style={navItemStyle(active)}
                    onClick={() => navigate(`/collections/${col.id}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: dotColor, flexShrink: 0, marginRight: '0.4rem',
                      }} />
                      <span style={navItemNameStyle(active)}>{col.title}</span>
                    </div>
                    <span style={navItemCountStyle}>{col.itemCount}</span>
                  </div>
                )
              })}
              {moreCollections > 0 && (
                <span
                  style={navMoreStyle}
                  onClick={() => navigate('/collections')}
                >
                  + {moreCollections} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom — avatar + search */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '0.5rem 0.6rem 0.6rem',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
      }}>
        <button
          onClick={() => navigate('/profile')}
          aria-label="Open user profile"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.4rem 0.65rem', borderRadius: 7,
            background: 'transparent', border: 'none',
            cursor: 'pointer', width: '100%', fontFamily: 'var(--font)',
          }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'var(--accent)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--text-xs)', fontWeight: 600, color: 'white',
            flexShrink: 0, letterSpacing: '-0.02em',
          }}>
            {initials}
          </div>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </span>
        </button>

        <button
          onClick={onSearchOpen}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 0.65rem', borderRadius: 7,
            background: 'var(--bg)', border: '1px solid var(--border-mid)',
            cursor: 'pointer', width: '100%', fontFamily: 'var(--font)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
            <line x1="8.5" y1="8.5" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
          </svg>
          <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', flex: 1, textAlign: 'left' }}>
            Search logs...
          </span>
        </button>
      </div>
    </nav>
  )
}
