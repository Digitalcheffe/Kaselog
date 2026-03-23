import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { kases as kasesApi, timeline as timelineApi, logs as logsApi } from '../api/client'
import type { KaseResponse, TimelineEntryResponse } from '../api/types'
import { useKases } from '../contexts/KasesContext'
import NewContentModal from '../components/NewContentModal'

// ── Tag color palette ─────────────────────────────────────────────────────────

const TAG_PALETTES = ['green', 'purple', 'amber', 'blue', 'coral'] as const
type TagPalette = (typeof TAG_PALETTES)[number]

function tagColorClass(name: string): TagPalette {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (Math.imul(31, hash) + name.charCodeAt(i)) | 0
  }
  return TAG_PALETTES[Math.abs(hash) % TAG_PALETTES.length]
}

// ── Timestamp formatting ──────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) {
    return `today ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
  if (diffDays === 1) {
    return `yesterday ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ── Color map for collection dots ─────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  teal:   '#1D9E75',
  blue:   '#378ADD',
  purple: '#7F77DD',
  coral:  '#D85A30',
  amber:  '#BA7517',
}

// ── Kase settings panel ───────────────────────────────────────────────────────

interface KaseSettingsPanelProps {
  kase: KaseResponse
  entryCount: number
  onClose: () => void
  onUpdated: (k: KaseResponse) => void
  onDeleted: () => void
  onPinToggled: (k: KaseResponse) => void
}

