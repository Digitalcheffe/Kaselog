import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SettingsPage from '../pages/SettingsPage'
import LeftNav from '../components/LeftNav'
import { KasesProvider } from '../contexts/KasesContext'
import { CollectionsProvider } from '../contexts/CollectionsContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { UserProvider } from '../contexts/UserContext'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  kases: {
    list:   vi.fn(),
    pin:    vi.fn(),
    unpin:  vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  collections: {
    list: vi.fn(),
  },
  user: {
    get:    vi.fn(),
    update: vi.fn(),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { kases as kasesApi, collections as collectionsApi, user as userApi } from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="*" element={<SettingsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderNavAtPath(path: string) {
  vi.mocked(kasesApi.list).mockResolvedValue([])
  vi.mocked(collectionsApi.list).mockResolvedValue([])
  vi.mocked(userApi.get).mockResolvedValue({
    id: 'u1', firstName: null, lastName: null, email: null,
    theme: 'light', accent: 'teal', fontSize: 'medium',
    createdAt: '', updatedAt: '',
  })

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={
          <ThemeProvider>
            <UserProvider>
              <KasesProvider>
                <CollectionsProvider>
                  <LeftNav onSearchOpen={vi.fn()} />
                </CollectionsProvider>
              </KasesProvider>
            </UserProvider>
          </ThemeProvider>
        } />
      </Routes>
    </MemoryRouter>,
  )
}

// ── SettingsPage — basic render ───────────────────────────────────────────────

describe('SettingsPage — render', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('renders without errors', () => {
    renderSettings()
    expect(screen.getByText('App Settings')).toBeInTheDocument()
  })

  it('renders the version badge', () => {
    renderSettings()
    expect(screen.getByText('v0.1 — framework')).toBeInTheDocument()
  })
})

// ── SettingsPage — tab bar ────────────────────────────────────────────────────

describe('SettingsPage — tab bar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('renders all six tabs', () => {
    renderSettings()
    const tablist = screen.getByRole('tablist')
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs).toHaveLength(6)
  })

  it('renders each expected tab label', () => {
    renderSettings()
    expect(screen.getByTestId('settings-tab-workspace')).toBeInTheDocument()
    expect(screen.getByTestId('settings-tab-users')).toBeInTheDocument()
    expect(screen.getByTestId('settings-tab-notifications')).toBeInTheDocument()
    expect(screen.getByTestId('settings-tab-integrations')).toBeInTheDocument()
    expect(screen.getByTestId('settings-tab-security')).toBeInTheDocument()
    expect(screen.getByTestId('settings-tab-data')).toBeInTheDocument()
  })

  it('default active tab on mount is Workspace', () => {
    renderSettings()
    const workspaceTab = screen.getByTestId('settings-tab-workspace')
    expect(workspaceTab).toHaveAttribute('aria-selected', 'true')
  })

  it('all other tabs are not selected on mount', () => {
    renderSettings()
    const inactiveTabs = ['users', 'notifications', 'integrations', 'security', 'data']
    for (const id of inactiveTabs) {
      expect(screen.getByTestId(`settings-tab-${id}`)).toHaveAttribute('aria-selected', 'false')
    }
  })

  it('clicking a tab activates it and deactivates the previously active tab', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByTestId('settings-tab-users'))

    expect(screen.getByTestId('settings-tab-users')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('settings-tab-workspace')).toHaveAttribute('aria-selected', 'false')
  })

  it('clicking each tab in turn activates it', async () => {
    const user = userEvent.setup()
    renderSettings()

    const tabIds: string[] = ['workspace', 'users', 'notifications', 'integrations', 'security', 'data']

    for (const id of tabIds) {
      await user.click(screen.getByTestId(`settings-tab-${id}`))
      expect(screen.getByTestId(`settings-tab-${id}`)).toHaveAttribute('aria-selected', 'true')
      // All others should be inactive
      for (const otherId of tabIds.filter(t => t !== id)) {
        expect(screen.getByTestId(`settings-tab-${otherId}`)).toHaveAttribute('aria-selected', 'false')
      }
    }
  })
})

// ── SettingsPage — panel content ──────────────────────────────────────────────

describe('SettingsPage — Workspace panel (default)', () => {
  it('shows Kase Templates and Shareable Read-Only Links cards', () => {
    renderSettings()
    expect(screen.getByText('Kase Templates')).toBeInTheDocument()
    expect(screen.getByText('Shareable Read-Only Links')).toBeInTheDocument()
  })
})

describe('SettingsPage — Data panel danger zone', () => {
  it('shows danger zone when Data tab is active', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByTestId('settings-tab-data'))

    expect(screen.getByTestId('danger-zone')).toBeInTheDocument()
    expect(screen.getByText('Delete All Data')).toBeInTheDocument()
  })
})

// ── LeftNav — App Settings button ────────────────────────────────────────────

describe('LeftNav — App Settings button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('renders the settings button in the left nav', () => {
    renderNavAtPath('/')
    expect(screen.getByTestId('nav-settings-btn')).toBeInTheDocument()
  })

  it('settings button is present on a kase route', () => {
    renderNavAtPath('/kases/some-id')
    expect(screen.getByTestId('nav-settings-btn')).toBeInTheDocument()
  })

  it('settings button is present on a collections route', () => {
    renderNavAtPath('/collections')
    expect(screen.getByTestId('nav-settings-btn')).toBeInTheDocument()
  })

  it('settings button navigates to /settings on click', async () => {
    const user = userEvent.setup()
    renderNavAtPath('/')

    await user.click(screen.getByTestId('nav-settings-btn'))

    expect(mockNavigate).toHaveBeenCalledWith('/settings')
  })

  it('settings button has active styling when current route is /settings', () => {
    renderNavAtPath('/settings')

    const btn = screen.getByTestId('nav-settings-btn')
    // Active: background is accent-light, text accent-text
    // We test via the computed style string containing the CSS variable
    expect(btn).toHaveStyle({ background: 'var(--accent-light)' })
  })

  it('settings button does not have active styling on non-settings route', () => {
    renderNavAtPath('/')

    const btn = screen.getByTestId('nav-settings-btn')
    expect(btn).not.toHaveStyle({ background: 'var(--accent-light)' })
  })
})
