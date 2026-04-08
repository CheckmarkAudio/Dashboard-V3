import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, UserPlus, Loader2, Music } from 'lucide-react'

export default function Login() {
  const { user, loading: authLoading, signIn, signUp } = useAuth()
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (tab === 'signin') {
        const { error } = await signIn(email, password)
        if (error) setError(error.message)
      } else {
        if (!displayName.trim()) {
          setError('Display name is required')
          setLoading(false)
          return
        }
        const { error } = await signUp(email, password, displayName)
        if (error) setError(error.message)
        else setSuccess('Account created! Check your email to verify, then sign in.')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center p-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <Music size={24} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Checkmark Audio</span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Manage your team.<br />
            <span className="text-brand-200">Track everything.</span>
          </h2>
          <p className="text-brand-200/80 text-lg max-w-md">
            Daily reports, lead tracking, performance reviews, and checklists — all in one place.
          </p>
          <div className="flex gap-6 mt-12">
            {[
              { label: 'Reports', value: 'Daily & Weekly' },
              { label: 'Pipeline', value: 'Lead Tracking' },
              { label: 'Reviews', value: 'Performance' },
            ].map(item => (
              <div key={item.label} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                <p className="text-white/60 text-[10px] uppercase tracking-wider font-medium">{item.label}</p>
                <p className="text-white text-sm font-semibold mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-surface-alt">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8 lg:hidden">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-brand-200">
              <Music size={24} />
            </div>
            <h1 className="text-2xl font-bold">Checkmark Audio</h1>
            <p className="text-text-muted mt-1">Team Management System</p>
          </div>

          <div className="lg:mb-8 hidden lg:block">
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-text-muted mt-1">Sign in to your account to continue</p>
          </div>

          <div className="bg-surface rounded-2xl shadow-xl shadow-black/5 border border-border p-7">
            <div className="flex rounded-xl bg-surface-alt p-1 mb-6">
              <button
                onClick={() => { setTab('signin'); setError(''); setSuccess('') }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  tab === 'signin' ? 'bg-surface shadow-sm text-text' : 'text-text-muted hover:text-text'
                }`}
              >
                <LogIn size={15} /> Sign In
              </button>
              <button
                onClick={() => { setTab('signup'); setError(''); setSuccess('') }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  tab === 'signup' ? 'bg-surface shadow-sm text-text' : 'text-text-muted hover:text-text'
                }`}
              >
                <UserPlus size={15} /> Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === 'signup' && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm transition-all"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 animate-slide-up">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl p-3 animate-slide-up">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold text-sm hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-200 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {tab === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
