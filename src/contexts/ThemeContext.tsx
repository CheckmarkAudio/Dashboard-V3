import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { setUserPreference } from '../lib/preferences'

/**
 * Theme preference shape. `system` follows `prefers-color-scheme`,
 * while `light` and `dark` are explicit user choices that lock the
 * UI.
 *
 * Persistence (2026-05-13):
 *   - localStorage is the synchronous fast-path so first paint is
 *     instant + correct (no theme flash).
 *   - When signed in, the choice ALSO writes to
 *     `team_members.preferences.theme` so it follows the user
 *     across devices. On sign-in, the DB value takes precedence
 *     and overrides the local cache (so device A reflects the
 *     change made on device B as soon as auth resolves).
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
const PREFERENCE_KEY = 'theme'

function readStoredPreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    // localStorage may be unavailable (private mode, SSR); fall through.
  }
  // Skin pass 2026-05-06 — default flipped from 'dark' to 'light' per
  // user direction "make light mode the standard page on log in." The
  // dark-mode design is preserved (lock policy still in effect on
  // shared tokens), but new users + users without a saved preference
  // now land on light first.
  return 'light'
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

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference())
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolvePreference(readStoredPreference()))

  // Track the user we last reconciled against so we don't clobber a
  // mid-session toggle when AuthContext re-emits the same profile
  // (e.g. on a refresh-profile call that doesn't change anything).
  const reconciledForUserId = useRef<string | null>(null)

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

  // Reconcile from server preferences on sign-in. The DB value wins
  // over the local cache so a theme picked on device B propagates
  // to device A as soon as the profile resolves.
  useEffect(() => {
    if (!user?.id || !profile) return
    if (reconciledForUserId.current === user.id) return
    reconciledForUserId.current = user.id

    const stored = (profile.preferences as Record<string, unknown> | null)?.[PREFERENCE_KEY]
    if (isThemePreference(stored)) {
      // DB has a saved value → trust it.
      setPreferenceState(stored)
      try { window.localStorage.setItem(STORAGE_KEY, stored) } catch {}
    } else {
      // DB has no saved value yet → push the local cache up so the
      // server starts tracking. One-shot migration on first sign-in.
      const local = readStoredPreference()
      void setUserPreference(user.id, PREFERENCE_KEY, local)
    }
  }, [user?.id, profile])

  // Reset the reconciliation tracker on sign-out so the next user
  // can reconcile cleanly.
  useEffect(() => {
    if (!user?.id) reconciledForUserId.current = null
  }, [user?.id])

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next)
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Ignore quota/denied errors — state still updates in-memory.
      }
      // Mirror to DB when signed in so the choice follows the user
      // across devices. Fire-and-forget — failures log but don't
      // surface, since the local change still works.
      if (user?.id) {
        void setUserPreference(user.id, PREFERENCE_KEY, next)
      }
    },
    [user?.id],
  )

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
