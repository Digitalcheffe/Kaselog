import { createContext, useContext, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark'
export type Accent = 'teal' | 'blue' | 'purple' | 'coral' | 'amber'

export interface AccentDef {
  name: Accent
  label: string
  value: string
}

export const ACCENT_DEFS: AccentDef[] = [
  { name: 'teal',   label: 'Teal',   value: '#1D9E75' },
  { name: 'blue',   label: 'Blue',   value: '#378ADD' },
  { name: 'purple', label: 'Purple', value: '#7F77DD' },
  { name: 'coral',  label: 'Coral',  value: '#D85A30' },
  { name: 'amber',  label: 'Amber',  value: '#BA7517' },
]

// ── DOM application ────────────────────────────────────────────────────────

export function applyThemeToDOM(theme: Theme) {
  document.body.setAttribute('data-theme', theme)
}

export function applyFontScaleToDOM(fontSize: string) {
  const scale = fontSize === 'small' ? '0.88' : fontSize === 'large' ? '1.15' : '1.0'
  document.documentElement.style.setProperty('--font-scale', scale)
}

export function applyAccentToDOM(accent: Accent) {
  const def = ACCENT_DEFS.find(a => a.name === accent)!
  // Set --accent on :root (html element) as inline style for immediate effect
  document.documentElement.style.setProperty('--accent', def.value)
  // Set data-accent so CSS handles --accent-light / --accent-text variants
  if (accent === 'teal') {
    document.body.removeAttribute('data-accent')
  } else {
    document.body.setAttribute('data-accent', accent)
  }
}

// ── Context ────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: Theme
  accent: Accent
  setTheme: (t: Theme) => void
  setAccent: (a: Accent) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<{ theme: Theme; accent: Accent }>(() => {
    applyThemeToDOM('light')
    applyAccentToDOM('teal')
    return { theme: 'light', accent: 'teal' }
  })

  function setTheme(theme: Theme) {
    const next = { ...prefs, theme }
    applyThemeToDOM(theme)
    setPrefs(next)
  }

  function setAccent(accent: Accent) {
    const next = { ...prefs, accent }
    applyAccentToDOM(accent)
    setPrefs(next)
  }

  return (
    <ThemeContext.Provider value={{ theme: prefs.theme, accent: prefs.accent, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
