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
    const email = authUser.email

    const { data, error } = await supabase
      .from('intern_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) console.error('Profile lookup failed:', error.message, error.code)
    if (data) { setProfile(data as TeamMember); return }

    if (email) {
      const { data: emailMatch, error: emailErr } = await supabase
        .from('intern_users')
        .select('*')
        .eq('email', email)
        .maybeSingle()
      if (emailErr) console.error('Email lookup failed:', emailErr.message)
      if (emailMatch) {
        const { error: linkErr } = await supabase
          .from('intern_users')
          .update({ id: userId })
          .eq('id', emailMatch.id)
        if (linkErr) console.error('Profile link failed:', linkErr.message)
        setProfile({ ...emailMatch, id: userId } as TeamMember)
        return
      }
    }

    if (email) {
      const newProfile = {
        id: userId,
        email,
        display_name: email.split('@')[0],
        role: 'member' as const,
      }
      const { error: insertErr } = await supabase
        .from('intern_users')
        .upsert(newProfile, { onConflict: 'id' })
      if (insertErr) {
        console.error('Profile creation failed:', insertErr.message, insertErr.code)
        setProfile(buildFallbackProfile(authUser))
        return
      }
      setProfile(newProfile as TeamMember)
      return
    }

    // Last-resort fallback to prevent "signed in but no profile" lockout.
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error as Error | null }

    if (data.user) {
      const { data: existing } = await supabase
        .from('intern_users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('intern_users')
          .update({ id: data.user.id, display_name: displayName })
          .eq('email', email)
      } else {
        await supabase.from('intern_users').insert({
          id: data.user.id,
          email,
          display_name: displayName,
          role: 'member',
        })
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
