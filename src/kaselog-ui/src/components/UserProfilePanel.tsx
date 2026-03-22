import { useState, useEffect, useRef } from 'react'
import { useTheme, ACCENT_DEFS } from '../contexts/ThemeContext'
import { useUser } from '../contexts/UserContext'

interface Props {
  onClose: () => void
}

export default function UserProfilePanel({ onClose }: Props) {
  const { theme, accent, setTheme, setAccent } = useTheme()
  const { user, saveProfile, saveAppearance } = useUser()

  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const initialized = useRef(false)

  // Sync fields once user data arrives from the backend (async load)
  useEffect(() => {
    if (user && !initialized.current) {
      initialized.current = true
      setFirstName(user.firstName ?? '')
      setLastName(user.lastName ?? '')
      setEmail(user.email ?? '')
    }
  }, [user])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSaveProfile() {
    setSaving(true)
    try {
      await saveProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  function handleTheme(t: 'light' | 'dark') {
    setTheme(t)
    saveAppearance(t, accent).catch(() => {/* best-effort */})
  }

  function handleAccent(a: typeof accent) {
    setAccent(a)
    saveAppearance(theme, a).catch(() => {/* best-effort */})
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-mid)',
    borderRadius: 6,
    padding: '0.4rem 0.6rem',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font)',
    width: '100%',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: '0.3rem',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
      />

      {/* Panel */}
      <div
        data-testid="user-profile-panel"
        style={{
          position: 'fixed',
          bottom: 80,
          left: 12,
          width: 268,
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
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>Profile</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>Account details and appearance</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close profile panel"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--text-base)',
              color: 'var(--text-tertiary)',
              padding: '2px 4px',
              fontFamily: 'var(--font)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Profile section */}
        <div style={{ padding: '0.85rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>First name</div>
              <input
                data-testid="profile-first-name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Last name</div>
              <input
                data-testid="profile-last-name"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <div style={labelStyle}>Email</div>
            <input
              data-testid="profile-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </div>

          <button
            data-testid="profile-save-btn"
            onClick={handleSaveProfile}
            disabled={saving}
            style={{
              padding: '0.45rem 0.75rem',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              cursor: saving ? 'default' : 'pointer',
              fontFamily: 'var(--font)',
              opacity: saving ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save changes'}
          </button>

        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)' }} />

        {/* Appearance section */}
        <div style={{ padding: '0.85rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Appearance
          </div>

          {/* Theme row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', minWidth: 52 }}>Theme</div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                aria-label="Light theme"
                data-testid="theme-light-btn"
                onClick={() => handleTheme('light')}
                style={{
                  width: 36, height: 24, borderRadius: 6,
                  border: `2px solid ${theme === 'light' ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-xs)', fontWeight: 500,
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
                onClick={() => handleTheme('dark')}
                style={{
                  width: 36, height: 24, borderRadius: 6,
                  border: `2px solid ${theme === 'dark' ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-xs)', fontWeight: 500,
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
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', minWidth: 52 }}>Accent</div>
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              {ACCENT_DEFS.map(def => (
                <button
                  key={def.name}
                  aria-label={`${def.label} accent`}
                  data-testid={`accent-${def.name}`}
                  onClick={() => handleAccent(def.name)}
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: def.value,
                    border: accent === def.name ? `2px solid ${def.value}` : '2px solid transparent',
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
