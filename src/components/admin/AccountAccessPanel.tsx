import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Copy, Key, Loader2, RotateCw, Shield, ShieldCheck, User as UserIcon } from 'lucide-react'
import { supabase, withSupabaseRetry } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { OWNER_EMAIL } from '../../domain/permissions'
import { Button, Modal } from '../ui'

/**
 * Best-effort extraction of a human-readable error message from any
 * shape Supabase / fetch / JS might throw. Preferring the most specific
 * field first so we never fall back to "Something went wrong".
 */
function errorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e.message === 'string' && e.message) return e.message
    if (typeof e.error === 'string' && e.error) return e.error
    if (typeof e.error_description === 'string' && e.error_description) return e.error_description
  }
  return fallback
}

/**
 * Generate a strong, human-friendly temp password.
 *
 *  - 14 chars long, mixes upper/lower/digits + a couple of symbols
 *  - Skips look-alike characters (0/O, 1/l/I) so the owner can read
 *    it out loud or paste it into a DM without confusion
 *  - `crypto.getRandomValues` for proper entropy (NOT `Math.random`)
 *
 * Used by the admin reset flow: we generate a temp password client-
 * side, send it to the `admin-reset-password` edge function, then
 * show it back in the modal with a Copy button so the owner can hand
 * it off securely (DM, in-person, etc.). The member is forced to
 * change it on first login via `ForcePasswordChangeModal`.
 */
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ' // no I, L, O
  const lower = 'abcdefghjkmnpqrstuvwxyz' // no i, l, o
  const digits = '23456789'                // no 0, 1
  const symbols = '!@#$%&*'
  const all = upper + lower + digits + symbols
  const len = 14
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  // Guarantee at least one of each class so the password always
  // satisfies common "mixed character" rules.
  const required = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    symbols[arr[3] % symbols.length],
  ]
  const rest = Array.from(arr.slice(4)).map((n) => all[n % all.length])
  // Shuffle so the required chars aren't always at the front.
  const out = [...required, ...rest]
  for (let i = out.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.join('')
}

/**
 * Account Access panel (owner-only).
 *
 * Renders two columns — Admin Access (role='admin') and Employee Access
 * (role='intern') — with a toggle on every non-owner row that flips that
 * user's role. Calls the SECURITY DEFINER RPC `owner_set_member_role`,
 * which itself rejects any caller whose JWT email isn't OWNER_EMAIL, so
 * we have defense-in-depth: UI hides the toggles for non-owners AND the
 * DB refuses writes from them.
 *
 * The owner's own row is shown as pinned + locked: you can never
 * demote the primary admin from this UI (and the DB trigger would
 * silently coerce any such change back anyway).
 */

interface AccessUser {
  id: string
  email: string
  display_name: string
  role: 'admin' | 'intern'
  position: string | null
  status: string | null
}

function UserRow({
  user,
  isOwnerViewer,
  isPrimaryOwner,
  busy,
  onToggle,
  onResetPassword,
}: {
  user: AccessUser
  isOwnerViewer: boolean
  isPrimaryOwner: boolean
  busy: boolean
  onToggle: (user: AccessUser) => void
  onResetPassword: (user: AccessUser) => void
}) {
  const initial = user.display_name?.charAt(0)?.toUpperCase() ?? user.email.charAt(0).toUpperCase()
  const positionLabel = user.position
    ? user.position.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Team member'

  return (
    <div
      className={[
        'flex items-center gap-3 px-3 py-3 rounded-xl border transition-colors',
        isPrimaryOwner
          ? 'bg-gold/[0.06] border-gold/30'
          : 'bg-surface-alt/60 border-border hover:border-border-light',
      ].join(' ')}
    >
      <div className="w-9 h-9 rounded-full bg-surface border border-border-light text-gold flex items-center justify-center text-sm font-bold shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text truncate">{user.display_name}</p>
        <p className="text-[12px] text-text-muted truncate">{user.email}</p>
        <p className="text-[11px] text-text-light mt-0.5">
          {isPrimaryOwner ? (
            <span className="inline-flex items-center gap-1 text-gold font-semibold">
              <ShieldCheck size={11} /> Primary owner · cannot be changed
            </span>
          ) : (
            positionLabel
          )}
        </p>
      </div>

      {/* Reset password — owner-only, never shown on the primary owner row */}
      {isOwnerViewer && !isPrimaryOwner && (
        <button
          type="button"
          onClick={() => onResetPassword(user)}
          disabled={busy}
          title={`Reset password for ${user.display_name}`}
          aria-label={`Reset password for ${user.display_name}`}
          className="shrink-0 p-2 rounded-lg text-text-muted hover:bg-surface-hover hover:text-gold transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Key size={14} aria-hidden="true" />
        </button>
      )}

      {/* Admin toggle (owner-only). Non-owner viewers see read-only state. */}
      <label
        className={[
          'flex items-center gap-2 shrink-0',
          isOwnerViewer && !isPrimaryOwner ? 'cursor-pointer' : 'cursor-not-allowed opacity-70',
        ].join(' ')}
        title={
          isPrimaryOwner
            ? 'The primary owner account is locked as admin.'
            : isOwnerViewer
              ? user.role === 'admin'
                ? 'Uncheck to revoke admin access'
                : 'Check to grant admin access'
              : 'Only the primary owner can change access.'
        }
      >
        <input
          type="checkbox"
          checked={user.role === 'admin'}
          onChange={() => onToggle(user)}
          disabled={!isOwnerViewer || isPrimaryOwner || busy}
          aria-label={`Admin access for ${user.display_name}`}
          className="w-4 h-4 rounded border-border accent-gold"
        />
        <span className="text-[11px] font-semibold text-text-muted tabular-nums w-12 text-right">
          {busy ? '…' : user.role === 'admin' ? 'Admin' : 'Employee'}
        </span>
      </label>
    </div>
  )
}

