import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { Button, Input } from '../components/ui'
import { ArrowLeft, CheckCircle, Eye, EyeOff, KeyRound, LogIn, Mail, Music } from 'lucide-react'

/**
 * Lean 2 — preview-login lockdown (runtime defense layer 2 / 4).
 *
 * The hostname guard says: only auto-login when the page is served
 * from a Vercel branch-preview URL. Branch-preview hostnames are
 * generated from the Vercel PROJECT name (currently `cm-studio`), not
 * from any custom production domain — they look like
 * `cm-studio-git-<branch>-<team>.vercel.app`. The check below doesn't
 * hardcode that prefix (it just looks for `-git-`), so it survives a
 * future project rename without edits. The production alias — the
 * domain explicitly excluded from auto-login — is `cm-audio.vercel.app`.
 *
 * This guard is paired with three more layers (see also `Lean 2`
 * comments below):
 *   - Layer 1 (build/runtime): vite.config.ts exposes VERCEL_ENV as
 *     `VITE_DEPLOY_ENV`, and auto-login only runs when it is exactly
 *     `preview`.
 *   - Layer 4 (build): vite.config.ts strips the
 *     `VITE_PREVIEW_LOGIN_*` env vars when `VERCEL_ENV === 'production'`,
 *     so they can't appear in the production bundle even if an admin
 *     puts them in the wrong Vercel scope.
 *   - Layer 3 (runtime): we ALSO require an explicit
 *     `VITE_PREVIEW_LOGIN_ALLOWED === 'true'` env var alongside the
 *     email/password creds — a deliberate "yes I really mean it"
 *     opt-in that has to be set on every preview environment.
 */
function isVercelBranchPreview(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  if (!host.endsWith('.vercel.app')) return false
  // Production alias — never auto-login here.
  if (host.startsWith('cm-audio')) return false
  // Branch previews always contain '-git-' in the hostname.
  return host.includes('-git-')
}

function isInstalledAppContext(): boolean {
  if (typeof window === 'undefined') return false
  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches ?? false
  const fullscreenMedia = window.matchMedia?.('(display-mode: fullscreen)').matches ?? false
  // iOS Safari exposes `navigator.standalone` for home-screen apps.
  const iOSStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return standaloneMedia || fullscreenMedia || iOSStandalone
}

/**
 * Race a promise against a timeout so the user never stares at a
 * spinner forever. Used for both sign-in and password-reset calls.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Request timed out — the server may be unavailable. Please try again.')),
        ms,
      ),
    ),
  ])
}

/**
 * Map raw Supabase auth errors to friendly, action-oriented copy.
 *
 * Supabase's defaults are honest but unhelpful for end-users
 * ("Invalid login credentials", "Email not confirmed"). We translate
 * the common ones to plain English with a clear next step. Anything
 * we don't recognize falls through verbatim so we don't accidentally
 * swallow a useful diagnostic.
 */
/**
 * Translate raw Supabase password-reset errors to user-friendly copy.
 * resetPasswordForEmail never reveals whether the email exists (security
 * best practice), so most real-world errors are rate-limits or network
 * issues. Anything unrecognised falls through as-is.
 */
function friendlyResetError(raw: string | undefined): string {
  if (!raw) return 'Something went wrong. Please try again.'
  const lower = raw.toLowerCase()
  if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('email rate limit')) {
    return 'Too many reset requests in a short time. Please wait a few minutes and try again.'
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Network hiccup. Check your connection and try again.'
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'The server took too long to respond. Check your connection and try again.'
  }
  if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
    return "That doesn't look like a valid email address. Please check and try again."
  }
  if (lower.includes('error sending') || lower.includes('unable to send')) {
    return "Couldn't send the email — the link may not be whitelisted in Supabase yet. Ask your admin to set the Site URL in the Supabase dashboard."
  }
  return raw
}

function friendlyAuthError(raw: string | undefined): string {
  if (!raw) return 'Something went wrong signing in. Please try again.'
  const lower = raw.toLowerCase()
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return "That email and password don't match. Double-check both — passwords are case-sensitive."
  }
  if (lower.includes('email not confirmed')) {
    return "Your account isn't fully set up yet. Ask your admin to send you a fresh temporary password."
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Too many sign-in attempts in a row. Wait a minute and try again.'
  }
  if (lower.includes('user not found') || lower.includes('no user found')) {
    return "We don't have an account on file for that email. Double-check the spelling, or ask your admin to add you."
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Network hiccup. Check your connection and try again.'
  }
  return raw
}

