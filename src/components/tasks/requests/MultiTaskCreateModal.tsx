import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, FileText, Flame, Loader2, Plus, Repeat, Trash2, Users } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import { useToast } from '../../Toast'
import MemberMultiSelect from '../../members/MemberMultiSelect'
import {
  assignCustomTasksToMembers,
  type CustomTaskDraft,
} from '../../../lib/queries/assignments'
import { STUDIO_SPACES, type StudioSpace } from '../../../lib/queries/adminTasks'
import type { AssignedTaskScope } from '../../../types/assignments'
import AddFromTemplateModal from './AddFromTemplateModal'

type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly'

/** "members" or one of the three physical studio spaces — a single
 *  top-of-modal destination that every draft row in this session goes
 *  to. Replaces the old per-row studio-space picker: the 2026-07-11
 *  redesign (matching the director's reference mockup) treats "where
 *  does this batch go" as one modal-wide choice, not a per-task one.
 *  Need a mixed-room batch? Submit twice. */
type Destination = 'members' | StudioSpace

// 2026-07-12 — director direction: "we don't need the Control Room
// tab, that's part of Studio A." STUDIO_SPACES itself stays untouched
// (Control Room is still a real, distinct value elsewhere — the
// Studio Tasks page still groups existing Control Room tasks under
// their own section); this modal just stops offering it as a
// creation target.
const CREATABLE_STUDIO_SPACES = STUDIO_SPACES.filter((space) => space !== 'Control Room')

/**
 * MultiTaskCreateModal — PR #42, restyled 2026-07-11 to match the
 * director's reference mockup ("Add task" / assign-to tabs / member
 * photo grid).
 *
 * Replacement for the single-task AdminTaskCreateModal on the Assign
 * page. Supports row-by-row task entry plus an "Add from template"
 * shortcut that pulls items from any team template into the current
 * draft list.
 *
 * Top-of-modal "Assign to" tabs: Members / Control Room / Studio A /
 * Studio B. Members routes tasks to one or more picked recipients
 * (photo-card grid); any studio tab posts to that room's shared pool
 * (no recipient picker — anyone on the team can claim from there).
 *
 * On submit fires `assign_custom_tasks_to_members` (plural) once,
 * atomic across all draft rows.
 *
 * Notes:
 *   - "Add from template" copies item metadata into new editable
 *     rows. Once added, the rows are independent — the admin can
 *     tweak before submit. There's no template-link preserved (by
 *     design — these are now custom one-shot tasks).
 *   - The single-task AdminTaskCreateModal is kept around for the
 *     compact Hub Quick Assign flow; only the Assign page + the
 *     admin path of "+ New Task" (My Tasks / Team / Studio widgets)
 *     use this multi-row variant.
 */

interface DraftRow {
  // Local-only id so React keys stay stable when rows reorder /
  // delete. The DB never sees this.
  tempId: string
  title: string
  description: string
  // Studio-scope only — captured as `recurrence_spec` on the row.
  // `null` = one-shot. Member rows leave it null.
  recurrence: RecurrenceFrequency | null
  dueDate: string
  isRequired: boolean
}

function emptyRow(): DraftRow {
  return {
    tempId:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    title: '',
    description: '',
    recurrence: null,
    dueDate: '',
    isRequired: false,
  }
}

function destinationFromInitial(scope: AssignedTaskScope, studioSpace: StudioSpace | null): Destination {
  // Guard against a caller passing a space that isn't offered as a tab
  // (e.g. Control Room) — fall back to the first real tab instead of
  // landing on a destination with no visibly active button.
  if (scope === 'studio' && studioSpace && (CREATABLE_STUDIO_SPACES as readonly string[]).includes(studioSpace)) {
    return studioSpace
  }
  return 'members'
}

