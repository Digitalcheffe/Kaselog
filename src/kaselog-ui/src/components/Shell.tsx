import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import LeftNav from './LeftNav'
import SearchOverlay from './SearchOverlay'
import UserProfilePanel from './UserProfilePanel'
import { KasesProvider } from '../contexts/KasesContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { UserProvider } from '../contexts/UserContext'

export default function Shell() {
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <ThemeProvider>
      <UserProvider>
        <KasesProvider>
          <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <LeftNav
              onSearchOpen={() => setOverlayOpen(true)}
              onProfileOpen={() => setProfileOpen(true)}
            />
            <main style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'var(--bg)',
            }}>
              <Outlet />
            </main>
          </div>
          {overlayOpen && <SearchOverlay onClose={() => setOverlayOpen(false)} />}
          {profileOpen && <UserProfilePanel onClose={() => setProfileOpen(false)} />}
        </KasesProvider>
      </UserProvider>
    </ThemeProvider>
  )
}
