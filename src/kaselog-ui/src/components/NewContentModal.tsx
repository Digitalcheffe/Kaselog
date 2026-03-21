import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { logs as logsApi, collections as collectionsApi } from '../api/client'
import type { CollectionResponse } from '../api/types'

const COLOR_MAP: Record<string, string> = {
  teal: '#1D9E75',
  blue: '#378ADD',
  purple: '#7F77DD',
  coral: '#D85A30',
  amber: '#BA7517',
}

type Step = 'pick' | 'log' | 'collections'

interface Props {
  kaseId: string
  kaseName: string
  onClose: () => void
}

export default function NewContentModal({ kaseId, kaseName, onClose }: Props) {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('pick')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [titleError, setTitleError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [collections, setCollections] = useState<CollectionResponse[]>([])

  const titleRef = useRef<HTMLInputElement>(null)

  // Auto-focus title when entering log step
  useEffect(() => {
    if (step === 'log') {
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [step])

  // Load collections when entering collections step
  useEffect(() => {
    if (step === 'collections') {
      collectionsApi.list().then(setCollections).catch(() => setCollections([]))
    }
  }, [step])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleCreateLog() {
    if (!title.trim()) {
      setTitleError(true)
      titleRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      const log = await logsApi.create(kaseId, {
        title: title.trim(),
        description: description.trim() || undefined,
      })
      navigate(`/logs/${log.id}`)
      onClose()
    } catch {
      setSaving(false)
    }
  }

  // Shared modal container styles
  const modalStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 10,
    background: 'var(--bg)',
    border: '1px solid var(--border-mid)',
    borderRadius: 12,
    width: 340,
    boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
    overflow: 'hidden',
    animation: 'modalIn 0.15s ease-out',
  }

  return (
    <>
      <style>{`@keyframes modalIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Backdrop */}
      <div
        data-testid="modal-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.18)',
          zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Stop click propagation inside modal */}
        <div
          role="dialog"
          aria-modal="true"
          onClick={e => e.stopPropagation()}
          style={modalStyle}
        >
          {/* ── Step 1: Pick ── */}
          {step === 'pick' && (
            <>
              <div style={{
                padding: '1rem 1.25rem 0.75rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    Add to {kaseName}
                  </div>
                </div>
                <button
                  aria-label="Close modal"
                  onClick={onClose}
                  style={{ fontSize: 18, color: 'var(--text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', lineHeight: 1, padding: 2 }}
                >
                  ×
                </button>
              </div>
              <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => setStep('log')}
                  style={{
                    padding: '0.85rem 1rem', borderRadius: 8,
                    border: '1px solid var(--border-mid)',
                    background: 'var(--bg-secondary)',
                    cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12,
                    textAlign: 'left', fontFamily: 'inherit', width: '100%',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <rect x="2" y="3" width="11" height="1.5" rx="0.75" fill="currentColor" opacity="0.5"/>
                      <rect x="2" y="6.5" width="8" height="1.5" rx="0.75" fill="currentColor" opacity="0.5"/>
                      <rect x="2" y="10" width="9.5" height="1.5" rx="0.75" fill="currentColor" opacity="0.5"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3 }}>New Log</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>A freeform note, journal entry, or session summary</div>
                  </div>
                </button>

                <button
                  onClick={() => setStep('collections')}
                  style={{
                    padding: '0.85rem 1rem', borderRadius: 8,
                    border: '1px solid var(--border-mid)',
                    background: 'var(--bg-secondary)',
                    cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12,
                    textAlign: 'left', fontFamily: 'inherit', width: '100%',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <rect x="2" y="2.5" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.5"/>
                      <rect x="8" y="2.5" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.5"/>
                      <rect x="2" y="8.5" width="5" height="4" rx="1.5" fill="currentColor" opacity="0.3"/>
                      <rect x="8" y="8.5" width="5" height="4" rx="1.5" fill="currentColor" opacity="0.3"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3 }}>Add Collection Item</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>Track a structured entry in one of your collections</div>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* ── Step 2a: New Log form ── */}
          {step === 'log' && (
            <>
              <div style={{
                padding: '1rem 1.25rem 0.75rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>New Log</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{kaseName}</div>
                </div>
                <button
                  aria-label="Close modal"
                  onClick={onClose}
                  style={{ fontSize: 18, color: 'var(--text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', lineHeight: 1, padding: 2 }}
                >
                  ×
                </button>
              </div>
              <div style={{
                padding: '0.6rem 1.25rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <button
                  onClick={() => setStep('pick')}
                  style={{ fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}
                >
                  ← back
                </button>
              </div>
              <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label
                    htmlFor="modal-log-title"
                    style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}
                  >
                    Title
                  </label>
                  <input
                    id="modal-log-title"
                    ref={titleRef}
                    value={title}
                    onChange={e => { setTitle(e.target.value); setTitleError(false) }}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateLog() }}
                    placeholder="What are you logging?"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: `1px solid ${titleError ? '#E24B4A' : 'var(--border-mid)'}`,
                      borderRadius: 7,
                      padding: '8px 11px',
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                  {titleError && (
                    <span style={{ fontSize: 11, color: '#E24B4A' }}>Title is required</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label
                    htmlFor="modal-log-desc"
                    style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}
                  >
                    Description <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10, color: 'var(--text-tertiary)' }}>optional</span>
                  </label>
                  <textarea
                    id="modal-log-desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Short summary shown on the timeline…"
                    rows={3}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-mid)',
                      borderRadius: 7,
                      padding: '8px 11px',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                      resize: 'none',
                      lineHeight: 1.5,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                  <button
                    onClick={() => setStep('pick')}
                    style={{
                      fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer',
                      padding: '5px 10px', borderRadius: 6,
                      border: '1px solid var(--border-mid)',
                      background: 'transparent', fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={handleCreateLog}
                    disabled={saving}
                    style={{
                      fontSize: 12, fontWeight: 500, color: 'white',
                      background: 'var(--accent)', padding: '6px 16px',
                      borderRadius: 6, cursor: 'pointer', border: 'none',
                      fontFamily: 'inherit', opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? 'Creating…' : 'Create Log →'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 2b: Collection picker ── */}
          {step === 'collections' && (
            <>
              <div style={{
                padding: '1rem 1.25rem 0.75rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Add Collection Item</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{kaseName}</div>
                </div>
                <button
                  aria-label="Close modal"
                  onClick={onClose}
                  style={{ fontSize: 18, color: 'var(--text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', lineHeight: 1, padding: 2 }}
                >
                  ×
                </button>
              </div>
              <div style={{
                padding: '0.6rem 1.25rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <button
                  onClick={() => setStep('pick')}
                  style={{ fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}
                >
                  ← back
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Choose a collection</span>
              </div>
              <div style={{ padding: '0.5rem 0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {collections.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '0.5rem 0.65rem' }}>
                    No collections yet.
                  </div>
                )}
                {collections.map(col => (
                  <button
                    key={col.id}
                    onClick={() => {
                      navigate(`/items/new?collectionId=${col.id}&kaseId=${kaseId}`)
                      onClose()
                    }}
                    style={{
                      padding: '0.55rem 0.65rem', borderRadius: 7,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                      background: 'transparent', border: 'none', width: '100%',
                      textAlign: 'left', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: COLOR_MAP[col.color] ?? '#1D9E75', flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{col.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{col.itemCount} items</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', opacity: 0.5 }}>›</span>
                  </button>
                ))}
                <div style={{ padding: '0.5rem 0.65rem' }}>
                  <button
                    onClick={() => { navigate('/collections/new'); onClose() }}
                    style={{
                      fontSize: 11, color: 'var(--accent)', cursor: 'pointer',
                      background: 'none', border: 'none', fontFamily: 'inherit', padding: 0,
                    }}
                  >
                    + Create new collection
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
