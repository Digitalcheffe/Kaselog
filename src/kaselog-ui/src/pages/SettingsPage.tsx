import { useState } from 'react'

type TabId = 'workspace' | 'users' | 'notifications' | 'integrations' | 'security' | 'data'

interface TabDef {
  id: TabId
  label: string
  icon: string
}

const TABS: TabDef[] = [
  { id: 'workspace',     label: 'Workspace',        icon: '🗂️' },
  { id: 'users',         label: 'Users',             icon: '👥' },
  { id: 'notifications', label: 'Notifications',     icon: '🔔' },
  { id: 'integrations',  label: 'Integrations',      icon: '🔌' },
  { id: 'security',      label: 'Security & Access', icon: '🔒' },
  { id: 'data',          label: 'Data',              icon: '💾' },
]

// ── Badge ─────────────────────────────────────────────────────────────────────

type BadgeVariant = 'soon' | 'planned' | 'destructive'

const BADGE_LABEL: Record<BadgeVariant, string> = {
  soon:        'soon',
  planned:     'planned',
  destructive: 'destructive',
}

function Badge({ variant }: { variant: BadgeVariant }) {
  const style: React.CSSProperties =
    variant === 'soon'
      ? { background: 'var(--accent-light)', color: 'var(--accent-text)' }
      : variant === 'planned'
      ? { background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }
      : { background: '#FCEBEB', color: '#A32D2D' }

  return (
    <span
      data-testid={`badge-${variant}`}
      style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 99,
        flexShrink: 0,
        ...style,
      }}
    >
      {BADGE_LABEL[variant]}
    </span>
  )
}

// ── Coming-soon card ──────────────────────────────────────────────────────────

function ComingSoonCard({ title, badge }: { title: string; badge: BadgeVariant }) {
  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
    }}>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
        {title}
      </span>
      <Badge variant={badge} />
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, description, children }: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{
          fontSize: 'var(--text-base)', fontWeight: 600,
          color: 'var(--text-primary)', marginBottom: '0.35rem',
        }}>
          {title}
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {description}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {children}
      </div>
    </div>
  )
}

// ── Tab panels ────────────────────────────────────────────────────────────────

function WorkspacePanel() {
  return (
    <Section
      title="Workspace"
      description="Configure workspace-level settings and templates for your instance."
    >
      <ComingSoonCard title="Kase Templates" badge="soon" />
      <ComingSoonCard title="Shareable Read-Only Links" badge="planned" />
    </Section>
  )
}

function UsersPanel() {
  return (
    <Section
      title="Users"
      description="Manage user accounts and access roles for this instance."
    >
      <p style={{
        fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)',
        fontStyle: 'italic', marginBottom: '0.25rem',
      }}>
        Multi-user support is on the roadmap
      </p>
      <ComingSoonCard title="User Accounts" badge="planned" />
      <ComingSoonCard title="Roles & Permissions" badge="planned" />
    </Section>
  )
}

function NotificationsPanel() {
  return (
    <Section
      title="Notifications"
      description="Configure outbound alerts and event-driven notification triggers."
    >
      <ComingSoonCard title="Outbound Webhooks" badge="soon" />
      <ComingSoonCard title="Email Configuration" badge="planned" />
      <ComingSoonCard title="Event Triggers" badge="planned" />
    </Section>
  )
}

function IntegrationsPanel() {
  return (
    <Section
      title="Integrations"
      description="Connect KaseLog to external services and protocols."
    >
      <ComingSoonCard title="MCP Server Access" badge="soon" />
      <ComingSoonCard title="OAuth Provider Configuration" badge="planned" />
    </Section>
  )
}

function SecurityPanel() {
  return (
    <Section
      title="Security & Access"
      description="Control network access, CORS policy, and API credentials."
    >
      <ComingSoonCard title="URL & CORS Configuration" badge="soon" />
      <ComingSoonCard title="API Key Management" badge="planned" />
    </Section>
  )
}

function DataPanel() {
  return (
    <div>
      <Section
        title="Data"
        description="Backup, restore, and migrate your KaseLog data."
      >
        <ComingSoonCard title="Backup" badge="soon" />
        <ComingSoonCard title="Restore" badge="planned" />
        <ComingSoonCard title="Import from External Sources" badge="planned" />
      </Section>

      {/* Danger zone */}
      <div
        data-testid="danger-zone"
        style={{
          marginTop: '2rem',
          border: '1px solid #F09595',
          borderRadius: 10,
          background: '#FEF5F5',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '0.65rem 1.25rem',
          borderBottom: '1px solid #F09595',
        }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#A32D2D' }}>
            Danger Zone
          </span>
        </div>
        <div style={{ padding: '1rem 1.25rem' }}>
          <div style={{
            background: 'white',
            border: '1px solid #F09595',
            borderRadius: 8,
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: '#A32D2D' }}>
              Delete All Data
            </span>
            <span style={{
              background: '#FCEBEB', color: '#A32D2D',
              fontSize: 'var(--text-xs)', fontWeight: 600,
              padding: '2px 8px', borderRadius: 99, flexShrink: 0,
            }}>
              destructive
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const PANELS: Record<TabId, React.FC> = {
  workspace:     WorkspacePanel,
  users:         UsersPanel,
  notifications: NotificationsPanel,
  integrations:  IntegrationsPanel,
  security:      SecurityPanel,
  data:          DataPanel,
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('workspace')

  const Panel = PANELS[activeTab]

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
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
          App Settings
        </span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          padding: '2px 8px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 99,
        }}>
          v0.1 — framework
        </span>
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Settings tabs"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
          flexShrink: 0,
          padding: '0 1.25rem',
          gap: '0.1rem',
          overflowX: 'auto',
        }}
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              data-testid={`settings-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.6rem 0.75rem',
                fontSize: 'var(--text-sm)',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                whiteSpace: 'nowrap',
                marginBottom: -1,
                transition: 'color 0.1s',
              }}
            >
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Settings body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem' }}>
        <div style={{ maxWidth: 820 }}>
          <Panel />
        </div>
      </div>

    </div>
  )
}
