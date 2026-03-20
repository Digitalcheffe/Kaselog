import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { logs as logsApi } from '../api/client'
import type { LogResponse } from '../api/types'

export default function LogViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [log, setLog] = useState<LogResponse | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    logsApi.get(id).then(setLog).catch(() => {})
  }, [id])

  async function handleNewLog() {
    if (!log) return
    try {
      const created = await logsApi.create(log.kaseId, { title: 'New Log' })
      navigate(`/logs/${created.id}`)
    } catch {
      // silently ignore
    }
  }

  if (!log) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</p>
      </div>
    )
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
        gap: '0.5rem',
        background: 'var(--bg)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(`/kases/${log.kaseId}`)}
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 5,
            background: 'transparent',
            border: 'none',
            fontFamily: 'var(--font)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          ← Kase
        </button>
        <span style={{ fontSize: 12, color: 'var(--border-mid)', flexShrink: 0 }}>/</span>
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}>
          {log.title}
        </span>
        <div style={{ flex: 1, minWidth: '0.5rem' }} />
        <span style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          padding: '3px 9px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 5,
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          v{log.versionCount} · history
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          saved just now
        </span>
        <button
          onClick={handleNewLog}
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'white',
            background: 'var(--accent)',
            padding: '5px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
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
          flexShrink: 0,
        }}>
          K
        </div>
      </div>

      {/* Editor area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Editor column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Toolbar placeholder */}
          <div style={{
            borderBottom: '1px solid var(--border)',
            padding: '0 1.5rem',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg)',
            height: 36,
            minHeight: 36,
            flexShrink: 0,
            gap: '2px',
            overflowX: 'auto',
          }}>
            {['H1','H2','H3'].map(t => (
              <span key={t} style={{ padding: '4px 7px', borderRadius: 5, fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', cursor: 'pointer' }}>{t}</span>
            ))}
            <span style={{ width: 1, height: 14, background: 'var(--border-mid)', margin: '0 3px' }} />
            {['≡','1.','☐'].map(t => (
              <span key={t} style={{ padding: '4px 7px', borderRadius: 5, fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', cursor: 'pointer' }}>{t}</span>
            ))}
            <span style={{ width: 1, height: 14, background: 'var(--border-mid)', margin: '0 3px' }} />
            {['</>', '"', '▶', '∑'].map(t => (
              <span key={t} style={{ padding: '4px 7px', borderRadius: 5, fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', cursor: 'pointer' }}>{t}</span>
            ))}
            <span style={{ width: 1, height: 14, background: 'var(--border-mid)', margin: '0 3px' }} />
            {['↩','↪'].map(t => (
              <span key={t} style={{ padding: '4px 7px', borderRadius: 5, fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', cursor: 'pointer' }}>{t}</span>
            ))}
          </div>

          {/* Canvas */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '2.5rem 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <div style={{ width: '100%', maxWidth: 680, padding: '0 3rem' }}>
              <h1 style={{
                fontSize: 26,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
                lineHeight: 1.2,
                marginBottom: '0.4rem',
                fontFamily: 'var(--font)',
              }}>
                {log.title}
              </h1>
              <div style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                marginBottom: '2rem',
              }}>
                <span>{new Date(log.updatedAt).toLocaleString()}</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border-mid)', display: 'inline-block' }} />
                <span>version {log.versionCount} of {log.versionCount}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                {log.content
                  ? log.content
                  : <em style={{ color: 'var(--text-tertiary)' }}>Start writing…</em>
                }
              </div>
            </div>
          </div>
        </div>

        {/* Settings panel */}
        {panelOpen && (
          <div style={{
            width: 260,
            minWidth: 260,
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-mid)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Log settings</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>Info</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Created {new Date(log.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edge tab */}
        <div style={{
          position: 'absolute',
          right: panelOpen ? 260 : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 30,
          transition: 'right 0.25s ease',
        }}>
          <div
            onClick={() => setPanelOpen(o => !o)}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-mid)',
              borderRight: 'none',
              borderRadius: '8px 0 0 8px',
              padding: '0.6rem 0.35rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              boxShadow: '-2px 0 8px rgba(0,0,0,0.06)',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1 }}>
              {panelOpen ? '›' : '‹'}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 2.5, height: 2.5, borderRadius: '50%', background: 'var(--text-tertiary)', opacity: 0.5 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
