import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { Button, Input, Modal } from '../components/ui'
import { OWNER_EMAIL } from '../domain/permissions'
import { CheckCircle2, Eye, EyeOff, HelpCircle, LogIn, Mail, Music } from 'lucide-react'
import { supabase } from '../lib/supabase'

/**
 * Lean 2 — preview-login lockdown (runtime defense layer 2 / 3).
 *
 * The hostname guard says: only auto-login when the page is served
 * from a Vercel branch-preview URL. Branch-preview hostnames look
 * like `dashboard-v3-git-<branch>-<team>.vercel.app`; the production
 * alias is `dashboard-v3-dusky.vercel.app`.
 *
 * This guard is paired with two more layers (see also `Lean 2`
 * comments below):
 *   - Layer 3 (build): vite.config.ts strips the
 *     `VITE_PREVIEW_LOGIN_*` env vars when `VERCEL_ENV === 'production'`,
 *     so they can't appear in the production bundle even if an admin
 *     puts them in the wrong Vercel scope.
 *   - Layer 2 (runtime): we ALSO require an explicit
 *     `VITE_PREVIEW_LOGIN_ALLOWED === 'true'` env var alongside the
 *     email/password creds — a deliberate "yes I really mean it"
 *     opt-in that has to be set on every preview environment.
 */
