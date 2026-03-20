import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { kases as kasesApi, logs as logsApi } from '../api/client'
import type { KaseResponse, LogResponse } from '../api/types'

// ── Tag color palette ─────────────────────────────────────────────────────────

const TAG_PALETTES = ['green', 'purple', 'amber', 'blue', 'coral'] as const
type TagPalette = (typeof TAG_PALETTES)[number]

/** Deterministic hash: same tag name always maps to the same palette. */
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function KaseViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [kase, setKase] = useState<KaseResponse | null>(null)
  const [logList, setLogList] = useState<LogResponse[]>([])
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

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

  async function handleNewLog() {
    if (!id) return
    try {
      const log = await logsApi.create(id, { title: 'New Log' })
      navigate(`/logs/${log.id}`)
    } catch {
      // silently ignore — user remains on timeline
    }
  }

  // ── 404 state ───────────────────────────────────────────────────────────────
  if (!loading && notFound) {
    return (
      <>
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
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Kase not found
          </div>
          <div style={{ flex: 1 }} />
        </div>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          color: 'var(--text-tertiary)',
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

  // ── Normal render ────────────────────────────────────────────────────────────
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
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {kase?.title ?? '\u2026'}
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          padding: '2px 8px',
          background: 'var(--bg-secondary)',
          borderRadius: 99,
          border: '1px solid var(--border)',
        }}>
          {logList.length} {logList.length === 1 ? 'log' : 'logs'}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleNewLog}
          style={{
            fontSize: 13,
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
          + New Log
        </button>
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading&hellip;</div>
        ) : logList.length === 0 ? (
          <EmptyState onNewLog={handleNewLog} />
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
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ onNewLog }: { onNewLog: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: '4rem',
      gap: '0.75rem',
    }}>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
        No logs yet
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
        Create your first log to start capturing work in this kase
      </div>
      <button
        onClick={onNewLog}
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
        + New Log
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
  log,
  index,
  isLast,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: TimelineEntryProps) {
  const isNewest = index === 0

  return (
    <div
      style={{ display: 'flex', gap: '1rem', cursor: 'pointer', paddingBottom: '1.25rem' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {/* Spine */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 4,
        width: 14,
        flexShrink: 0,
      }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: isNewest ? 'var(--accent)' : 'var(--bg-tertiary)',
          border: '2px solid var(--bg)',
          boxShadow: isNewest
            ? '0 0 0 1.5px var(--accent)'
            : '0 0 0 1.5px var(--border-mid)',
          flexShrink: 0,
        }} />
        {!isLast && (
          <div style={{
            width: 1,
            flex: 1,
            background: 'var(--border)',
            marginTop: 4,
            minHeight: '1.25rem',
          }} />
        )}
      </div>

      {/* Entry body */}
      <div style={{
        flex: 1,
        paddingBottom: '1.25rem',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
      }}>
        {/* Header row */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
          marginBottom: '0.25rem',
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 500,
            color: isHovered ? 'var(--accent)' : 'var(--text-primary)',
            flex: 1,
            lineHeight: 1.3,
            transition: 'color 0.15s',
          }}>
            {log.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            <span style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              padding: '1px 6px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
            }}>
              v{log.versionCount}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {formatTimestamp(log.updatedAt)}
            </span>
          </div>
        </div>

        {/* Description */}
        {log.description && (
          <div style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: '0.45rem',
          }}>
            {log.description}
          </div>
        )}

        {/* Tags */}
        {(log.tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {(log.tags ?? []).map(tag => (
              <span
                key={tag.id}
                className={`tag-${tagColorClass(tag.name)}`}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 99,
                  fontWeight: 500,
                }}
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