export default function MultiTaskCreateModal({
  onClose,
  initialScope = 'member',
  defaultRecipientIds,
  initialStudioSpace = null,
  initialDrafts,
}: {
  onClose: () => void
  initialScope?: AssignedTaskScope
  // PR #52 — when the modal opens from a per-member context (the
  // new member-centric Assign page), pre-select that member as the
  // recipient. Pass an empty array (or omit) for the default
  // empty-set behaviour used by the Hub Quick Assign flow.
  defaultRecipientIds?: string[]
  // PR #102 — when the modal opens from the Studio tab, optionally
  // pre-select that room's destination tab (e.g., admin clicks +Add
  // inside Control Room → opens modal already on the Control Room
  // tab).
  initialStudioSpace?: StudioSpace | null
  // PR #102 — when invoked from a Templates dropdown, pre-load
  // the template's items as draft rows so the admin can review
  // before sending. Each draft inherits stage/description/etc
  // from the template item; admin can edit before submit.
  initialDrafts?: CustomTaskDraft[]
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [destination, setDestination] = useState<Destination>(
    destinationFromInitial(initialScope, initialStudioSpace),
  )
  const scope: AssignedTaskScope = destination === 'members' ? 'member' : 'studio'
  const studioSpace: StudioSpace | null = destination === 'members' ? null : destination

  const [drafts, setDrafts] = useState<DraftRow[]>(() => {
    if (initialDrafts && initialDrafts.length > 0) {
      return initialDrafts.map((d) => ({
        ...emptyRow(),
        title: d.title,
        description: d.description ?? '',
        recurrence: d.recurrence_spec?.frequency ?? null,
        isRequired: d.is_required ?? false,
      }))
    }
    return [emptyRow()]
  })
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    () => new Set(defaultRecipientIds ?? []),
  )
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)

  const updateDraft = (tempId: string, patch: Partial<DraftRow>) => {
    setDrafts((prev) => prev.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d)))
  }
  const removeDraft = (tempId: string) => {
    setDrafts((prev) => (prev.length === 1 ? prev : prev.filter((d) => d.tempId !== tempId)))
  }
  const addEmpty = () => setDrafts((prev) => [...prev, emptyRow()])

  const handleAddFromTemplate = (newDrafts: CustomTaskDraft[]) => {
    setTemplatePickerOpen(false)
    if (newDrafts.length === 0) return
    setDrafts((prev) => {
      // If the only existing row is empty (untouched), replace it
      // with the imported rows so we don't leave a stray blank.
      const onlyEmpty =
        prev.length === 1 &&
        prev[0]?.title.trim() === '' &&
        prev[0]?.description.trim() === ''
      const imported: DraftRow[] = newDrafts.map((d) => ({
        ...emptyRow(),
        title: d.title,
        description: d.description ?? '',
        isRequired: d.is_required ?? false,
      }))
      return onlyEmpty ? imported : [...prev, ...imported]
    })
  }

  const submitMutation = useMutation({
    mutationFn: () => {
      const payload: CustomTaskDraft[] = drafts
        .filter((d) => d.title.trim().length > 0)
        .map((d) => ({
          title: d.title.trim(),
          description: d.description.trim() || null,
          // 2026-07-11 — Flywheel stage picker removed from this modal
          // per director direction ("get rid of the flywheel stuff").
          // category always NULL for tasks created here now.
          category: null,
          due_date: d.dueDate || null,
          is_required: d.isRequired,
          show_on_overview: true,
          // Destination is chosen once for the whole modal session now
          // (see `Destination` type comment above).
          studio_space: scope === 'studio' ? studioSpace : null,
          // Recurrence threads through for BOTH scopes; engine handles
          // member + studio rows uniformly.
          recurrence_spec: d.recurrence
            ? { frequency: d.recurrence, interval: 1 }
            : null,
        }))
      return assignCustomTasksToMembers(
        scope === 'studio' ? [] : Array.from(selectedMemberIds),
        payload,
        { scope },
      )
    },
    onSuccess: (summary) => {
      const tasks = summary.task_count
      const recipients = summary.recipient_count
      if (scope === 'studio') {
        toast(
          `${tasks} task${tasks === 1 ? '' : 's'} posted to ${studioSpace ?? 'the studio pool'} — visible to the whole team.`,
          'success',
        )
      } else {
        toast(
          `Sent ${tasks} task${tasks === 1 ? '' : 's'} to ${recipients} member${recipients === 1 ? '' : 's'}.`,
          'success',
        )
      }
      void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['team-assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
      // PR #44 — Assign Log widget reads under this prefix.
      void queryClient.invalidateQueries({ queryKey: ['admin-log'] })
      // Edit Tasks widget shares this prefix.
      void queryClient.invalidateQueries({ queryKey: ['admin-assigned-tasks'] })
      onClose()
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  const validDraftCount = drafts.filter((d) => d.title.trim().length > 0).length
  const canSubmit =
    validDraftCount > 0 &&
    !submitMutation.isPending &&
    (scope === 'studio' || selectedMemberIds.size > 0)

  const eyebrow =
    destination === 'members'
      ? 'Send to one or more team members'
      : `Studio pool — visible to the whole team · ${destination}`

  return (
    <>
      <FloatingDetailModal
        title="Add task"
        eyebrow={eyebrow}
        onClose={onClose}
        maxWidth={680}
      >
        <div className="flex flex-col gap-4">
          {/* Assign to — Members / Studio A / Studio B. One choice for
              the whole modal session (see Destination type comment).
              Bigger, bordered tabs match the reference mockup's visual
              weight — a step up from a small pill toggle since this is
              the first, most consequential decision in the flow.
              2026-07-12 — Control Room dropped per director direction
              ("that's part of Studio A"); STUDIO_SPACES itself is
              untouched (existing Control Room tasks elsewhere in the
              app are unaffected), this modal just doesn't offer it as
              a creation target anymore. */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-light mb-2">
              Assign to
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <DestinationTab
                active={destination === 'members'}
                icon={<Users size={15} />}
                label="Members"
                onClick={() => setDestination('members')}
              />
              {CREATABLE_STUDIO_SPACES.map((space) => (
                <DestinationTab
                  key={space}
                  active={destination === space}
                  icon={<Building2 size={15} />}
                  label={space}
                  onClick={() => setDestination(space)}
                />
              ))}
            </div>
          </div>

          {/* Recipient picker — photo-card grid, moved above the task
              rows per director direction ("swap task info with the
              members spot"): pick who first, then fill in what. Member
              destination only. */}
          {destination === 'members' && (
            <MemberMultiSelect
              label="Send to members"
              variant="grid"
              selectedIds={selectedMemberIds}
              onToggle={(id) =>
                setSelectedMemberIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }
            />
          )}

          {/* Draft rows */}
          <div className="space-y-2">
            {drafts.map((d, i) => (
              <DraftRowCard
                key={d.tempId}
                index={i}
                draft={d}
                canRemove={drafts.length > 1}
                onChange={(patch) => updateDraft(d.tempId, patch)}
                onRemove={() => removeDraft(d.tempId)}
              />
            ))}
          </div>

          {/* Add row + Add from template buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={addEmpty}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold text-gold/90 hover:text-gold hover:bg-gold/5 transition-colors"
            >
              <Plus size={14} strokeWidth={2.5} />
              Add task
            </button>
            <button
              type="button"
              onClick={() => setTemplatePickerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold text-text-light hover:text-text hover:bg-surface-hover transition-colors ring-1 ring-border"
            >
              <FileText size={13} />
              Add from template
            </button>
          </div>

          {/* Submit row */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center py-2 rounded-lg text-[13px] font-semibold btn-subtle"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={!canSubmit}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-bold bg-gold text-black hover:bg-gold-muted disabled:opacity-50"
            >
              {submitMutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Plus size={13} strokeWidth={2.5} />
              )}
              {submitMutation.isPending
                ? 'Creating…'
                : `Create task${validDraftCount === 1 ? '' : `s (${validDraftCount})`}`}
            </button>
          </div>
        </div>
      </FloatingDetailModal>

      {templatePickerOpen && (
        <AddFromTemplateModal
          onCancel={() => setTemplatePickerOpen(false)}
          onAdd={handleAddFromTemplate}
        />
      )}
    </>
  )
}

function DestinationTab({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-[13px] font-bold transition-colors focus-ring ${
        active
          ? 'border-gold bg-gold/10 text-gold'
          : 'border-border text-text-muted hover:text-text hover:border-text-light/40'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function DraftRowCard({
  index,
  draft,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number
  draft: DraftRow
  canRemove: boolean
  onChange: (patch: Partial<DraftRow>) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold tracking-[0.08em] text-text-muted uppercase">
          Task {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove task"
            className="inline-flex items-center justify-center p-1 rounded-md text-text-muted hover:text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Title + priority flame + due date on one row, matching the
          reference mockup's layout. Flame replaces the old bottom
          "Required" checkbox — same underlying `isRequired` field. */}
      <div className="flex items-start gap-2">
        <input
          type="text"
          autoFocus={index === 0 && !draft.title}
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Task title"
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-surface-alt border border-border text-[13px] font-semibold text-text placeholder:text-text-muted focus:outline-none focus:border-gold/50"
        />
        <button
          type="button"
          onClick={() => onChange({ isRequired: !draft.isRequired })}
          aria-label={draft.isRequired ? 'Remove priority' : 'Mark as priority'}
          aria-pressed={draft.isRequired}
          title="Priority"
          className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors focus-ring ${
            draft.isRequired
              ? 'border-orange-400/60 bg-orange-500/15 text-orange-300'
              : 'border-border text-text-light hover:text-orange-300 hover:border-orange-400/40'
          }`}
        >
          <Flame size={15} aria-hidden="true" />
        </button>
        <input
          type="date"
          value={draft.dueDate}
          onChange={(e) => onChange({ dueDate: e.target.value })}
          aria-label="Due date"
          className="shrink-0 w-[150px] px-2.5 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text focus:outline-none focus:border-gold/50"
        />
      </div>

      <textarea
        value={draft.description}
        onChange={(e) => onChange({ description: e.target.value })}
        rows={2}
        placeholder="Description (optional)"
        className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text placeholder:text-text-muted focus:outline-none focus:border-gold/50 resize-none"
      />

      {/* Recurrence — surfaced for BOTH destinations (2026-05-07).
          Selecting Daily / Weekly / Monthly causes
          spawn_recurring_task_instances() to insert fresh rows on
          cadence; cron fires daily at 11:00 UTC. */}
      <RecurrencePicker
        value={draft.recurrence}
        onChange={(next) => onChange({ recurrence: next })}
      />
    </div>
  )
}

// ─── Recurrence pills ───────────────────────────────────────────────
//
// [None] [Daily] [Weekly] [Monthly]
//
// Captures the cadence on the row; the actual auto-recreate engine
// is a future feature. Persisted as `recurrence_spec = {frequency,
// interval: 1}` (server CHECK enforces the frequency enum).

function RecurrencePicker({
  value,
  onChange,
}: {
  value: RecurrenceFrequency | null
  onChange: (next: RecurrenceFrequency | null) => void
}) {
  const options: { key: RecurrenceFrequency; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ]
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-light mb-1.5">
        <span className="inline-flex items-center gap-1">
          <Repeat size={9} aria-hidden="true" />
          Recurrence
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        <SpacePill label="None" active={value === null} onClick={() => onChange(null)} />
        {options.map((opt) => (
          <SpacePill
            key={opt.key}
            label={opt.label}
            active={value === opt.key}
            onClick={() => onChange(opt.key)}
          />
        ))}
      </div>
    </div>
  )
}

function SpacePill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 transition-colors ${
        active
          ? 'bg-gold/15 text-gold ring-gold/40'
          : 'bg-surface-alt text-text-muted ring-border hover:text-text hover:bg-surface-hover'
      }`}
    >
      {label}
    </button>
  )
}
