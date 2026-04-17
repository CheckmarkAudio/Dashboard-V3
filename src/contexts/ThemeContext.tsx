import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/**
 * Theme preference shape. `system` follows `prefers-color-scheme`, while
 * `light` and `dark` are explicit user choices that lock the UI.
 *
 * NOTE: Preference currently persists to localStorage only. Future work
 * (paired with the intern_* → team_* rename) will add a `theme_preference`
 * column on the team member profile row so the choice follows the user
 * across devices. Search for `TODO(theme-db)` when picking that up.
 */
export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (next: ThemePreference) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'checkmark-theme-preference'

function readStoredPreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    // localStorage may be unavailable (private mode, SSR); fall through.
  }
  return 'dark' // dashboard ships dark-first; 'system' is opt-in
}

function systemPrefersLight(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: light)').matches
}

function resolvePreference(pref: ThemePreference): ResolvedTheme {
  if (pref === 'light') return 'light'
  if (pref === 'dark') return 'dark'
  return systemPrefersLight() ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference())
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolvePreference(readStoredPreference()))

  // Apply resolved theme to `<html data-theme=…>` so CSS variable
  // overrides in index.css take effect. Runs on every resolve change.
  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])

  // Re-resolve whenever preference changes.
  useEffect(() => {
    setResolved(resolvePreference(preference))
  }, [preference])

  // When preference is `system`, listen for OS-level changes and follow them.
  useEffect(() => {
    if (preference !== 'system' || typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => setResolved(resolvePreference('system'))
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignore quota/denied errors — state still updates in-memory.
    }
    // TODO(theme-db): after the intern_* → team_* rename lands, also
    // persist to `team_members.theme_preference` via a Supabase update so
    // the preference follows the user across devices.
  }, [])

  const toggle = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setPreference])

  const value = useMemo(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
