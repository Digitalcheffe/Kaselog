import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collections as collectionsApi } from '../api/client'

const ACCENT_COLORS = [
  { value: 'teal',   label: 'Teal',   hex: '#1D9E75' },
  { value: 'blue',   label: 'Blue',   hex: '#378ADD' },
  { value: 'purple', label: 'Purple', hex: '#7F77DD' },
  { value: 'coral',  label: 'Coral',  hex: '#D85A30' },
  { value: 'amber',  label: 'Amber',  hex: '#BA7517' },
] as const

export default function NewCollectionPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [color, setColor] = useState<string>('teal')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError(null)
    try {
      const col = await collectionsApi.create({ title: title.trim(), color })
      navigate(`/collections/${col.id}/design`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create collection')
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
        borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>New Collection</span>
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 24 }}>
            Create a collection
          </div>

          {/* Title */}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>
            Title
          </label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            placeholder="e.g. Vinyl Records"
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 6, boxSizing: 'border-box',
              border: `1px solid ${error ? 'var(--accent-coral, #D85A30)' : 'var(--border)'}`,
              background: 'var(--bg)', color: 'var(--text)', fontSize: 14, marginBottom: 4,
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: 'var(--accent-coral, #D85A30)', marginBottom: 16 }}>{error}</div>
          )}
          {!error && <div style={{ marginBottom: 20 }} />}

          {/* Color */}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 10 }}>
            Color
          </label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
            {ACCENT_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                title={c.label}
                aria-label={c.label}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: 'none',
                  background: c.hex, cursor: 'pointer',
                  outline: color === c.value ? `3px solid ${c.hex}` : 'none',
                  outlineOffset: 2,
                  boxShadow: color === c.value ? `0 0 0 5px var(--bg)` : 'none',
                }}
              />
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 6, border: 'none',
                background: 'var(--accent)', color: '#fff', cursor: 'pointer',
                fontSize: 14, fontWeight: 500,
              }}
            >
              {saving ? 'Creating…' : 'Create & open designer'}
            </button>
            <button
              onClick={() => navigate('/collections')}
              style={{
                padding: '9px 16px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
