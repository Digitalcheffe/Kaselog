export default function KaseListPage() {
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
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          KaseLog
        </div>
        <div style={{ flex: 1 }} />
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

      {/* Empty state */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
      }}>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
          Select a Kase
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          Choose from the sidebar or create a new one
        </div>
      </div>
    </>
  )
}
