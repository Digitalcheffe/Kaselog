import { useState, useEffect, useRef } from 'react'
import { useMatch, useNavigate } from 'react-router-dom'
import { useKases } from '../contexts/KasesContext'
import { useCollections } from '../contexts/CollectionsContext'
import { useUser } from '../contexts/UserContext'
import { kases as kasesApi } from '../api/client'
import type { KaseResponse } from '../api/types'

const COLOR_MAP: Record<string, string> = {
  teal:   '#1D9E75',
  blue:   '#378ADD',
  purple: '#7F77DD',
  coral:  '#D85A30',
  amber:  '#BA7517',
}

const NAV_LIMIT = 5

interface LeftNavProps {
  onSearchOpen: () => void
}

function getInitials(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const f = firstName?.trim()[0]?.toUpperCase() ?? ''
  const l = lastName?.trim()[0]?.toUpperCase() ?? ''
  return f || l ? `${f}${l}` : 'U'
}

// ── Small inline pin icon for nav ─────────────────────────────────────────────

function NavPinIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M9.828 1.172a.5.5 0 0 0-.707 0L6.95 3.344a1 1 0 0 1-.707.293H3.5a1 1 0 0 0-.707 1.707l2 2A1 1 0 0 1 5 8.05v2.536a.5.5 0 0 0 .854.353L7.5 9.293l3.207 3.207a.5.5 0 0 0 .707-.707L8.207 8.586l1.621-1.621A3 3 0 0 0 10.657 5H12a1 1 0 0 0 .707-1.707l-2-2a1 1 0 0 0-.707-.293H9.828z"
        fill="var(--accent)"
        opacity="0.6"
      />
    </svg>
  )
}

// ── Context menu ──────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number
  y: number
  kase: KaseResponse
  onClose: () => void
  onPinToggle: (kase: KaseResponse) => void
}

function KaseContextMenu({ x, y, kase, onClose, onPinToggle }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      data-testid="kase-context-menu"
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 500,
        background: 'var(--bg)',
        border: '1px solid var(--border-mid)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        padding: '4px',
        minWidth: 160,
      }}
    >
      <button
        data-testid="context-menu-pin-action"
        onClick={() => { onPinToggle(kase); onClose() }}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '6px 10px',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          background: 'none',
          border: 'none',
          borderRadius: 5,
          cursor: 'pointer',
          fontFamily: 'var(--font)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        {kase.isPinned ? 'Unpin Kase' : 'Pin Kase'}
      </button>
    </div>
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

// ── Main nav component ────────────────────────────────────────────────────────

