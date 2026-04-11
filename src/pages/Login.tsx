import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { LogIn, UserPlus, Loader2, Music } from 'lucide-react'

export default function Login() {
  const { user, loading: authLoading, signIn, signUp } = useAuth()
  useDocumentTitle('Sign In - Checkmark Audio')
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out — the server may be unavailable. Please try again.')), ms)),
    ])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (tab === 'signin') {
        const { error } = await withTimeout(signIn(email, password), 10000)
        if (error) setError(error.message)
      } else {
        if (!displayName.trim()) {
          setError('Display name is required')
          setLoading(false)
          return
        }
        const { error } = await withTimeout(signUp(email, password, displayName), 10000)
        if (error) setError(error.message)
        else setSuccess('Account created! Check your email to verify, then sign in.')
      }
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
            <div className="flex rounded-xl bg-surface-alt p-1 mb-6" role="tablist" aria-label="Authentication method">
              <button
                role="tab"
                aria-selected={tab === 'signin'}
                onClick={() => { setTab('signin'); setError(''); setSuccess('') }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  tab === 'signin' ? 'bg-surface-hover text-text' : 'text-text-muted hover:text-text'
                }`}
              >
                <LogIn size={15} aria-hidden="true" /> Sign In
              </button>
              <button
                role="tab"
                aria-selected={tab === 'signup'}
                onClick={() => { setTab('signup'); setError(''); setSuccess('') }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  tab === 'signup' ? 'bg-surface-hover text-text' : 'text-text-muted hover:text-text'
                }`}
              >
                <UserPlus size={15} aria-hidden="true" /> Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" role="tabpanel">
              {tab === 'signup' && (
                <div>
                  <label htmlFor="login-name" className="block text-sm font-medium mb-1.5 text-text-muted">Full Name</label>
                  <input
                    id="login-name"
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl border border-border text-sm transition-all"
                  />
                </div>
              )}

              <div>
                <label htmlFor="login-email" className="block text-sm font-medium mb-1.5 text-text-muted">Email</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-border text-sm transition-all"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium mb-1.5 text-text-muted">Password</label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-border text-sm transition-all"
                />
              </div>

              {error && (
                <div role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 animate-slide-up">
                  {error}
                </div>
              )}
              {success && (
                <div role="status" className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 animate-slide-up">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="w-full py-3 px-4 rounded-xl bg-gold hover:bg-gold-muted text-black font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                {tab === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
