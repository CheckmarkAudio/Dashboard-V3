import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Clock, Edit2, Inbox, Loader2, Repeat, Trash2, UserCircle2, X } from 'lucide-react'
import { useToast } from '../../Toast'
import {
  approveTaskRequest,
  fetchPendingTaskRequests,
  rejectTaskRequest,
  taskRequestKeys,
  type PendingTaskRequest,
} from '../../../lib/queries/taskRequests'
import { supabase } from '../../../lib/supabase'
import { FlywheelStagePicker, type FlywheelStage } from '../../tasks/requests/formAtoms'
import RequestDetailModal from './RequestDetailModal'

/**
 * PendingTaskRequestsWidget — admin approval queue for user-submitted
 * task requests (PR #16).
 *
 * List of pending requests with inline Approve / Reject buttons.
 * Approve is a single click; Reject opens a small note field so the
 * admin can explain why (the note flows to the requester's
 * notification). Both actions invalidate the relevant caches so the
 * queue + requester's My Tasks widgets refresh without a manual
 * reload.
 *
 * Intended to live on the Admin Hub Overview. Empty state is just an
 * empty row — no scary banner, because an empty queue is the good
 * case. Loading state shows a small spinner; error state surfaces the
 * RPC message.
 */

export default function PendingTaskRequestsWidget() {
  const queryClient = useQueryClient()
  const queue = useQuery({
    queryKey: taskRequestKeys.pending(),
    queryFn: fetchPendingTaskRequests,
    refetchInterval: 60_000,
  })
  const requests = queue.data ?? []

  // 2026-05-02 — realtime sync. A member submitting a task_request
  // (delete or create) now pops into the admin queue instantly
  // instead of waiting up to 60s for the refetchInterval. Listen to
  // ALL DML on task_requests; resolved rows leaving the queue also
  // get picked up. Requires task_requests in supabase_realtime
  // publication w/ REPLICA IDENTITY FULL — shipped in
  // migration 20260502180000_realtime_task_sync.sql.
  useEffect(() => {
    const sub = supabase
      .channel('admin-pending-task-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_requests' },
        () => {
          void queryClient.invalidateQueries({ queryKey: taskRequestKeys.pending() })
          void queryClient.invalidateQueries({ queryKey: ['admin-log'] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(sub)
    }
  }, [queryClient])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-3 pb-2.5 mb-2 border-b border-white/5 shrink-0">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.06em] text-text-light">
            APPROVALS
            {requests.length > 0 && (
              <span className="ml-2 text-amber-300">· {requests.length} pending</span>
            )}
          </p>
          <h2 className="text-[15px] font-bold tracking-tight text-text">Task requests</h2>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {queue.isLoading ? (
          <div className="h-full flex items-center justify-center text-text-light py-6">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : queue.error ? (
          <p className="text-[12px] text-amber-300 px-2 py-3">
            {(queue.error as Error).message}
          </p>
        ) : requests.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-6">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mb-2">
              <Check size={16} className="text-emerald-400" aria-hidden="true" />
            </div>
            <p className="text-[13px] font-medium text-text">All caught up</p>
            <p className="text-[11px] text-text-light mt-0.5 max-w-[28ch]">
              No pending task requests right now.
            </p>
          </div>
        ) : (
          requests.map((r) => <RequestRow key={r.id} request={r} />)
        )}
      </div>
    </div>
  )
}

function RequestRow({ request }: { request: PendingTaskRequest }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [note, setNote] = useState('')
  // PR #17 — admin tags the approved task with a flywheel stage
  // during review; `null` means inherit whatever the requester set
  // (or nothing).
  const [stage, setStage] = useState<FlywheelStage | null>(
    (request.category as FlywheelStage | null) ?? null,
  )

  const invalidate = () => {
    // Admin-side queue + member-side history + the notifications widget
    // all care when a request resolves. PR #28: ALSO invalidate the
    // team + studio task caches because the Flywheel widget reads
    // from `team-assigned-tasks` — without this invalidation, an
    // approved task tagged to a flywheel stage wouldn't light up the
    // Flywheel widget until the 30s staleTime expired.
    void queryClient.invalidateQueries({ queryKey: taskRequestKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['team-assigned-tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['overview-assignment-notifications'] })
    // Approve-delete also clears the row from the admin Edit Tasks
    // library + AssignAdmin per-member view caches.
    void queryClient.invalidateQueries({ queryKey: ['admin-assigned-tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['assign-page-member-tasks'] })
    // PR #45 — Approval Log feed reads under this prefix; refresh
    // it so the just-resolved request appears in the log.
    void queryClient.invalidateQueries({ queryKey: ['admin-log'] })
  }

  const approveMutation = useMutation({
    // Stage tag only meaningful for create — server keeps existing
    // category on edit (unless the proposed payload itself rewrote it),
    // and ignores it on delete.
    mutationFn: () => approveTaskRequest(request.id, request.kind === 'create' ? stage : null),
    onSuccess: () => {
      if (request.kind === 'delete') {
        toast(
          `Deleted — "${request.title}" removed from ${request.requester_name}'s tasks.`,
          'success',
        )
      } else if (request.kind === 'edit') {
        toast(
          `Edit applied — "${request.title}" updated for ${request.requester_name}.`,
          'success',
        )
      } else {
        const stagePart = stage ? ` · tagged ${stage}` : ''
        toast(
          `Approved — "${request.title}" added to ${request.requester_name}'s tasks${stagePart}.`,
          'success',
        )
      }
      setApproveOpen(false)
      invalidate()
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Approve failed', 'error'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectTaskRequest(request.id, note.trim() || null),
    onSuccess: () => {
      toast('Request declined.', 'success')
      setRejectOpen(false)
      setNote('')
      invalidate()
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Reject failed', 'error'),
  })

  const when = new Date(request.created_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  // Kind-driven chrome: rose for delete, gold for edit, amber for
  // create. The kind badge tells the admin at a glance which RPC
  // will fire on approve.
  const isDelete = request.kind === 'delete'
  const isEdit = request.kind === 'edit'
  const iconBgClass = isDelete
    ? 'bg-rose-500/15 ring-1 ring-rose-500/30 text-rose-300'
    : isEdit
      ? 'bg-gold/15 ring-1 ring-gold/30 text-gold'
      : 'bg-amber-500/15 ring-1 ring-amber-500/30 text-amber-300'
  const badgeClass = isDelete
    ? 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30'
    : isEdit
      ? 'bg-gold/15 text-gold ring-1 ring-gold/30'
      : 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
  const badgeLabel = isDelete ? 'Delete' : isEdit ? 'Edit' : 'New task'

  return (
    <>
    <div className="rounded-lg bg-surface-alt/40 ring-1 ring-white/5 px-2.5 py-2">
      <div className="flex items-start gap-2">
        <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${iconBgClass}`}>
          {isDelete ? (
            <Trash2 size={14} aria-hidden="true" />
          ) : isEdit ? (
            <Edit2 size={14} aria-hidden="true" />
          ) : (
            <UserCircle2 size={14} aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`shrink-0 text-[9px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded ${badgeClass}`}>
              {badgeLabel}
            </span>
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              aria-label={`Open details for "${request.title}"`}
              className="text-[13px] font-semibold text-text truncate text-left hover:text-gold focus-ring rounded"
            >
              {request.title}
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-light mt-0.5 flex-wrap">
            <span>{request.requester_name}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={10} aria-hidden="true" />
              {when}
            </span>
            {request.kind === 'create' && request.due_date && (
              <>
                <span>·</span>
                <span>
                  Due {new Date(request.due_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </>
            )}
            {request.kind === 'create' && request.recurrence_spec && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gold/15 ring-1 ring-gold/30 text-gold font-semibold uppercase tracking-wider text-[10px]">
                <Repeat size={9} aria-hidden="true" />
                {request.recurrence_spec.frequency}
              </span>
            )}
          </div>
          {isEdit && <EditDiff request={request} />}
          {request.description && (
            <p
              className={`text-[12px] mt-1 leading-snug ${
                isDelete || isEdit ? 'text-text italic' : 'text-text-muted'
              }`}
            >
              {(isDelete || isEdit) && (
                <span className="text-text-light not-italic">Reason: </span>
              )}
              {request.description}
            </p>
          )}
          {isDelete && !request.description && (
            <p className="text-[11px] text-text-light/70 mt-1 italic">No reason provided.</p>
          )}
        </div>
      </div>

      {rejectOpen ? (
        <div className="mt-2 space-y-1.5 pl-9">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note to requester…"
            className="w-full px-2.5 py-1.5 rounded-md bg-surface border border-border text-[12px] focus-ring placeholder:text-text-light/70"
            maxLength={280}
            autoFocus
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setRejectOpen(false)
                setNote('')
              }}
              className="px-2 py-1 rounded-md text-[11px] font-semibold text-text-light hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/20 ring-1 ring-rose-500/40 text-rose-200 text-[11px] font-bold hover:bg-rose-500/30"
            >
              {rejectMutation.isPending ? 'Declining…' : 'Decline'}
            </button>
          </div>
        </div>
      ) : approveOpen ? (
        <div className="mt-2 space-y-2 pl-9">
          {/* Stage picker only applies to create — server preserves
              category on edit (unless the proposed payload itself
              changes it) and ignores it on delete. */}
          {request.kind === 'create' && (
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
            <p className="text-[11px] text-gold/90">
              On approve, the proposed changes above will be applied to this task. The requester is notified.
            </p>
          )}
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setApproveOpen(false)}
              className="px-2 py-1 rounded-md text-[11px] font-semibold text-text-light hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                isDelete
                  ? 'bg-rose-500/80 text-white hover:brightness-110 shadow-[0_4px_12px_rgba(244,63,94,0.25)]'
                  : isEdit
                    ? 'bg-gold text-black hover:bg-gold-muted shadow-[0_4px_12px_rgba(214,170,55,0.18)]'
                    : 'bg-emerald-500/20 ring-1 ring-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30'
              }`}
            >
              {isDelete ? (
                <Trash2 size={11} aria-hidden="true" />
              ) : isEdit ? (
                <Edit2 size={11} aria-hidden="true" />
              ) : (
                <Check size={11} aria-hidden="true" />
              )}
              {approveMutation.isPending
                ? 'Approving…'
                : isDelete
                  ? 'Approve delete'
                  : isEdit
                    ? 'Apply edit'
                    : 'Confirm approve'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-end gap-1.5 pl-9">
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            disabled={approveMutation.isPending}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-text-light hover:text-rose-300 hover:bg-rose-500/10"
          >
            <X size={11} aria-hidden="true" />
            Decline
          </button>
          <button
            type="button"
            onClick={() => setApproveOpen(true)}
            disabled={approveMutation.isPending}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold disabled:opacity-50 ${
              isDelete
                ? 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/25'
                : isEdit
                  ? 'bg-gold/15 text-gold ring-1 ring-gold/30 hover:bg-gold/25'
                  : 'bg-emerald-500/20 ring-1 ring-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30'
            }`}
          >
            {isDelete ? (
              <Trash2 size={11} aria-hidden="true" />
            ) : isEdit ? (
              <Edit2 size={11} aria-hidden="true" />
            ) : (
              <Check size={11} aria-hidden="true" />
            )}
            {isDelete ? 'Approve delete…' : isEdit ? 'Apply edit…' : 'Approve…'}
          </button>
        </div>
      )}
    </div>
    {detailOpen && (
      <RequestDetailModal request={request} onClose={() => setDetailOpen(false)} />
    )}
    </>
  )
}

// EditDiff — for kind='edit' requests, render a tight Current → Proposed
// diff for each field that the proposed payload changes. Server returns
// `proposed` (only the changed keys) + a `current` snapshot of the
// target task, so we can render this without fetching the task again.
//
// If `current` is missing (target task was deleted between submit and
// fetch — admin direct-delete raced the request), fall back to showing
// just the proposed values so the admin can still see what was asked.
function EditDiff({ request }: { request: PendingTaskRequest }) {
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
    <div className="mt-1.5 rounded-md bg-gold/[0.06] ring-1 ring-gold/20 px-2 py-1.5 space-y-0.5">
      {keys.map((k) => (
        <div key={k} className="flex items-start gap-1.5 text-[11px] leading-snug">
          <span className="shrink-0 font-semibold text-gold/80 min-w-[44px]">{labelFor(k)}:</span>
          <span className="text-text-light truncate">{renderValue(current?.[k])}</span>
          <ArrowRight size={10} className="shrink-0 mt-0.5 text-gold/60" aria-hidden="true" />
          <span className="text-text font-medium truncate">{renderValue(proposed[k])}</span>
        </div>
      ))}
    </div>
  )
}

// Re-export for the admin hub to render in an empty state — currently
// unused but handy if we want to show a "no requests" CTA panel.
export { Inbox }
