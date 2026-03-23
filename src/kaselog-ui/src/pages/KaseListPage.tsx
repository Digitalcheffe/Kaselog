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

// ── Gear / settings icon ──────────────────────────────────────────────────────

function GearIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
      <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.892 3.433-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.892-1.64-.901-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.474l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z" />
    </svg>
  )
}

// ── Pin icon ──────────────────────────────────────────────────────────────────

function PinIcon({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M9.828 1.172a.5.5 0 0 0-.707 0L6.95 3.344a1 1 0 0 1-.707.293H3.5a1 1 0 0 0-.707 1.707l2 2A1 1 0 0 1 5 8.05v2.536a.5.5 0 0 0 .854.353L7.5 9.293l3.207 3.207a.5.5 0 0 0 .707-.707L8.207 8.586l1.621-1.621A3 3 0 0 0 10.657 5H12a1 1 0 0 0 .707-1.707l-2-2a1 1 0 0 0-.707-.293H9.828z"
        fill={filled ? 'var(--accent)' : 'var(--text-tertiary)'}
        opacity={filled ? 1 : 0.4}
      />
    </svg>
  )
}

// ── Kase management panel ─────────────────────────────────────────────────────

interface KaseManagementPanelProps {
  kase: KaseResponse
  onClose: () => void
  onUpdated: (kase: KaseResponse) => void
  onDeleted: (kase: KaseResponse) => void
  onPinToggled: (kase: KaseResponse) => void
}