function KaseSettingsPanel({ kase, entryCount, onClose, onUpdated, onDeleted, onPinToggled }: KaseSettingsPanelProps) {
  const [localTitle, setLocalTitle] = useState(kase.title)
  const [localDesc, setLocalDesc] = useState(kase.description ?? '')
  const [pinning, setPinning] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setLocalTitle(kase.title)
    setLocalDesc(kase.description ?? '')
  }, [kase])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleTitleBlur() {
    const t = localTitle.trim()
    if (!t || t === kase.title) return
    try {
      const updated = await kasesApi.update(kase.id, { title: t, description: localDesc.trim() || null })
      onUpdated(updated)
    } catch { /* ignore */ }
  }

  async function handleDescBlur() {
    const d = localDesc.trim()
    if (d === (kase.description ?? '')) return
    try {
      const updated = await kasesApi.update(kase.id, { title: localTitle.trim(), description: d || null })
      onUpdated(updated)
    } catch { /* ignore */ }
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

  async function handleConfirmDelete() {
    setDeleting(true)
    try {
      await kasesApi.delete(kase.id)
      onDeleted()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
      <div
        data-testid="kase-settings-panel"
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
        <div style={{
          height: 48, minHeight: 48, display: 'flex', alignItems: 'center',
          padding: '0 1rem', gap: 8,
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
            Kase settings
          </span>
          <button
            aria-label="Close settings"
            onClick={onClose}
            style={{ fontSize: 'var(--text-lg)', color: 'var(--text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Title
            </div>
            <input
              aria-label="Kase title"
              value={localTitle}
              onChange={e => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-mid)',
                borderRadius: 7, padding: '7px 10px',
                fontSize: 'var(--text-base)', color: 'var(--text-primary)',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Description
            </div>
            <textarea
              aria-label="Kase description"
              value={localDesc}
              onChange={e => setLocalDesc(e.target.value)}
              onBlur={handleDescBlur}
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

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Pin toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Pin this Kase</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>
                Pinned kases appear at the top of all lists
              </div>
            </div>
            <button
              aria-label={kase.isPinned ? 'Unpin this kase' : 'Pin this kase'}
              data-testid="settings-pin-toggle"
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
              Info
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Created</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatDate(kase.createdAt)}</span>
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Entries</span>
              <span style={{ color: 'var(--text-primary)' }}>{entryCount}</span>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          <div>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  fontSize: 'var(--text-sm)', color: '#B91C1C', cursor: 'pointer',
                  background: 'none', border: 'none', fontFamily: 'inherit',
                  padding: 0, textAlign: 'left',
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
                  <strong>Permanently delete this Kase?</strong><br />
                  All Logs, Log versions, and linked Collection items will be permanently deleted. This cannot be undone.
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
                    onClick={handleConfirmDelete}
                    disabled={deleting}
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

// ── Main component ────────────────────────────────────────────────────────────

export default function KaseViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { refresh: refreshKases } = useKases()

  const [kase, setKase] = useState<KaseResponse | null>(null)
  const [entries, setEntries] = useState<TimelineEntryResponse[]>([])
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pinnedFilterActive, setPinnedFilterActive] = useState(false)
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)

  async function handleLogPinToggle(entryId: string, currentPinned: boolean) {
    const newPinned = !currentPinned
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, isPinned: newPinned } : e))
    try {
      await logsApi.pin(entryId, { isPinned: newPinned })
    } catch {
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, isPinned: currentPinned } : e))
    }
  }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setNotFound(false)

    Promise.all([
      kasesApi.get(id).catch(() => null),
      timelineApi.list(id).catch(() => []),
    ]).then(([fetchedKase, fetchedEntries]) => {
      if (fetchedKase === null) {
        setNotFound(true)
      } else {
        setKase(fetchedKase)
        setEntries(fetchedEntries)
      }
      setLoading(false)
    })
  }, [id])

  // ── 404 state ────────────────────────────────────────────────────────────────
  if (!loading && notFound) {
    return (
      <>
        <div style={{
          height: 48, minHeight: 48,
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 1.25rem', gap: '0.75rem', flexShrink: 0,
        }}>
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Kase not found
          </div>
          <div style={{ flex: 1 }} />
        </div>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '0.5rem', color: 'var(--text-tertiary)',
        }}>
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 500, color: 'var(--text-secondary)' }}>
            This kase doesn&rsquo;t exist
          </div>
          <div style={{ fontSize: 'var(--text-base)' }}>
            It may have been deleted or the link is incorrect.
          </div>
        </div>
      </>
    )
  }

  // ── Normal render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Top bar */}
      <div style={{
        height: 48, minHeight: 48,
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 1.25rem', gap: '0.75rem', flexShrink: 0,
      }}>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {kase?.title ?? '\u2026'}
        </div>
        <div style={{
          fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)',
          padding: '2px 8px', background: 'var(--bg-secondary)',
          borderRadius: 99, border: '1px solid var(--border)',
        }}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </div>
        <div style={{ flex: 1 }} />

        {/* Pin filter toggle */}
        <button
          data-testid="pin-filter-toggle"
          aria-pressed={pinnedFilterActive}
          onClick={() => setPinnedFilterActive(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            fontSize: 'var(--text-sm)',
            color: pinnedFilterActive ? 'var(--accent)' : 'var(--text-tertiary)',
            padding: '4px 10px', borderRadius: 6,
            border: pinnedFilterActive ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: pinnedFilterActive ? 'var(--accent-light)' : 'var(--bg)',
            cursor: 'pointer', fontFamily: 'var(--font)',
            transition: 'all 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M9.828 1.172a.5.5 0 0 0-.707 0L6.95 3.344a1 1 0 0 1-.707.293H3.5a1 1 0 0 0-.707 1.707l2 2A1 1 0 0 1 5 8.05v2.536a.5.5 0 0 0 .854.353L7.5 9.293l3.207 3.207a.5.5 0 0 0 .707-.707L8.207 8.586l1.621-1.621A3 3 0 0 0 10.657 5H12a1 1 0 0 0 .707-1.707l-2-2a1 1 0 0 0-.707-.293H9.828z" />
          </svg>
          Pinned
        </button>

        {/* Settings gear */}
        <button
          aria-label="Kase settings"
          onClick={() => setSettingsOpen(o => !o)}
          style={{
            fontSize: 'var(--text-md)', color: 'var(--text-tertiary)', cursor: 'pointer',
            background: 'none', border: 'none', padding: '4px 6px',
            borderRadius: 6, lineHeight: 1, fontFamily: 'inherit',
          }}
        >
          ⚙
        </button>

        {/* + New button */}
        <button
          onClick={() => setModalOpen(true)}
          style={{
            fontSize: 'var(--text-base)', fontWeight: 500,
            color: 'var(--bg)', background: 'var(--accent)',
            padding: '5px 12px', borderRadius: 6,
            cursor: 'pointer', border: 'none', fontFamily: 'var(--font)',
          }}
        >
          + New
        </button>
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
        {loading ? (
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>Loading&hellip;</div>
        ) : (() => {
          // Apply pin + tag filters client-side
          const filtered = entries.filter(entry => {
            if (pinnedFilterActive && entry.entityType === 'log' && !entry.isPinned) return false
            if (pinnedFilterActive && entry.entityType === 'collection_item') return false
            if (activeTagFilter && entry.entityType === 'log') {
              if (!(entry.tags ?? []).includes(activeTagFilter)) return false
            }
            return true
          })

          if (filtered.length === 0) {
            if (pinnedFilterActive) return <PinnedEmptyState />
            return <EmptyState onNew={() => setModalOpen(true)} />
          }

          // Group: pinned logs float to top; rest stay in original order
          const pinnedLogs = filtered.filter(e => e.entityType === 'log' && e.isPinned)
          const otherEntries = filtered.filter(e => !(e.entityType === 'log' && e.isPinned))
          const hasPinnedSection = pinnedLogs.length > 0
          const hasOtherSection = otherEntries.length > 0

          return (
            <>
              {/* Pinned section label */}
              {hasPinnedSection && (
                <div
                  data-testid="pinned-section-label"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    paddingBottom: '0.75rem',
                    color: 'var(--accent)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M9.828 1.172a.5.5 0 0 0-.707 0L6.95 3.344a1 1 0 0 1-.707.293H3.5a1 1 0 0 0-.707 1.707l2 2A1 1 0 0 1 5 8.05v2.536a.5.5 0 0 0 .854.353L7.5 9.293l3.207 3.207a.5.5 0 0 0 .707-.707L8.207 8.586l1.621-1.621A3 3 0 0 0 10.657 5H12a1 1 0 0 0 .707-1.707l-2-2a1 1 0 0 0-.707-.293H9.828z" />
                  </svg>
                  Pinned
                </div>
              )}

              {/* Pinned log entries */}
              {pinnedLogs.map((entry, i) => (
                <LogTimelineEntry
                  key={entry.id}
                  entry={entry}
                  index={i}
                  isLast={!hasOtherSection && i === pinnedLogs.length - 1}
                  isHovered={hoveredId === entry.id}
                  onMouseEnter={() => setHoveredId(entry.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => navigate(`/logs/${entry.id}`)}
                  onPinToggle={() => handleLogPinToggle(entry.id, entry.isPinned === true)}
                />
              ))}

              {/* Separator between pinned and remaining entries */}
              {hasPinnedSection && hasOtherSection && (
                <div style={{ height: 1, background: 'var(--border)', margin: '0.25rem 0 1rem 0' }} />
              )}

              {/* Remaining entries in original order */}
              {otherEntries.map((entry, i) => {
                const globalIndex = hasPinnedSection ? pinnedLogs.length + i : i
                const isLast = i === otherEntries.length - 1
                return entry.entityType === 'log' ? (
                  <LogTimelineEntry
                    key={entry.id}
                    entry={entry}
                    index={globalIndex}
                    isLast={isLast}
                    isHovered={hoveredId === entry.id}
                    onMouseEnter={() => setHoveredId(entry.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => navigate(`/logs/${entry.id}`)}
                    onPinToggle={() => handleLogPinToggle(entry.id, entry.isPinned === true)}
                  />
                ) : (
                  <CollectionItemTimelineEntry
                    key={entry.id}
                    entry={entry}
                    index={globalIndex}
                    isLast={isLast}
                    isHovered={hoveredId === entry.id}
                    onMouseEnter={() => setHoveredId(entry.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => navigate(`/items/${entry.id}`)}
                  />
                )
              })}
            </>
          )
        })()}
      </div>

      {/* New content modal */}
      {modalOpen && kase && (
        <NewContentModal
          kaseId={kase.id}
          kaseName={kase.title}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Kase settings panel */}
      {settingsOpen && kase && (
        <KaseSettingsPanel
          kase={kase}
          entryCount={entries.length}
          onClose={() => setSettingsOpen(false)}
          onUpdated={updated => setKase(updated)}
          onDeleted={() => navigate('/')}
          onPinToggled={updated => { setKase(updated); refreshKases() }}
        />
      )}
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PinnedEmptyState() {
  return (
    <div
      data-testid="pinned-empty-state"
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingTop: '4rem', gap: '0.5rem',
      }}
    >
      <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', fontWeight: 500 }}>
        No pinned logs in this Kase
      </div>
      <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>
        Open a log's settings to pin it
      </div>
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      paddingTop: '4rem', gap: '0.75rem',
    }}>
      <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', fontWeight: 500 }}>
        No entries yet
      </div>
      <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>
        Create a log or add a collection item to start capturing work in this kase
      </div>
      <button
        onClick={onNew}
        style={{
          marginTop: '0.5rem', fontSize: 'var(--text-base)', fontWeight: 500,
          color: 'var(--bg)', background: 'var(--accent)',
          padding: '8px 20px', borderRadius: 7,
          cursor: 'pointer', border: 'none', fontFamily: 'var(--font)',
        }}
      >
        + New
      </button>
    </div>
  )
}

// ── Log timeline entry ────────────────────────────────────────────────────────

interface LogEntryProps {
  entry: TimelineEntryResponse
  index: number
  isLast: boolean
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
  onPinToggle: () => void
}

function LogTimelineEntry({ entry, index, isLast, isHovered, onMouseEnter, onMouseLeave, onClick, onPinToggle }: LogEntryProps) {
  const isNewest = index === 0
  const isPinned = entry.isPinned === true

  return (
    <div
      style={{ display: 'flex', gap: '1rem', cursor: 'pointer', paddingBottom: '1.25rem' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {/* Spine */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, width: 14, flexShrink: 0 }}>
        {/* Dot with optional pin marker */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            data-testid={isPinned ? 'pinned-dot' : 'log-dot'}
            style={{
              width: 10, height: 10, borderRadius: '50%',
              background: isNewest ? 'var(--accent)' : 'var(--bg-tertiary)',
              border: '2px solid var(--bg)',
              boxShadow: isNewest ? '0 0 0 1.5px var(--accent)' : '0 0 0 1.5px var(--border-mid)',
            }}
          />
          {isPinned && (
            <svg
              data-testid="pin-dot-marker"
              width="12" height="12"
              viewBox="0 0 16 16"
              fill="var(--accent)"
              aria-label="Pinned"
              style={{
                position: 'absolute',
                top: -7,
                left: 6,
                opacity: 0.9,
              }}
            >
              <path d="M9.828 1.172a.5.5 0 0 0-.707 0L6.95 3.344a1 1 0 0 1-.707.293H3.5a1 1 0 0 0-.707 1.707l2 2A1 1 0 0 1 5 8.05v2.536a.5.5 0 0 0 .854.353L7.5 9.293l3.207 3.207a.5.5 0 0 0 .707-.707L8.207 8.586l1.621-1.621A3 3 0 0 0 10.657 5H12a1 1 0 0 0 .707-1.707l-2-2a1 1 0 0 0-.707-.293H9.828z" />
            </svg>
          )}
        </div>
        {!isLast && (
          <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4, minHeight: '1.25rem' }} />
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, paddingBottom: '1.25rem', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <div style={{
            fontSize: 'var(--text-base)', fontWeight: 500,
            color: isHovered ? 'var(--accent)' : 'var(--text-primary)',
            flex: 1, lineHeight: 1.3, transition: 'color 0.15s',
          }}>
            {entry.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
            {(isPinned || isHovered) && (
              <button
                data-testid="pin-entry-badge"
                aria-label={isPinned ? 'Unpin log' : 'Pin log'}
                onClick={e => { e.stopPropagation(); onPinToggle() }}
                style={{
                  width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderRadius: 6, flexShrink: 0,
                  color: isPinned ? 'var(--accent)' : 'var(--text-tertiary)',
                  opacity: isPinned ? 1 : 0.6,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M9.828 1.172a.5.5 0 0 0-.707 0L6.95 3.344a1 1 0 0 1-.707.293H3.5a1 1 0 0 0-.707 1.707l2 2A1 1 0 0 1 5 8.05v2.536a.5.5 0 0 0 .854.353L7.5 9.293l3.207 3.207a.5.5 0 0 0 .707-.707L8.207 8.586l1.621-1.621A3 3 0 0 0 10.657 5H12a1 1 0 0 0 .707-1.707l-2-2a1 1 0 0 0-.707-.293H9.828z" />
                </svg>
              </button>
            )}
            <span style={{
              fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
              padding: '1px 6px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 4,
              fontFamily: 'var(--font-mono)',
            }}>
              log
            </span>
            <span style={{
              fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
              padding: '1px 6px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 4,
              fontFamily: 'var(--font-mono)',
            }}>
              v{entry.versionCount}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              {formatTimestamp(entry.updatedAt)}
            </span>
          </div>
        </div>
        {entry.description && (
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.45rem' }}>
            {entry.description}
          </div>
        )}
        {(entry.tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {(entry.tags ?? []).map(tag => (
              <span
                key={tag}
                className={`tag-${tagColorClass(tag)}`}
                style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 99, fontWeight: 500 }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Collection item timeline entry ────────────────────────────────────────────

interface CollectionItemEntryProps {
  entry: TimelineEntryResponse
  index: number
  isLast: boolean
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
}

function CollectionItemTimelineEntry({
  entry, isLast, isHovered, onMouseEnter, onMouseLeave, onClick,
}: CollectionItemEntryProps) {
  const dotColor = COLOR_MAP[entry.collectionColor ?? ''] ?? '#9a9890'

  return (
    <div
      style={{ display: 'flex', gap: '1rem', cursor: 'pointer', paddingBottom: '1.25rem' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {/* Spine — square dim dot for collection items */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, width: 14, flexShrink: 0 }}>
        <div style={{
          width: 10, height: 10, borderRadius: 3,
          background: 'var(--bg-tertiary)',
          border: '2px solid var(--bg)',
          boxShadow: '0 0 0 1.5px var(--border-mid)',
          flexShrink: 0,
        }} />
        {!isLast && (
          <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4, minHeight: '1.25rem' }} />
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, paddingBottom: '1.25rem', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
        {/* Header row: type badge + timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <span style={{
            fontSize: 'var(--text-xs)', fontWeight: 500,
            padding: '1px 7px', borderRadius: 99,
            background: '#E6F1FB', color: '#042C53',
            flexShrink: 0,
          }}>
            collection item
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {formatTimestamp(entry.updatedAt)}
          </span>
        </div>

        {/* Collection item card */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-mid)',
          borderRadius: 8,
          padding: '0.6rem 0.8rem',
          transition: 'border-color 0.15s',
          borderColor: isHovered ? 'var(--border-mid)' : undefined,
        }}>
          {/* Collection name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: dotColor, flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{entry.collectionTitle}</span>
          </div>

          {/* Item title */}
          <div style={{
            fontSize: 'var(--text-base)', fontWeight: 500,
            color: isHovered ? 'var(--accent)' : 'var(--text-primary)',
            marginBottom: (entry.summaryFields ?? []).length > 0 ? '0.35rem' : 0,
            transition: 'color 0.15s',
          }}>
            {entry.itemTitle}
          </div>

          {/* Summary fields */}
          {(entry.summaryFields ?? []).length > 0 && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {(entry.summaryFields ?? []).map(sf => (
                <div key={sf.name} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  {sf.name} <span style={{ color: 'var(--text-secondary)' }}>{sf.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
