import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import { useToast } from '../../Toast'
import { submitTaskRequest, taskRequestKeys } from '../../../lib/queries/taskRequests'

/**
 * TaskRequestModal — small submit form so any user can ask admin for
 * a task to be added to their My Tasks. Monday-style: low-friction,
 * title is the only required field. Admin reviews in the approval
 * queue (see PendingTaskRequestsWidget).
 *
 * On submit: RPC creates a pending task_requests row + notifies every
 * admin on the team via assignment_notifications. The user sees the
 * request land in the "Pending approval" section on MyTasksCard until
 * an admin resolves it.
 */

export default function TaskRequestModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  const submitMutation = useMutation({
    mutationFn: () =>
      submitTaskRequest({
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
      }),
    onSuccess: () => {
      toast('Request submitted — admin has been notified.', 'success')
      void queryClient.invalidateQueries({ queryKey: taskRequestKeys.mine() })
      // Admin-side widget also refreshes for any admin currently in the app.
      void queryClient.invalidateQueries({ queryKey: taskRequestKeys.pending() })
      onClose()
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Submit failed', 'error')
    },
  })

  const canSubmit = title.trim().length > 0 && !submitMutation.isPending

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    submitMutation.mutate()
  }

  return (
    <FloatingDetailModal
      onClose={onClose}
      eyebrow="Request a task"
      title="Ask admin to add a task"
      maxWidth={520}
      ariaLabel="Submit a task request for admin approval"
      footer={
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-surface-alt/40 rounded-b-[18px]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="task-request-form"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold text-black text-[13px] font-bold hover:bg-gold-muted focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={13} aria-hidden="true" />
            {submitMutation.isPending ? 'Sending…' : 'Submit for approval'}
          </button>
        </div>
      }
    >
      <form id="task-request-form" onSubmit={handleSubmit} className="space-y-3 px-4 py-3">
        <p className="text-[12px] text-text-light leading-snug">
          Admin will review and either approve (the task lands in your My Tasks) or decline with a note.
        </p>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-light mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Prep studio B for Tuesday session"
            className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus-ring placeholder:text-text-light/70"
            maxLength={200}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-light mb-1">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Any context admin should know?"
            className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-sm focus-ring placeholder:text-text-light/70 resize-none"
            maxLength={2000}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-light mb-1">
            Due date (optional)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus-ring text-text"
          />
        </div>
      </form>
    </FloatingDetailModal>
  )
}
