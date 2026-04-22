import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, Inbox, Loader2, UserCircle2, X } from 'lucide-react'
import { useToast } from '../../Toast'
import {
  approveTaskRequest,
  fetchPendingTaskRequests,
  rejectTaskRequest,
  taskRequestKeys,
  type PendingTaskRequest,
} from '../../../lib/queries/taskRequests'

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
  const queue = useQuery({
    queryKey: taskRequestKeys.pending(),
    queryFn: fetchPendingTaskRequests,
    refetchInterval: 60_000,
  })
  const requests = queue.data ?? []

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
  const [note, setNote] = useState('')

  const invalidate = () => {
    // Admin-side queue + member-side history + the notifications widget
    // all care when a request resolves.
    void queryClient.invalidateQueries({ queryKey: taskRequestKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['overview-assignment-notifications'] })
  }

  const approveMutation = useMutation({
    mutationFn: () => approveTaskRequest(request.id),
    onSuccess: () => {
      toast(`Approved — "${request.title}" added to ${request.requester_name}'s tasks.`, 'success')
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

  return (
    <div className="rounded-lg bg-surface-alt/40 ring-1 ring-white/5 px-2.5 py-2">
      <div className="flex items-start gap-2">
        <div className="shrink-0 w-7 h-7 rounded-lg bg-amber-500/15 ring-1 ring-amber-500/30 text-amber-300 flex items-center justify-center">
          <UserCircle2 size={14} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-text truncate">{request.title}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-text-light mt-0.5 flex-wrap">
            <span>{request.requester_name}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={10} aria-hidden="true" />
              {when}
            </span>
            {request.due_date && (
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
          </div>
          {request.description && (
            <p className="text-[12px] text-text-muted mt-1 leading-snug">
              {request.description}
            </p>
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
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/20 ring-1 ring-emerald-500/40 text-emerald-200 text-[11px] font-bold hover:bg-emerald-500/30 disabled:opacity-50"
          >
            <Check size={11} aria-hidden="true" />
            {approveMutation.isPending ? 'Approving…' : 'Approve'}
          </button>
        </div>
      )}
    </div>
  )
}

// Re-export for the admin hub to render in an empty state — currently
// unused but handy if we want to show a "no requests" CTA panel.
export { Inbox }
