import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Check,
  Edit2,
  Minus,
  Plus,
  X,
} from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import { useToast } from '../../Toast'
import {
  approveTaskRequest,
  rejectTaskRequest,
  taskRequestKeys,
  type PendingTaskRequest,
} from '../../../lib/queries/taskRequests'
import { FlywheelStagePicker, type FlywheelStage } from '../../tasks/requests/formAtoms'

/**
 * RequestDetailModal — admin click-into expansion of a pending task
 * request row. Surfaces fields that don't fit on the queue row
 * (description, full edit diff, recurrence, category) and exposes
 * the same Approve / Decline actions inline so the admin doesn't
 * have to close the modal to act.
 *
 * Owns its own approve / reject mutations + cache invalidation so
 * the modal is self-contained — opening it from a different surface
 * (notifications panel, member's history view, etc.) Just Works.
 *
 * Reuses FloatingDetailModal so the modal centers correctly even
 * when nested inside transformed/backdrop-filtered ancestors
 * (PR #86 fix).
 */

export default function RequestDetailModal({
  request,
  onClose,
}: {
  request: PendingTaskRequest
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [stage, setStage] = useState<FlywheelStage | null>(
    (request.category as FlywheelStage | null) ?? null,
  )
  const [declineNote, setDeclineNote] = useState('')
  const [confirmMode, setConfirmMode] = useState<null | 'approve' | 'decline'>(null)

  const isDelete = request.kind === 'delete'
  const isEdit = request.kind === 'edit'
  const isCreate = request.kind === 'create'

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: taskRequestKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['team-assigned-tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-assigned-tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['assign-page-member-tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['overview-assignment-notifications'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-log'] })
  }

  const approveMutation = useMutation({
    mutationFn: () => approveTaskRequest(request.id, isCreate ? stage : null),
    onSuccess: () => {
      if (isDelete) {
        toast(`Deleted — "${request.title}" removed from ${request.requester_name}'s tasks.`, 'success')
      } else if (isEdit) {
        toast(`Edit applied — "${request.title}" updated for ${request.requester_name}.`, 'success')
      } else {
        const stagePart = stage ? ` · tagged ${stage}` : ''
        toast(`Approved — "${request.title}" added to ${request.requester_name}'s tasks${stagePart}.`, 'success')
      }
      invalidate()
      onClose()
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Approve failed', 'error'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectTaskRequest(request.id, declineNote.trim() || null),
    onSuccess: () => {
      toast('Request declined.', 'success')
      invalidate()
      onClose()
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Decline failed', 'error'),
  })

  // Sitewide pending-symbol palette: − (delete) · 🖉 (edit) · + (create).
  const KindIcon = isDelete ? Minus : isEdit ? Edit2 : Plus
  // System-wide kind palette: rose (delete) · orange (edit) · amber (create).
  const kindAccent = isDelete
    ? 'text-rose-300 bg-rose-500/15 ring-rose-500/30'
    : isEdit
      ? 'text-orange-300 bg-orange-500/15 ring-orange-500/30'
      : 'text-amber-300 bg-amber-500/15 ring-amber-500/30'
  const kindLabel = isDelete ? 'Delete' : isEdit ? 'Edit' : 'New task'

  const eyebrow =
    isDelete ? 'Delete request' : isEdit ? 'Edit request' : 'New task request'

  return (
    <FloatingDetailModal
      onClose={onClose}
      eyebrow={eyebrow}
      title={request.title}
      maxWidth={560}
      ariaLabel="Task request details"
      footer={
        confirmMode === 'decline' ? (
          <div className="px-4 py-2.5 border-t border-border bg-rose-500/[0.04] rounded-b-[18px] space-y-1.5">
            <input
              type="text"
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
              placeholder="Optional note to requester…"
              maxLength={280}
              autoFocus
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-[13px] placeholder:text-text-light focus:border-rose-400/60 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmMode(null)
                  setDeclineNote('')
                }}
                className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-text-muted hover:text-text"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold bg-rose-500/80 text-white hover:brightness-110 shadow-[0_4px_12px_rgba(244,63,94,0.25)] disabled:opacity-50"
              >
                <X size={11} aria-hidden="true" />
                {rejectMutation.isPending ? 'Declining…' : 'Confirm decline'}
              </button>
            </div>
          </div>
        ) : confirmMode === 'approve' ? (
          <div
            className={`px-4 py-2.5 border-t border-border rounded-b-[18px] space-y-2 ${
              isDelete
                ? 'bg-rose-500/[0.04]'
                : isEdit
                  ? 'bg-orange-500/[0.05]'
                  : 'bg-surface-alt/40'
            }`}
          >
            {isCreate && (
              <FlywheelStagePicker
                value={stage}
                onChange={setStage}
                label="Tag with flywheel stage (optional)"
              />
            )}
            {isDelete && (
              <p className="text-[11px] text-rose-300">
                On approve, the task will be deleted permanently. The requester is notified.
              </p>
            )}
            {isEdit && (
              <p className="text-[11px] text-orange-300/90">
                On approve, the proposed changes will be applied. The requester is notified.
              </p>
            )}
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setConfirmMode(null)}
                className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-text-muted hover:text-text"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold disabled:opacity-50 bg-emerald-500/20 ring-1 ring-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30"
              >
                <Check size={11} aria-hidden="true" />
                {approveMutation.isPending ? 'Working…' : 'Confirm approve'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border bg-surface-alt/40 rounded-b-[18px]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:text-text"
            >
              Close
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setConfirmMode('decline')}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-text-light hover:text-rose-300 hover:bg-rose-500/10"
              >
                <X size={12} aria-hidden="true" />
                Decline
              </button>
              <button
                type="button"
                onClick={() => setConfirmMode('approve')}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold disabled:opacity-50 bg-emerald-500/20 ring-1 ring-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30"
              >
                <Check size={12} aria-hidden="true" />
                Approve…
              </button>
            </div>
          </div>
        )
      }
    >
      <div className="space-y-4 px-4 py-3">
        {/* Header — kind badge + requester */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ring-1 text-[10px] font-bold uppercase tracking-wider ${kindAccent}`}>
            <KindIcon size={10} aria-hidden="true" />
            {kindLabel}
          </span>
          <span className="text-[11px] text-text-light">from {request.requester_name}</span>
          <span className="text-[11px] text-text-light">·</span>
          <span className="text-[11px] text-text-light">
            {new Date(request.created_at).toLocaleString('en-US', {
              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            })}
          </span>
        </div>

        {/* Body — kind-specific. */}
        {isEdit && <EditDiffBlock request={request} />}

        {isCreate && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
            {request.due_date && (
              <DetailRow label="Due">
                {new Date(request.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </DetailRow>
            )}
            {request.category && <DetailRow label="Stage">{request.category}</DetailRow>}
            {request.recurrence_spec && (
              <DetailRow label="Recurrence">
                Every {request.recurrence_spec.interval} {request.recurrence_spec.frequency}
              </DetailRow>
            )}
            {request.is_required && <DetailRow label="Required">Yes</DetailRow>}
          </div>
        )}

        {/* Description / reason — common to all kinds. */}
        <section>
          <Label>{isDelete || isEdit ? 'Reason' : 'Description'}</Label>
          {request.description ? (
            <p className="text-[13px] text-text leading-relaxed mt-1 whitespace-pre-line">
              {request.description}
            </p>
          ) : (
            <p className="text-[12px] text-text-light italic mt-1">
              {isDelete || isEdit ? 'No reason provided.' : 'No description.'}
            </p>
          )}
        </section>
      </div>
    </FloatingDetailModal>
  )
}

// ─── Atoms ─────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-light">
      {children}
    </p>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="text-[13px] text-text mt-0.5">{children}</p>
    </div>
  )
}

// EditDiffBlock — same shape as the inline EditDiff in PendingTaskRequestsWidget
// but slightly larger / more readable for the modal context.
function EditDiffBlock({ request }: { request: PendingTaskRequest }) {
  const proposed = request.proposed
  const current = request.current
  if (!proposed) return null
  const keys = Object.keys(proposed) as (keyof typeof proposed)[]
  if (keys.length === 0) return null

  const labelFor = (k: string) => {
    if (k === 'title') return 'Title'
    if (k === 'description') return 'Description'
    if (k === 'category') return 'Stage'
    if (k === 'due_date') return 'Due'
    return k
  }
  const renderValue = (raw: unknown) => {
    if (raw === null || raw === undefined || raw === '') {
      return <em className="text-text-light/70">none</em>
    }
    return <span>{String(raw)}</span>
  }

  return (
    <section>
      <Label>Proposed changes</Label>
      <div className="mt-1 px-1 py-1 space-y-1">
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-[64px_1fr_auto_1fr] items-start gap-2 text-[12px] leading-snug">
            <span className="font-semibold text-orange-300">{labelFor(k)}</span>
            <span className="text-text-light truncate">{renderValue(current?.[k])}</span>
            <ArrowRight size={11} className="mt-1 text-orange-400/70" aria-hidden="true" />
            <span className="text-text font-medium">{renderValue(proposed[k])}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
