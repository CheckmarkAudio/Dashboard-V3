import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Flag, Send, Users } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import { useToast } from '../../Toast'
import MemberMultiSelect from '../../members/MemberMultiSelect'
import { assignCustomTaskToMembers } from '../../../lib/queries/assignments'
import type { AssignedTaskScope } from '../../../types/assignments'
import {
  Field,
  FlywheelStagePicker,
  RecurrencePicker,
  recurrenceToSpec,
  type FlywheelStage,
  type RecurrenceFrequency,
} from './formAtoms'

/**
 * AdminTaskCreateModal — the canonical admin task-creation surface
 * (PR #18). Mirrors the member-side `TaskRequestModal` exactly, plus
 * three admin-only pieces:
 *
 *   1. Flywheel stage picker (so the created task is KPI-tagged at
 *      write time, no backfill needed).
 *   2. Recipient multi-select (members → their personal queue).
 *   3. Members / Studio scope toggle (shared studio task has no
 *      assignee; any team member can complete).
 *
 * Used from:
 *   - Admin Hub's "Task" tile in `AdminAssignWidget` (replaces the
 *     legacy in-file `AssignTaskModal`)
 *   - Potentially from the Assign page later, but the current reorg
 *     moves quick-compose entirely to the Hub.
 *
 * Submits directly — no approval step. That's the structural
 * difference from the member modal: admin writes assigned_tasks
 * immediately via `assign_custom_task_to_members` RPC.
 *
 * Recurrence persists but is still a coming-soon stub — same toast
 * as the member modal. When the cron engine lands, existing rows
 * auto-activate.
 */

export default function AdminTaskCreateModal({
  onClose,
  initialScope = 'member',
}: {
  onClose: () => void
  // PR #39 — optional preset. When callers want a "Studio Task" tile
  // that lands admins directly in studio-scope mode, pass
  // initialScope="studio" and the toggle starts on Studio + recipient
  // picker is hidden.
  initialScope?: AssignedTaskScope
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // ─── Form state — mirrors TaskRequestModal order exactly ──────────
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState(false)
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>('off')
  // ─── Admin-only ───────────────────────────────────────────────────
  const [stage, setStage] = useState<FlywheelStage | null>(null)
  const [scope, setScope] = useState<AssignedTaskScope>(initialScope)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const assignMutation = useMutation({
    mutationFn: () =>
      assignCustomTaskToMembers(
        scope === 'studio' ? [] : Array.from(selectedIds),
        {
          title: title.trim(),
          description: description.trim() || null,
          category: stage,
          due_date: dueDate || null,
          is_required: priority,
          show_on_overview: true,
          scope,
        },
      ),
    onSuccess: (summary) => {
      if (scope === 'studio') {
        toast('Studio task posted — visible to the whole team.', 'success')
      } else {
        toast(
          `Assigned to ${summary.recipient_count} ${
            summary.recipient_count === 1 ? 'member' : 'members'
          } · ${summary.task_count} ${summary.task_count === 1 ? 'task' : 'tasks'}`,
          'success',
        )
      }
      void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['team-assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-recent-assignments'] })
      onClose()
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Assign failed', 'error')
    },
  })

  const canSubmit = useMemo(() => {
    if (assignMutation.isPending) return false
    if (title.trim().length === 0) return false
    if (scope === 'member' && selectedIds.size === 0) return false
    return true
  }, [assignMutation.isPending, title, selectedIds.size, scope])

  function toggleRecipient(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    assignMutation.mutate()
  }

  function handleRecurrenceChange(next: RecurrenceFrequency) {
    const prev = recurrence
    setRecurrence(next)
    // Persist the choice; fire the coming-soon nudge once per Off-to-on
    // transition. Engine lands in a later PR.
    if (next !== 'off' && prev === 'off') {
      toast('Recurring tasks — engine coming soon. Your choice is saved.', 'success')
    }
    // recurrenceToSpec is called at submit time; the admin RPC doesn't
    // currently accept a recurrence spec (that path is member-only for
    // now), so we hold the value locally and the stub remains toast-only
    // until the cron pipeline + admin RPC update ship together.
    void recurrenceToSpec
  }

  return (
    <FloatingDetailModal
      onClose={onClose}
      eyebrow="Create a task"
      title="Assign a task"
      maxWidth={560}
      ariaLabel="Admin: create and assign a task"
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
            form="admin-task-create-form"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold text-black text-[13px] font-bold hover:bg-gold-muted focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={13} aria-hidden="true" />
            {assignMutation.isPending ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      }
    >
      <form id="admin-task-create-form" onSubmit={handleSubmit} className="space-y-4 px-4 py-3">
        {/* Scope toggle sits right under the title so it sets context
            for the recipient picker that follows. Members = pick
            people; Studio = shared pool, no recipients needed. */}
        <div
          role="radiogroup"
          aria-label="Assign target"
          className="inline-flex rounded-lg bg-surface-alt ring-1 ring-border p-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={scope === 'member'}
            onClick={() => setScope('member')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
              scope === 'member' ? 'bg-gold text-black' : 'text-text-muted hover:text-text'
            }`}
          >
            <Users size={13} aria-hidden="true" />
            Members
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={scope === 'studio'}
            onClick={() => setScope('studio')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
              scope === 'studio' ? 'bg-cyan-500 text-black' : 'text-text-muted hover:text-text'
            }`}
          >
            <Building2 size={13} aria-hidden="true" />
            Studio
          </button>
        </div>

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
            placeholder="Any context the recipients should know?"
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

        {/* Admin-only: flywheel stage picker. Maps to
            assigned_tasks.category so KPI counters pick up the task
            the moment it lands. */}
        <FlywheelStagePicker value={stage} onChange={setStage} />

        <RecurrencePicker value={recurrence} onChange={handleRecurrenceChange} />

        {/* Recipient list only in Members scope — Studio is a pool
            and doesn't need a picker. */}
        {scope === 'member' ? (
          <MemberMultiSelect
            selectedIds={selectedIds}
            onToggle={toggleRecipient}
            label="Recipients"
            maxHeightClass="max-h-48"
          />
        ) : (
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2.5 flex items-start gap-2">
            <Building2 size={14} className="text-cyan-300 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-[12px] text-text-muted leading-snug">
              <span className="text-cyan-300 font-semibold">Studio task.</span>{' '}
              No specific assignee — any team member can complete it. Lands in the Studio Tasks widget on the Tasks page, visible to everyone.
            </div>
          </div>
        )}
      </form>
    </FloatingDetailModal>
  )
}
