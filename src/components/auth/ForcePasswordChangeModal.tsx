import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'
import { Modal, Button, Input } from '../ui'
import { KeyRound } from 'lucide-react'

/**
 * Phase 6.2 — Forces an admin-created member to set a new password on
 * their first login. Renders nothing unless the signed-in user has
 * `requires_password_change: true` in their `auth.users.user_metadata`
 * (the `admin-create-member` Edge Function v3 sets that flag when an
 * admin creates the account).
 *
 * The modal is locked: backdrop click and Escape do nothing, and there
 * is no close button. The only way out is to actually change the
 * password. Once the change succeeds, we update `user_metadata` in the
 * same `auth.updateUser` call so the flag clears, then call
 * `refreshProfile()` to pull the new auth state into context — the
 * modal then unmounts on the next render and the dashboard appears.
 */
export default function ForcePasswordChangeModal() {
  const { user, refreshProfile, isPasswordRecovery, clearPasswordRecovery } = useAuth()
  const { toast } = useToast()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Trigger in either of two scenarios:
  //   1. Admin-created account with requires_password_change flag set
  //      by admin-create-member (first-login onboarding)
  //   2. User clicked the recovery link from a password-reset email —
  //      AuthContext sets isPasswordRecovery=true on the
  //      PASSWORD_RECOVERY event from supabase.auth.onAuthStateChange
  const requiresChange = user?.user_metadata?.requires_password_change === true
  if (!user || (!requiresChange && !isPasswordRecovery)) return null

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
    // Update password AND clear the requires_password_change flag in one
    // round trip. Preserves any other user_metadata fields the admin set.
    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPassword,
      data: {
        ...user.user_metadata,
        requires_password_change: false,
      },
    })
    setSubmitting(false)

    if (updateErr) {
      setError(updateErr.message)
      return
    }

    toast('Password updated — welcome to Checkmark Audio')
    setNewPassword('')
    setConfirmPassword('')
    // Drop the recovery flag too — if we got here from clicking a
    // reset email (isPasswordRecovery=true), we're done with it.
    clearPasswordRecovery()
    // Re-pull session so user_metadata picks up the cleared flag.
    await refreshProfile()
  }

  return (
    <Modal
      open
      // onClose is required by the prop type but never invoked because
      // we set locked + hideCloseButton.
      onClose={() => {}}
      locked
      hideCloseButton
      title="Set your password"
      description="Your account was created by an admin. Choose a new password to continue."
      size="sm"
      footer={
        <Button
          type="submit"
          form="force-password-change-form"
          variant="primary"
          loading={submitting}
          iconLeft={!submitting ? <KeyRound size={14} aria-hidden="true" /> : undefined}
        >
          Update password
        </Button>
      }
    >
      <form id="force-password-change-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="force-pwd-new"
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
          id="force-pwd-confirm"
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
      </form>
    </Modal>
  )
}
