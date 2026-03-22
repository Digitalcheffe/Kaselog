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
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-accent')
    document.documentElement.style.removeProperty('--accent')
  })

  afterEach(() => {
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-accent')
    document.documentElement.style.removeProperty('--accent')
  })

  it('default theme is light on initial render', () => {
    renderPanel()
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

  it('selecting coral accent updates --accent to coral value', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByTestId('accent-coral'))

    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#D85A30')
  })

  it('selecting purple accent sets data-accent attribute on body', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByTestId('accent-purple'))

    expect(document.body.getAttribute('data-accent')).toBe('purple')
  })
})
