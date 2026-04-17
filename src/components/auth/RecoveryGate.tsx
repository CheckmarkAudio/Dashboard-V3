import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button, Input } from '../ui'

/**
 * Top-level route interceptor for Supabase password recovery.
 *
 * Why this exists:
 *   When a user clicks the "Reset Your Password" link in their email,
 *   supabase-js silently consumes the token hash (it's async), React's
 *   ProtectedRoute sees `!user` during the race window and redirects
 *   them to /login, and they end up staring at the login form instead
 *   of a password-set form. It's a bug that affects every SPA using
 *   Supabase's default recovery flow.
 *
 * How this fixes it:
 *   - main.tsx detects `type=recovery` in the URL hash BEFORE React
 *     mounts and stashes a flag in sessionStorage.
 *   - AuthContext reads that flag synchronously into `isPasswordRecovery`.
 *   - This component wraps the entire app's routes. When
 *     `isPasswordRecovery` is true, it renders a locked full-screen
 *     "Set your password" form instead of whatever the router would
 *     otherwise render — no /login redirect, no dashboard flash, no
 *     navigation confusion.
 *   - On successful password change, it clears the flag and navigates
 *     the user to the dashboard. They're already signed in by virtue
 *     of the recovery token, so no second login is needed.
 */
export default function RecoveryGate({ children }: { children: ReactNode }) {
  const { isPasswordRecovery, user, clearPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // If isPasswordRecovery was set but supabase-js hasn't finished
  // establishing the session yet, user will still be null for a
  // moment. Once user is set, we're ready to let them submit.
  const sessionReady = !!user

  // Defensive: if somehow isPasswordRecovery got stuck on with no
  // supabase session to back it, give up after 8 seconds and clear
  // the flag so the user isn't permanently stuck staring at a spinner.
  useEffect(() => {
    if (!isPasswordRecovery || sessionReady) return
    const bail = setTimeout(() => {
      if (!sessionReady) clearPasswordRecovery()
    }, 8000)
    return () => clearTimeout(bail)
  }, [isPasswordRecovery, sessionReady, clearPasswordRecovery])

  if (!isPasswordRecovery) return <>{children}</>

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
    setSubmitting(false)
    if (updateErr) {
      setError(updateErr.message)
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    clearPasswordRecovery()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4">
            <KeyRound size={24} className="text-gold" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-text">Set your new password</h1>
          <p className="text-text-muted mt-1 text-sm">
            You're signing in from a password-reset link. Choose a new password to finish.
          </p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-7">
          {!sessionReady ? (
            <div className="flex items-center justify-center py-8 text-text-light">
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              <span className="ml-2 text-sm">Verifying reset link…</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="recovery-new-password"
                label="New password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                hint="At least 8 characters."
              />
              <Input
                id="recovery-confirm-password"
                label="Confirm new password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {error && (
                <div role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                variant="primary"
                block
                loading={submitting}
                iconLeft={!submitting ? <KeyRound size={14} aria-hidden="true" /> : undefined}
              >
                Update password
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
