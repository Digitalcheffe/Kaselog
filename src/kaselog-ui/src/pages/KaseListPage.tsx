import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { kases as kasesApi } from '../api/client'
import { useKases } from '../contexts/KasesContext'
import type { KaseResponse } from '../api/types'

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

// ── Pin icon ──────────────────────────────────────────────────────────────────

function PinIcon({ filled, size = 14 }: { filled: boolean; size?: number }) {
  if (filled) {
    // Filled pin — accent color
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M9.828 1.172a.5.5 0 0 0-.707 0L6.95 3.344a1 1 0 0 1-.707.293H3.5a1 1 0 0 0-.707 1.707l2 2A1 1 0 0 1 5 8.05v2.536a.5.5 0 0 0 .854.353L7.5 9.293l3.207 3.207a.5.5 0 0 0 .707-.707L8.207 8.586l1.621-1.621A3 3 0 0 0 10.657 5H12a1 1 0 0 0 .707-1.707l-2-2a1 1 0 0 0-.707-.293H9.828z"
          fill="var(--accent)"
        />
      </svg>
    )
  }
  // Outline pin — muted
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M9.828 1.172a.5.5 0 0 0-.707 0L6.95 3.344a1 1 0 0 1-.707.293H3.5a1 1 0 0 0-.707 1.707l2 2A1 1 0 0 1 5 8.05v2.536a.5.5 0 0 0 .854.353L7.5 9.293l3.207 3.207a.5.5 0 0 0 .707-.707L8.207 8.586l1.621-1.621A3 3 0 0 0 10.657 5H12a1 1 0 0 0 .707-1.707l-2-2a1 1 0 0 0-.707-.293H9.828z"
        stroke="var(--text-tertiary)"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  )
}

// ── Kase row ──────────────────────────────────────────────────────────────────

interface KaseRowProps {
  kase: KaseResponse
  isLast: boolean
  onPinToggle: (kase: KaseResponse) => void
}

function KaseRow({ kase, isLast, onPinToggle }: KaseRowProps) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  const activityTime = kase.latestLogUpdatedAt
    ? formatRelativeTime(kase.latestLogUpdatedAt)
    : formatRelativeTime(kase.createdAt)

  return (
    <div
      data-testid={`kase-row-${kase.id}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.85rem 1rem',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        background: hovered ? 'var(--bg-secondary)' : 'var(--bg)',
        transition: 'background 0.1s',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/kases/${kase.id}`)}
    >
      {/* Pin icon — always visible, left edge */}
      <button
        data-testid={`pin-btn-${kase.id}`}
        aria-label={kase.isPinned ? 'Unpin kase' : 'Pin kase'}
        onClick={e => { e.stopPropagation(); onPinToggle(kase) }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          marginTop: 2,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          borderRadius: 4,
          opacity: kase.isPinned ? 1 : (hovered ? 0.7 : 0.35),
          transition: 'opacity 0.15s',
        }}
      >
        <PinIcon filled={kase.isPinned} size={14} />
      </button>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: 3 }}>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--text-primary)' }}>
            {kase.title}
          </div>
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            padding: '1px 7px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 99,
            flexShrink: 0,
          }}>
            {kase.logCount} {kase.logCount === 1 ? 'log' : 'logs'}
          </div>
        </div>

        {/* Description */}
        {kase.description && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.5 }}>
            {kase.description}
          </div>
        )}

        {/* Latest log preview */}
        {kase.latestLogTitle ? (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginBottom: 3, lineHeight: 1.4 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{kase.latestLogTitle}</span>
            {kase.latestLogPreview && (
              <span> — {kase.latestLogPreview}</span>
            )}
          </div>
        ) : (
          <div
            data-testid={`no-logs-${kase.id}`}
            style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: 3 }}
          >
            No logs yet
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--text-tertiary)',
        flexShrink: 0,
        marginTop: 3,
        whiteSpace: 'nowrap',
      }}>
        {activityTime}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

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

  async function handlePinToggle(kase: KaseResponse) {
    try {
      await (kase.isPinned ? kasesApi.unpin(kase.id) : kasesApi.pin(kase.id))
      refresh()
    } catch { /* ignore */ }
  }

  const pinnedKases = kaseList.filter(k => k.isPinned)
  const unpinnedKases = kaseList.filter(k => !k.isPinned)
  const hasPinned = pinnedKases.length > 0

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
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          All Kases
        </div>
        {!loading && (
          <div style={{
            fontSize: 'var(--text-xs)',
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
            fontSize: 'var(--text-sm)',
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
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', paddingTop: '2rem', textAlign: 'center' }}>
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
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              No kases yet
            </div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>
              Create your first kase to start logging
            </div>
            <button
              onClick={openModal}
              style={{
                marginTop: '0.5rem',
                fontSize: 'var(--text-base)',
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
            {/* Pinned kases */}
            {pinnedKases.map((kase, i) => (
              <KaseRow
                key={kase.id}
                kase={kase}
                isLast={i === pinnedKases.length - 1 && unpinnedKases.length === 0}
                onPinToggle={handlePinToggle}
              />
            ))}

            {/* Divider between pinned and unpinned */}
            {hasPinned && unpinnedKases.length > 0 && (
              <div
                data-testid="pin-divider"
                style={{
                  height: 1,
                  background: 'var(--border)',
                  margin: 0,
                }}
              />
            )}

            {/* Unpinned kases */}
            {unpinnedKases.map((kase, i) => (
              <KaseRow
                key={kase.id}
                kase={kase}
                isLast={i === unpinnedKases.length - 1}
                onPinToggle={handlePinToggle}
              />
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
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem', letterSpacing: '-0.02em' }}>
              New Kase
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
                    fontSize: 'var(--text-base)',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${titleError ? '#d85a30' : 'var(--border-mid)'}`,
                    borderRadius: 6,
                    outline: 'none',
                    fontFamily: 'var(--font)',
                  }}
                />
                {titleError && (
                  <div role="alert" style={{ fontSize: 'var(--text-xs)', color: '#d85a30', marginTop: 4 }}>
                    {titleError}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
                    fontSize: 'var(--text-base)',
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
                <div role="alert" style={{ fontSize: 'var(--text-sm)', color: '#d85a30', marginBottom: '1rem', padding: '8px 10px', background: 'rgba(216,90,48,0.08)', borderRadius: 6 }}>
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
                    fontSize: 'var(--text-base)',
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
                    fontSize: 'var(--text-base)',
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
