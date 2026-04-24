import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Users, X } from 'lucide-react'
import FloatingDetailModal from '../FloatingDetailModal'
import {
  approveTaskReassignment,
  declineTaskReassignment,
  fetchIncomingReassignRequests,
  taskReassignKeys,
  type IncomingReassignRequest,
} from '../../lib/queries/taskReassign'

/**
 * TaskReassignRequestModal — PR #38.
 *
 * Opens when the current assignee clicks a `task_reassign_requested`
 * notification. Shows every pending incoming reassignment request
 * with Approve / Decline actions. Decline surfaces an optional note
 * field so the assignee can say "I've got this today, try tomorrow."
 *
 * Approval atomically moves `assigned_tasks.assigned_to` to the
 * requester via `approve_task_reassignment` RPC; a notification flows
 * back to the requester telling them the task is now theirs.
 */
export default function TaskReassignRequestModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const requestsQuery = useQuery({
    queryKey: taskReassignKeys.incoming(),
    queryFn: fetchIncomingReassignRequests,
    refetchOnWindowFocus: false,
  })

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approveTaskReassignment(requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskReassignKeys.incoming() })
      // The task just moved to the requester — both member + team
      // task caches may be stale.
      void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['team-assigned-tasks'] })
    },
  })

  const declineMutation = useMutation({
    mutationFn: ({ requestId, note }: { requestId: string; note?: string }) =>
      declineTaskReassignment(requestId, note ?? null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskReassignKeys.incoming() })
    },
  })

  const requests = requestsQuery.data ?? []

  return (
    <FloatingDetailModal
      title="Reassignment requests"
      eyebrow="Team members asking to take your tasks"
      onClose={onClose}
      maxWidth={560}
    >
      {requestsQuery.isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="animate-spin text-text-muted" />
        </div>
      ) : requestsQuery.error ? (
        <p className="text-[13px] text-amber-300 py-4">
          {(requestsQuery.error as Error).message}
        </p>
      ) : requests.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[14px] text-text">Nothing pending.</p>
          <p className="mt-1 text-[12px] text-text-muted">
            You'll see requests here when a teammate asks to take one of your tasks.
          </p>
        </div>
      ) : (
        <div className="space-y-2 py-2">
          {requests.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              onApprove={() => approveMutation.mutate(r.id)}
              onDecline={(note) => declineMutation.mutate({ requestId: r.id, note })}
              isBusy={approveMutation.isPending || declineMutation.isPending}
            />
          ))}
        </div>
      )}
    </FloatingDetailModal>
  )
}

function RequestRow({
  request,
  onApprove,
  onDecline,
  isBusy,
}: {
  request: IncomingReassignRequest
  onApprove: () => void
  onDecline: (note?: string) => void
  isBusy: boolean
}) {
  const [declineOpen, setDeclineOpen] = useState(false)
  const [note, setNote] = useState('')
  return (
    <div className="rounded-xl border border-border bg-surface-alt/40 p-3">
      <div className="flex items-start gap-3">
        <Users size={14} className="text-gold/70 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-text">
            {request.requester_name ?? 'A teammate'} wants to take{' '}
            <span className="text-gold">“{request.task_title ?? 'a task'}”</span>
          </p>
          {request.note && (
            <p className="mt-1 text-[12px] text-text-muted italic">“{request.note}”</p>
          )}
          <p className="mt-1 text-[11px] text-text-muted">
            {new Date(request.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      {!declineOpen ? (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={isBusy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-bold bg-gradient-to-b from-gold to-gold-muted text-black hover:brightness-105 disabled:opacity-50"
          >
            <Check size={13} strokeWidth={3} />
            Approve
          </button>
          <button
            type="button"
            onClick={() => setDeclineOpen(true)}
            disabled={isBusy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-semibold bg-white/[0.04] text-text-light hover:text-text hover:bg-white/[0.08] disabled:opacity-50"
          >
            <X size={13} strokeWidth={3} />
            Decline
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why keep it? (optional)"
            className="w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:border-gold/50"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDecline(note.trim() || undefined)}
              disabled={isBusy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-bold bg-rose-500/80 text-white hover:brightness-110 disabled:opacity-50"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => {
                setDeclineOpen(false)
                setNote('')
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-semibold bg-white/[0.04] text-text-light hover:text-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
