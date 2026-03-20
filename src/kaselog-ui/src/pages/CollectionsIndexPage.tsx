import { useNavigate } from 'react-router-dom'
import { useCollections } from '../contexts/CollectionsContext'

const COLOR_MAP: Record<string, string> = {
  teal:   '#1D9E75',
  blue:   '#378ADD',
  purple: '#7F77DD',
  coral:  '#D85A30',
  amber:  '#BA7517',
}

export default function CollectionsIndexPage() {
  const { collectionList, loading } = useCollections()
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        height: 48, minHeight: 48,
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 1.25rem', gap: '0.75rem',
        background: 'var(--bg)', flexShrink: 0,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Collections</div>
        <div style={{
          fontSize: 11, color: 'var(--text-tertiary)',
          padding: '2px 8px', background: 'var(--bg-secondary)',
          borderRadius: 99, border: '1px solid var(--border)',
        }}>
          {collectionList.length} {collectionList.length === 1 ? 'collection' : 'collections'}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate('/collections/new')}
          style={{
            fontSize: 12, fontWeight: 500, color: 'white',
            background: 'var(--accent)', padding: '5px 12px',
            borderRadius: 6, border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          + New Collection
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : collectionList.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '0.5rem', padding: '3rem',
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>No collections yet</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Create your first collection to start tracking structured data</div>
            <button
              onClick={() => navigate('/collections/new')}
              style={{
                marginTop: '0.5rem', fontSize: 12, fontWeight: 500,
                color: 'var(--accent)', background: 'transparent',
                border: '1px solid var(--accent)', borderRadius: 6,
                padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font)',
              }}
            >
              + New Collection
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '0.75rem',
          }}>
            {collectionList.map(col => {
              const dotColor = COLOR_MAP[col.color] ?? '#1D9E75'
              return (
                <div
                  key={col.id}
                  onClick={() => navigate(`/collections/${col.id}`)}
                  style={{
                    padding: '1rem 1.1rem',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-mid)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {col.title}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {col.itemCount} {col.itemCount === 1 ? 'item' : 'items'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
