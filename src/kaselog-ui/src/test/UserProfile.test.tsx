import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../contexts/ThemeContext'
import { UserProvider } from '../contexts/UserContext'
import ProfilePage from '../pages/ProfilePage'
import type { UserResponse } from '../api/types'

// ── Mock API ──────────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  user: {
    get: vi.fn(),
    update: vi.fn(),
  },
}))

import { user as userApi } from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    firstName: null,
    lastName: null,
    email: null,
    theme: 'light',
    accent: 'teal',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <ThemeProvider>
        <UserProvider>
          <ProfilePage />
        </UserProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProfilePage', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-accent')
    document.documentElement.style.removeProperty('--accent')
    vi.mocked(userApi.get).mockResolvedValue(makeUser())
    vi.mocked(userApi.update).mockImplementation(async body =>
      makeUser({
        firstName: body.firstName ?? null,
        lastName: body.lastName ?? null,
        email: body.email ?? null,
        theme: body.theme,
        accent: body.accent,
      }),
    )
  })

  afterEach(() => {
    localStorage.clear()
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-accent')
    document.documentElement.style.removeProperty('--accent')
    vi.clearAllMocks()
  })

  it('renders profile fields', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('profile-first-name')).toBeInTheDocument()
      expect(screen.getByTestId('profile-last-name')).toBeInTheDocument()
      expect(screen.getByTestId('profile-email')).toBeInTheDocument()
    })
  })

  it('pre-populates fields from loaded user', async () => {
    vi.mocked(userApi.get).mockResolvedValue(makeUser({ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' }))
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId<HTMLInputElement>('profile-first-name').value).toBe('Jane')
      expect(screen.getByTestId<HTMLInputElement>('profile-last-name').value).toBe('Doe')
      expect(screen.getByTestId<HTMLInputElement>('profile-email').value).toBe('jane@example.com')
    })
  })

  it('save button calls update with entered profile data', async () => {
    const ue = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByTestId('profile-first-name'))

    await ue.clear(screen.getByTestId('profile-first-name'))
    await ue.type(screen.getByTestId('profile-first-name'), 'Alice')
    await ue.clear(screen.getByTestId('profile-last-name'))
    await ue.type(screen.getByTestId('profile-last-name'), 'Smith')
    await ue.clear(screen.getByTestId('profile-email'))
    await ue.type(screen.getByTestId('profile-email'), 'alice@example.com')

    await ue.click(screen.getByTestId('profile-save-btn'))

    await waitFor(() => {
      expect(userApi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
        }),
      )
    })
  })

  it('shows error message when save fails', async () => {
    vi.mocked(userApi.update).mockRejectedValue(new Error('Network error'))
    const ue = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByTestId('profile-save-btn'))
    await ue.click(screen.getByTestId('profile-save-btn'))

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument()
    })
  })

  it('clicking Dark applies data-theme="dark" to body', async () => {
    const ue = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByTestId('theme-dark-btn'))
    await ue.click(screen.getByTestId('theme-dark-btn'))

    expect(document.body.getAttribute('data-theme')).toBe('dark')
  })

  it('clicking Light applies data-theme="light" to body', async () => {
    const ue = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByTestId('theme-dark-btn'))
    await ue.click(screen.getByTestId('theme-dark-btn'))
    expect(document.body.getAttribute('data-theme')).toBe('dark')

    await ue.click(screen.getByTestId('theme-light-btn'))
    expect(document.body.getAttribute('data-theme')).toBe('light')
  })

  it('clicking an accent updates --accent on :root', async () => {
    const ue = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByTestId('accent-blue'))
    await ue.click(screen.getByTestId('accent-blue'))

    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#378ADD')
  })

  it('theme preference written to localStorage when changed', async () => {
    const ue = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByTestId('theme-dark-btn'))
    await ue.click(screen.getByTestId('theme-dark-btn'))

    const stored = JSON.parse(localStorage.getItem('kaselog-prefs') ?? '{}')
    expect(stored.theme).toBe('dark')
  })

  it('accent preference written to localStorage when changed', async () => {
    const ue = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByTestId('accent-purple'))
    await ue.click(screen.getByTestId('accent-purple'))

    const stored = JSON.parse(localStorage.getItem('kaselog-prefs') ?? '{}')
    expect(stored.accent).toBe('purple')
  })

  it('default theme is light when no localStorage value exists', async () => {
    renderPage()
    await waitFor(() => screen.getByTestId('theme-light-btn'))
    const t = document.body.getAttribute('data-theme')
    expect(t === null || t === 'light').toBe(true)
  })

  it('stored preferences restored on simulated reload', () => {
    localStorage.setItem('kaselog-prefs', JSON.stringify({ theme: 'dark', accent: 'amber' }))
    renderPage()
    expect(document.body.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#BA7517')
  })
})
