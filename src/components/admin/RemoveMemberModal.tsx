import { useEffect, useRef, useState } from 'react'
import { Archive, Loader2, Trash2, X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import {
  archiveMember,
  inspectMember,
  permanentlyDeleteMember,
  type MemberInspectResult,
} from '../../lib/queries/memberLifecycle'

export interface RemoveMemberModalProps {
  memberId: string
  memberName: string
  onClose: () => void
  /** Fired after a successful archive or delete so the caller can refresh. */
  onDone: (action: 'archived' | 'deleted') => void
}

/**
 * Two-option removal dialog backed by the admin-remove-member edge function.
 *
 * Replaces the old ConfirmModal + raw `team_members` row delete, which left
 * the member's login account behind and made the email impossible to re-add
 * ("A user with this email address has already been registered").
 *
 * - Archive (default): keeps all history, disables login, re-addable later.
 * - Delete forever: removes login + profile; only offered when the member
 *   has zero linked history so old work keeps its attribution.
 */
export default function RemoveMemberModal({
  memberId,
  memberName,
  onClose,
  onDone,
}: RemoveMemberModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  const [inspect, setInspect] = useState<MemberInspectResult | null>(null)
  const [inspectError, setInspectError] = useState('')
  const [busy, setBusy] = useState<'archive' | 'delete' | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let cancelled = false
    inspectMember(memberId)
      .then((result) => { if (!cancelled) setInspect(result) })
      .catch((err) => {
        if (!cancelled) setInspectError(err instanceof Error ? err.message : 'Could not load member activity')
      })
    return () => { cancelled = true }
  }, [memberId])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [busy, onClose])

  const handleArchive = async () => {
    setBusy('archive')
    setActionError('')
    try {
      await archiveMember(memberId)
      onDone('archived')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Archive failed')
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setBusy('delete')
    setActionError('')
    try {
      await permanentlyDeleteMember(memberId)
      onDone('deleted')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete failed')
      setBusy(null)
      setConfirmingDelete(false)
    }
  }

  const linkedActivity = (inspect?.activity ?? []).filter((item) => item.count > 0)
  const canDelete = inspect?.canPermanentlyDelete ?? false

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-member-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        role="presentation"
        onClick={() => { if (!busy) onClose() }}
      />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up">
        <button
          onClick={onClose}
          disabled={busy !== null}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-surface-hover text-text-muted focus-ring"
          aria-label="Close"
        >
          <X size={16} aria-hidden="true" />
        </button>

        <div className="p-6 space-y-4">
          <div>
            <h3 id="remove-member-title" className="text-lg font-semibold text-text">
              Remove {memberName}
            </h3>
            <p className="text-sm text-text-muted mt-1">
              Choose how to remove them. Both options free up their spot on the roster,
              and you can always add them back later.
            </p>
          </div>

          {/* Activity summary drives which option is safest */}
          {inspectError ? (
            <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-400">
              {inspectError}
            </div>
          ) : !inspect ? (
            <div className="flex items-center gap-2 text-sm text-text-muted py-2" role="status">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Checking their history…
            </div>
          ) : linkedActivity.length > 0 ? (
            <div className="rounded-xl border border-border bg-surface-alt/50 p-3">
              <p className="text-label text-text-light mb-1.5">Linked history</p>
              <p className="text-sm text-text-muted">
                {linkedActivity.slice(0, 4).map((item) => `${item.count} ${item.label.toLowerCase()}`).join(' · ')}
                {linkedActivity.length > 4 ? ` · +${linkedActivity.length - 4} more` : ''}
              </p>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              No bookings, tasks, posts, or other history yet — safe to delete completely.
            </p>
          )}

          {actionError && (
            <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-400">
              {actionError}
            </div>
          )}

          {/* Two big, self-explanatory choices */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleArchive}
              disabled={busy !== null || !inspect}
              className="w-full flex items-start gap-3 p-4 rounded-xl border border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors text-left focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === 'archive'
                ? <Loader2 size={20} className="text-amber-400 shrink-0 mt-0.5 animate-spin" aria-hidden="true" />
                : <Archive size={20} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />}
              <span>
                <span className="block text-base font-semibold text-text">Archive member</span>
                <span className="block text-sm text-text-muted mt-0.5">
                  Recommended. Keeps all their history, turns off their login.
                  Adding the same email later reactivates them.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={busy !== null || !inspect || !canDelete}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border transition-colors text-left focus-ring disabled:cursor-not-allowed ${
                confirmingDelete
                  ? 'border-red-400 bg-red-500/25 hover:bg-red-500/30'
                  : 'border-red-400/40 bg-red-500/10 hover:bg-red-500/20'
              } ${!canDelete ? 'opacity-50' : ''}`}
            >
              {busy === 'delete'
                ? <Loader2 size={20} className="text-red-400 shrink-0 mt-0.5 animate-spin" aria-hidden="true" />
                : <Trash2 size={20} className="text-red-400 shrink-0 mt-0.5" aria-hidden="true" />}
              <span>
                <span className="block text-base font-semibold text-text">
                  {confirmingDelete ? 'Click again to delete forever' : 'Delete forever'}
                </span>
                <span className="block text-sm text-text-muted mt-0.5">
                  {canDelete
                    ? 'Removes their account and login completely. Cannot be undone.'
                    : 'Not available — they have history that would lose its name. Use Archive instead.'}
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
