import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import LeftNav from './LeftNav'
import SearchOverlay from './SearchOverlay'
import AppearancePanel from './AppearancePanel'
import { KasesProvider } from '../contexts/KasesContext'
import { ThemeProvider } from '../contexts/ThemeContext'

export default function Shell() {
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)

  return (
    <ThemeProvider>
      <KasesProvider>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          <LeftNav
            onSearchOpen={() => setOverlayOpen(true)}
            onAppearanceOpen={() => setAppearanceOpen(true)}
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
        {appearanceOpen && <AppearancePanel onClose={() => setAppearanceOpen(false)} />}
      </KasesProvider>
    </ThemeProvider>
  )
}
