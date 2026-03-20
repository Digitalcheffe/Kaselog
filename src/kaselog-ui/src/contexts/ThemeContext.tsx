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

const ACCENT_NAMES = ACCENT_DEFS.map(a => a.name) as Accent[]

// ── Storage ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'kaselog-prefs'

interface StoredPrefs {
  theme: Theme
  accent: Accent
}

function loadPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Record<string, unknown>
      return {
        theme:  p['theme'] === 'dark' ? 'dark' : 'light',
        accent: ACCENT_NAMES.includes(p['accent'] as Accent) ? (p['accent'] as Accent) : 'teal',
      }
    }
  } catch {
    // ignore parse errors
  }
  return { theme: 'light', accent: 'teal' }
}

function savePrefs(prefs: StoredPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore storage errors
  }
}

// ── DOM application ────────────────────────────────────────────────────────

export function applyThemeToDOM(theme: Theme) {
  document.body.setAttribute('data-theme', theme)
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
  const [prefs, setPrefs] = useState<StoredPrefs>(() => {
    const p = loadPrefs()
    applyThemeToDOM(p.theme)
    applyAccentToDOM(p.accent)
    return p
  })

  function setTheme(theme: Theme) {
    const next = { ...prefs, theme }
    applyThemeToDOM(theme)
    savePrefs(next)
    setPrefs(next)
  }

  function setAccent(accent: Accent) {
    const next = { ...prefs, accent }
    applyAccentToDOM(accent)
    savePrefs(next)
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
