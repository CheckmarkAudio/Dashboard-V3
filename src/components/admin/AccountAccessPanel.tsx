import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Key, Loader2, Pencil, RotateCw, Shield, ShieldCheck, User as UserIcon, X } from 'lucide-react'
import { supabase, withSupabaseRetry } from '../../lib/supabase'
import { extractEdgeFunctionError } from '../../lib/edgeFunctionError'
import { useAuth } from '../../contexts/AuthContext'
import { OWNER_EMAIL } from '../../domain/permissions'
import { Button, Modal } from '../ui'
import SetupLinkReveal from '../auth/SetupLinkReveal'

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

function normalizeAccessUser(row: Partial<AccessUser>): AccessUser {
  const email = (row.email ?? '').trim().toLowerCase()
  const displayName = (row.display_name ?? '').trim()
  const role = row.role === 'admin' ? 'admin' : 'intern'
  return {
    id: row.id ?? '',
    email,
    display_name: displayName || email || 'Unnamed member',
    role,
    position: row.position ?? null,
    status: row.status ?? null,
  }
}

/**
 * Account Access panel (owner-only).
 *
 * Renders two columns — Admin Access (role='admin') and Employee Access.
 * Owner can flip access roles. Admins can generate setup links for
 * coworkers. The database/edge function re-checks both permissions.
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
  canManageAccess,
  canGenerateSetupLinks,
  isPrimaryOwner,
  busy,
  onToggle,
  onGenerateSetupLink,
  onUpdateEmail,
}: {
  user: AccessUser
  canManageAccess: boolean
  canGenerateSetupLinks: boolean
  isPrimaryOwner: boolean
  busy: boolean
  onToggle: (user: AccessUser) => void
  onGenerateSetupLink: (user: AccessUser) => void
  onUpdateEmail: (user: AccessUser, newEmail: string) => Promise<boolean>
}) {
  const initial =
    user.display_name?.charAt(0)?.toUpperCase() ||
    user.email?.charAt(0)?.toUpperCase() ||
    '?'
  const positionLabel = user.position
    ? user.position.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Team member'

  // Inline email editor state — per-row local so opening the editor on
  // one row doesn't lock the others. Enter saves, Escape cancels.
  // 2026-05-14 added per user ask: "can you make emails editable in
  // settings? I had a typo in one of the emails but couldn't fix it."
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(user.email)
  const [submitting, setSubmitting] = useState(false)
  const canEditEmail = isOwnerViewer && !isPrimaryOwner

  const beginEdit = () => {
    setDraft(user.email)
    setEditing(true)
  }
  const cancelEdit = () => {
    setEditing(false)
    setDraft(user.email)
  }
  const saveEdit = async () => {
    const next = draft.trim().toLowerCase()
    if (!next || next === user.email) {
      cancelEdit()
      return
    }
    setSubmitting(true)
    try {
      const ok = await onUpdateEmail(user, next)
      if (ok) setEditing(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={[
        'group/row flex items-center gap-3 px-3 py-3 rounded-xl border transition-colors',
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
        {editing ? (
          // Inline email editor — input + save (✓) + cancel (X). Enter
          // saves, Escape cancels. Disabled while the network call is
          // in flight so double-submits can't fire.
          <div className="flex items-center gap-1.5 mt-0.5">
            <input
              type="email"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void saveEdit()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelEdit()
                }
              }}
              disabled={submitting}
              aria-label={`New email for ${user.display_name}`}
              className="flex-1 min-w-0 px-2 py-1 rounded-md text-[12px] bg-surface border border-border text-text focus-ring disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void saveEdit()}
              disabled={submitting || !draft.trim() || draft.trim().toLowerCase() === user.email}
              aria-label="Save email"
              className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-ring"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={submitting}
              aria-label="Cancel email edit"
              className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:bg-surface-hover hover:text-text disabled:opacity-40 transition-colors focus-ring"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-[12px] text-text-muted truncate">{user.email}</p>
            {canEditEmail && (
              <button
                type="button"
                onClick={beginEdit}
                aria-label={`Edit email for ${user.display_name}`}
                title="Edit email"
                className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-text-light hover:text-gold hover:bg-surface-hover opacity-0 group-hover/row:opacity-100 transition-all focus-ring"
              >
                <Pencil size={11} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
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

      {/* Setup link — admin/owner only, never shown on the primary owner row */}
      {canGenerateSetupLinks && !isPrimaryOwner && (
        <button
          type="button"
          onClick={() => onGenerateSetupLink(user)}
          disabled={busy}
          title={`Generate setup link for ${user.display_name}`}
          aria-label={`Generate setup link for ${user.display_name}`}
          className="shrink-0 p-2 rounded-lg text-text-muted hover:bg-surface-hover hover:text-gold transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Key size={14} aria-hidden="true" />
        </button>
      )}

      {/* Admin toggle (owner-only). Non-owner viewers see read-only state. */}
      <label
        className={[
          'flex items-center gap-2 shrink-0',
          canManageAccess && !isPrimaryOwner ? 'cursor-pointer' : 'cursor-not-allowed opacity-70',
        ].join(' ')}
        title={
          isPrimaryOwner
            ? 'The primary owner account is locked as admin.'
            : canManageAccess
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
          disabled={!canManageAccess || isPrimaryOwner || busy}
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
  const { user, profile } = useAuth()
  const viewerEmail = (user?.email ?? '').trim().toLowerCase()
  const isOwnerViewer = viewerEmail === OWNER_EMAIL
  const isAdminViewer = profile?.role === 'admin'
  const canManageAccess = isOwnerViewer
  const canGenerateSetupLinks = isOwnerViewer || isAdminViewer

  const [users, setUsers] = useState<AccessUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null)

  // Setup-link modal state.
  //
  // Supabase's built-in SMTP has been unreliable for non-owner
  // recipients in this project, so this flow does not ask Supabase to
  // send email. The owner/admin generates the recovery link directly,
  // then copies it into email/DM. The member chooses their own password.
  const [resetTarget, setResetTarget] = useState<AccessUser | null>(null)
  const [resetPending, setResetPending] = useState(false)
  const [resetResult, setResetResult] = useState<
    | { kind: 'ok'; setupLink: string }
    | { kind: 'err'; message: string }
    | null
  >(null)

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
        return (data ?? []).map((row) => normalizeAccessUser(row as Partial<AccessUser>))
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

  const onGenerateSetupLink = useCallback((target: AccessUser) => {
    if (!canGenerateSetupLinks) return
    if ((target.email ?? '').toLowerCase() === OWNER_EMAIL) return
    setResetTarget(target)
    setResetResult(null)
  }, [canGenerateSetupLinks])

  // Inline email correction. Owner-only path that hits the
  // `admin-update-email` edge function — that function does the
  // owner-JWT check + service-role auth.users update + team_members
  // mirror in one round trip. Returns true on success so the row's
  // editor can close itself; false on error (toast carries the
  // reason) so the editor stays open for the user to fix the value.
  const onUpdateEmail = useCallback(
    async (target: AccessUser, newEmail: string): Promise<boolean> => {
      if (!isOwnerViewer) return false
      if ((target.email ?? '').toLowerCase() === OWNER_EMAIL) {
        setToast({ kind: 'err', message: 'The primary owner email cannot be changed here.' })
        setTimeout(() => setToast(null), 4000)
        return false
      }

      // Optimistic update — snap UI now, roll back on error. Mirrors
      // the admin-toggle pattern above so the two flows feel
      // identical to the user.
      const prevEmail = target.email
      setBusyId(target.id)
      setToast(null)
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, email: newEmail } : u)))

      const { data, error: invokeErr } = await supabase.functions.invoke<{
        ok: boolean
        email?: string
        error?: string
        warning?: string
      }>('admin-update-email', {
        body: { user_id: target.id, new_email: newEmail },
      })

      setBusyId(null)

      if (invokeErr || !data?.ok) {
        // Roll back the optimistic UI to the prior email so the row
        // doesn't lie about its current state.
        setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, email: prevEmail } : u)))
        // Prefer the function's own JSON `{ error }`; otherwise dig
        // into the FunctionsHttpError context for the body our
        // function returned. Plain `errorMessage(invokeErr)` would
        // surface the opaque "Edge Function returned a non-2xx
        // status code" string and hide the real reason.
        const msg = data?.error ?? (await extractEdgeFunctionError(invokeErr, 'Failed to update email'))
        setToast({ kind: 'err', message: msg })
        setTimeout(() => setToast(null), 5000)
        return false
      }

      const finalEmail = data.email ?? newEmail
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, email: finalEmail } : u)))
      setToast({
        kind: 'ok',
        message: data.warning
          ? `Email updated, but: ${data.warning}`
          : `Email updated for ${target.display_name}.`,
      })
      setTimeout(() => setToast(null), 4000)
      return true
    },
    [isOwnerViewer],
  )

  const confirmReset = useCallback(async () => {
    if (!resetTarget) return
    setResetPending(true)

    const { data, error: invokeErr } = await supabase.functions.invoke<{
      ok: boolean
      error?: string
      email?: string
      setup_link?: string
    }>('admin-generate-setup-link', {
      body: {
        user_id: resetTarget.id,
        redirect_to: `${window.location.origin}/login`,
      },
    })
    setResetPending(false)

    // Two failure shapes:
    //   - network / 4xx / 5xx → `invokeErr` populated
    //   - function returned 200 with `{ ok: false, error }` shape
    if (invokeErr) {
      setResetResult({ kind: 'err', message: errorMessage(invokeErr, 'Failed to generate setup link') })
      return
    }
    if (!data?.ok) {
      setResetResult({ kind: 'err', message: data?.error ?? 'Failed to generate setup link' })
      return
    }
    if (!data.setup_link) {
      setResetResult({ kind: 'err', message: 'No setup link returned' })
      return
    }
    setResetResult({ kind: 'ok', setupLink: data.setup_link })
  }, [resetTarget])

  const closeResetModal = useCallback(() => {
    setResetTarget(null)
    setResetResult(null)
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
            canManageAccess
              ? 'text-gold bg-gold/10 border border-gold/30'
              : canGenerateSetupLinks
                ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-400/30'
              : 'text-text-light bg-surface-alt border border-border',
          ].join(' ')}
        >
          {canManageAccess ? <ShieldCheck size={12} /> : <UserIcon size={12} />}
          {canManageAccess ? 'Owner · edits enabled' : canGenerateSetupLinks ? 'Setup links enabled' : 'Read-only'}
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
                canManageAccess={canManageAccess}
                canGenerateSetupLinks={canGenerateSetupLinks}
                isPrimaryOwner={u.email.toLowerCase() === OWNER_EMAIL}
                busy={busyId === u.id}
                onToggle={onToggle}
                onGenerateSetupLink={onGenerateSetupLink}
                onUpdateEmail={onUpdateEmail}
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
                canManageAccess={canManageAccess}
                canGenerateSetupLinks={canGenerateSetupLinks}
                isPrimaryOwner={false}
                busy={busyId === u.id}
                onToggle={onToggle}
                onGenerateSetupLink={onGenerateSetupLink}
                onUpdateEmail={onUpdateEmail}
              />
            ))
          )}
        </section>
      </div>

      {/* ── Setup link modal — direct-link handoff flow ── */}
      {resetTarget && (
        <Modal
          open
          onClose={closeResetModal}
          title={resetResult?.kind === 'ok' ? 'Setup link ready' : 'Generate setup link'}
          description={
            resetResult?.kind === 'ok'
              ? undefined
              : `Generate a password setup link for ${resetTarget.display_name}.`
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
                  Generate link
                </Button>
              </>
            )
          }
        >
          {resetResult?.kind === 'ok' ? (
            <SetupLinkReveal
              email={resetTarget.email}
              displayName={resetTarget.display_name}
              setupLink={resetResult.setupLink}
            />
          ) : resetResult?.kind === 'err' ? (
            <div role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              {resetResult.message}
            </div>
          ) : (
            <p className="text-[13px] text-text-muted">
              A secure setup link will be generated for{' '}
              <span className="font-semibold text-text">{resetTarget.email}</span>.
              You'll be able to copy it and send it directly.
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}