export default function AccountAccessPanel() {
  const { user } = useAuth()
  const viewerEmail = (user?.email ?? '').trim().toLowerCase()
  const isOwnerViewer = viewerEmail === OWNER_EMAIL

  const [users, setUsers] = useState<AccessUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null)

  // Reset-password modal state.
  //
  // 2026-05-08 — switched from `auth.resetPasswordForEmail` to the
  // `admin-reset-password` edge function. Supabase's built-in SMTP only
  // delivers recovery emails to the project-owner address on free
  // tier; every other recipient got "Unable to process request" back
  // from GoTrue, which surfaced as a useless modal error. Until we
  // wire a real SMTP provider (Resend / SendGrid / etc.) we use the
  // already-deployed admin reset flow: the owner generates a temp
  // password, sees it in the modal with a Copy button, hands it off
  // out-of-band (DM, in-person), and `ForcePasswordChangeModal`
  // forces the member to change it on first login.
  const [resetTarget, setResetTarget] = useState<AccessUser | null>(null)
  const [resetPending, setResetPending] = useState(false)
  const [resetResult, setResetResult] = useState<
    | { kind: 'ok'; tempPassword: string }
    | { kind: 'err'; message: string }
    | null
  >(null)
  const [tempPasswordCopied, setTempPasswordCopied] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      // withSupabaseRetry silently absorbs transient auth-lock errors
      // ("Lock ... was released because another request stole it") and
      // network blips — up to 3 attempts with exponential backoff.
      // Only real errors (RLS, validation, etc.) propagate to the UI.
      const rows = await withSupabaseRetry(async () => {
        const { data, error: err } = await supabase
          .from('team_members')
          .select('id, email, display_name, role, position, status')
          .order('display_name')
        if (err) throw err
        return (data ?? []) as AccessUser[]
      })
      setUsers(rows)
      setError(null)
    } catch (err) {
      setError(errorMessage(err, 'Failed to load accounts'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refetch() }, [refetch])

  const onToggle = useCallback(async (target: AccessUser) => {
    if (!isOwnerViewer) return
    if ((target.email ?? '').toLowerCase() === OWNER_EMAIL) return
    const nextRole = target.role === 'admin' ? 'intern' : 'admin'

    // Optimistic update — snap UI now, roll back on error.
    setBusyId(target.id)
    setToast(null)
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role: nextRole } : u)))

    const { error: rpcErr } = await supabase.rpc('owner_set_member_role', {
      p_user_id: target.id,
      p_new_role: nextRole,
    })
    if (rpcErr) {
      // Roll back and surface the error.
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role: target.role } : u)))
      setToast({ kind: 'err', message: errorMessage(rpcErr, 'Failed to update access') })
    } else {
      setToast({
        kind: 'ok',
        message: `${target.display_name} is now ${nextRole === 'admin' ? 'an admin' : 'an employee'}.`,
      })
    }
    setBusyId(null)
    setTimeout(() => setToast(null), 4000)
  }, [isOwnerViewer])

  const onResetPassword = useCallback((target: AccessUser) => {
    if (!isOwnerViewer) return
    if ((target.email ?? '').toLowerCase() === OWNER_EMAIL) return
    setResetTarget(target)
    setResetResult(null)
  }, [isOwnerViewer])

  const confirmReset = useCallback(async () => {
    if (!resetTarget) return
    setResetPending(true)
    setTempPasswordCopied(false)

    // Generate a strong temp password client-side, hand it to the
    // owner-only edge function which:
    //   1. Verifies the caller's JWT email == OWNER_EMAIL
    //   2. Calls `auth.admin.updateUserById()` with the new password
    //   3. Sets `requires_password_change: true` in user_metadata
    //   4. Returns the target email on success
    // The owner shares the temp password with the member out-of-band;
    // on first login `ForcePasswordChangeModal` forces a change.
    const tempPassword = generateTempPassword()
    const { data, error: invokeErr } = await supabase.functions.invoke<{
      ok: boolean
      error?: string
      email?: string
    }>('admin-reset-password', {
      body: { user_id: resetTarget.id, new_password: tempPassword },
    })
    setResetPending(false)

    // Two failure shapes:
    //   - network / 4xx / 5xx → `invokeErr` populated
    //   - function returned 200 with `{ ok: false, error }` shape
    if (invokeErr) {
      setResetResult({ kind: 'err', message: errorMessage(invokeErr, 'Failed to reset password') })
      return
    }
    if (!data?.ok) {
      setResetResult({ kind: 'err', message: data?.error ?? 'Failed to reset password' })
      return
    }
    setResetResult({ kind: 'ok', tempPassword })
  }, [resetTarget])

  const closeResetModal = useCallback(() => {
    setResetTarget(null)
    setResetResult(null)
    setTempPasswordCopied(false)
  }, [])

  const copyTempPassword = useCallback(async (pw: string) => {
    try {
      await navigator.clipboard.writeText(pw)
      setTempPasswordCopied(true)
      setTimeout(() => setTempPasswordCopied(false), 2000)
    } catch {
      // Clipboard API can fail in non-secure contexts; the password
      // is still visible in the modal so the owner can select-all
      // and copy manually as a fallback.
    }
  }, [])

  const { admins, employees } = useMemo(() => {
    const admins: AccessUser[] = []
    const employees: AccessUser[] = []
    for (const u of users) {
      if (u.role === 'admin') admins.push(u)
      else employees.push(u)
    }
    // Pin the primary owner at the top of the admin list.
    admins.sort((a, b) => {
      const aOwner = a.email.toLowerCase() === OWNER_EMAIL
      const bOwner = b.email.toLowerCase() === OWNER_EMAIL
      if (aOwner !== bOwner) return aOwner ? -1 : 1
      return a.display_name.localeCompare(b.display_name)
    })
    return { admins, employees }
  }, [users])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-light">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (error) {
    // If we're showing this, the error survived 3 auto-retries —
    // so it's real, not a transient hiccup. Present it calmly with a
    // clear action rather than a noisy warning.
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 text-sm px-4 py-3.5 rounded-xl bg-surface-alt/60 border border-border">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text">We couldn't load accounts.</p>
            <p className="text-[12px] text-text-muted mt-0.5 break-words">{error}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<RotateCw size={14} />}
            onClick={() => void refetch()}
            loading={loading}
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-text flex items-center gap-2">
            <Shield size={18} className="text-gold" /> Account Access
          </h2>
          <p className="text-[13px] text-text-muted mt-1 max-w-[52ch]">
            Grant or revoke admin access. Only the primary owner
            (<code className="px-1 py-0.5 rounded bg-surface-alt text-[11px]">{OWNER_EMAIL}</code>)
            can change these toggles — the database enforces this.
          </p>
        </div>
        <span
          className={[
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold',
            isOwnerViewer
              ? 'text-gold bg-gold/10 border border-gold/30'
              : 'text-text-light bg-surface-alt border border-border',
          ].join(' ')}
        >
          {isOwnerViewer ? <ShieldCheck size={12} /> : <UserIcon size={12} />}
          {isOwnerViewer ? 'Owner · edits enabled' : 'Read-only'}
        </span>
      </header>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={[
            'px-3 py-2 rounded-lg text-[13px] border',
            toast.kind === 'ok'
              ? 'bg-status-success-bg text-status-success-text border-emerald-400/30'
              : 'bg-status-danger-bg text-status-danger-text border-red-400/30',
          ].join(' ')}
        >
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* ── Admin column ── */}
        <section className="bg-surface-alt/40 rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center justify-between px-1 py-1">
            <h3 className="text-sm font-bold text-text flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-gold" /> Admin Access
            </h3>
            <span className="text-[11px] text-text-light tabular-nums">{admins.length}</span>
          </div>
          {admins.length === 0 ? (
            <p className="text-[12px] text-text-light italic px-2 py-4">No admins.</p>
          ) : (
            admins.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isOwnerViewer={isOwnerViewer}
                isPrimaryOwner={u.email.toLowerCase() === OWNER_EMAIL}
                busy={busyId === u.id}
                onToggle={onToggle}
                onResetPassword={onResetPassword}
              />
            ))
          )}
        </section>

        {/* ── Employee column ── */}
        <section className="bg-surface-alt/40 rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center justify-between px-1 py-1">
            <h3 className="text-sm font-bold text-text flex items-center gap-1.5">
              <UserIcon size={14} className="text-text-muted" /> Employee Access
            </h3>
            <span className="text-[11px] text-text-light tabular-nums">{employees.length}</span>
          </div>
          {employees.length === 0 ? (
            <p className="text-[12px] text-text-light italic px-2 py-4">No employees.</p>
          ) : (
            employees.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isOwnerViewer={isOwnerViewer}
                isPrimaryOwner={false}
                busy={busyId === u.id}
                onToggle={onToggle}
                onResetPassword={onResetPassword}
              />
            ))
          )}
        </section>
      </div>

      {/* ── Password reset modal — temp-password handoff flow ──
          Owner clicks "Reset password" → modal asks for confirmation →
          edge function generates and sets a temp password → modal
          reveals the temp password with a Copy button → owner shares
          it with the member out-of-band → member logs in → forced to
          change it via ForcePasswordChangeModal.
          Switching back to a true email-link flow is queued behind
          configuring a custom SMTP provider in Supabase. */}
      {resetTarget && (
        <Modal
          open
          onClose={closeResetModal}
          title={resetResult?.kind === 'ok' ? 'Temporary password ready' : 'Reset password'}
          description={
            resetResult?.kind === 'ok'
              ? undefined
              : `Generate a one-time password for ${resetTarget.display_name}. They'll be forced to change it on first login.`
          }
          size="sm"
          footer={
            resetResult?.kind === 'ok' ? (
              <Button variant="primary" onClick={closeResetModal}>Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={closeResetModal} disabled={resetPending}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={() => void confirmReset()}
                  loading={resetPending}
                  iconLeft={!resetPending ? <Key size={14} aria-hidden="true" /> : undefined}
                >
                  Generate password
                </Button>
              </>
            )
          }
        >
          {resetResult?.kind === 'ok' ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 px-3 py-3 rounded-lg bg-status-success-bg border border-emerald-400/30">
                <CheckCircle2 size={18} className="text-status-success-text mt-0.5 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-status-success-text">
                    New password set for {resetTarget.email}
                  </p>
                  <p className="text-[12px] text-text-muted mt-1">
                    Share the password below with {resetTarget.display_name}. They'll be forced to choose their own on first login.
                  </p>
                </div>
              </div>
              {/* Copyable password block. Mono font + select-all on
                  click so the owner can either hit Copy or just
                  triple-click → ⌘C as a backup. */}
              <div className="rounded-lg border border-border bg-surface-alt/60 p-3">
                <p className="text-[10px] font-semibold tracking-wider uppercase text-text-light mb-1.5">
                  Temporary password
                </p>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 min-w-0 px-3 py-2 rounded-md bg-surface border border-border-light font-mono text-sm text-text break-all select-all"
                    onClick={(e) => {
                      const range = document.createRange()
                      range.selectNodeContents(e.currentTarget)
                      const sel = window.getSelection()
                      sel?.removeAllRanges()
                      sel?.addRange(range)
                    }}
                  >
                    {resetResult.tempPassword}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Copy size={13} aria-hidden="true" />}
                    onClick={() => void copyTempPassword(resetResult.tempPassword)}
                  >
                    {tempPasswordCopied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-text-light">
                Tip: send it through a private channel (DM, in-person). The password is single-use — Checkmark forces a change as soon as they log in.
              </p>
            </div>
          ) : resetResult?.kind === 'err' ? (
            <div role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              {resetResult.message}
            </div>
          ) : (
            <p className="text-[13px] text-text-muted">
              A temporary password will be generated for{' '}
              <span className="font-semibold text-text">{resetTarget.email}</span>.
              You'll be able to copy it and hand it off — they'll set their own password on next login.
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}
