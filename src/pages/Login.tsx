import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { Button, Input } from '../components/ui'
import { LogIn, Music } from 'lucide-react'

export default function Login() {
  const { user, loading: authLoading, signIn } = useAuth()
  useDocumentTitle('Sign In - Checkmark Audio')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Phase 6.4 — surface the "not provisioned" message if the user was
  // rejected by AuthContext because no team_members row exists.
  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('auth_no_profile')
      if (msg) {
        setError(msg)
        sessionStorage.removeItem('auth_no_profile')
      }
    } catch { /* sessionStorage unavailable */ }
  }, [])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />

  const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out — the server may be unavailable. Please try again.')), ms),
      ),
    ])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await withTimeout(signIn(email, password), 10000)
      if (error) setError(error.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-surface relative overflow-hidden border-r border-border">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-gold/10 blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-gold/5 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center p-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Music size={24} className="text-gold" />
            </div>
            <span className="text-2xl font-bold text-text tracking-tight">Checkmark Audio</span>
          </div>
          <h2 className="text-4xl font-bold text-text leading-tight mb-4">
            Your studio.<br />
            <span className="text-gold">Your command center.</span>
          </h2>
          <p className="text-text-muted text-lg max-w-md">
            Projects, sessions, pipeline, team operations, and business health — all in one place.
          </p>
          <div className="flex gap-4 mt-12">
            {[
              { label: 'Projects', value: 'Recording & Mixing' },
              { label: 'Pipeline', value: 'Artist Development' },
              { label: 'Growth', value: 'Social & Metrics' },
            ].map(item => (
              <div key={item.label} className="bg-white/[0.04] border border-border rounded-xl px-4 py-3">
                <p className="text-text-light text-[10px] uppercase tracking-wider font-medium">{item.label}</p>
                <p className="text-text text-sm font-semibold mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8 lg:hidden">
            <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4">
              <Music size={24} className="text-gold" />
            </div>
            <h1 className="text-2xl font-bold text-text">Checkmark Audio</h1>
            <p className="text-text-muted mt-1">Command Center</p>
          </div>

          <div className="lg:mb-8 hidden lg:block">
            <h1 className="text-2xl font-bold text-text">Welcome back</h1>
            <p className="text-text-muted mt-1">Sign in to your account to continue</p>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="login-email"
                label="Email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <Input
                id="login-password"
                label="Password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />

              {error && (
                <div role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 animate-slide-up">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                block
                loading={loading}
                iconLeft={!loading ? <LogIn size={16} aria-hidden="true" /> : undefined}
              >
                Sign In
              </Button>

              <p className="text-xs text-text-light text-center pt-2">
                Need access? Ask your admin to create your account.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
