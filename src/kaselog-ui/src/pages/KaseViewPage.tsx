import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { kases as kasesApi, logs as logsApi } from '../api/client'
import type { KaseResponse, LogResponse } from '../api/types'

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) {
    return `today ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
  if (diffDays === 1) {
    return `yesterday ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function KaseViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [kase, setKase] = useState<KaseResponse | null>(null)
  const [logList, setLogList] = useState<LogResponse[]>([])

  useEffect(() => {
    if (!id) return
    kasesApi.get(id).then(setKase).catch(() => {})
    logsApi.listByKase(id).then(setLogList).catch(() => {})
  }, [id])

  async function handleNewLog() {
    if (!id) return
    try {
      const log = await logsApi.create(id, { title: 'New Log' })
      navigate(`/logs/${log.id}`)
    } catch {
      // silently ignore
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
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {kase?.title ?? '…'}
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          padding: '2px 8px',
          background: 'var(--bg-secondary)',
          borderRadius: 99,
          border: '1px solid var(--border)',
        }}>
          {kase?.logCount ?? 0} logs
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleNewLog}
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
          + New Log
        </button>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--accent-light)',
          border: '1px solid var(--border-mid)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--accent-text)',
          cursor: 'pointer',
        }}>
          K
        </div>
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
        {logList.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            No logs yet. Click &ldquo;+ New Log&rdquo; to get started.
          </p>
        ) : (
          logList.map((log, i) => (
            <div
              key={log.id}
              style={{ display: 'flex', gap: '1rem', cursor: 'pointer' }}
              onClick={() => navigate(`/logs/${log.id}`)}
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
                  background: i === 0 ? 'var(--accent)' : 'var(--bg-tertiary)',
                  border: '2px solid var(--bg)',
                  boxShadow: i === 0
                    ? '0 0 0 1.5px var(--accent)'
                    : '0 0 0 1.5px var(--border-mid)',
                  flexShrink: 0,
                }} />
                {i < logList.length - 1 && (
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
                borderBottom: i < logList.length - 1 ? '1px solid var(--border)' : 'none',
                marginBottom: 0,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  marginBottom: '0.25rem',
                }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    flex: 1,
                    lineHeight: 1.3,
                  }}>
                    {log.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      padding: '1px 6px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      v{log.versionCount}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      {formatTimestamp(log.updatedAt)}
                    </span>
                  </div>
                </div>
                {log.description && (
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    marginBottom: '0.45rem',
                  }}>
                    {log.description}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
