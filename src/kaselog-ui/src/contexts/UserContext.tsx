import { createContext, useContext, useEffect, useState } from 'react'
import * as api from '../api/client'
import type { UserResponse, UpdateUserRequest } from '../api/types'
import { useTheme, applyFontScaleToDOM } from './ThemeContext'
import type { Theme, Accent } from './ThemeContext'
import { ACCENT_DEFS } from './ThemeContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export type FontSize = 'small' | 'medium' | 'large'
const VALID_FONT_SIZES: FontSize[] = ['small', 'medium', 'large']

interface UserContextValue {
  user: UserResponse | null
  loading: boolean
  fontSize: FontSize
  saveProfile: (data: { firstName: string; lastName: string; email: string }) => Promise<void>
  saveAppearance: (theme: Theme, accent: Accent) => Promise<void>
  saveFontSize: (size: FontSize) => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [fontSize, setFontSize] = useState<FontSize>('medium')
  const { theme, accent, setTheme, setAccent } = useTheme()

  useEffect(() => {
    api.user.get()
      .then(u => {
        setUser(u)
        // Sync stored appearance from backend if user has saved preferences
        if (u.firstName !== null || u.lastName !== null || u.email !== null
            || u.theme !== 'light' || u.accent !== 'teal') {
          const validAccents = ACCENT_DEFS.map(a => a.name)
          if ((u.theme === 'light' || u.theme === 'dark') && u.theme !== theme) {
            setTheme(u.theme as Theme)
          }
          if (validAccents.includes(u.accent as Accent) && u.accent !== accent) {
            setAccent(u.accent as Accent)
          }
        }
        // Apply font size from backend
        const fs = VALID_FONT_SIZES.includes(u.fontSize as FontSize) ? (u.fontSize as FontSize) : 'medium'
        setFontSize(fs)
        applyFontScaleToDOM(fs)
      })
      .catch(() => { /* backend unavailable — continue with defaults */ })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveProfile(data: { firstName: string; lastName: string; email: string }) {
    const body: UpdateUserRequest = {
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      email: data.email || null,
      theme,
      accent,
      fontSize,
    }
    const updated = await api.user.update(body)
    setUser(updated)
  }

  async function saveAppearance(newTheme: Theme, newAccent: Accent) {
    const body: UpdateUserRequest = {
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      email: user?.email ?? null,
      theme: newTheme,
      accent: newAccent,
      fontSize,
    }
    const updated = await api.user.update(body)
    setUser(updated)
  }

  async function saveFontSize(size: FontSize) {
    applyFontScaleToDOM(size)
    setFontSize(size)
    const body: UpdateUserRequest = {
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      email: user?.email ?? null,
      theme,
      accent,
      fontSize: size,
    }
    const updated = await api.user.update(body)
    setUser(updated)
  }

  return (
    <UserContext.Provider value={{ user, loading, fontSize, saveProfile, saveAppearance, saveFontSize }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
