import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, ChevronDown, ChevronUp, Plus, Send, Sparkles, Users } from 'lucide-react'
import { useToast } from '../../Toast'
import MemberMultiSelect from '../../members/MemberMultiSelect'
import { assignCustomTaskToMembers } from '../../../lib/queries/assignments'
import type { AssignedTaskScope } from '../../../types/assignments'
import { FlywheelStagePicker, type FlywheelStage } from '../../tasks/requests/formAtoms'

/**
 * QuickAssignWidget — monday-style inline compose box at the top of
 * the Assign page. Admin types a title, picks recipients, sets an
 * optional due date, hits Send. No modal, no template picker, no
 * multi-step wizard.
 *
 * Why inline instead of a modal: monday.com's "+ Add item" pattern
 * sits AT THE TOP of every board and never blocks the view. That's
 * the ergonomic we want — admins can rattle off 3-4 tasks in a
 * sitting without losing context. "+ Add another" keeps the form open
 * after each send so the batch flow stays quick.
 *
 * Options reveal (description / required / show-on-overview) is
 * behind a "More options ⌄" toggle to keep the default state minimal.
 *
 * PR #14 — scope target toggle. Members (default) routes to specific
 * people. Studio writes a single shared task with no assignee that
 * anyone on the team can complete (like "restock cables" or "clean
 * live room"). Studio mode hides the recipient picker.
 */

const QUICK_KEY = ['admin-quick-assign'] as const

export default function QuickAssignWidget() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isRequired, setIsRequired] = useState(false)
  const [showOnOverview, setShowOnOverview] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [moreOpen, setMoreOpen] = useState(false)
  const [lastSent, setLastSent] = useState<string | null>(null)
  const [scope, setScope] = useState<AssignedTaskScope>('member')
  // PR #17 — admin tags tasks with a flywheel stage at creation time
  // so KPI counters pick up the task without a post-hoc backfill.
  const [stage, setStage] = useState<FlywheelStage | null>(null)

  const assignMutation = useMutation({
    mutationFn: async () => {
      return assignCustomTaskToMembers(
        scope === 'studio' ? [] : Array.from(selectedIds),
        {
          title: title.trim(),
          description: description.trim() || null,
          category: stage,
          due_date: dueDate || null,
          is_required: isRequired,
          show_on_overview: showOnOverview,
          scope,
        },
      )
    },
    onSuccess: (summary) => {
      if (scope === 'studio') {
        toast('Studio task posted · visible to the whole team', 'success')
      } else {
        toast(
          `Assigned to ${summary.recipient_count} ${
            summary.recipient_count === 1 ? 'member' : 'members'
          } · ${summary.task_count} ${summary.task_count === 1 ? 'task' : 'tasks'}`,
          'success',
        )
      }
      setLastSent(title.trim())
      // Keep recipients + scope for fast batch entry; clear only the
      // task-specific fields. Matches monday's "add another" flow.
      setTitle('')
      setDescription('')
      setDueDate('')
      setIsRequired(false)
      // Invalidate downstream caches so recipients see the task land
      // without a refresh.
      void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['team-assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-recent-assignments'] })
      void queryClient.invalidateQueries({ queryKey: QUICK_KEY })
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Assignment failed', 'error')
    },
  })

  const canSubmit = useMemo(() => {
    if (assignMutation.isPending) return false
    if (title.trim().length === 0) return false
    // Studio: no recipients needed — the task goes to the studio pool.
    // Member: must pick at least one.
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

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    assignMutation.mutate()
  }

  return (
    <section
      className="rounded-2xl border border-border bg-surface-alt/40 p-4 space-y-3"
      aria-labelledby="quick-assign-heading"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gold/15 ring-1 ring-gold/30 text-gold shrink-0">
            <Sparkles size={16} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="quick-assign-heading" className="text-[15px] font-bold text-text">
              Quick Assign
            </h2>
            <p className="text-[11px] text-text-light truncate">
              {scope === 'studio'
                ? 'Posting to the studio pool · any team member can complete'
                : 'Type a task, pick recipients, send'}
            </p>
          </div>
        </div>
        {/* Target toggle — Members vs Studio */}
        <div
          role="radiogroup"
          aria-label="Assign target"
          className="inline-flex rounded-lg bg-surface-alt ring-1 ring-border p-1 shrink-0"
        >
          <button
            type="button"
            role="radio"
            aria-checked={scope === 'member'}
            onClick={() => setScope('member')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
              scope === 'member'
                ? 'bg-gold text-black'
                : 'text-text-muted hover:text-text'
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
              scope === 'studio'
                ? 'bg-cyan-500 text-black'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <Building2 size={13} aria-hidden="true" />
            Studio
          </button>
        </div>
      </header>

      <form onSubmit={onSubmit} className="space-y-3">
        {/* Row 1: Title + Due + Send */}
        <div className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            aria-label="Task title"
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus-ring placeholder:text-text-light/70"
            maxLength={200}
            required
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label="Due date"
            className="md:w-44 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus-ring text-text"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gold text-black text-sm font-bold hover:bg-gold-muted focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={14} aria-hidden="true" />
            {assignMutation.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>

        {/* Row 2: Recipients (Member scope) OR studio note (Studio scope) */}
        {scope === 'member' ? (
          <MemberMultiSelect
            selectedIds={selectedIds}
            onToggle={toggleRecipient}
            label="Recipients"
            maxHeightClass="max-h-40"
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

        {/* Flywheel stage — admin-only per PR #17 decision.
            Pre-tags the resulting assigned_tasks.category so KPI
            counters pick up the task without a backfill. */}
        <FlywheelStagePicker value={stage} onChange={setStage} />

        {/* Row 3: More options toggle + collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-light hover:text-text"
            aria-expanded={moreOpen}
          >
            {moreOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            More options
          </button>
          {moreOpen && (
            <div className="mt-3 space-y-2 pl-4 border-l-2 border-border">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                aria-label="Task description"
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm focus-ring placeholder:text-text-light/70 resize-none"
                maxLength={2000}
              />
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-[12px] text-text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="w-4 h-4 rounded border-border-light bg-surface text-gold focus-ring"
                  />
                  Required
                </label>
                <label className="inline-flex items-center gap-2 text-[12px] text-text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showOnOverview}
                    onChange={(e) => setShowOnOverview(e.target.checked)}
                    className="w-4 h-4 rounded border-border-light bg-surface text-gold focus-ring"
                  />
                  Show on Overview
                </label>
              </div>
            </div>
          )}
        </div>

        {/* After-send acknowledgment + quick "Add another" affordance */}
        {lastSent && !assignMutation.isPending && (
          <div className="flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-500/10 ring-1 ring-emerald-500/30 rounded-lg px-3 py-2">
            <Plus size={12} aria-hidden="true" />
            Last sent: <span className="font-semibold">{lastSent}</span>
            <span className="text-text-light">· recipients kept for quick add</span>
          </div>
        )}
      </form>
    </section>
  )
}
