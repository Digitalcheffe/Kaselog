import { Outlet, useNavigate } from 'react-router-dom'
import LeftNav from './LeftNav'
import { KasesProvider } from '../contexts/KasesContext'

export default function Shell() {
  const navigate = useNavigate()

  return (
    <KasesProvider>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <LeftNav onSearchOpen={() => navigate('/search')} />
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
    </KasesProvider>
  )
}
