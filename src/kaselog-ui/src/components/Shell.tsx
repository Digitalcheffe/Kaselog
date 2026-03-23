import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import LeftNav from './LeftNav'
import SearchOverlay from './SearchOverlay'
import { KasesProvider } from '../contexts/KasesContext'
import { CollectionsProvider } from '../contexts/CollectionsContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { UserProvider } from '../contexts/UserContext'
import { useIsMobile } from '../hooks/useMobile'

// ── Bottom navigation (mobile only) ──────────────────────────────────────────

function KasesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="7" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="13" width="7" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function CollectionsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12.5" y1="12.5" x2="18" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 17c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

interface BottomNavProps {
  onSearchOpen: () => void
}

function BottomNav({ onSearchOpen }: BottomNavProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isKasesActive = pathname === '/' || pathname.startsWith('/kases') || pathname.startsWith('/logs')
  const isCollectionsActive = pathname.startsWith('/collections') || pathname.startsWith('/items')
  const isSearchActive = pathname === '/search'
  const isProfileActive = pathname === '/profile'

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 56,
    padding: '8px 4px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: active ? 'var(--accent)' : 'var(--text-tertiary)',
    fontFamily: 'var(--font)',
    transition: 'color 0.15s',
    WebkitTapHighlightColor: 'transparent',
  })

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-2xs)',
    fontWeight: 500,
    letterSpacing: '0.01em',
  }

  return (
    <nav
      data-testid="bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <button
        aria-label="Kases"
        style={tabStyle(isKasesActive)}
        onClick={() => navigate('/kases')}
      >
        <KasesIcon />
        <span style={labelStyle}>Kases</span>
      </button>

      <button
        aria-label="Collections"
        style={tabStyle(isCollectionsActive)}
        onClick={() => navigate('/collections')}
      >
        <CollectionsIcon />
        <span style={labelStyle}>Collections</span>
      </button>

      <button
        aria-label="Search"
        style={tabStyle(isSearchActive)}
        onClick={onSearchOpen}
      >
        <SearchIcon />
        <span style={labelStyle}>Search</span>
      </button>

      <button
        aria-label="Profile"
        style={tabStyle(isProfileActive)}
        onClick={() => navigate('/profile')}
      >
        <ProfileIcon />
        <span style={labelStyle}>Profile</span>
      </button>
    </nav>
  )
}

// ── Shell ─────────────────────────────────────────────────────────────────────

export default function Shell() {
  const [overlayOpen, setOverlayOpen] = useState(false)
  const isMobile = useIsMobile()

  return (
    <ThemeProvider>
      <UserProvider>
        <KasesProvider>
          <CollectionsProvider>
            <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
              {!isMobile && <LeftNav onSearchOpen={() => setOverlayOpen(true)} />}
              <main
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  background: 'var(--bg)',
                  paddingBottom: isMobile ? 56 : 0,
                }}
              >
                <Outlet />
              </main>
            </div>
            {isMobile && <BottomNav onSearchOpen={() => setOverlayOpen(true)} />}
            {overlayOpen && <SearchOverlay onClose={() => setOverlayOpen(false)} />}
          </CollectionsProvider>
        </KasesProvider>
      </UserProvider>
    </ThemeProvider>
  )
}