function KaseManagementPanel({ kase, onClose, onUpdated, onDeleted, onPinToggled }: KaseManagementPanelProps) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(kase.title)
  const [description, setDescription] = useState(kase.description ?? '')
  const [titleError, setTitleError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pinning, setPinning] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Sync form when a different kase is selected
  useEffect(() => {
    setTitle(kase.title)
    setDescription(kase.description ?? '')
    setTitleError('')
  }, [kase.id])

  // ESC closes the panel
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const isDirty =
    title !== kase.title ||
    description !== (kase.description ?? '')

  async function handleSave() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setTitleError('Title is required')
      return
    }
    setTitleError('')
    setSaving(true)
    try {
      const updated = await kasesApi.update(kase.id, {
        title: trimmedTitle,
        description: description.trim() || null,
      })
      onUpdated(updated)
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  async function handlePinToggle() {
    if (pinning) return
    setPinning(true)
    try {
      const updated = kase.isPinned
        ? await kasesApi.unpin(kase.id)
        : await kasesApi.pin(kase.id)
      onPinToggled(updated)
    } catch { /* ignore */ } finally {
      setPinning(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await kasesApi.delete(kase.id)
      onDeleted(kase)
    } catch {
      setDeleting(false)
    }
  }

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)', fontWeight: 600,
    color: 'var(--text-tertiary)', textTransform: 'uppercase',
    letterSpacing: '0.07em', marginBottom: 6,
  }

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="kase-panel-backdrop"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 200 }}
      />

      {/* Panel */}
      <div
        data-testid="kase-management-panel"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 280, zIndex: 201,
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border-mid)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          height: 48, minHeight: 48, display: 'flex', alignItems: 'center',
          padding: '0 1rem', gap: 8,
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{
            fontSize: 'var(--text-sm)', fontWeight: 600,
            color: 'var(--text-primary)', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {kase.title}
          </span>
          <button
            aria-label="Close panel"
            onClick={onClose}
            style={{
              fontSize: 'var(--text-lg)', color: 'var(--text-tertiary)',
              cursor: 'pointer', background: 'none', border: 'none', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

          {/* Open Kase */}
          <button
            data-testid="panel-open-kase-btn"
            onClick={() => { navigate(`/kases/${kase.id}`); onClose() }}
            style={{
              width: '100%',
              fontSize: 'var(--text-sm)', fontWeight: 500,
              color: 'var(--bg)', background: 'var(--accent)',
              padding: '8px 12px', borderRadius: 7,
              cursor: 'pointer', border: 'none', fontFamily: 'var(--font)',
            }}
          >
            Open Kase
          </button>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Title */}
          <div>
            <div style={fieldLabelStyle}>Title</div>
            <input
              data-testid="panel-title-input"
              aria-label="Kase title"
              value={title}
              onChange={e => { setTitle(e.target.value); setTitleError('') }}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-secondary)',
                border: `1px solid ${titleError ? '#DC2626' : 'var(--border-mid)'}`,
                borderRadius: 7, padding: '7px 10px',
                fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            {titleError && (
              <div role="alert" style={{ fontSize: 'var(--text-xs)', color: '#DC2626', marginTop: 4 }}>
                {titleError}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <div style={fieldLabelStyle}>Description</div>
            <textarea
              data-testid="panel-description-input"
              aria-label="Kase description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-mid)',
                borderRadius: 7, padding: '7px 10px',
                fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
                fontFamily: 'inherit', outline: 'none',
                resize: 'vertical', lineHeight: 1.5,
              }}
            />
          </div>

          {/* Save button */}
          <button
            data-testid="panel-save-btn"
            onClick={handleSave}
            disabled={!isDirty || saving}
            style={{
              width: '100%',
              fontSize: 'var(--text-sm)', fontWeight: 500,
              color: (!isDirty || saving) ? 'var(--text-tertiary)' : 'var(--bg)',
              background: (!isDirty || saving) ? 'var(--bg-secondary)' : 'var(--accent)',
              padding: '7px 12px', borderRadius: 7,
              border: '1px solid var(--border)',
              cursor: (!isDirty || saving) ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)',
              transition: 'all 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Pin toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Pin this Kase</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>
                Appears at the top of all lists
              </div>
            </div>
            <button
              aria-label={kase.isPinned ? 'Unpin this kase' : 'Pin this kase'}
              data-testid="panel-pin-toggle"
              onClick={handlePinToggle}
              disabled={pinning}
              style={{
                width: 34, height: 20,
                borderRadius: 10,
                background: kase.isPinned ? 'var(--accent)' : 'var(--border-mid)',
                border: 'none',
                cursor: pinning ? 'not-allowed' : 'pointer',
                position: 'relative',
                flexShrink: 0,
                marginLeft: '0.75rem',
                transition: 'background 0.2s',
                opacity: pinning ? 0.6 : 1,
              }}
            >
              <span style={{
                position: 'absolute',
                top: 2,
                left: kase.isPinned ? 16 : 2,
                width: 16, height: 16,
                borderRadius: '50%',
                background: 'white',
                transition: 'left 0.2s',
                display: 'block',
              }} />
            </button>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Delete */}
          <div>
            {!confirmDelete ? (
              <button
                data-testid="panel-delete-btn"
                onClick={() => setConfirmDelete(true)}
                style={{
                  fontSize: 'var(--text-sm)', color: '#B91C1C',
                  cursor: 'pointer', background: 'none', border: 'none',
                  fontFamily: 'inherit', padding: 0, textAlign: 'left',
                }}
              >
                Delete this Kase
              </button>
            ) : (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 8, padding: '0.75rem',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ fontSize: 'var(--text-sm)', color: '#7F1D1D', lineHeight: 1.5 }}>
                  <strong>Delete this Kase?</strong><br />
                  All Logs and versions will be permanently deleted.
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
                      padding: '5px 0', borderRadius: 6,
                      border: '1px solid var(--border-mid)',
                      background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    data-testid="panel-confirm-delete-btn"
                    aria-label="Confirm delete kase"
                    style={{
                      flex: 1, fontSize: 'var(--text-sm)', fontWeight: 500,
                      color: 'white', background: '#DC2626',
                      padding: '5px 0', borderRadius: 6,
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      opacity: deleting ? 0.6 : 1,
                    }}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Kase row ──────────────────────────────────────────────────────────────────

interface KaseRowProps {
  kase: KaseResponse
  isLast: boolean
  onPinToggle: (kase: KaseResponse) => void
  onManage: (kase: KaseResponse) => void
}

function KaseRow({ kase, isLast, onPinToggle, onManage }: KaseRowProps) {
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
      {/* Gear/settings icon — top-left corner, opens management panel */}
      <button
        data-testid={`settings-btn-${kase.id}`}
        aria-label={`Settings for ${kase.title}`}
        onClick={e => { e.stopPropagation(); onManage(kase) }}
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
          color: 'var(--text-tertiary)',
          opacity: hovered ? 0.7 : 0.3,
          transition: 'opacity 0.15s',
        }}
      >
        <GearIcon size={14} />
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

      {/* Right side: pin button + timestamp */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <button
          data-testid={`pin-btn-${kase.id}`}
          aria-label={kase.isPinned ? 'Unpin kase' : 'Pin kase'}
          onClick={e => { e.stopPropagation(); onPinToggle(kase) }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 4,
            opacity: kase.isPinned ? 1 : (hovered ? 0.7 : 0.25),
            transition: 'opacity 0.15s',
          }}
        >
          <PinIcon filled={kase.isPinned} size={14} />
        </button>

        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          whiteSpace: 'nowrap',
        }}>
          {activityTime}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KaseListPage() {
  const navigate = useNavigate()
  const { kaseList, loading, refresh, updateKase } = useKases()

  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [titleError, setTitleError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedKase, setSelectedKase] = useState<KaseResponse | null>(null)

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
    // Optimistic: flip immediately so the UI responds instantly
    updateKase({ ...kase, isPinned: !kase.isPinned })
    try {
      const updated = await (kase.isPinned ? kasesApi.unpin(kase.id) : kasesApi.pin(kase.id))
      updateKase(updated)  // Confirm with server response
      refresh()            // Background sync (silent — no loading flash)
    } catch {
      updateKase(kase)     // Revert to original on error
    }
  }

  function handlePanelUpdated(updated: KaseResponse) {
    setSelectedKase(updated)
    updateKase(updated)
    refresh()
  }

  function handlePanelPinToggled(updated: KaseResponse) {
    setSelectedKase(updated)
    updateKase(updated)
    refresh()
  }

  function handlePanelDeleted(_kase: KaseResponse) {
    setSelectedKase(null)
    refresh()
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
                onManage={kase => setSelectedKase(kase)}
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
                onManage={kase => setSelectedKase(kase)}
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

      {/* Kase management panel */}
      {selectedKase && (
        <KaseManagementPanel
          kase={selectedKase}
          onClose={() => setSelectedKase(null)}
          onUpdated={handlePanelUpdated}
          onPinToggled={handlePanelPinToggled}
          onDeleted={handlePanelDeleted}
        />
      )}
    </>
  )
}