function isVercelBranchPreview(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  if (!host.endsWith('.vercel.app')) return false
  // Production alias — never auto-login here.
  if (host.startsWith('dashboard-v3-dusky')) return false
  // Branch previews always contain '-git-' in the hostname.
  return host.includes('-git-')
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
  const [helpOpen, setHelpOpen] = useState(false)
  // 2026-05-13 — self-serve password reset. Once Gmail SMTP is
  // wired into Supabase auth, the "Need help signing in?" modal
  // becomes a real reset form (email-link flow) instead of a
  // mailto-the-owner fallback. State below drives the form.
  const [resetEmail, setResetEmail] = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)

  // Preview auto-login: three independent guards must all pass before
  // we silently sign in. See `isVercelBranchPreview()` above + the
  // build-time strip in `vite.config.ts` for the full defense story.
  const previewEmail = import.meta.env.VITE_PREVIEW_LOGIN_EMAIL as string | undefined
  const previewPassword = import.meta.env.VITE_PREVIEW_LOGIN_PASSWORD as string | undefined
  const previewAllowed = import.meta.env.VITE_PREVIEW_LOGIN_ALLOWED as string | undefined
  const previewReady =
    Boolean(previewEmail) &&
    Boolean(previewPassword) &&
    previewAllowed === 'true' &&
    isVercelBranchPreview()
  const [previewRunning, setPreviewRunning] = useState(previewReady)
  const previewFiredRef = useRef(false)

  // Audit log: if the auto-login env vars are present on a hostname
  // that ISN'T an authorized preview, surface it loudly in the
  // console so we notice misconfiguration before a real bypass
  // happens. (Vite's build-time strip should make this unreachable
  // on production deployments, but a belt-and-suspenders check
  // matters here.)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasAnyPreviewVar = Boolean(previewEmail) || Boolean(previewPassword) || Boolean(previewAllowed)
    if (hasAnyPreviewVar && !isVercelBranchPreview()) {
      // eslint-disable-next-line no-console
      console.warn(
        '[Login] VITE_PREVIEW_LOGIN_* env vars detected on a non-preview hostname. ' +
          'Auto-login was refused. Audit Vercel env scopes — these vars must live in ' +
          'the Preview scope only, never Production.',
      )
    }
  }, [previewEmail, previewPassword, previewAllowed])

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
      if (error) setError(friendlyAuthError(error.message))
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : undefined))
    } finally {
      setLoading(false)
    }
  }

  // 2026-05-13 — self-serve forgot-password handler. Calls Supabase
  // recovery API; success goes to the modal's success state with
  // explicit "check your email" copy. The mailto-to-owner fallback
  // is preserved as a secondary action in case SMTP fails or the
  // member's email isn't on file.
  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setResetError(null)
    const target = resetEmail.trim().toLowerCase()
    if (!target) {
      setResetError('Enter your account email first.')
      return
    }
    setResetSending(true)
    try {
      const redirectTo =
        typeof window !== 'undefined'
          ? window.location.origin + import.meta.env.BASE_URL
          : undefined
      const { error: rpfeErr } = await supabase.auth.resetPasswordForEmail(
        target,
        redirectTo ? { redirectTo } : undefined,
      )
      if (rpfeErr) {
        // Supabase returns a generic error to avoid email enumeration;
        // surface the message verbatim so the member can act on it.
        setResetError(friendlyAuthError(rpfeErr.message))
        return
      }
      // Supabase intentionally returns success even when the email
      // doesn't exist (anti-enumeration). We show "check your inbox"
      // either way — accurate when the address IS registered, and
      // still safe to claim when it isn't.
      setResetSent(target)
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : 'Something went wrong sending the reset email.',
      )
    } finally {
      setResetSending(false)
    }
  }

  // Mailto fallback — kept around for the "I can't access this email
  // anymore / wrong email on file" path that resetPasswordForEmail
  // can't fix. Pre-fills the support note with whatever the member
  // typed in either the login email field or the reset form.
  const supportSubject = encodeURIComponent('Help signing in to Checkmark')
  const supportBody = encodeURIComponent(
    [
      "Hi — I'm having trouble signing in to the Checkmark workspace.",
      '',
      `Account email: ${(resetEmail || email) || '(please fill in)'}`,
      'Issue (forgot password / email not working / other):',
      '',
      'Thanks!',
    ].join('\n'),
  )
  const supportMailto = `mailto:${OWNER_EMAIL}?subject=${supportSubject}&body=${supportBody}`

  // Closing the modal resets its state so the next open is clean.
  const closeHelpModal = () => {
    setHelpOpen(false)
    setResetSent(null)
    setResetError(null)
    setResetSending(false)
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

              {/* Password input + show/hide toggle. Implemented as a
                  custom block (not the shared `<Input>`) because we
                  need the trailing button to overlay the field and
                  toggle the input `type` between 'password' and
                  'text'. The button is keyboard-focusable + has an
                  aria-label so screen readers know what flips. */}
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

              {/* Need-help link. Opens a small modal explaining the
                  current self-serve story (none — owner-mediated)
                  and pre-fills a mailto to the owner. When SMTP +
                  member-side reset land, this becomes a "Forgot
                  password?" link that fires the recovery flow. */}
              <div className="flex items-center justify-center gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    // Pre-fill the reset form with whatever the
                    // member already typed in the main email field.
                    if (email && !resetEmail) setResetEmail(email)
                    setHelpOpen(true)
                  }}
                  className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-gold transition-colors focus-ring rounded"
                >
                  <HelpCircle size={12} aria-hidden="true" />
                  Forgot your password?
                </button>
              </div>

              <p className="text-xs text-text-light text-center pt-1">
                Need access? Ask your admin to create your account.
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* 2026-05-13 — Forgot Password modal. Real self-serve flow
          now that Gmail SMTP is wired into Supabase auth. The mailto-
          to-owner button stays as a secondary fallback for the
          "I can't access this email anymore" case that
          resetPasswordForEmail can't help with. */}
      <Modal
        open={helpOpen}
        onClose={closeHelpModal}
        title={resetSent ? 'Check your inbox' : 'Forgot your password?'}
        description={
          resetSent
            ? undefined
            : 'Enter the email on file and we\'ll send a one-time reset link.'
        }
        size="sm"
        footer={
          resetSent ? (
            <Button variant="primary" onClick={closeHelpModal}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeHelpModal} disabled={resetSending}>Cancel</Button>
              <Button
                type="submit"
                form="forgot-password-form"
                variant="primary"
                loading={resetSending}
                iconLeft={!resetSending ? <Mail size={14} aria-hidden="true" /> : undefined}
              >
                Email me a reset link
              </Button>
            </>
          )
        }
      >
        {resetSent ? (
          <div className="space-y-3 text-sm text-text-muted">
            <div className="flex items-start gap-3 px-3 py-3 rounded-lg bg-status-success-bg border border-emerald-400/30">
              <CheckCircle2 size={18} className="text-status-success-text mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-status-success-text">
                  Reset link sent
                </p>
                <p className="text-[12px] text-text-muted mt-1">
                  If <span className="font-semibold text-text">{resetSent}</span> is on file, you'll get an email within a minute. Click the link to set a new password.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-text-light">
              Don't see it? Check spam, or{' '}
              <a href={supportMailto} className="text-gold hover:underline">
                email the owner
              </a>{' '}
              if your address has changed.
            </p>
          </div>
        ) : (
          <form id="forgot-password-form" onSubmit={handleResetPassword} className="space-y-3">
            <Input
              id="forgot-email"
              label="Account email"
              type="email"
              required
              autoFocus
              placeholder="you@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              disabled={resetSending}
            />
            {resetError && (
              <div role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                {resetError}
              </div>
            )}
            <p className="text-[11px] text-text-light">
              Wrong email on file or no longer have access?{' '}
              <a href={supportMailto} className="text-gold hover:underline">
                Email {OWNER_EMAIL}
              </a>{' '}
              and we'll fix it manually.
            </p>
          </form>
        )}
      </Modal>
    </div>
  )
}
