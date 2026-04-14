import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { normalizeEmail } from '../lib/email'
import type { TeamMember } from '../types'

interface AuthContextType {
  user: SupabaseUser | null
  profile: TeamMember | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
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
    isAdmin: true,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    refreshProfile: async () => {},
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
  const sessionInitialized = useRef(false)

  // Phase 6.4 — `buildFallbackProfile` was removed. Previously, if the
  // intern_users lookup failed we'd synthesize a profile from auth.user
  // metadata so the user wouldn't be locked out. That bypassed the
  // admin-only-account-creation rule: any rogue auth.users row would
  // become a usable dashboard session. The current `fetchProfile`
  // returns a boolean and the AuthProvider effect calls
  // `rejectAndSignOut` on `false`, signing the user out cleanly.

  /**
   * Look up the signed-in auth user's profile in `intern_users`. Returns
   * `true` if a profile was found (or successfully relinked from a
   * pre-seeded row) and `false` if no admin-provisioned row exists for
   * this user.
   *
   * Phase 6.4 — On `false`, the caller MUST sign the user out. We no
   * longer auto-create a profile or fall back to `buildFallbackProfile`
   * — both of those paths bypassed the admin-only-account-creation rule
   * by silently letting any rogue `auth.users` row become a usable
   * dashboard session. The hard reject is the enforcement point.
   */
  const fetchProfile = useCallback(async (authUser: SupabaseUser): Promise<boolean> => {
    const userId = authUser.id
    // Always normalize emails — the DB has a CHECK (email = lower(email))
    // constraint on intern_users plus RLS policies that compare via
    // `lower(email)`, so any casing drift silently creates ghost profiles.
    const email = normalizeEmail(authUser.email)

    // 1) Primary lookup: profile row whose PK already matches the auth uid.
    const { data, error } = await supabase
      .from('intern_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) console.error('[AuthContext] Profile lookup failed:', error.message, error.code)
    if (data) { setProfile(data as TeamMember); return true }

    // 2) Secondary lookup: an admin may have pre-seeded a row keyed by email
    //    before this user signed up (legacy TeamManager flow created rows
    //    with random UUIDs). The cascade-link migration added ON UPDATE
    //    CASCADE to every FK pointing at intern_users(id), so a clean PK
    //    update relinks the pre-seeded row to the new auth uid and the
    //    user inherits all their historical data automatically.
    if (email) {
      const { data: emailMatch, error: emailErr } = await supabase
        .from('intern_users')
        .select('*')
        .ilike('email', email)
        .maybeSingle()
      if (emailErr) console.error('[AuthContext] Email lookup failed:', emailErr.message)
      if (emailMatch && emailMatch.id !== userId) {
        const { data: updated, error: updateErr } = await supabase
          .from('intern_users')
          .update({ id: userId, email })
          .eq('id', emailMatch.id)
          .select('*')
          .maybeSingle()
        if (!updateErr && updated) {
          setProfile(updated as TeamMember)
          return true
        }
        if (updateErr) console.error('[AuthContext] Profile PK-relink failed:', updateErr.message, updateErr.code)
      }
    }

    // 3) No row found and no email-match cascade-link possible. This
    //    user was NOT provisioned by an admin. Refuse to load. The
    //    caller signs them out and surfaces the message via sessionStorage.
    console.error('[AuthContext] No intern_users profile for auth user', userId, email)
    return false
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user)
  }, [user, fetchProfile])

  /**
   * Phase 6.4 — Hard reject for users without an admin-provisioned
   * intern_users row. Signs the user out and stashes a one-shot flag
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

    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 5000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      sessionInitialized.current = true
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        let ok = false
        try { ok = await fetchProfile(session.user) } catch (err) {
          console.error('Failed to load profile on init:', err)
        }
        if (!ok) await rejectAndSignOut()
      }
      setLoading(false)
    }).catch((err) => {
      console.error('Session retrieval failed:', err)
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'INITIAL_SESSION' && sessionInitialized.current) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        let ok = false
        try { ok = await fetchProfile(session.user) } catch (err) {
          console.error('Failed to load profile on auth change:', err)
        }
        if (!ok) await rejectAndSignOut()
      } else {
        setProfile(null)
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

  const signOut = useCallback(async () => {
    try { await supabase.auth.signOut() } catch {}
    setUser(null)
    setSession(null)
    setProfile(null)
  }, [])

  const value = useMemo(() => ({
    user,
    profile,
    session,
    loading,
    isAdmin: profile?.role === 'admin',
    signIn,
    signOut,
    refreshProfile,
  }), [user, profile, session, loading, signIn, signOut, refreshProfile])

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