export default function Login() {
  const { user, loading: authLoading, signIn } = useAuth()
  useDocumentTitle('Sign In - Checkmark Workspace')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Forgot-password flow ──────────────────────────────────────────
  // Three modes: 'login' (default) → 'reset' (enter email) → 'sent'
  // (confirmation). User can jump back at any point.
  type Mode = 'login' | 'reset' | 'sent'
  const [mode, setMode] = useState<Mode>('login')
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  const goToReset = () => {
    // Pre-fill with whatever they typed in the login form.
    setResetEmail(email)
    setResetError('')
    setMode('reset')
  }
  const backToLogin = () => {
    setResetError('')
    setMode('login')
  }

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    const addr = resetEmail.trim().toLowerCase()
    if (!addr) {
      setResetError('Please enter your email address.')
      return
    }
    setResetError('')
    setResetLoading(true)
    try {
      // No redirectTo — we let Supabase use the Site URL configured in
      // the project dashboard (Authentication → URL Configuration → Site URL).
      // Passing a custom redirectTo requires that URL to be explicitly
      // whitelisted in Supabase's Redirect URLs list; omitting it avoids
      // that requirement entirely. The recovery hash (#type=recovery) lands
      // on whatever the Site URL is, and our index.html inline script catches
      // it before React mounts regardless of which path it lands on.
      const { error: resetErr } = await withTimeout(
        supabase.auth.resetPasswordForEmail(addr),
        10_000,
      )
      if (resetErr) {
        setResetError(friendlyResetError(resetErr.message))
      } else {
        setMode('sent')
      }
    } catch (err) {
      setResetError(friendlyResetError(err instanceof Error ? err.message : undefined))
    } finally {
      setResetLoading(false)
    }
  }

  // Preview auto-login: four independent guards must all pass before
  // we silently sign in. See `isVercelBranchPreview()` above + the
  // build/deploy checks in `vite.config.ts` for the full defense story.
  const deployEnv = import.meta.env.VITE_DEPLOY_ENV as string | undefined
  const previewEmail = import.meta.env.VITE_PREVIEW_LOGIN_EMAIL as string | undefined
  const previewPassword = import.meta.env.VITE_PREVIEW_LOGIN_PASSWORD as string | undefined
  const previewAllowed = import.meta.env.VITE_PREVIEW_LOGIN_ALLOWED as string | undefined
  const previewBuild = deployEnv === 'preview'
  const previewHost = isVercelBranchPreview()
  const installedAppContext = isInstalledAppContext()
  const previewReady =
    previewBuild &&
    Boolean(previewEmail) &&
    Boolean(previewPassword) &&
    previewAllowed === 'true' &&
    previewHost &&
    !installedAppContext
  const [previewRunning, setPreviewRunning] = useState(previewReady)
  const previewFiredRef = useRef(false)

  // Audit log: if the auto-login env vars are present outside a true
  // preview build + preview hostname, surface it loudly in the console
  // so we notice misconfiguration before a real bypass happens.
  // Vite's build-time strip should make the production case
  // unreachable, but a belt-and-suspenders check matters here.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasAnyPreviewVar = Boolean(previewEmail) || Boolean(previewPassword) || Boolean(previewAllowed)
    if (hasAnyPreviewVar && (!previewBuild || !previewHost)) {
      // eslint-disable-next-line no-console
      console.warn(
        '[Login] Preview auto-login vars detected outside an authorized preview deploy. ' +
          'Auto-login was refused. Audit Vercel env scopes — preview login vars must live ' +
          'in the Preview scope only, never Production.',
        { deployEnv, host: window.location.hostname, previewBuild, previewHost },
      )
    }
    if (hasAnyPreviewVar && installedAppContext) {
      // eslint-disable-next-line no-console
      console.info(
        '[Login] Preview auto-login disabled in installed app context. ' +
          'Installed PWA QA must exercise real login/session behavior.',
        { deployEnv, host: window.location.hostname },
      )
    }
  }, [deployEnv, installedAppContext, previewAllowed, previewBuild, previewEmail, previewHost, previewPassword])

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

  useEffect(() => {
    if (!previewReady) return
    if (previewFiredRef.current) return
    if (authLoading) return
    if (user) return
    // Fire exactly once per mount. `signIn` is stable from AuthContext.
    previewFiredRef.current = true
    void (async () => {
      try {
        const { error } = await signIn(previewEmail!, previewPassword!)
        if (error) {
          // Auto-login failed — fall back to the normal form so the
          // user can correct anything. Pre-fill the email to make
          // retry quick.
          setEmail(previewEmail!)
          setError(`Preview auto-login failed: ${error.message}`)
        }
      } catch (err) {
        setEmail(previewEmail!)
        setError(err instanceof Error ? err.message : 'Preview auto-login threw')
      } finally {
        setPreviewRunning(false)
      }
    })()
  }, [authLoading, previewReady, previewEmail, previewPassword, signIn, user])

  if (authLoading || previewRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-bg gap-3" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" aria-hidden="true" />
        {previewRunning && (
          <p className="text-xs text-text-light">Preview auto-login…</p>
        )}
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await withTimeout(signIn(email, password), 10000)
      if (error) setError(friendlyAuthError(error.message))
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : undefined))
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
            <p className="text-gold font-semibold mt-1">Workspace</p>
          </div>

          {/* ── Mode: login ── */}
          {mode === 'login' && (
            <>
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

                  {/* Password input + show/hide toggle */}
                  <div className="space-y-1.5">
                    <label htmlFor="login-password" className="block text-[12px] font-medium text-text-muted">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-3 pr-10 py-2 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-light focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        title={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-muted hover:text-gold hover:bg-surface-hover transition-colors focus-ring"
                        tabIndex={0}
                      >
                        {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>

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

                  <button
                    type="button"
                    onClick={goToReset}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors focus-ring rounded py-1"
                  >
                    <KeyRound size={12} aria-hidden="true" />
                    Forgot password? Get a reset link
                  </button>
                </form>
              </div>
            </>
          )}

          {/* ── Mode: reset (enter email) ── */}
          {mode === 'reset' && (
            <>
              <div className="lg:mb-8 hidden lg:block">
                <h1 className="text-2xl font-bold text-text">Reset your password</h1>
                <p className="text-text-muted mt-1">We'll send a reset link to your email</p>
              </div>

              <div className="bg-surface rounded-2xl border border-border p-7">
                <form onSubmit={handleResetRequest} className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                      <KeyRound size={16} className="text-gold" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text">Forgot your password?</p>
                      <p className="text-[12px] text-text-muted">Enter your email and we'll send a link.</p>
                    </div>
                  </div>

                  <Input
                    id="reset-email"
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoFocus
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                  />

                  {resetError && (
                    <div role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                      {resetError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    block
                    loading={resetLoading}
                    iconLeft={!resetLoading ? <Mail size={15} aria-hidden="true" /> : undefined}
                  >
                    Send reset link
                  </Button>

                  <button
                    type="button"
                    onClick={backToLogin}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors focus-ring rounded py-1"
                  >
                    <ArrowLeft size={12} aria-hidden="true" />
                    Back to sign in
                  </button>
                </form>
              </div>
            </>
          )}

          {/* ── Mode: sent (confirmation) ── */}
          {mode === 'sent' && (
            <>
              <div className="lg:mb-8 hidden lg:block">
                <h1 className="text-2xl font-bold text-text">Check your inbox</h1>
                <p className="text-text-muted mt-1">Reset link on its way</p>
              </div>

              <div className="bg-surface rounded-2xl border border-border p-7 space-y-5">
                <div className="flex flex-col items-center text-center gap-3 py-2">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center">
                    <CheckCircle size={24} className="text-emerald-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-text">Reset link sent</p>
                    <p className="text-[13px] text-text-muted mt-1">
                      We sent a link to <span className="font-semibold text-text">{resetEmail}</span>.
                      Click it to choose a new password.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-surface-alt/60 border border-border px-4 py-3 text-[12px] text-text-muted space-y-1.5">
                  <p className="font-semibold text-text-light uppercase tracking-wide text-[10px]">Didn't get it?</p>
                  <p>• Check your <span className="text-text font-medium">spam / junk</span> folder — it sometimes lands there.</p>
                  <p>• The link expires in <span className="text-text font-medium">1 hour</span>.</p>
                  <p>
                    •{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('reset'); setResetError('') }}
                      className="text-gold hover:underline focus-ring rounded"
                    >
                      Try again
                    </button>
                    {' '}with a different email, or ask your admin.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={backToLogin}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors focus-ring rounded py-1"
                >
                  <ArrowLeft size={12} aria-hidden="true" />
                  Back to sign in
                </button>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
