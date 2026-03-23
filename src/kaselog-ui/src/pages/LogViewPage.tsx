import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { kases as kasesApi, logs as logsApi, versions as versionsApi, tags as tagsApi, images as imagesApi } from '../api/client'
import type { KaseResponse, LogResponse, LogVersionResponse, TagResponse } from '../api/types'
import TiptapEditor from '../components/TiptapEditor'

// ── Tag color palette (same as KaseViewPage) ──────────────────────────────────

const TAG_PALETTES = [
  { bg: 'var(--accent-light)', color: 'var(--accent-text)' },
  { bg: '#EEEDFE', color: '#26215C' },
  { bg: '#FAEEDA', color: '#412402' },
  { bg: '#E3F0FD', color: '#153058' },
  { bg: '#FDEAE4', color: '#5A1A0A' },
]

function tagStyle(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (Math.imul(31, hash) + name.charCodeAt(i)) | 0
  }
  return TAG_PALETTES[Math.abs(hash) % TAG_PALETTES.length]
}

// ── Timestamp ─────────────────────────────────────────────────────────────────

function formatTs(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  const hm = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  if (diffDays === 0) return `today ${hm}`
  if (diffDays === 1) return `yesterday ${hm}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

// ── SP helpers ────────────────────────────────────────────────────────────────

function SpLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      marginBottom: '0.3rem',
    }}>
      {children}
    </div>
  )
}

function SpInput({
  value,
  placeholder,
  onBlur,
  onChange,
  ariaLabel,
}: {
  value: string
  placeholder?: string
  onBlur?: (val: string) => void
  onChange?: (val: string) => void
  ariaLabel?: string
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  return (
    <input
      aria-label={ariaLabel}
      value={local}
      placeholder={placeholder}
      onChange={(e) => { setLocal(e.target.value); onChange?.(e.target.value) }}
      onBlur={() => onBlur?.(local)}
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border-mid)',
        borderRadius: 6,
        padding: '0.4rem 0.6rem',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font)',
        width: '100%',
        outline: 'none',
      }}
    />
  )
}

function SpDivider() {
  return <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }} />
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LogViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [log, setLog] = useState<LogResponse | null>(null)
  const [kase, setKase] = useState<KaseResponse | null>(null)
  const [versions, setVersions] = useState<LogVersionResponse[]>([])
  const [notFound, setNotFound] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  // Editor content state
  const [editorContent, setEditorContent] = useState('')
  const [pendingContent, setPendingContent] = useState('')
  const hasPendingRef = useRef(false)

  // Save status
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [unsaved, setUnsaved] = useState(false)

  // Settings panel state
  const [spTitle, setSpTitle] = useState('')
  const [spDesc, setSpDesc] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [availableTags, setAvailableTags] = useState<TagResponse[]>([])
  const [tagDropdownVisible, setTagDropdownVisible] = useState(false)
  const [checkpointLabel, setCheckpointLabel] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Autosave timer
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load data ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    setNotFound(false)

    logsApi.get(id).then((l) => {
      setLog(l)
      setEditorContent(l.content)
      setPendingContent(l.content)
      setSpTitle(l.title)
      setSpDesc(l.description ?? '')
      setLastSavedAt(l.updatedAt)
      setUnsaved(false)
      kasesApi.get(l.kaseId).then(setKase).catch(() => {})
    }).catch(() => setNotFound(true))

    versionsApi.list(id).then(setVersions).catch(() => {})
  }, [id])

  // ── Load available tags when panel opens ────────────────────────────────────

  useEffect(() => {
    if (!panelOpen) return
    tagsApi.list().then(setAvailableTags).catch(() => {})
  }, [panelOpen])

  // ── Autosave on unmount ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      if (hasPendingRef.current && log?.autosaveEnabled && id) {
        void versionsApi.create(id, { content: pendingContent, isAutosave: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Content change from editor ───────────────────────────────────────────────

  const handleContentChange = useCallback((markdown: string) => {
    setPendingContent(markdown)
    hasPendingRef.current = true

    if (!log?.autosaveEnabled) {
      setUnsaved(true)
      return
    }

    // Debounce autosave 2s
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      if (!id) return
      try {
        const v = await versionsApi.create(id, { content: markdown, isAutosave: true })
        setLastSavedAt(v.createdAt)
        setUnsaved(false)
        hasPendingRef.current = false
        // Refresh versions list
        versionsApi.list(id).then(setVersions).catch(() => {})
        // Update log versionCount
        logsApi.get(id).then((updated) => {
          setLog(updated)
        }).catch(() => {})
      } catch {
        // silently ignore save errors
      }
    }, 2000)
  }, [id, log?.autosaveEnabled])

  // ── Manual save ─────────────────────────────────────────────────────────────

  async function handleManualSave() {
    if (!id || !log) return
    try {
      const v = await versionsApi.create(id, { content: pendingContent, isAutosave: false })
      setLastSavedAt(v.createdAt)
      setUnsaved(false)
      hasPendingRef.current = false
      versionsApi.list(id).then(setVersions).catch(() => {})
      logsApi.get(id).then(setLog).catch(() => {})
    } catch {
      // silently ignore
    }
  }

  // ── Image upload ─────────────────────────────────────────────────────────────

  async function handleImageUpload(file: File): Promise<string> {
    const result = await imagesApi.upload(file)
    return result.url
  }

  // ── New Log ──────────────────────────────────────────────────────────────────

  async function handleNewLog() {
    if (!log) return
    try {
      const created = await logsApi.create(log.kaseId, { title: 'New Log' })
      navigate(`/logs/${created.id}`)
    } catch {
      // silently ignore
    }
  }

  // ── Title blur (canvas) ──────────────────────────────────────────────────────

  async function handleTitleBlur(val: string) {
    if (!id || !log || val === log.title) return
    try {
      const updated = await logsApi.update(id, {
        title: val,
        description: log.description,
        autosaveEnabled: log.autosaveEnabled,
      })
      setLog(updated)
    } catch {
      // silently ignore
    }
  }

  // ── Settings panel: title blur ───────────────────────────────────────────────

  async function handleSpTitleBlur(val: string) {
    if (!id || !log || val === log.title) return
    try {
      const updated = await logsApi.update(id, {
        title: val,
        description: log.description,
        autosaveEnabled: log.autosaveEnabled,
      })
      setLog(updated)
    } catch {
      // silently ignore
    }
  }

  // ── Settings panel: description blur ────────────────────────────────────────

  async function handleSpDescBlur(val: string) {
    if (!id || !log || val === (log.description ?? '')) return
    try {
      const updated = await logsApi.update(id, {
        title: log.title,
        description: val || null,
        autosaveEnabled: log.autosaveEnabled,
      })
      setLog(updated)
    } catch {
      // silently ignore
    }
  }

  // ── Settings panel: autosave toggle ─────────────────────────────────────────

  async function handleAutosaveToggle() {
    if (!id || !log) return
    try {
      const updated = await logsApi.update(id, {
        title: log.title,
        description: log.description,
        autosaveEnabled: !log.autosaveEnabled,
      })
      setLog(updated)
    } catch {
      // silently ignore
    }
  }

  // ── Settings panel: pin toggle ───────────────────────────────────────────────

  async function handlePinToggle() {
    if (!id || !log) return
    try {
      const updated = await logsApi.pin(id, { isPinned: !log.isPinned })
      setLog(updated)
    } catch {
      // silently ignore
    }
  }

  // ── Add tag ──────────────────────────────────────────────────────────────────

  async function handleAddTag(name: string) {
    if (!id || !name.trim()) return
    try {
      const tag = await tagsApi.addToLog(id, name.trim())
      setLog((prev) => prev ? { ...prev, tags: [...(prev.tags ?? []), tag] } : prev)
      setTagInput('')
    } catch {
      // silently ignore
    }
  }

  // ── Remove tag ───────────────────────────────────────────────────────────────

  async function handleRemoveTag(tagId: string) {
    if (!id) return
    try {
      await tagsApi.removeFromLog(id, tagId)
      setLog((prev) => prev ? { ...prev, tags: (prev.tags ?? []).filter(t => t.id !== tagId) } : prev)
    } catch {
      // silently ignore
    }
  }

  // ── Named checkpoint ─────────────────────────────────────────────────────────

  async function handleSaveCheckpoint() {
    if (!id) return
    const label = checkpointLabel.trim() || undefined
    try {
      await versionsApi.create(id, { content: pendingContent, label, isAutosave: false })
      setCheckpointLabel('')
      setLastSavedAt(new Date().toISOString())
      setUnsaved(false)
      hasPendingRef.current = false
      versionsApi.list(id).then(setVersions).catch(() => {})
      logsApi.get(id).then(setLog).catch(() => {})
    } catch {
      // silently ignore
    }
  }

  // ── Restore version ──────────────────────────────────────────────────────────

  async function handleRestoreVersion(versionId: string) {
    if (!id) return
    try {
      const restored = await versionsApi.restore(id, versionId)
      setEditorContent(restored.content)
      setPendingContent(restored.content)
      setLastSavedAt(restored.createdAt)
      setUnsaved(false)
      hasPendingRef.current = false
      versionsApi.list(id).then(setVersions).catch(() => {})
      logsApi.get(id).then(setLog).catch(() => {})
    } catch {
      // silently ignore
    }
  }

  // ── Delete log ───────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!id || !log) return
    try {
      await logsApi.delete(id)
      navigate(`/kases/${log.kaseId}`)
    } catch {
      // silently ignore
    }
  }

  // ── Render: not found ────────────────────────────────────────────────────────

  if (notFound) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <p style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>Log not found</p>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>This log may have been deleted.</p>
        <button
          onClick={() => navigate('/')}
          style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
        >
          ← Back to Kases
        </button>
      </div>
    )
  }

  if (!log) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>Loading…</p>
      </div>
    )
  }

  const saveStatusText = log.autosaveEnabled
    ? (lastSavedAt ? `saved ${timeAgo(lastSavedAt)}` : 'not saved yet')
    : (unsaved ? 'unsaved changes' : lastSavedAt ? `saved ${timeAgo(lastSavedAt)}` : '')

  return (
    <>
      {/* ── Top bar ── */}
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
            fontSize: 'var(--text-base)',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 5,
            background: 'transparent',
            border: 'none',
            fontFamily: 'var(--font)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--accent)'; (e.target as HTMLElement).style.background = 'var(--accent-light)' }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--text-tertiary)'; (e.target as HTMLElement).style.background = 'transparent' }}
        >
          ← {kase?.title ?? 'Kase'}
        </button>
        <span style={{ fontSize: 'var(--text-base)', color: 'var(--border-mid)', flexShrink: 0 }}>/</span>
        <span
          data-testid="topbar-log-title"
          style={{
            fontSize: 'var(--text-base)',
            fontWeight: 500,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {log.title}
        </span>
        <div style={{ flex: 1, minWidth: '0.5rem' }} />
        <span style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          padding: '3px 9px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 5,
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          cursor: 'pointer',
        }}
          onClick={() => setPanelOpen(true)}
        >
          v{log.versionCount} · history
        </span>
        <span style={{
          fontSize: 'var(--text-xs)',
          color: unsaved && !log.autosaveEnabled ? '#BA7517' : 'var(--text-tertiary)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {saveStatusText}
        </span>
        {!log.autosaveEnabled && (
          <button
            onClick={handleManualSave}
            style={{
              fontSize: 'var(--text-base)',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-mid)',
              padding: '5px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontFamily: 'var(--font)',
            }}
          >
            Save
          </button>
        )}
        <button
          onClick={handleNewLog}
          style={{
            fontSize: 'var(--text-base)',
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
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          color: 'var(--accent-text)',
          cursor: 'pointer',
          flexShrink: 0,
        }}>
          K
        </div>
      </div>

      {/* ── Editor area ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* ── Editor column ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ── Canvas ── */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '2.5rem 3rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}>
            <div style={{ width: '100%', maxWidth: 'var(--editor-max-width)' }}>
              {/* Log title */}
              <TitleInput
                value={log.title}
                onBlur={handleTitleBlur}
              />

              {/* Meta line */}
              <div style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                marginBottom: '1.5rem',
              }}>
                <span>{formatTs(log.updatedAt)}</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border-mid)', display: 'inline-block' }} />
                {kase && <span>{kase.title}</span>}
                {kase && <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border-mid)', display: 'inline-block' }} />}
                <span>version {log.versionCount} of {log.versionCount}</span>
              </div>

              {/* Tiptap editor */}
              <TiptapEditor
                content={editorContent}
                onChange={handleContentChange}
                onImageUpload={handleImageUpload}
              />
            </div>
          </div>
        </div>

        {/* ── Settings panel ── */}
        <div style={{
          width: panelOpen ? 260 : 0,
          minWidth: panelOpen ? 260 : 0,
          background: 'var(--bg-secondary)',
          borderLeft: panelOpen ? '1px solid var(--border-mid)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
          transition: 'width 0.25s ease, min-width 0.25s ease',
        }}>
          {panelOpen && (
            <>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--text-primary)' }}>Log settings</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Title */}
                <div>
                  <SpLabel>Title</SpLabel>
                  <SpInput value={spTitle} onChange={setSpTitle} onBlur={handleSpTitleBlur} ariaLabel="Panel title" />
                </div>

                {/* Description */}
                <div>
                  <SpLabel>Description</SpLabel>
                  <SpInput
                    value={spDesc}
                    placeholder="Shows as preview on timeline…"
                    onChange={setSpDesc}
                    onBlur={handleSpDescBlur}
                  />
                </div>

                {/* Tags */}
                <div>
                  <SpLabel>Tags</SpLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.4rem' }}>
                    {(log.tags ?? []).map((t: TagResponse) => {
                      const s = tagStyle(t.name)
                      return (
                        <span
                          key={t.id}
                          style={{
                            fontSize: 'var(--text-xs)',
                            fontWeight: 500,
                            padding: '2px 7px',
                            borderRadius: 99,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            background: s.bg,
                            color: s.color,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.name}
                          <span
                            style={{ opacity: 0.5, cursor: 'pointer', marginLeft: 2 }}
                            onClick={() => handleRemoveTag(t.id)}
                          >✕</span>
                        </span>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', position: 'relative' }}>
                    <input
                      value={tagInput}
                      placeholder="add tag…"
                      onChange={(e) => setTagInput(e.target.value)}
                      onFocus={() => setTagDropdownVisible(true)}
                      onBlur={() => setTagDropdownVisible(false)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                          e.preventDefault()
                          void handleAddTag(tagInput)
                        }
                      }}
                      style={{
                        flex: 1,
                        background: 'var(--bg)',
                        border: '1px solid var(--border-mid)',
                        borderRadius: 5,
                        padding: '0.3rem 0.5rem',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font)',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => { if (tagInput.trim()) void handleAddTag(tagInput) }}
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border-mid)',
                        borderRadius: 5,
                        padding: '0.3rem 0.6rem',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      +
                    </button>
                    {tagDropdownVisible && (() => {
                      const currentNames = new Set((log.tags ?? []).map(t => t.name.toLowerCase()))
                      const filtered = availableTags.filter(t =>
                        t.name.toLowerCase().includes(tagInput.toLowerCase()) &&
                        !currentNames.has(t.name.toLowerCase())
                      )
                      return filtered.length > 0 ? (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 36,
                          background: 'var(--bg)',
                          border: '1px solid var(--border-mid)',
                          borderRadius: 5,
                          marginTop: 2,
                          zIndex: 100,
                          overflow: 'hidden',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}>
                          {filtered.map(t => (
                            <div
                              key={t.id}
                              onMouseDown={(e) => { e.preventDefault(); void handleAddTag(t.name) }}
                              style={{
                                padding: '0.35rem 0.5rem',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)' }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                            >
                              {t.name}
                            </div>
                          ))}
                        </div>
                      ) : null
                    })()}
                  </div>
                </div>

                <SpDivider />

                {/* Autosave toggle */}
                <div>
                  <SpLabel>Autosave</SpLabel>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>Save automatically</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>
                        {log.autosaveEnabled
                          ? (lastSavedAt ? `Last saved ${timeAgo(lastSavedAt)}` : 'Enabled')
                          : 'Manual saves only'}
                      </div>
                    </div>
                    <div
                      data-testid="autosave-toggle"
                      onClick={handleAutosaveToggle}
                      style={{
                        width: 32,
                        height: 18,
                        borderRadius: 9,
                        background: log.autosaveEnabled ? 'var(--accent)' : 'var(--border-mid)',
                        position: 'relative',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'background 0.2s',
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: 2,
                        [log.autosaveEnabled ? 'right' : 'left']: 2,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: 'white',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'right 0.2s, left 0.2s',
                      }} />
                    </div>
                  </div>
                </div>

                {/* Pin toggle */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>Pin this log</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>
                        Show in pinned filter on this Kase&rsquo;s timeline
                      </div>
                    </div>
                    <div
                      data-testid="log-pin-toggle"
                      aria-label={log.isPinned ? 'Unpin this log' : 'Pin this log'}
                      role="switch"
                      aria-checked={log.isPinned}
                      onClick={handlePinToggle}
                      style={{
                        width: 32,
                        height: 18,
                        borderRadius: 9,
                        background: log.isPinned ? 'var(--accent)' : 'var(--border-mid)',
                        position: 'relative',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'background 0.2s',
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: 2,
                        [log.isPinned ? 'right' : 'left']: 2,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: 'white',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'right 0.2s, left 0.2s',
                      }} />
                    </div>
                  </div>
                </div>

                <SpDivider />

                {/* Version history */}
                <div>
                  <SpLabel>Version history</SpLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: '0.5rem' }}>
                    {versions.map((v, i) => (
                      <div
                        key={v.id}
                        data-testid={`version-entry-${v.id}`}
                        onClick={() => { if (i > 0) void handleRestoreVersion(v.id) }}
                        style={{
                          padding: '0.45rem 0.55rem',
                          borderRadius: 5,
                          cursor: i === 0 ? 'default' : 'pointer',
                          border: i === 0 ? '1px solid var(--border-mid)' : 'none',
                          background: i === 0 ? 'var(--bg)' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.1rem' }}>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            v{versions.length - i}
                          </span>
                          {i === 0 && (
                            <span style={{
                              fontSize: 'var(--text-xs)', padding: '1px 5px', borderRadius: 99, fontWeight: 500,
                              background: 'var(--accent-light)', color: 'var(--accent-text)',
                            }}>
                              current
                            </span>
                          )}
                          {v.label && (
                            <span style={{
                              fontSize: 'var(--text-xs)', padding: '1px 5px', borderRadius: 99, fontWeight: 500,
                              background: '#FAEEDA', color: '#412402',
                            }}>
                              {v.label}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                          {formatTs(v.createdAt)} · {v.isAutosave ? 'autosaved' : v.label ? 'checkpoint' : 'saved'}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Named checkpoint */}
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <input
                      value={checkpointLabel}
                      placeholder="checkpoint label…"
                      onChange={(e) => setCheckpointLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveCheckpoint() }}
                      style={{
                        flex: 1,
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 5,
                        padding: '0.35rem 0.5rem',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-tertiary)',
                        fontFamily: 'var(--font)',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => void handleSaveCheckpoint()}
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 5,
                        padding: '0.35rem 0.5rem',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      + checkpoint
                    </button>
                  </div>
                </div>

                <SpDivider />

                {/* Info */}
                <div>
                  <SpLabel>Info</SpLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {[
                      { key: 'Created', val: formatTs(log.createdAt) },
                      { key: 'Last edited', val: formatTs(log.updatedAt) },
                      { key: 'Kase', val: kase?.title ?? '—' },
                    ].map(({ key, val }) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{key}</span>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textAlign: 'right' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <SpDivider />

                {/* Export */}
                <div>
                  <SpLabel>Export</SpLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <button
                      data-testid="export-markdown-btn"
                      onClick={() => void logsApi.export(log.id, 'markdown')}
                      style={{
                        width: '100%',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg)',
                        border: '1px solid var(--border-mid)',
                        borderRadius: 5,
                        padding: '0.4rem 0.6rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      Export as Markdown
                    </button>
                    <button
                      data-testid="export-pdf-btn"
                      onClick={() => void logsApi.export(log.id, 'pdf')}
                      style={{
                        width: '100%',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg)',
                        border: '1px solid var(--border-mid)',
                        borderRadius: 5,
                        padding: '0.4rem 0.6rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      Export as PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Delete */}
              <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                {showDeleteConfirm ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => void handleDelete()}
                      style={{
                        flex: 1,
                        fontSize: 'var(--text-sm)',
                        color: 'white',
                        background: '#A32D2D',
                        border: 'none',
                        borderRadius: 5,
                        padding: '0.4rem',
                        cursor: 'pointer',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      Confirm delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-tertiary)',
                        background: 'var(--bg)',
                        border: '1px solid var(--border-mid)',
                        borderRadius: 5,
                        padding: '0.4rem 0.75rem',
                        cursor: 'pointer',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      width: '100%',
                      fontSize: 'var(--text-sm)',
                      color: '#A32D2D',
                      cursor: 'pointer',
                      textAlign: 'center',
                      padding: '0.4rem',
                      borderRadius: 5,
                      border: '1px solid #F09595',
                      background: 'transparent',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    Delete this log
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Edge tab ── */}
        <div style={{
          position: 'absolute',
          right: panelOpen ? 260 : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 30,
          transition: 'right 0.25s ease',
        }}>
          <div
            data-testid="edge-tab"
            onClick={() => setPanelOpen(o => !o)}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-mid)',
              borderRight: 'none',
              borderRadius: '8px 0 0 8px',
              padding: '0.9rem 0.55rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              boxShadow: '-2px 0 8px rgba(0,0,0,0.06)',
            }}
          >
            <span style={{ fontSize: 'var(--text-lg)', color: 'var(--text-tertiary)', lineHeight: 1 }}>
              {panelOpen ? '›' : '‹'}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 3.5, height: 3.5, borderRadius: '50%', background: 'var(--text-tertiary)', opacity: 0.5 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Title input (canvas) ──────────────────────────────────────────────────────

function TitleInput({ value, onBlur }: { value: string; onBlur: (val: string) => void }) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  return (
    <input
      value={local}
      placeholder="Log title…"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onBlur(local)}
      aria-label="Log title"
      style={{
        fontSize: 'var(--text-2xl)',
        fontWeight: 600,
        color: 'var(--text-primary)',
        letterSpacing: '-0.03em',
        lineHeight: 1.2,
        marginBottom: '0.4rem',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        width: '100%',
        fontFamily: 'var(--font)',
        display: 'block',
      }}
    />
  )
}
