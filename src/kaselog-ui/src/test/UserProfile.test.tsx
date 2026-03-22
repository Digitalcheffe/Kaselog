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
    fontSize: 'medium',
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
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-accent')
    document.documentElement.style.removeProperty('--accent')
    document.documentElement.style.removeProperty('--font-scale')
    vi.mocked(userApi.get).mockResolvedValue(makeUser())
    vi.mocked(userApi.update).mockImplementation(async body =>
      makeUser({
        firstName: body.firstName ?? null,
        lastName: body.lastName ?? null,
        email: body.email ?? null,
        theme: body.theme,
        accent: body.accent,
        fontSize: body.fontSize ?? 'medium',
      }),
    )
  })

  afterEach(() => {
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-accent')
    document.documentElement.style.removeProperty('--accent')
    document.documentElement.style.removeProperty('--font-scale')
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

  it('default theme is light on initial render', async () => {
    renderPage()
    await waitFor(() => screen.getByTestId('theme-light-btn'))
    const t = document.body.getAttribute('data-theme')
    expect(t === null || t === 'light').toBe(true)
  })

  it('on load GET /api/user is called and data-theme applied from response', async () => {
    vi.mocked(userApi.get).mockResolvedValue(makeUser({ theme: 'dark' }))
    renderPage()
    await waitFor(() => {
      expect(userApi.get).toHaveBeenCalled()
      expect(document.body.getAttribute('data-theme')).toBe('dark')
    })
  })

  it('on load --accent CSS variable is set from the settings response', async () => {
    vi.mocked(userApi.get).mockResolvedValue(makeUser({ accent: 'blue' }))
    renderPage()
    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#378ADD')
    })
  })

  it('on load --font-scale matches the fontSize value from settings', async () => {
    vi.mocked(userApi.get).mockResolvedValue(makeUser({ fontSize: 'large' }))
    renderPage()
    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.15')
    })
  })

  it('clicking Large font size sets --font-scale to 1.15 and calls PUT /api/user', async () => {
    const ue = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByTestId('font-size-large'))
    await ue.click(screen.getByTestId('font-size-large'))

    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.15')
    await waitFor(() => {
      expect(userApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ fontSize: 'large' }),
      )
    })
  })

  it('clicking Small font size sets --font-scale to 0.88 and calls PUT /api/user', async () => {
    const ue = userEvent.setup()
    renderPage()

    await waitFor(() => screen.getByTestId('font-size-small'))
    await ue.click(screen.getByTestId('font-size-small'))

    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('0.88')
    await waitFor(() => {
      expect(userApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ fontSize: 'small' }),
      )
    })
  })

  it('clicking Medium font size sets --font-scale to 1.0', async () => {
    const ue = userEvent.setup()
    // Start with large
    vi.mocked(userApi.get).mockResolvedValue(makeUser({ fontSize: 'large' }))
    renderPage()

    await waitFor(() => screen.getByTestId('font-size-medium'))
    await ue.click(screen.getByTestId('font-size-medium'))

    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.0')
  })
})
