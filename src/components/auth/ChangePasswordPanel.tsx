import { useCallback, useMemo, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui'

/**
 * Member-side change-password panel.
 *
 * Mounted inside `Profile.tsx` when the viewer is looking at their
 * own profile. Pure self-serve — no admin involvement, no email
 * required (Supabase's `auth.updateUser({ password })` works against
 * any active session).
 *
 * Flow:
 *   1. Member enters current password + new password + confirm
 *   2. We verify the current password by calling
 *      `signInWithPassword({ email, password: current })`. This is
 *      the only call Supabase exposes for "is this password right?"
 *      — it silently rotates the session JWT but doesn't sign the
 *      user out, which is the behavior we want.
 *   3. On verify success → call `updateUser({ password: new })`
 *   4. Toast success, clear the form.
 *
 * Why re-auth: without it anyone with momentary browser access
 * (an unattended laptop, an over-the-shoulder snoop) could change
 * the password. The re-auth step closes that window without
 * requiring an email round-trip.
 */
export default function ChangePasswordPanel() {
  const { user } = useAuth()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<
    | { kind: 'ok' }
    | { kind: 'err'; message: string }
    | null
  >(null)

  // Length-based strength bucket. Intentionally simple — Supabase
  // already enforces a min length on the server side; this is just
  // visual feedback so the member can see they're choosing
  // something not-terrible.
  const strength = useMemo<{ label: string; tone: 'weak' | 'ok' | 'strong' } | null>(() => {
    if (next.length === 0) return null
    if (next.length < 8) return { label: 'Too short', tone: 'weak' }
    if (next.length < 12) return { label: 'OK', tone: 'ok' }
    return { label: 'Strong', tone: 'strong' }
  }, [next])

  const matchError = useMemo<string | null>(() => {
    if (next.length === 0 || confirm.length === 0) return null
    if (next !== confirm) return "Passwords don't match"
    return null
  }, [next, confirm])

  const submitDisabled =
    pending ||
    !current ||
    next.length < 8 ||
    next !== confirm

  const reset = useCallback(() => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setShowCurrent(false)
    setShowNext(false)
  }, [])

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setResult(null)
      if (!user?.email) {
        setResult({ kind: 'err', message: 'No active session — please sign in again.' })
        return
      }
      setPending(true)
      try {
        // Step 1 — verify current password. Supabase doesn't expose a
        // dedicated "verify password" call, so signInWithPassword is
        // the documented workaround. It rotates the JWT but doesn't
        // log the user out, so the rest of the page keeps working.
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: current,
        })
        if (verifyErr) {
          setResult({
            kind: 'err',
            message:
              verifyErr.message.toLowerCase().includes('invalid')
                ? 'Current password is incorrect.'
                : verifyErr.message,
          })
          return
        }

        // Step 2 — set the new password. Supabase enforces min 6 by
        // default; we enforce min 8 client-side for a saner floor.
        const { error: updateErr } = await supabase.auth.updateUser({ password: next })
        if (updateErr) {
          setResult({ kind: 'err', message: updateErr.message })
          return
        }

        setResult({ kind: 'ok' })
        reset()
      } catch (err) {
        setResult({
          kind: 'err',
          message: err instanceof Error ? err.message : 'Failed to update password.',
        })
      } finally {
        setPending(false)
      }
    },
    [current, next, user?.email, reset],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={14} className="text-gold" aria-hidden="true" />
        <h2 className="text-[11px] font-semibold text-gold uppercase tracking-wider">
          Security
        </h2>
      </div>

      <div className="rounded-xl border border-border bg-surface-alt/40 p-5">
        <p className="text-sm font-semibold text-text">Change your password</p>
        <p className="text-[12px] text-text-muted mt-1">
          Verify your current password, then choose a new one. You'll stay signed in afterwards.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          {/* Current password */}
          <PasswordField
            id="cp-current"
            label="Current password"
            value={current}
            onChange={setCurrent}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((v) => !v)}
            autoComplete="current-password"
          />

          {/* New password — single show/hide toggle covers both new + confirm */}
          <div className="space-y-1.5">
            <PasswordField
              id="cp-next"
              label="New password"
              value={next}
              onChange={setNext}
              show={showNext}
              onToggleShow={() => setShowNext((v) => !v)}
              autoComplete="new-password"
              minLength={8}
              hint="Minimum 8 characters."
            />
            {strength && (
              <div className="flex items-center gap-2 px-1">
                <div className="flex-1 h-1 rounded-full bg-surface-alt overflow-hidden">
                  <div
                    className={[
                      'h-full transition-all duration-200',
                      strength.tone === 'weak' && 'w-1/4 bg-rose-400',
                      strength.tone === 'ok' && 'w-2/4 bg-amber-400',
                      strength.tone === 'strong' && 'w-full bg-emerald-400',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                </div>
                <span
                  className={[
                    'text-[10px] font-semibold uppercase tracking-wider',
                    strength.tone === 'weak' && 'text-rose-400',
                    strength.tone === 'ok' && 'text-amber-400',
                    strength.tone === 'strong' && 'text-emerald-400',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {/* Confirm — reuses the new-password show toggle so members
              can verify they typed the same thing twice. */}
          <PasswordField
            id="cp-confirm"
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            show={showNext}
            onToggleShow={() => setShowNext((v) => !v)}
            autoComplete="new-password"
            minLength={8}
            error={matchError ?? undefined}
          />

          {result?.kind === 'err' && (
            <div role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              {result.message}
            </div>
          )}
          {result?.kind === 'ok' && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-status-success-bg border border-emerald-400/30">
              <CheckCircle2 size={16} className="text-status-success-text mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-sm text-status-success-text">
                Password updated. You'll use the new one next time you sign in.
              </p>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="primary"
              loading={pending}
              disabled={submitDisabled}
              iconLeft={!pending ? <KeyRound size={14} aria-hidden="true" /> : undefined}
            >
              Update password
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Local helper ────────────────────────────────────────────────

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  autoComplete?: string
  minLength?: number
  hint?: string
  error?: string
}

/**
 * Local password input with show/hide eye toggle. Keeps the markup
 * consistent across all three fields without spamming the parent
 * with three identical blocks.
 */
function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  minLength,
  hint,
  error,
}: PasswordFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[12px] font-medium text-text-muted">
        {label}
      </label>
      <div className="relative">
        <Lock
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light pointer-events-none"
          aria-hidden="true"
        />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          className="w-full pl-9 pr-10 py-2 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-light focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-muted hover:text-gold hover:bg-surface-hover transition-colors focus-ring"
        >
          {show ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <p className="text-[11px] text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-text-light">{hint}</p>
      ) : null}
    </div>
  )
}
