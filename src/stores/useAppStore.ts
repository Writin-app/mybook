import { create } from 'zustand'

export type ThemePreference = 'system' | 'light' | 'dark'

const THEME_PREFERENCE_STORAGE_KEY = 'writin-theme-preference'

interface AppState {
  isNavigationOpen: boolean
  theme: 'light' | 'dark'
  themePreference: ThemePreference
  closeNavigation: () => void
  setThemePreference: (preference: ThemePreference) => void
  toggleTheme: () => void
  toggleNavigation: () => void
}

function getStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)
    if (stored === 'system' || stored === 'light' || stored === 'dark') {
      return stored
    }
  } catch {
    // Ignore storage access errors.
  }
  return 'system'
}

function saveThemePreference(preference: ThemePreference) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference)
  } catch {
    // Ignore storage access errors.
  }
}

function resolveSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  return preference === 'system' ? resolveSystemTheme() : preference
}

function applyTheme(theme: AppState['theme']) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

const initialThemePreference = getStoredThemePreference()
const initialTheme = resolveTheme(initialThemePreference)
applyTheme(initialTheme)

export const useAppStore = create<AppState>((set) => ({
  isNavigationOpen: false,
  theme: initialTheme,
  themePreference: initialThemePreference,
  closeNavigation: () => set({ isNavigationOpen: false }),
  setThemePreference: (themePreference) => {
    const theme = resolveTheme(themePreference)
    saveThemePreference(themePreference)
    applyTheme(theme)
    set({ themePreference, theme })
  },
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === 'light' ? 'dark' : 'light'
      saveThemePreference(theme)
      applyTheme(theme)
      return { theme, themePreference: theme }
    }),
  toggleNavigation: () =>
    set((state) => ({ isNavigationOpen: !state.isNavigationOpen })),
}))

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleSystemThemeChange = () => {
    if (useAppStore.getState().themePreference !== 'system') return
    const nextTheme = resolveSystemTheme()
    applyTheme(nextTheme)
    useAppStore.setState({ theme: nextTheme })
  }
  mediaQuery.addEventListener?.('change', handleSystemThemeChange)
}
