import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { kases as kasesApi, logs as logsApi } from '../api/client'
import type { KaseResponse, LogResponse } from '../api/types'
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

// ── Kase settings panel ───────────────────────────────────────────────────────

interface KaseSettingsPanelProps {
  kase: KaseResponse
  logCount: number
  onClose: () => void
  onUpdated: (k: KaseResponse) => void
  onDeleted: () => void
}

function KaseSettingsPanel({ kase, logCount, onClose, onUpdated, onDeleted }: KaseSettingsPanelProps) {
  const [localTitle, setLocalTitle] = useState(kase.title)
  const [localDesc, setLocalDesc] = useState(kase.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Sync if kase prop changes
  useEffect(() => {
    setLocalTitle(kase.title)
    setLocalDesc(kase.description ?? '')
  }, [kase])

  // Close on Escape
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
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 200 }}
      />
      {/* Panel */}
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
        {/* Header */}
        <div style={{
          height: 48, minHeight: 48, display: 'flex', alignItems: 'center',
          padding: '0 1rem', gap: 8,
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
            Kase settings
          </span>
          <button
            aria-label="Close settings"
            onClick={onClose}
            style={{ fontSize: 18, color: 'var(--text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          {/* Title */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
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
                fontSize: 13, color: 'var(--text-primary)',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          {/* Description */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
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
                fontSize: 12, color: 'var(--text-primary)',
                fontFamily: 'inherit', outline: 'none',
                resize: 'vertical', lineHeight: 1.5,
              }}
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
              Info
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Created</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatDate(kase.createdAt)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Logs</span>
              <span style={{ color: 'var(--text-primary)' }}>{logCount}</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Delete */}
          <div>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  fontSize: 12, color: '#B91C1C', cursor: 'pointer',
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
                <div style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.5 }}>
                  <strong>Permanently delete this Kase?</strong><br />
                  All Logs, Log versions, and linked Collection items will be permanently deleted. This cannot be undone.
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      flex: 1, fontSize: 12, color: 'var(--text-secondary)',
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
                      flex: 1, fontSize: 12, fontWeight: 500,
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

  const [kase, setKase] = useState<KaseResponse | null>(null)
  const [logList, setLogList] = useState<LogResponse[]>([])
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setNotFound(false)

    Promise.all([
      kasesApi.get(id).catch(() => null),
      logsApi.listByKase(id).catch(() => []),
    ]).then(([fetchedKase, fetchedLogs]) => {
      if (fetchedKase === null) {
        setNotFound(true)
      } else {
        setKase(fetchedKase)
        setLogList(fetchedLogs)
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
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Kase not found
          </div>
          <div style={{ flex: 1 }} />
        </div>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '0.5rem', color: 'var(--text-tertiary)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)' }}>
            This kase doesn&rsquo;t exist
          </div>
          <div style={{ fontSize: 13 }}>
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
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {kase?.title ?? '\u2026'}
        </div>
        <div style={{
          fontSize: 12, color: 'var(--text-tertiary)',
          padding: '2px 8px', background: 'var(--bg-secondary)',
          borderRadius: 99, border: '1px solid var(--border)',
        }}>
          {logList.length} {logList.length === 1 ? 'log' : 'logs'}
        </div>
        <div style={{ flex: 1 }} />

        {/* Settings gear */}
        <button
          aria-label="Kase settings"
          onClick={() => setSettingsOpen(o => !o)}
          style={{
            fontSize: 15, color: 'var(--text-tertiary)', cursor: 'pointer',
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
            fontSize: 13, fontWeight: 500,
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
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading&hellip;</div>
        ) : logList.length === 0 ? (
          <EmptyState onNew={() => setModalOpen(true)} />
        ) : (
          logList.map((log, i) => (
            <TimelineEntry
              key={log.id}
              log={log}
              index={i}
              isLast={i === logList.length - 1}
              isHovered={hoveredId === log.id}
              onMouseEnter={() => setHoveredId(log.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => navigate(`/logs/${log.id}`)}
            />
          ))
        )}
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
          logCount={logList.length}
          onClose={() => setSettingsOpen(false)}
          onUpdated={updated => setKase(updated)}
          onDeleted={() => navigate('/')}
        />
      )}
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      paddingTop: '4rem', gap: '0.75rem',
    }}>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
        No logs yet
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
        Create your first log to start capturing work in this kase
      </div>
      <button
        onClick={onNew}
        style={{
          marginTop: '0.5rem', fontSize: 13, fontWeight: 500,
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

interface TimelineEntryProps {
  log: LogResponse
  index: number
  isLast: boolean
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
}

function TimelineEntry({
  log, index, isLast, isHovered, onMouseEnter, onMouseLeave, onClick,
}: TimelineEntryProps) {
  const isNewest = index === 0

  return (
    <div
      style={{ display: 'flex', gap: '1rem', cursor: 'pointer', paddingBottom: '1.25rem' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', paddingTop: 4,
        width: 14, flexShrink: 0,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: isNewest ? 'var(--accent)' : 'var(--bg-tertiary)',
          border: '2px solid var(--bg)',
          boxShadow: isNewest ? '0 0 0 1.5px var(--accent)' : '0 0 0 1.5px var(--border-mid)',
          flexShrink: 0,
        }} />
        {!isLast && (
          <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4, minHeight: '1.25rem' }} />
        )}
      </div>
      <div style={{
        flex: 1, paddingBottom: '1.25rem',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <div style={{
            fontSize: 14, fontWeight: 500,
            color: isHovered ? 'var(--accent)' : 'var(--text-primary)',
            flex: 1, lineHeight: 1.3, transition: 'color 0.15s',
          }}>
            {log.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            <span style={{
              fontSize: 11, color: 'var(--text-tertiary)',
              padding: '1px 6px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 4,
              fontFamily: 'var(--font-mono)',
            }}>
              v{log.versionCount}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {formatTimestamp(log.updatedAt)}
            </span>
          </div>
        </div>
        {log.description && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.45rem' }}>
            {log.description}
          </div>
        )}
        {(log.tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {(log.tags ?? []).map(tag => (
              <span
                key={tag.id}
                className={`tag-${tagColorClass(tag.name)}`}
                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 500 }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
