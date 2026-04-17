import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
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
  const { isPasswordRecovery, clearPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Previously we gated the form on React's `user` state being set,
  // which created a window where the user stared at a spinner while
  // waiting for supabase-js to update the context. We now render the
  // form immediately — supabase.auth.updateUser() works off the
  // stored session, which is already present by the time we got here
  // (either the URL hash was consumed or the PASSWORD_RECOVERY event
  // fired). No need to block on React state catching up.

  // Defensive: if the flag got set but no actual session was
  // established within 10 seconds (e.g., the recovery token was
  // invalid/expired), clear the flag and fall through to normal
  // routing so the user isn't permanently stuck here.
  useEffect(() => {
    if (!isPasswordRecovery) return
    const bail = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) clearPasswordRecovery()
    }, 10_000)
    return () => clearTimeout(bail)
  }, [isPasswordRecovery, clearPasswordRecovery])

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
        </div>
      </div>
    </div>
  )
}
