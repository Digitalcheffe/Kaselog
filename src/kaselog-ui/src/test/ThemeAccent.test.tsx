import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '../contexts/ThemeContext'
import AppearancePanel from '../components/AppearancePanel'

// ── Helpers ───────────────────────────────────────────────────────────────

function renderPanel() {
  return render(
    <ThemeProvider>
      <AppearancePanel onClose={() => {}} />
    </ThemeProvider>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Theme and accent system', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-accent')
    document.documentElement.style.removeProperty('--accent')
  })

  afterEach(() => {
    localStorage.clear()
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-accent')
    document.documentElement.style.removeProperty('--accent')
  })

  it('default theme is light when no localStorage value exists', () => {
    renderPanel()
    // body should have data-theme='light' (or not 'dark')
    const t = document.body.getAttribute('data-theme')
    expect(t === null || t === 'light').toBe(true)
  })

  it('clicking Dark applies data-theme="dark" to body', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByTestId('theme-dark-btn'))

    expect(document.body.getAttribute('data-theme')).toBe('dark')
  })

  it('clicking Light applies data-theme="light" to body', async () => {
    const user = userEvent.setup()
    renderPanel()

    // Start from dark
    await user.click(screen.getByTestId('theme-dark-btn'))
    expect(document.body.getAttribute('data-theme')).toBe('dark')

    // Switch back to light
    await user.click(screen.getByTestId('theme-light-btn'))
    expect(document.body.getAttribute('data-theme')).toBe('light')
  })

  it('clicking an accent updates --accent on :root', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByTestId('accent-blue'))

    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#378ADD')
  })

  it('preferences written to localStorage on change', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByTestId('theme-dark-btn'))
    await user.click(screen.getByTestId('accent-purple'))

    const stored = JSON.parse(localStorage.getItem('kaselog-prefs') ?? '{}')
    expect(stored.theme).toBe('dark')
    expect(stored.accent).toBe('purple')
  })

  it('stored preferences correctly restored on simulated reload', () => {
    // Pre-seed localStorage as if a previous session saved dark + amber
    localStorage.setItem('kaselog-prefs', JSON.stringify({ theme: 'dark', accent: 'amber' }))

    renderPanel()

    expect(document.body.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#BA7517')
  })
})
