import { useNavigate } from 'react-router-dom'
import { useCollections } from '../contexts/CollectionsContext'

const COLOR_MAP: Record<string, string> = {
  teal:   '#1D9E75',
  blue:   '#378ADD',
  purple: '#7F77DD',
  coral:  '#D85A30',
  amber:  '#BA7517',
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const diffMs = Date.now() - date.getTime()
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
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Collections
        </div>
        {!loading && (
          <div style={{
            fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
            padding: '2px 8px', background: 'var(--bg-secondary)',
            borderRadius: 99, border: '1px solid var(--border)',
          }}>
            {collectionList.length} {collectionList.length === 1 ? 'collection' : 'collections'}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate('/collections/new')}
          style={{
            fontSize: 'var(--text-sm)', fontWeight: 500, color: 'white',
            background: 'var(--accent)', padding: '5px 12px',
            borderRadius: 6, border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          + New Collection
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
        {loading ? (
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)', paddingTop: '2rem', textAlign: 'center' }}>
            Loading…
          </div>
        ) : collectionList.length === 0 ? (
          /* Empty state */
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            paddingTop: '4rem', gap: '0.75rem',
          }}>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              No collections yet
            </div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-tertiary)' }}>
              Create a collection to track structured data alongside your logs
            </div>
            <button
              onClick={() => navigate('/collections/new')}
              style={{
                marginTop: '0.5rem', fontSize: 'var(--text-base)', fontWeight: 500,
                color: 'white', background: 'var(--accent)',
                border: 'none', borderRadius: 6,
                padding: '8px 20px', cursor: 'pointer', fontFamily: 'var(--font)',
              }}
            >
              + New Collection
            </button>
          </div>
        ) : (
          /* Row list */
          <div style={{
            maxWidth: 680,
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            {collectionList.map((col, i) => {
              const dotColor = COLOR_MAP[col.color] ?? '#1D9E75'
              return (
                <div
                  key={col.id}
                  data-testid={`collection-row-${col.id}`}
                  onClick={() => navigate(`/collections/${col.id}`)}
                  style={{
                    height: 56, minHeight: 56,
                    padding: '0 1.5rem',
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    cursor: 'pointer',
                    borderBottom: i < collectionList.length - 1 ? '1px solid var(--border)' : 'none',
                    background: 'var(--bg)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg)')}
                >
                  {/* Color dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: dotColor, flexShrink: 0,
                  }} />

                  {/* Collection name */}
                  <span style={{
                    fontSize: 'var(--text-sm)', fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {col.title}
                  </span>

                  {/* Item count pill */}
                  <span style={{
                    fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary)',
                    padding: '2px 8px', background: 'var(--bg-secondary)',
                    borderRadius: 99, border: '1px solid var(--border)',
                    flexShrink: 0,
                  }}>
                    {col.itemCount} {col.itemCount === 1 ? 'item' : 'items'}
                  </span>

                  {/* Spacer */}
                  <div style={{ flex: 1 }} />

                  {/* Updated timestamp */}
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {formatRelativeTime(col.updatedAt)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
