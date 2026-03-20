import { useMatch, useNavigate } from 'react-router-dom'
import { useKases } from '../contexts/KasesContext'
import { useUser } from '../contexts/UserContext'

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
  const { user } = useUser()
  const navigate = useNavigate()
  const kaseMatch = useMatch('/kases/:id')
  const activeKaseId = kaseMatch?.params.id

  const initials = getInitials(user?.firstName, user?.lastName)
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Profile'

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
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          KaseLog
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1, letterSpacing: '0.02em' }}>
          private ops journal
        </div>
      </div>

      {/* New Kase — navigates to / where the form lives */}
      <button
        onClick={() => navigate('/')}
        style={{
          margin: '0.6rem 0.6rem 0.25rem',
          padding: '0.45rem 0.75rem',
          background: 'var(--bg)',
          border: '1px solid var(--border-mid)',
          borderRadius: 'var(--radius)',
          fontSize: 13,
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
        fontSize: 10,
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
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '0.5rem 0.6rem', fontStyle: 'italic' }}>
            No kases yet
          </div>
        )}
        {kaseList.map(kase => {
          const isActive = activeKaseId === kase.id
          return (
            <div
              key={kase.id}
              onClick={() => navigate(`/kases/${kase.id}`)}
              style={{
                padding: '0.45rem 0.6rem',
                borderRadius: 6,
                cursor: 'pointer',
                marginBottom: 1,
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
              }}
            >
              <div style={{
                fontSize: 13,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 500 : 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {kase.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                {kase.logCount} {kase.logCount === 1 ? 'log' : 'logs'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Avatar + Search — pinned */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '0.5rem 0.6rem 0.6rem', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <button
          onClick={() => navigate('/profile')}
          aria-label="Open user profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.65rem',
            borderRadius: 7,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            fontFamily: 'var(--font)',
          }}
        >
          <div style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
            color: 'white',
            flexShrink: 0,
            letterSpacing: '-0.02em',
          }}>
            {initials}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </span>
        </button>
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
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)', flex: 1, textAlign: 'left' }}>
            Search logs...
          </span>
        </button>
      </div>
    </nav>
  )
}
