import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { supabase, withSupabaseRetry } from '../lib/supabase'
import { normalizeEmail } from '../lib/email'
import type { TeamMember } from '../types'
import {
  OWNER_EMAIL,
  canAccessAdmin,
  getAppRole,
  getRoleCapabilities,
  type AppCapability,
  type AppRole,
} from '../domain/permissions'

interface AuthContextType {
  user: SupabaseUser | null
  profile: TeamMember | null
  session: Session | null
  loading: boolean
  appRole: AppRole
  capabilities: AppCapability[]
  isAdmin: boolean
  canAccessAdmin: boolean
  /**
   * True only when the current session was established by clicking a
   * Supabase password-reset email link. Used by ForcePasswordChangeModal
   * to show the "set your password" UI so the user finishes the recovery
   * flow. Cleared once they update their password successfully.
   */
  isPasswordRecovery: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  clearPasswordRecovery: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// DEV BYPASS — provide a fake admin profile so the full UI renders locally
function DevAuthProvider({ children }: { children: ReactNode }) {
  const mockProfile = {
    id: 'dev-user',
    display_name: 'Dev Admin',
    email: 'dev@checkmarkaudio.com',
    role: 'admin',
    position: 'Developer',
  } as TeamMember

  const value = useMemo(() => ({
    user: { id: 'dev-user', email: 'dev@checkmarkaudio.com' } as SupabaseUser,
    profile: mockProfile,
    session: null,
    loading: false,
    appRole: 'admin' as AppRole,
    capabilities: getRoleCapabilities('admin'),
    isAdmin: true,
    canAccessAdmin: true,
    isPasswordRecovery: false,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    refreshProfile: async () => {},
    clearPasswordRecovery: () => {},
  }), [])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // DEV BYPASS
  // DEMO BYPASS — use mock auth for draft/demo site and local dev
  if (import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true') return <DevAuthProvider>{children}</DevAuthProvider>
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<TeamMember | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // Initialize from the sessionStorage flag set in main.tsx BEFORE
  // React mounted. That flag is the bulletproof path — `main.tsx` runs
  // earlier than any React effect, so it catches the recovery hash
  // before supabase-js can strip it. Fallback: the PASSWORD_RECOVERY
  // event listener below will also set this flag if the sessionStorage
  // path missed it somehow.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    try {
      return window.sessionStorage.getItem('pending_password_recovery') === '1'
    } catch {
      return false
    }
  })
  const sessionInitialized = useRef(false)

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false)
    try { window.sessionStorage.removeItem('pending_password_recovery') } catch { /* ignore */ }
  }, [])

  // Phase 6.4 — `buildFallbackProfile` was removed. Previously, if the
  // team_members lookup failed we'd synthesize a profile from auth.user
  // metadata so the user wouldn't be locked out. That bypassed the
  // admin-only-account-creation rule: any rogue auth.users row would
  // become a usable dashboard session. The current `fetchProfile`
  // returns a boolean and the AuthProvider effect calls
  // `rejectAndSignOut` on `false`, signing the user out cleanly.

  /**
   * Look up the signed-in auth user's profile in `team_members`.
   *
   *   - 'found'      → profile loaded into state, caller proceeds
   *   - 'not_found'  → no admin-provisioned row exists for this user;
   *                    caller MUST sign them out (admin-only-provisioning
   *                    enforcement, Phase 6.4)
   *   - 'error'      → transient lookup failure (network, RLS hiccup,
   *                    JWT not yet attached). Caller MUST NOT sign out
   *                    in this case — that was the bug behind the
   *                    "boots me out on every login" symptom. Leave the
   *                    session intact so a subsequent auth-state event
   *                    or manual refresh can retry the load.
   */
  type ProfileFetchResult = 'found' | 'not_found' | 'error'
  const fetchProfile = useCallback(async (authUser: SupabaseUser): Promise<ProfileFetchResult> => {
    const userId = authUser.id
    // Always normalize emails — the DB has a CHECK (email = lower(email))
    // constraint on team_members plus RLS policies that compare via
    // `lower(email)`, so any casing drift silently creates ghost profiles.
    const email = normalizeEmail(authUser.email)

    // Helper: if all the DB-backed lookups fail or return no rows AND
    //         the auth email is the hardcoded owner, synthesize an owner
    //         profile. Safe because OWNER_EMAIL is hardcoded and only
    //         someone with that email's verified password reaches here.
    const synthesizeOwnerIfApplicable = (): ProfileFetchResult | null => {
      if (email !== OWNER_EMAIL) return null
      console.warn('[AuthContext] OWNER_EMAIL fallback engaged — synthesizing owner profile because team_members lookup did not return the row.')
      setProfile({
        id: userId,
        email: OWNER_EMAIL,
        display_name: 'Checkmark Admin',
        role: 'admin',
        position: 'owner',
        status: 'active',
      } as TeamMember)
      return 'found'
    }

    // 1) Primary lookup: profile row whose PK already matches the auth
    //    uid. Wrapped in withSupabaseRetry so a transient auth-lock
    //    ("Lock ... was released because another request stole it") or
    //    network blip doesn't leave the user in a profile-less state
    //    where the UI silently falls back to `member` role.
    let data: TeamMember | null = null
    try {
      data = await withSupabaseRetry(async () => {
        const res = await supabase
          .from('team_members')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
        if (res.error) throw res.error
        return (res.data ?? null) as TeamMember | null
      })
    } catch (error) {
      const pgErr = error as { message?: string; code?: string }
      console.error('[AuthContext] Profile lookup failed after retries:', pgErr.message, pgErr.code)
      // For the owner, engage the fallback rather than leaving them in
      // a profile-less limbo state.
      const ownerFallback = synthesizeOwnerIfApplicable()
      if (ownerFallback) return ownerFallback
      // For non-owner users, bailing on 'error' (instead of falling into
      // reject) prevents a transient blip from forcibly signing them out.
      return 'error'
    }
    if (data) { setProfile(data); return 'found' }

    // 2) Secondary lookup: an admin may have pre-seeded a row keyed by email
    //    before this user signed up (legacy TeamManager flow created rows
    //    with random UUIDs). The cascade-link migration added ON UPDATE
    //    CASCADE to every FK pointing at team_members(id), so a clean PK
    //    update relinks the pre-seeded row to the new auth uid and the
    //    user inherits all their historical data automatically.
    if (email) {
      let emailMatch: TeamMember | null = null
      try {
        emailMatch = await withSupabaseRetry(async () => {
          const res = await supabase
            .from('team_members')
            .select('*')
            .ilike('email', email)
            .maybeSingle()
          if (res.error) throw res.error
          return (res.data ?? null) as TeamMember | null
        })
      } catch (emailErr) {
        const pgErr = emailErr as { message?: string }
        console.error('[AuthContext] Email lookup failed after retries:', pgErr.message)
        return 'error'
      }
      if (emailMatch && emailMatch.id !== userId) {
        const { data: updated, error: updateErr } = await supabase
          .from('team_members')
          .update({ id: userId, email })
          .eq('id', emailMatch.id)
          .select('*')
          .maybeSingle()
        if (updateErr) {
          console.error('[AuthContext] Profile PK-relink failed:', updateErr.message, updateErr.code)
          return 'error'
        }
        if (updated) {
          setProfile(updated as TeamMember)
          return 'found'
        }
      } else if (emailMatch) {
        // Same id as auth uid but the primary lookup didn't return it —
        // unusual race. Treat as found.
        setProfile(emailMatch as TeamMember)
        return 'found'
      }
    }

    // 3) Owner email last-resort fallback (covers the no-row case). The
    //    error-path fallback is handled inside synthesizeOwnerIfApplicable
    //    above; calling it here covers the "queries succeeded but no row
    //    matched" case.
    const ownerFallback = synthesizeOwnerIfApplicable()
    if (ownerFallback) return ownerFallback

    // 4) Both lookups completed cleanly with no matching row, and the
    //    user is not the owner. They genuinely were NOT provisioned by
    //    an admin. The caller signs them out and surfaces the message
    //    via sessionStorage.
    console.error('[AuthContext] No team_members profile for auth user', userId, email)
    return 'not_found'
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user)
  }, [user, fetchProfile])

  /**
   * Phase 6.4 — Hard reject for users without an admin-provisioned
   * team_members row. Signs the user out and stashes a one-shot flag
   * in sessionStorage so the next /login render can surface the reason.
   */
  const rejectAndSignOut = useCallback(async () => {
    try {
      sessionStorage.setItem(
        'auth_no_profile',
        'Your account was not provisioned by an admin. Please contact your team administrator.',
      )
    } catch { /* sessionStorage may be unavailable in private mode; ignore */ }
    try { await supabase.auth.signOut() } catch { /* swallow */ }
    setUser(null)
    setSession(null)
    setProfile(null)
  }, [])

  useEffect(() => {
    let mounted = true

    // Detect password-recovery BEFORE supabase-js consumes the URL hash.
    //
    // Supabase's client parses `#type=recovery&access_token=…` inside
    // its own constructor (effectively synchronous), which happens
    // before this effect's `onAuthStateChange` subscribe below gets a
    // chance to run. Result: the `PASSWORD_RECOVERY` event is fired
    // into a void, no listener catches it, and the user just lands on
    // the dashboard instead of seeing the "Set your password" modal.
    //
    // We work around the race by checking the URL ourselves here —
    // whichever path fires first (this sync check OR the async event),
    // isPasswordRecovery flips on, and ForcePasswordChangeModal shows
    // up correctly.
    if (typeof window !== 'undefined') {
      const hash = window.location.hash ?? ''
      const search = window.location.search ?? ''
      if (hash.includes('type=recovery') || search.includes('type=recovery')) {
        setIsPasswordRecovery(true)
      }
    }

    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 5000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      sessionInitialized.current = true
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        let result: 'found' | 'not_found' | 'error' = 'error'
        try { result = await fetchProfile(session.user) } catch (err) {
          console.error('Failed to load profile on init:', err)
        }
        // Only sign out on a definitive "no row exists" verdict. A
        // transient 'error' leaves the session intact so the next
        // auth-state event or refreshProfile() call can recover.
        if (result === 'not_found') await rejectAndSignOut()
      }
      setLoading(false)
    }).catch((err) => {
      console.error('Session retrieval failed:', err)
      if (mounted) setLoading(false)
    })

    // Supabase documents a specific footgun: don't await supabase
    // client calls *inside* the onAuthStateChange callback. Doing so
    // risks deadlocking GoTrue's internal state machine because some
    // events (like PASSWORD_RECOVERY) are dispatched while the client
    // is still holding an internal lock. Our previous implementation
    // awaited fetchProfile here, which made the recovery path brittle
    // and occasionally miss events.
    //
    // Fix: the callback now does ONLY synchronous React-state updates.
    // Any supabase work (fetchProfile, signOut) is deferred to the
    // next tick via setTimeout(0) so the client can finish its
    // internal housekeeping first.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'INITIAL_SESSION' && sessionInitialized.current) return

      // Supabase fires PASSWORD_RECOVERY when a user lands on the app
      // via the recovery link in the password-reset email. Flip the
      // flag so RecoveryGate renders the "Set your password" screen.
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      }

      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        // Defer the profile lookup + sign-out decision so we don't
        // block inside the auth state change dispatch.
        const authUser = session.user
        setTimeout(() => {
          if (!mounted) return
          fetchProfile(authUser)
            .then((result) => {
              if (!mounted) return
              if (result === 'not_found') {
                void rejectAndSignOut()
              }
            })
            .catch((err) => {
              console.error('Failed to load profile on auth change:', err)
            })
        }, 0)
      } else {
        setProfile(null)
        // Fully signed out — any recovery flow in progress is abandoned.
        setIsPasswordRecovery(false)
        try { window.sessionStorage.removeItem('pending_password_recovery') } catch { /* ignore */ }
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [fetchProfile, rejectAndSignOut])

  const signIn = useCallback(async (email: string, password: string) => {
    const normalized = normalizeEmail(email)
    const { error } = await supabase.auth.signInWithPassword({ email: normalized, password })
    return { error: error as Error | null }
  }, [])

  // NOTE: `signUp` was intentionally removed in Phase 5.1. Self-signup is
  // disabled on the Supabase dashboard (Auth → Providers → Email), and all
  // new accounts are created server-side via the `admin-create-member`
  // Edge Function invoked by the admin-only `TeamManager` page. Removing
  // the method from this interface gives us a compile-time guarantee that
  // no future code path can accidentally re-enable self-signup from the
  // client.

  /**
   * Hard sign-out that cannot fail to clear the local session.
   *
   * The previous implementation awaited supabase.auth.signOut() with
   * default global scope and caught errors silently. If the global
   * revoke request failed (rate-limited, offline, or the refresh token
   * was already rejected server-side), localStorage still held the
   * session — so the next render would restore the user and the UI
   * looked like sign-out did nothing. That's what was happening for
   * Bridget.
   *
   * Fix: always run a LOCAL signOut first (clears localStorage and
   * cannot fail on the network), THEN fire-and-forget a global revoke
   * as a best-effort server cleanup, THEN wipe React state. The user
   * is guaranteed to be signed out locally within a tick.
   */
  const signOut = useCallback(async () => {
    try {
      // scope: 'local' clears the stored session and subscribers
      // without making a network call to /auth/v1/logout. It cannot
      // fail on a network or rate-limit error.
      await supabase.auth.signOut({ scope: 'local' })
    } catch { /* swallow — local scope doesn't network, but be defensive */ }

    // Best-effort global revoke so the refresh token is invalidated
    // server-side. If this fails, we're still signed out locally.
    void supabase.auth.signOut({ scope: 'global' }).catch(() => {})

    setUser(null)
    setSession(null)
    setProfile(null)
    setIsPasswordRecovery(false)
    try { window.sessionStorage.removeItem('pending_password_recovery') } catch { /* ignore */ }
  }, [])

  const value = useMemo(() => {
    // Pass user.email so OWNER_EMAIL always resolves to 'owner' even if
    // profile is still loading, errored, or null. This is the load-
    // bearing line that guarantees the owner sees admin nav as soon as
    // they're authenticated, independent of team_members lookup state.
    const appRole = getAppRole(profile, user?.email)
    return {
      user,
      profile,
      session,
      loading,
      appRole,
      capabilities: getRoleCapabilities(appRole),
      isAdmin: canAccessAdmin(appRole),
      canAccessAdmin: canAccessAdmin(appRole),
      isPasswordRecovery,
      signIn,
      signOut,
      refreshProfile,
      clearPasswordRecovery,
    }
  }, [user, profile, session, loading, isPasswordRecovery, signIn, signOut, refreshProfile, clearPasswordRecovery])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
