import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme, ACCENT_DEFS } from '../contexts/ThemeContext'
import { useUser } from '../contexts/UserContext'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { theme, accent, setTheme, setAccent } = useTheme()
  const { user, saveProfile, saveAppearance } = useUser()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const initialized = useRef(false)

  // Sync fields once user data arrives
  useEffect(() => {
    if (user && !initialized.current) {
      initialized.current = true
      setFirstName(user.firstName ?? '')
      setLastName(user.lastName ?? '')
      setEmail(user.email ?? '')
    }
  }, [user])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveStatus('idle')
    setSaveError('')
    try {
      await saveProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (err) {
      setSaveStatus('error')
      setSaveError(err instanceof Error ? err.message : 'Failed to save — check that the backend is running.')
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
    padding: '0.5rem 0.7rem',
    fontSize: 'var(--text-base)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font)',
    width: '100%',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: '0.4rem',
  }

  return (
    <>
      {/* Top bar */}
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
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'var(--text-base)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font)',
            padding: '4px 6px',
            borderRadius: 5,
          }}
        >
          ← Back
        </button>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Profile
        </div>
        <div style={{ flex: 1 }} />
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 2rem' }}>
        <div style={{ maxWidth: 520 }}>

          {/* Profile card */}
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
            marginBottom: '1.5rem',
          }}>
            <div style={{
              padding: '0.9rem 1.1rem',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--text-primary)' }}>Account</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>Your name and email address</div>
            </div>

            <form onSubmit={handleSaveProfile} noValidate>
              <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>First name</label>
                    <input
                      data-testid="profile-first-name"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="First"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Last name</label>
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
                  <label style={labelStyle}>Email</label>
                  <input
                    data-testid="profile-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    style={inputStyle}
                  />
                </div>

                {saveStatus === 'error' && (
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    color: '#d85a30',
                    padding: '8px 10px',
                    background: 'rgba(216,90,48,0.08)',
                    borderRadius: 6,
                    border: '1px solid rgba(216,90,48,0.2)',
                  }}>
                    {saveError}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    data-testid="profile-save-btn"
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'var(--accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 'var(--text-base)',
                      fontWeight: 500,
                      cursor: saving ? 'default' : 'pointer',
                      fontFamily: 'var(--font)',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                  {saveStatus === 'saved' && (
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)' }}>Saved</span>
                  )}
                </div>

              </div>
            </form>
          </div>

          {/* Appearance card */}
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '0.9rem 1.1rem',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--text-primary)' }}>Appearance</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>Theme and accent color</div>
            </div>

            <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Theme row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', minWidth: 64 }}>Theme</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    aria-label="Light theme"
                    data-testid="theme-light-btn"
                    onClick={() => handleTheme('light')}
                    style={{
                      width: 60, height: 32, borderRadius: 6,
                      border: `2px solid ${theme === 'light' ? 'var(--accent)' : 'var(--border-mid)'}`,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                      fontSize: 'var(--text-sm)', fontWeight: 500,
                      color: theme === 'light' ? 'var(--accent)' : 'var(--text-tertiary)',
                      background: '#f7f6f3',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    ☀ Light
                  </button>
                  <button
                    aria-label="Dark theme"
                    data-testid="theme-dark-btn"
                    onClick={() => handleTheme('dark')}
                    style={{
                      width: 60, height: 32, borderRadius: 6,
                      border: `2px solid ${theme === 'dark' ? 'var(--accent)' : 'var(--border-mid)'}`,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                      fontSize: 'var(--text-sm)', fontWeight: 500,
                      color: theme === 'dark' ? 'var(--accent)' : 'var(--text-secondary)',
                      background: '#1c1c1a',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    ☽ Dark
                  </button>
                </div>
              </div>

              {/* Accent row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', minWidth: 64 }}>Accent</div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  {ACCENT_DEFS.map(def => (
                    <button
                      key={def.name}
                      aria-label={`${def.label} accent`}
                      data-testid={`accent-${def.name}`}
                      onClick={() => handleAccent(def.name)}
                      title={def.label}
                      style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: def.value,
                        border: accent === def.name ? `2px solid ${def.value}` : '2px solid transparent',
                        cursor: 'pointer',
                        outline: accent === def.name ? `2px solid ${def.value}` : 'none',
                        outlineOffset: 2,
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </>
  )
}
