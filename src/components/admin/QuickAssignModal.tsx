import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Calendar, CalendarCheck, Send, Users, Zap } from 'lucide-react'
import FloatingDetailModal from '../FloatingDetailModal'
import { useToast } from '../Toast'
import MemberMultiSelect from '../members/MemberMultiSelect'
import { assignCustomTaskToMembers } from '../../lib/queries/assignments'
import type { AssignedTaskScope } from '../../types/assignments'

/**
 * QuickAssignModal — slim "send a task in five seconds" surface for
 * the Hub page (PR follow-up to PR #143).
 *
 * Distinct from `AdminTaskCreateModal` (which is the full task-compose
 * surface with description, priority, recurrence, flywheel stage). The
 * quick variant strips down to only what's required for the assignment
 * to land + a one-tap "today" affordance on the date field per the
 * user direction "should be able to click once on the calendar icon
 * and it populates today's date".
 *
 * Reuses the same RPC (`assign_custom_task_to_members`) so quick-assigned
 * tasks are functionally identical to ones created through the full
 * modal — the only difference is the omitted optional fields default
 * sensibly (no description, no priority, no recurrence, no flywheel
 * stage tag).
 *
 * Studio/Members toggle preserved because admins really do want to
 * post a quick "clean up control room" to the studio pool sometimes.
 */
export default function QuickAssignModal({
  onClose,
  initialScope = 'member',
}: {
  onClose: () => void
  initialScope?: AssignedTaskScope
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [scope, setScope] = useState<AssignedTaskScope>(initialScope)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const todayISO = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])
  const isToday = dueDate === todayISO

  const assignMutation = useMutation({
    mutationFn: () =>
      assignCustomTaskToMembers(
        scope === 'studio' ? [] : Array.from(selectedIds),
        {
          title: title.trim(),
          description: null,
          category: null,
          due_date: dueDate || null,
          is_required: false,
          show_on_overview: true,
          scope,
        },
      ),
    onSuccess: (summary) => {
      if (scope === 'studio') {
        toast('Studio task posted — visible to the whole team.', 'success')
      } else {
        toast(
          `Quick-assigned to ${summary.recipient_count} ${
            summary.recipient_count === 1 ? 'member' : 'members'
          }`,
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
      toast(err instanceof Error ? err.message : 'Quick assign failed', 'error')
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

  return (
    <FloatingDetailModal
      onClose={onClose}
      header={
        <>
          <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-gold/80 font-bold">
            <Zap size={11} strokeWidth={2.5} className="text-gold" aria-hidden="true" />
            Quick Assign
          </p>
          <h2 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-text leading-tight truncate">
            Send a task in seconds
          </h2>
        </>
      }
      maxWidth={520}
      ariaLabel="Quick-assign a task"
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
            form="quick-assign-form"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold text-black text-[13px] font-bold hover:bg-gold-muted focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={13} aria-hidden="true" />
            {assignMutation.isPending ? 'Sending…' : 'Assign'}
          </button>
        </div>
      }
    >
      <form id="quick-assign-form" onSubmit={handleSubmit} className="space-y-3.5 px-4 py-3">
        {/* Scope toggle — same chrome as AdminTaskCreateModal so the
            two surfaces feel like siblings. */}
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

        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-light">
            What needs doing?
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Reset patch bay before tonight's session"
            className="mt-1.5 w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus-ring placeholder:text-text-light/70"
            maxLength={200}
            required
            autoFocus
          />
        </label>

        {/* Date row with the one-tap "Today" affordance. The big
            CalendarCheck button on the left fills today; users can
            still type any other date in the input. */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-light">
            Due
          </span>
          <div className="mt-1.5 flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => setDueDate(isToday ? '' : todayISO)}
              aria-pressed={isToday}
              title={isToday ? 'Clear today' : 'Set to today'}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 rounded-xl border text-[12px] font-bold transition-colors focus-ring ${
                isToday
                  ? 'bg-gold text-black border-gold-muted'
                  : 'bg-surface-alt text-text-muted border-border hover:text-text hover:border-border-light'
              }`}
            >
              {isToday ? (
                <CalendarCheck size={14} strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <Calendar size={14} strokeWidth={2.2} aria-hidden="true" />
              )}
              Today
            </button>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus-ring text-text"
            />
          </div>
        </div>

        {scope === 'member' ? (
          <MemberMultiSelect
            selectedIds={selectedIds}
            onToggle={toggleRecipient}
            label="To"
            maxHeightClass="max-h-44"
          />
        ) : (
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2.5 flex items-start gap-2">
            <Building2 size={14} className="text-cyan-300 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-[12px] text-text-muted leading-snug">
              <span className="text-cyan-300 font-semibold">Studio task.</span>{' '}
              No specific assignee — any team member can claim it from the Studio Tasks widget.
            </div>
          </div>
        )}
      </form>
    </FloatingDetailModal>
  )
}