export default function LeftNav({ onSearchOpen }: LeftNavProps) {
  const { kaseList, refresh: refreshKases } = useKases()
  const { collectionList } = useCollections()
  const { user } = useUser()
  const navigate = useNavigate()
  const kaseMatch = useMatch('/kases/:id')
  const collectionMatch = useMatch('/collections/:id')
  const activeKaseId = kaseMatch?.params.id
  const activeCollectionId = collectionMatch?.params.id

  const [kasesOpen, setKasesOpen] = useState(true)
  const [collectionsOpen, setCollectionsOpen] = useState(true)
  const [selectedKase, setSelectedKase] = useState<KaseResponse | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; kase: KaseResponse } | null>(null)

  const initials = getInitials(user?.firstName, user?.lastName)
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Profile'

  // Split into pinned and unpinned, each capped at NAV_LIMIT
  const pinnedKases = kaseList.filter(k => k.isPinned)
  const unpinnedKases = kaseList.filter(k => !k.isPinned)

  const visiblePinned = pinnedKases.slice(0, NAV_LIMIT)
  const visibleUnpinned = unpinnedKases.slice(0, Math.max(0, NAV_LIMIT - visiblePinned.length))
  const visibleKases = [...visiblePinned, ...visibleUnpinned]
  const moreKases = kaseList.length - visibleKases.length

  const visibleCollections = collectionList.slice(0, NAV_LIMIT)
  const moreCollections = collectionList.length - NAV_LIMIT

  const hasPinnedVisible = visiblePinned.length > 0 && visibleUnpinned.length > 0

  async function handleContextMenuPinToggle(kase: KaseResponse) {
    try {
      await (kase.isPinned ? kasesApi.unpin(kase.id) : kasesApi.pin(kase.id))
      refreshKases()
    } catch { /* ignore */ }
  }

  function handleContextMenu(e: React.MouseEvent, kase: KaseResponse) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, kase })
  }

  // Panel callbacks
  function handlePanelUpdated(updated: KaseResponse) {
    setSelectedKase(updated)
    refreshKases()
  }

  function handlePanelPinToggled(updated: KaseResponse) {
    setSelectedKase(updated)
    refreshKases()
  }

  function handlePanelDeleted(kase: KaseResponse) {
    setSelectedKase(null)
    refreshKases()
    if (activeKaseId === kase.id) {
      navigate('/kases')
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  }

  const arrowStyle = (open: boolean): React.CSSProperties => ({
    fontSize: 'var(--text-xs)',
    color: 'var(--text-tertiary)',
    transition: 'transform 0.2s',
    transform: open ? 'none' : 'rotate(-90deg)',
    display: 'inline-block',
    cursor: 'pointer',
    padding: '2px 3px',
    borderRadius: 3,
    userSelect: 'none',
  })

  const newBtnStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-tertiary)',
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
  }

  const navItemStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.38rem 0.35rem 0.38rem 0.55rem',
    borderRadius: 6,
    cursor: 'pointer',
    marginBottom: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: active ? 'var(--bg-tertiary)' : 'transparent',
  })

  const navItemNameStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 'var(--text-sm)',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontWeight: active ? 500 : 400,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  })

  const navItemCountStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-tertiary)',
    flexShrink: 0,
    marginLeft: '0.3rem',
  }

  const navMoreStyle: React.CSSProperties = {
    padding: '0.25rem 0.55rem',
    fontSize: 'var(--text-xs)',
    color: 'var(--accent)',
    cursor: 'pointer',
    display: 'inline-block',
    marginBottom: '0.1rem',
    borderRadius: 5,
  }

  const navDividerStyle: React.CSSProperties = {
    height: 1,
    background: 'var(--border)',
    margin: '0.2rem 0.55rem',
  }

  const allLinkStyle: React.CSSProperties = {
    padding: '0.15rem 0.55rem 0.35rem',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    display: 'block',
    letterSpacing: '0.01em',
  }

  const chevronBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 3px',
    color: 'var(--text-tertiary)',
    fontSize: '14px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 3,
    flexShrink: 0,
  }

  return (
    <>
      <nav style={{
        width: 'var(--nav-width)',
        minWidth: 'var(--nav-width)',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '1rem 1rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            KaseLog
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1, letterSpacing: '0.02em' }}>
            private ops journal
          </div>
        </div>

        {/* Nav body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── Kases section ── */}
          <div>
            {/* Section header: arrow toggles accordion, label navigates to /kases */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.6rem 0.25rem 0.9rem',
              userSelect: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span
                  style={arrowStyle(kasesOpen)}
                  onClick={() => setKasesOpen(o => !o)}
                  role="button"
                  aria-label="Toggle Kases section"
                >
                  ▾
                </span>
                <span
                  data-testid="kases-section-header"
                  style={{ ...sectionLabelStyle, cursor: 'pointer' }}
                  onClick={() => navigate('/kases')}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  Kases
                </span>
              </div>
              <button
                style={newBtnStyle}
                onClick={() => navigate('/')}
                aria-label="New Kase"
              >
                + new
              </button>
            </div>

            {kasesOpen && (
              <div style={{ padding: '0 0.4rem 0.1rem' }}>
                {visibleKases.length === 0 && (
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', padding: '0.35rem 0.55rem', fontStyle: 'italic' }}>
                    No kases yet
                  </div>
                )}

                {/* Pinned kases */}
                {visiblePinned.map(kase => {
                  const active = activeKaseId === kase.id
                  return (
                    <div
                      key={kase.id}
                      data-testid={`nav-kase-${kase.id}`}
                      style={navItemStyle(active)}
                      onClick={() => setSelectedKase(kase)}
                      onContextMenu={e => handleContextMenu(e, kase)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: '0.3rem', flex: 1 }}>
                        <NavPinIcon size={10} />
                        <span style={navItemNameStyle(active)}>{kase.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexShrink: 0 }}>
                        <span style={navItemCountStyle}>{kase.logCount}</span>
                        <button
                          data-testid={`nav-kase-arrow-${kase.id}`}
                          aria-label={`Open ${kase.title}`}
                          onClick={e => { e.stopPropagation(); navigate(`/kases/${kase.id}`) }}
                          style={chevronBtnStyle}
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Divider between pinned and unpinned in nav */}
                {hasPinnedVisible && (
                  <div data-testid="nav-pin-divider" style={navDividerStyle} />
                )}

                {/* Unpinned kases */}
                {visibleUnpinned.map(kase => {
                  const active = activeKaseId === kase.id
                  return (
                    <div
                      key={kase.id}
                      data-testid={`nav-kase-${kase.id}`}
                      style={navItemStyle(active)}
                      onClick={() => setSelectedKase(kase)}
                      onContextMenu={e => handleContextMenu(e, kase)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
                        <span style={navItemNameStyle(active)}>{kase.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexShrink: 0 }}>
                        <span style={navItemCountStyle}>{kase.logCount}</span>
                        <button
                          data-testid={`nav-kase-arrow-${kase.id}`}
                          aria-label={`Open ${kase.title}`}
                          onClick={e => { e.stopPropagation(); navigate(`/kases/${kase.id}`) }}
                          style={chevronBtnStyle}
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  )
                })}

                {moreKases > 0 && (
                  <span
                    style={navMoreStyle}
                    onClick={() => navigate('/kases')}
                  >
                    + {moreKases} more
                  </span>
                )}

                {/* All Kases link — always visible */}
                <span
                  data-testid="all-kases-link"
                  style={allLinkStyle}
                  onClick={() => navigate('/kases')}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  All Kases →
                </span>
              </div>
            )}
          </div>

          {/* Divider between Kases and Collections sections */}
          <div style={{ borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />

          {/* ── Collections section ── */}
          <div>
            {/* Section header: arrow toggles accordion, label navigates to /collections */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.6rem 0.25rem 0.9rem',
              userSelect: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span
                  style={arrowStyle(collectionsOpen)}
                  onClick={() => setCollectionsOpen(o => !o)}
                  role="button"
                  aria-label="Toggle Collections section"
                >
                  ▾
                </span>
                <span
                  data-testid="collections-section-header"
                  style={{ ...sectionLabelStyle, cursor: 'pointer' }}
                  onClick={() => navigate('/collections')}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  Collections
                </span>
              </div>
              <button
                style={newBtnStyle}
                onClick={() => navigate('/collections/new')}
                aria-label="New Collection"
              >
                + new
              </button>
            </div>

            {collectionsOpen && (
              <div style={{ padding: '0 0.4rem 0.1rem' }}>
                {visibleCollections.length === 0 && (
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', padding: '0.35rem 0.55rem', fontStyle: 'italic' }}>
                    No collections yet
                  </div>
                )}
                {visibleCollections.map(col => {
                  const active = activeCollectionId === col.id
                  const dotColor = COLOR_MAP[col.color] ?? '#1D9E75'
                  return (
                    <div
                      key={col.id}
                      style={navItemStyle(active)}
                      onClick={() => navigate(`/collections/${col.id}`)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                        <div style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: dotColor, flexShrink: 0, marginRight: '0.4rem',
                        }} />
                        <span style={navItemNameStyle(active)}>{col.title}</span>
                      </div>
                      <span style={navItemCountStyle}>{col.itemCount}</span>
                    </div>
                  )
                })}
                {moreCollections > 0 && (
                  <span
                    style={navMoreStyle}
                    onClick={() => navigate('/collections')}
                  >
                    + {moreCollections} more
                  </span>
                )}

                {/* All Collections link — always visible */}
                <span
                  data-testid="all-collections-link"
                  style={allLinkStyle}
                  onClick={() => navigate('/collections')}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  All Collections →
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom — avatar + search */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '0.5rem 0.6rem 0.6rem',
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}>
          <button
            onClick={() => navigate('/profile')}
            aria-label="Open user profile"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.65rem', borderRadius: 7,
              background: 'transparent', border: 'none',
              cursor: 'pointer', width: '100%', fontFamily: 'var(--font)',
            }}
          >
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--text-xs)', fontWeight: 600, color: 'white',
              flexShrink: 0, letterSpacing: '-0.02em',
            }}>
              {initials}
            </div>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </span>
          </button>

          <button
            onClick={onSearchOpen}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.65rem', borderRadius: 7,
              background: 'var(--bg)', border: '1px solid var(--border-mid)',
              cursor: 'pointer', width: '100%', fontFamily: 'var(--font)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
              <line x1="8.5" y1="8.5" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
            </svg>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', flex: 1, textAlign: 'left' }}>
              Search logs...
            </span>
          </button>
        </div>
      </nav>

      {/* Context menu (rendered outside nav for correct stacking) */}
      {contextMenu && (
        <KaseContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          kase={contextMenu.kase}
          onClose={() => setContextMenu(null)}
          onPinToggle={handleContextMenuPinToggle}
        />
      )}

      {/* Kase management panel */}
      {selectedKase && (
        <KaseManagementPanel
          kase={selectedKase}
          onClose={() => setSelectedKase(null)}
          onUpdated={handlePanelUpdated}
          onDeleted={handlePanelDeleted}
          onPinToggled={handlePanelPinToggled}
        />
      )}
    </>
  )
}
