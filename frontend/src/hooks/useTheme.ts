import { useCallback, useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark'

const GUEST_THEME_KEY = 'reconledger-theme:guest'

function getThemeKey(userId?: string) {
  return userId ? `reconledger-theme:${userId}` : GUEST_THEME_KEY
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredTheme(userId?: string): ThemeMode | null {
  if (typeof window === 'undefined') {
    return null
  }

  const storage = window.localStorage
  if (!storage || typeof storage.getItem !== 'function') {
    return null
  }

  const perUser = storage.getItem(getThemeKey(userId))
  if (isThemeMode(perUser)) {
    return perUser
  }

  const guest = storage.getItem(GUEST_THEME_KEY)
  if (isThemeMode(guest)) {
    return guest
  }

  return null
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = mode
}

export function useTheme(userId?: string) {
  const [, setVersion] = useState(0)
  const theme = readStoredTheme(userId) ?? getSystemTheme()

  useEffect(() => {
    applyTheme(theme)
  }, [theme, userId])

  const toggleTheme = useCallback(() => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark'

    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
      window.localStorage.setItem(getThemeKey(userId), nextTheme)
    }

    applyTheme(nextTheme)
    setVersion((previous) => previous + 1)
  }, [theme, userId])

  return { theme, toggleTheme }
}
