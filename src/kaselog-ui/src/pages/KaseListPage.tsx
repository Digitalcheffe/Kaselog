import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { kases as kasesApi } from '../api/client'
import { useKases } from '../contexts/KasesContext'

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function KaseListPage() {
  const navigate = useNavigate()
  const { kaseList, loading, refresh } = useKases()

  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [titleError, setTitleError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (modalOpen && titleInputRef.current) {
      titleInputRef.current.focus()
    }
  }, [modalOpen])

  function openModal() {
    setTitle('')
    setDescription('')
    setTitleError('')
    setSubmitError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTitleError('')
    setSubmitError('')

    if (!title.trim()) {
      setTitleError('Title is required')
      titleInputRef.current?.focus()
      return
    }

    setSubmitting(true)
    try {
      const created = await kasesApi.create({
        title: title.trim(),
        description: description.trim() || null,
      })
      refresh()
      navigate(`/kases/${created.id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create kase. Please try again.')
      setSubmitting(false)
    }
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
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          All Kases
        </div>
        {!loading && (
          <div style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            padding: '2px 8px',
            background: 'var(--bg-secondary)',
            borderRadius: 99,
            border: '1px solid var(--border)',
          }}>
            {kaseList.length}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={openModal}
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--bg)',
            background: 'var(--accent)',
            padding: '5px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            border: 'none',
            fontFamily: 'var(--font)',
          }}
        >
          + New Kase
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', paddingTop: '2rem', textAlign: 'center' }}>
            Loading...
          </div>
        ) : kaseList.length === 0 ? (
          /* Empty state */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: '4rem',
            gap: '0.75rem',
          }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
              No kases yet
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              Create your first kase to start logging
            </div>
            <button
              onClick={openModal}
              style={{
                marginTop: '0.5rem',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--bg)',
                background: 'var(--accent)',
                padding: '8px 20px',
                borderRadius: 7,
                cursor: 'pointer',
                border: 'none',
                fontFamily: 'var(--font)',
              }}
            >
              + New Kase
            </button>
          </div>
        ) : (
          /* Kase list */
          <div style={{
            maxWidth: 680,
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            {kaseList.map((kase, i) => (
              <div
                key={kase.id}
                onClick={() => navigate(`/kases/${kase.id}`)}
                style={{
                  padding: '0.9rem 1.1rem',
                  cursor: 'pointer',
                  borderBottom: i < kaseList.length - 1 ? '1px solid var(--border)' : 'none',
                  background: 'var(--bg)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg)')}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {kase.title}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    padding: '1px 7px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 99,
                  }}>
                    {kase.logCount} {kase.logCount === 1 ? 'log' : 'logs'}
                  </div>
                </div>
                {kase.description && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3, lineHeight: 1.5 }}>
                    {kase.description}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  Updated {formatRelativeTime(kase.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Kase modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New Kase"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border-mid)',
            borderRadius: 10,
            padding: '1.5rem',
            width: 420,
            maxWidth: '90vw',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem', letterSpacing: '-0.02em' }}>
              New Kase
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Title
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={e => { setTitle(e.target.value); setTitleError('') }}
                  placeholder="e.g. Proxmox Cluster"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${titleError ? '#d85a30' : 'var(--border-mid)'}`,
                    borderRadius: 6,
                    outline: 'none',
                    fontFamily: 'var(--font)',
                  }}
                />
                {titleError && (
                  <div role="alert" style={{ fontSize: 11, color: '#d85a30', marginTop: 4 }}>
                    {titleError}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Description <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What is this kase about?"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-mid)',
                    borderRadius: 6,
                    outline: 'none',
                    fontFamily: 'var(--font)',
                  }}
                />
              </div>

              {submitError && (
                <div role="alert" style={{ fontSize: 12, color: '#d85a30', marginBottom: '1rem', padding: '8px 10px', background: 'rgba(216,90,48,0.08)', borderRadius: 6 }}>
                  {submitError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  style={{
                    padding: '7px 14px',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    background: 'transparent',
                    border: '1px solid var(--border-mid)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '7px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--bg)',
                    background: submitting ? 'var(--text-tertiary)' : 'var(--accent)',
                    border: 'none',
                    borderRadius: 6,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font)',
                  }}
                >
                  {submitting ? 'Creating...' : 'Create Kase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
