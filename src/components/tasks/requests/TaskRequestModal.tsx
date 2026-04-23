import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, Send } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import { useToast } from '../../Toast'
import { submitTaskRequest, taskRequestKeys } from '../../../lib/queries/taskRequests'
import {
  Field,
  RecurrencePicker,
  recurrenceToSpec,
  type RecurrenceFrequency,
} from './formAtoms'

/**
 * TaskRequestModal — member's rich "+ Task" submission form (PR #17).
 *
 * Replaces the tiny placeholder from PR #16. Restores the depth of
 * the pre-unification CreateTaskModal (title / description / due /
 * recurrence / priority) minus the admin-only pieces (flywheel stage
 * picker lives on the admin creation + approval surfaces instead).
 *
 * Submitting creates a pending task_requests row + notifies every
 * admin on the team. The requester sees the pending item in the
 * expandable strip on MyTasksCard until admin resolves it.
 *
 * Recurrence is stored but not yet materialized — selecting any
 * non-Off cadence fires a "coming soon" toast AND persists the
 * choice (see feedback_docs_drift_session_start.md and the migration
 * comment on `task_requests.recurrence_spec`).
 */

export default function TaskRequestModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState(false)
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>('off')

  // Pre-PR-17 the old modal had "High Priority" and "Required" as
  // two separate toggles. Per user's decision for PR #17, these are
  // one concept now — the stored field is still `is_required` (no
  // migration), the label shows both words so the semantics are
  // clear across contexts.

  const submitMutation = useMutation({
    mutationFn: () =>
      submitTaskRequest({
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        recurrence_spec: recurrenceToSpec(recurrence),
        is_required: priority,
      }),
    onSuccess: () => {
      toast('Request submitted — admin has been notified.', 'success')
      void queryClient.invalidateQueries({ queryKey: taskRequestKeys.mine() })
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

  function handleRecurrenceChange(next: RecurrenceFrequency) {
    const prev = recurrence
    setRecurrence(next)
    // Fire the coming-soon nudge once per selection transition off of Off.
    if (next !== 'off' && prev === 'off') {
      toast('Recurring tasks — engine coming soon. Your choice is saved.', 'success')
    }
  }

  return (
    <FloatingDetailModal
      onClose={onClose}
      eyebrow="Request a task"
      title="Ask admin to add a task"
      maxWidth={560}
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
      <form id="task-request-form" onSubmit={handleSubmit} className="space-y-4 px-4 py-3">
        <p className="text-[12px] text-text-light leading-snug">
          Admin will review and either approve (the task lands in your My Tasks, tagged to a flywheel stage) or decline with a note.
        </p>

        <Field label="What needs doing?">
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
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Any context admin should know?"
            className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-sm focus-ring placeholder:text-text-light/70 resize-none"
            maxLength={2000}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Due date (optional)">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus-ring text-text"
            />
          </Field>

          {/* Priority / Required merged into one concept. Stored as
              `is_required` in the DB; the label carries both words so
              the semantics are clear wherever it renders. */}
          <Field label="Priority">
            <button
              type="button"
              role="switch"
              aria-checked={priority}
              onClick={() => setPriority((v) => !v)}
              className={`w-full inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl ring-1 text-[13px] font-semibold transition-colors ${
                priority
                  ? 'bg-rose-500/10 text-rose-200 ring-rose-500/40'
                  : 'bg-surface-alt text-text-muted ring-border hover:text-text'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Flag size={13} aria-hidden="true" />
                {priority ? 'High priority · Required' : 'Normal'}
              </span>
              <span
                className={`inline-block w-8 h-4 rounded-full relative transition-colors ${
                  priority ? 'bg-rose-500/60' : 'bg-white/10'
                }`}
                aria-hidden="true"
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                    priority ? 'left-4' : 'left-0.5'
                  }`}
                />
              </span>
            </button>
          </Field>
        </div>

        <RecurrencePicker value={recurrence} onChange={handleRecurrenceChange} />
      </form>
    </FloatingDetailModal>
  )
}
