import { useTheme, ACCENT_DEFS } from '../contexts/ThemeContext'

interface Props {
  onClose: () => void
}

export default function AppearancePanel({ onClose }: Props) {
  const { theme, accent, setTheme, setAccent } = useTheme()

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
        }}
      />

      {/* Panel */}
      <div
        data-testid="appearance-panel"
        style={{
          position: 'fixed',
          bottom: 80,
          left: 12,
          width: 220,
          background: 'var(--bg)',
          border: '1px solid var(--border-mid)',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 50,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '0.65rem 0.9rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Appearance</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>Theme and accent color</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close appearance panel"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              color: 'var(--text-tertiary)',
              padding: '2px 4px',
              fontFamily: 'var(--font)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0.85rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

          {/* Theme row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 52 }}>Theme</div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                aria-label="Light theme"
                data-testid="theme-light-btn"
                onClick={() => setTheme('light')}
                style={{
                  width: 36,
                  height: 24,
                  borderRadius: 6,
                  border: `2px solid ${theme === 'light' ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 500,
                  color: theme === 'light' ? 'var(--accent)' : 'var(--text-tertiary)',
                  background: '#f7f6f3',
                  fontFamily: 'var(--font)',
                  transition: 'all 0.15s',
                }}
              >
                ☀
              </button>
              <button
                aria-label="Dark theme"
                data-testid="theme-dark-btn"
                onClick={() => setTheme('dark')}
                style={{
                  width: 36,
                  height: 24,
                  borderRadius: 6,
                  border: `2px solid ${theme === 'dark' ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 500,
                  color: theme === 'dark' ? 'var(--accent)' : 'var(--text-tertiary)',
                  background: '#1c1c1a',
                  fontFamily: 'var(--font)',
                  transition: 'all 0.15s',
                }}
              >
                ☽
              </button>
            </div>
          </div>

          {/* Accent row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 52 }}>Accent</div>
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              {ACCENT_DEFS.map(def => (
                <button
                  key={def.name}
                  aria-label={`${def.label} accent`}
                  data-testid={`accent-${def.name}`}
                  onClick={() => setAccent(def.name)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: def.value,
                    border: accent === def.name
                      ? `2px solid ${def.value}`
                      : '2px solid transparent',
                    cursor: 'pointer',
                    outline: accent === def.name ? `2px solid ${def.value}` : 'none',
                    outlineOffset: 2,
                    padding: 0,
                    transition: 'all 0.15s',
                  }}
                  title={def.label}
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
