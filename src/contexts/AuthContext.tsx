import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { TeamMember } from '../types'

interface AuthContextType {
  user: SupabaseUser | null
  profile: TeamMember | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<TeamMember | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const sessionInitialized = useRef(false)

  const buildFallbackProfile = useCallback((authUser: SupabaseUser): TeamMember => {
    const derivedDisplayName =
      (typeof authUser.user_metadata?.display_name === 'string' && authUser.user_metadata.display_name) ||
      (typeof authUser.user_metadata?.full_name === 'string' && authUser.user_metadata.full_name) ||
      (authUser.email?.split('@')[0] ?? 'User')
    const derivedRole =
      (typeof authUser.app_metadata?.role === 'string' && authUser.app_metadata.role) ||
      (typeof authUser.user_metadata?.role === 'string' && authUser.user_metadata.role) ||
      'member'

    return {
      id: authUser.id,
      email: authUser.email ?? '',
      display_name: derivedDisplayName,
      role: derivedRole,
    }
  }, [])

  const fetchProfile = useCallback(async (authUser: SupabaseUser) => {
    const userId = authUser.id
    // Always normalize emails — the DB's RLS policies compare via `lower(email)`
    // (see migration.sql "Users can view team"), so any casing drift between
    // client queries and server checks silently creates ghost profiles.
    const email = authUser.email?.trim().toLowerCase() ?? null

    // 1) Primary lookup: profile row whose PK already matches the auth uid.
    const { data, error } = await supabase
      .from('intern_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) console.error('[AuthContext] Profile lookup failed:', error.message, error.code)
    if (data) { setProfile(data as TeamMember); return }

    // 2) Secondary lookup: an admin may have pre-seeded a row keyed by email
    //    before this user signed up. We CANNOT update intern_users.id to the
    //    new auth uid — the PK is referenced by FKs on every child table and
    //    updating it fails (either blocked by FK, or by the RLS WITH CHECK on
    //    intern_users itself). Instead we copy the pre-seeded row's fields
    //    into a fresh row keyed by auth.uid() so the user can immediately use
    //    the app with the right role/team/position. Historical data attached
    //    to the old row will need to be reconciled server-side (see the
    //    server migration TODO in the Phase 1.2 plan).
    if (email) {
      const { data: emailMatch, error: emailErr } = await supabase
        .from('intern_users')
        .select('*')
        .ilike('email', email)
        .maybeSingle()
      if (emailErr) console.error('[AuthContext] Email lookup failed:', emailErr.message)
      if (emailMatch) {
        const seeded = emailMatch as TeamMember & {
          position?: string | null
          team_id?: string | null
          avatar_url?: string | null
          phone?: string | null
          start_date?: string | null
          status?: string | null
          managed_by?: string | null
        }
        const copied = {
          id: userId,
          email,
          display_name: seeded.display_name,
          role: seeded.role,
          position: seeded.position ?? null,
          team_id: seeded.team_id ?? null,
          avatar_url: seeded.avatar_url ?? null,
          phone: seeded.phone ?? null,
          start_date: seeded.start_date ?? null,
          status: seeded.status ?? 'active',
          managed_by: seeded.managed_by ?? null,
        }
        const { data: inserted, error: copyErr } = await supabase
          .from('intern_users')
          .insert(copied)
          .select('*')
          .maybeSingle()
        if (copyErr) {
          console.error('[AuthContext] Profile copy from seed failed:', copyErr.message, copyErr.code)
          // Fall back to the in-memory copy so the user isn't locked out
          setProfile(copied as TeamMember)
          return
        }
        setProfile((inserted ?? copied) as TeamMember)
        return
      }
    }

    // 3) No seed, no existing row — create a fresh profile keyed by auth uid.
    if (email) {
      const newProfile = {
        id: userId,
        email,
        display_name: email.split('@')[0] ?? 'User',
        role: 'member' as const,
      }
      const { data: inserted, error: insertErr } = await supabase
        .from('intern_users')
        .insert(newProfile)
        .select('*')
        .maybeSingle()
      if (insertErr) {
        console.error('[AuthContext] Profile creation failed:', insertErr.message, insertErr.code)
        setProfile(buildFallbackProfile(authUser))
        return
      }
      setProfile((inserted ?? newProfile) as TeamMember)
      return
    }

    // 4) Last-resort fallback to prevent "signed in but no profile" lockout.
    setProfile(buildFallbackProfile(authUser))
  }, [buildFallbackProfile])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user)
  }, [user, fetchProfile])

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
        try { await fetchProfile(session.user) } catch (err) {
          console.error('Failed to load profile on init:', err)
          setProfile(buildFallbackProfile(session.user))
        }
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
        try { await fetchProfile(session.user) } catch (err) {
          console.error('Failed to load profile on auth change:', err)
          setProfile(buildFallbackProfile(session.user))
        }
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
  }, [buildFallbackProfile, fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const normalized = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithPassword({ email: normalized, password })
    return { error: error as Error | null }
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const normalized = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signUp({ email: normalized, password })
    if (error) return { error: error as Error | null }

    if (data.user) {
      // Does a pre-seeded intern_users row already exist for this email?
      const { data: existing } = await supabase
        .from('intern_users')
        .select('*')
        .ilike('email', normalized)
        .maybeSingle()

      if (existing) {
        // Pre-seeded profile: copy its fields into a new row keyed by the
        // auth uid. We CANNOT update the existing row's `id` — it's a PK
        // referenced by FKs across the schema and blocked by the RLS
        // WITH CHECK clause. See the matching logic in fetchProfile() for
        // the long-form explanation.
        const seeded = existing as TeamMember & {
          position?: string | null
          team_id?: string | null
          avatar_url?: string | null
          phone?: string | null
          start_date?: string | null
          status?: string | null
          managed_by?: string | null
        }
        const copyErr = (await supabase.from('intern_users').insert({
          id: data.user.id,
          email: normalized,
          display_name: displayName || seeded.display_name,
          role: seeded.role,
          position: seeded.position ?? null,
          team_id: seeded.team_id ?? null,
          avatar_url: seeded.avatar_url ?? null,
          phone: seeded.phone ?? null,
          start_date: seeded.start_date ?? null,
          status: seeded.status ?? 'active',
          managed_by: seeded.managed_by ?? null,
        })).error
        if (copyErr) console.error('[AuthContext] signUp seed-copy failed:', copyErr.message, copyErr.code)
      } else {
        const { error: insertErr } = await supabase.from('intern_users').insert({
          id: data.user.id,
          email: normalized,
          display_name: displayName,
          role: 'member',
        })
        if (insertErr) console.error('[AuthContext] signUp profile insert failed:', insertErr.message, insertErr.code)
      }
    }
    return { error: null }
  }, [])

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
    signUp,
    signOut,
    refreshProfile,
  }), [user, profile, session, loading, signIn, signUp, signOut, refreshProfile])

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
