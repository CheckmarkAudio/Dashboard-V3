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
    if (data) { setProfile(data as TeamMember); return }

    // 2) Secondary lookup: an admin may have pre-seeded a row keyed by email
    //    before this user signed up (TeamManager creates rows with a random
    //    UUID). Now that supabase/migrations/20260411_link_profiles_cascade
    //    has added ON UPDATE CASCADE to every FK pointing at intern_users(id),
    //    we can do a proper PK update to relink the pre-seeded row to the
    //    new auth uid — the cascade propagates the change to every child
    //    table (KPIs, checklists, reviews, submissions, etc.) automatically,
    //    so the user inherits all their historical data. If the update fails
    //    for any reason (cascade not applied in dev, RLS oddity, etc.) we
    //    fall back to the old insert-copy path so nobody gets locked out.
    if (email) {
      const { data: emailMatch, error: emailErr } = await supabase
        .from('intern_users')
        .select('*')
        .ilike('email', email)
        .maybeSingle()
      if (emailErr) console.error('[AuthContext] Email lookup failed:', emailErr.message)
      if (emailMatch && emailMatch.id !== userId) {
        // Try the cascade-safe PK update first.
        const { data: updated, error: updateErr } = await supabase
          .from('intern_users')
          .update({ id: userId, email })
          .eq('id', emailMatch.id)
          .select('*')
          .maybeSingle()
        if (!updateErr && updated) {
          setProfile(updated as TeamMember)
          return
        }
        if (updateErr) console.error('[AuthContext] Profile PK-relink failed, falling back to insert-copy:', updateErr.message, updateErr.code)

        // Fallback: copy the seeded row's fields into a fresh row keyed by
        // auth.uid(). Historical child rows stay attached to the old seed
        // and will need manual reconciliation, but the user isn't locked out.
        const seeded = emailMatch as TeamMember & {
          position?: string | null
          team_id?: string | null
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
    const normalized = normalizeEmail(email)
    const { error } = await supabase.auth.signInWithPassword({ email: normalized, password })
    return { error: error as Error | null }
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const normalized = normalizeEmail(email)
    const { data, error } = await supabase.auth.signUp({ email: normalized, password })
    if (error) return { error: error as Error | null }

    if (data.user) {
      // Does a pre-seeded intern_users row already exist for this email?
      const { data: existing } = await supabase
        .from('intern_users')
        .select('*')
        .ilike('email', normalized)
        .maybeSingle()

      if (existing && existing.id !== data.user.id) {
        // Pre-seeded profile. Prefer a cascade-safe PK update so every child
        // table (KPIs, checklists, reviews, etc.) stays attached to the user.
        // If the update fails, fall back to insert-copy so the user still
        // ends up with a working profile — just without historical data.
        const { error: updateErr } = await supabase
          .from('intern_users')
          .update({
            id: data.user.id,
            email: normalized,
            display_name: displayName || existing.display_name,
          })
          .eq('id', existing.id)
        if (!updateErr) {
          // Done — cascade has done its job.
          return { error: null }
        }
        console.error('[AuthContext] signUp PK-relink failed, falling back to insert-copy:', updateErr.message, updateErr.code)

        const seeded = existing as TeamMember & {
          position?: string | null
          team_id?: string | null
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
          phone: seeded.phone ?? null,
          start_date: seeded.start_date ?? null,
          status: seeded.status ?? 'active',
          managed_by: seeded.managed_by ?? null,
        })).error
        if (copyErr) console.error('[AuthContext] signUp seed-copy failed:', copyErr.message, copyErr.code)
      } else if (!existing) {
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
