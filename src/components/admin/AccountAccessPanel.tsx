import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Copy, Key, Loader2, Shield, ShieldCheck, User as UserIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { OWNER_EMAIL } from '../../domain/permissions'
import { Button, Modal } from '../ui'

/**
 * Generate a reasonably secure, readable temporary password.
 * Length 14 gives ~80 bits of entropy with the allowed alphabet, which
 * is fine for a one-shot value the user will immediately change on
 * first sign-in via the ForcePasswordChangeModal.
 */
function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  const buf = new Uint32Array(14)
  crypto.getRandomValues(buf)
  return Array.from(buf, (n) => alphabet[n % alphabet.length]).join('')
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

  // Reset-password modal state. Lives here (not in the row component) so
  // the temp password stays visible until the owner explicitly closes
  // the modal — avoids any risk of it disappearing before they copy it.
  const [resetTarget, setResetTarget] = useState<AccessUser | null>(null)
  const [resetPending, setResetPending] = useState(false)
  const [resetResult, setResetResult] = useState<{ kind: 'ok'; password: string } | { kind: 'err'; message: string } | null>(null)
  const [resetCopied, setResetCopied] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('intern_users')
        .select('id, email, display_name, role, position, status')
        .order('display_name')
      if (err) throw err
      setUsers((data ?? []) as AccessUser[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts')
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
      setToast({ kind: 'err', message: rpcErr.message || 'Failed to update access' })
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
    setResetCopied(false)
  }, [isOwnerViewer])

  const confirmReset = useCallback(async () => {
    if (!resetTarget) return
    setResetPending(true)
    const newPassword = generateTempPassword()
    const { error: rpcErr } = await supabase.rpc('owner_reset_member_password', {
      p_user_id: resetTarget.id,
      p_new_password: newPassword,
    })
    setResetPending(false)
    if (rpcErr) {
      setResetResult({ kind: 'err', message: rpcErr.message || 'Failed to reset password' })
    } else {
      setResetResult({ kind: 'ok', password: newPassword })
    }
  }, [resetTarget])

  const closeResetModal = useCallback(() => {
    setResetTarget(null)
    setResetResult(null)
    setResetCopied(false)
  }, [])

  const copyTempPassword = useCallback(async (password: string) => {
    try {
      await navigator.clipboard.writeText(password)
      setResetCopied(true)
      setTimeout(() => setResetCopied(false), 2500)
    } catch {
      // Clipboard API may be unavailable; fall back to leaving it visible.
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
    return (
      <div className="flex items-center gap-2 text-sm text-amber-300 px-3 py-4 rounded-lg bg-status-warning-bg border border-amber-400/30">
        <AlertCircle size={16} />
        <span>{error}</span>
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

      {/* ── Reset password modal ──
          Two-stage flow: confirm → generate + call RPC → display temp
          password so the owner can share it with the team member. The
          next login triggers ForcePasswordChangeModal, so this value is
          one-shot. */}
      {resetTarget && (
        <Modal
          open
          onClose={closeResetModal}
          title={resetResult?.kind === 'ok' ? 'Temporary password created' : 'Reset password'}
          description={
            resetResult?.kind === 'ok'
              ? `${resetTarget.display_name} will be prompted to choose a new password the next time they sign in.`
              : `Generate a new temporary password for ${resetTarget.display_name}. They'll be forced to set their own on the next sign-in.`
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
              <p className="text-[13px] text-text-muted">
                Share this password with <span className="font-semibold text-text">{resetTarget.email}</span>.
                They'll use it once to sign in, then be prompted to set their own.
              </p>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 px-3 py-2.5 rounded-lg bg-surface-alt border border-border text-text text-sm font-mono select-all break-all">
                  {resetResult.password}
                </code>
                <button
                  type="button"
                  onClick={() => void copyTempPassword(resetResult.password)}
                  className="shrink-0 px-3 rounded-lg border border-border bg-surface-alt hover:bg-surface-hover text-sm font-semibold text-text focus-ring transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Copy size={13} aria-hidden="true" />
                    {resetCopied ? 'Copied' : 'Copy'}
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-text-light">
                This password won't be shown again. If you close this window before copying, just reset it again.
              </p>
            </div>
          ) : resetResult?.kind === 'err' ? (
            <div role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              {resetResult.message}
            </div>
          ) : (
            <p className="text-[13px] text-text-muted">
              A secure temporary password will be generated and shown to you once. You'll need to send it to{' '}
              <span className="font-semibold text-text">{resetTarget.email}</span> out of band.
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}
