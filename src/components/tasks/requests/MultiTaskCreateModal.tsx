import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Check, FileText, Flame, Loader2, Plus, Repeat, Send, Trash2, Users } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import { useToast } from '../../Toast'
import MemberMultiSelect from '../../members/MemberMultiSelect'
import {
  assignCustomTasksToMembers,
  type CustomTaskDraft,
} from '../../../lib/queries/assignments'
import type { StudioSpace } from '../../../lib/queries/adminTasks'
import type { AssignedTaskScope } from '../../../types/assignments'
import { Field, FlywheelStagePicker, type FlywheelStage } from './formAtoms'
import AddFromTemplateModal from './AddFromTemplateModal'

type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly'

/**
 * MultiTaskCreateModal — PR #42.
 *
 * Replacement for the single-task AdminTaskCreateModal on the Assign
 * page. Supports row-by-row task entry plus an "Add from template"
 * shortcut that pulls items from any team template into the current
 * draft list.
 *
 * Top-of-modal toggle:
 *   - Member: tasks go to one or more members; each gets a single
 *     batch notification summarising the N tasks.
 *   - Studio: each task becomes its own shared studio row in the
 *     pool. No recipient picker.
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
 *     compact Hub Quick Assign flow; only the Assign page uses this
 *     multi-row variant.
 */

interface DraftRow {
  // Local-only id so React keys stay stable when rows reorder /
  // delete. The DB never sees this.
  tempId: string
  title: string
  description: string
  stage: FlywheelStage | null
  // Studio-scope only — persisted as `studio_space` on the row.
  // Member scope rows ignore this field.
  studioSpace: StudioSpace | null
  // Studio-scope only — captured as `recurrence_spec` on the row.
  // `null` = one-shot. Member rows leave it null.
  recurrence: RecurrenceFrequency | null
  dueDate: string
  isRequired: boolean
}

function emptyRow(initialStudioSpace: StudioSpace | null = null): DraftRow {
  return {
    tempId:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    title: '',
    description: '',
    stage: null,
    studioSpace: initialStudioSpace,
    recurrence: null,
    dueDate: '',
    isRequired: false,
  }
}

export default function MultiTaskCreateModal({
  onClose,
  initialScope = 'member',
  defaultRecipientIds,
  initialStudioSpace = null,
  initialDrafts,
  lockScope = false,
}: {
  onClose: () => void
  initialScope?: AssignedTaskScope
  // PR #52 — when the modal opens from a per-member context (the
  // new member-centric Assign page), pre-select that member as the
  // recipient. Pass an empty array (or omit) for the default
  // empty-set behaviour used by the Hub Quick Assign flow.
  defaultRecipientIds?: string[]
  // PR #102 — when the modal opens from the Studio tab, optionally
  // pre-fill the first draft row's studio_space (e.g., admin
  // clicks +Add inside Control Room → opens modal with Control
  // Room already selected on draft 1). Subsequent rows the admin
  // adds default to "All / no specific room" so they pick per row.
  initialStudioSpace?: StudioSpace | null
  // PR #102 — when invoked from a Templates dropdown, pre-load
  // the template's items as draft rows so the admin can review
  // before sending. Each draft inherits stage/description/etc
  // from the template item; admin can edit before submit.
  initialDrafts?: CustomTaskDraft[]
  // Fixed-context launchers (Assign > member and Assign > Studio)
  // already establish where tasks belong, so the redundant scope
  // switch stays hidden. Hub Quick Assign leaves it available.
  lockScope?: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [scope, setScope] = useState<AssignedTaskScope>(initialScope)
  const [drafts, setDrafts] = useState<DraftRow[]>(() => {
    if (initialDrafts && initialDrafts.length > 0) {
      return initialDrafts.map((d) => ({
        ...emptyRow(initialScope === 'studio' ? initialStudioSpace ?? 'Studio A' : null),
        title: d.title,
        description: d.description ?? '',
        stage: (d.category as FlywheelStage) ?? null,
        studioSpace:
          initialScope === 'studio'
            ? (d.studio_space as StudioSpace | null) ?? initialStudioSpace ?? 'Studio A'
            : null,
        recurrence: d.recurrence_spec?.frequency ?? null,
        isRequired: d.is_required ?? false,
      }))
    }
    return [
      emptyRow(initialScope === 'studio' ? initialStudioSpace ?? 'Studio A' : null),
    ]
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
  const addEmpty = () =>
    setDrafts((prev) => [
      ...prev,
      emptyRow(scope === 'studio' ? 'Studio A' : null),
    ])

  const changeScope = (nextScope: AssignedTaskScope) => {
    setScope(nextScope)
    if (nextScope === 'studio') {
      setDrafts((prev) =>
        prev.map((draft) => ({
          ...draft,
          studioSpace: draft.studioSpace ?? 'Studio A',
        })),
      )
    }
  }

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
        ...emptyRow(scope === 'studio' ? 'Studio A' : null),
        title: d.title,
        description: d.description ?? '',
        stage: (d.category as FlywheelStage) ?? null,
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
          // Studio rows don't expose Flywheel stage — server stores
          // category=NULL for them. Member rows keep the existing
          // FlywheelStagePicker behaviour.
          category: scope === 'studio' ? null : d.stage,
          due_date: d.dueDate || null,
          is_required: d.isRequired,
          show_on_overview: true,
          studio_space: scope === 'studio' ? d.studioSpace : null,
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
          `${tasks} studio task${tasks === 1 ? '' : 's'} posted — visible to the whole team.`,
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

  return (
    <>
      <FloatingDetailModal
        title="Add tasks"
        eyebrow={
          scope === 'studio'
            ? 'Studio pool — anyone on the team can claim'
            : 'Send to one or more team members'
        }
        onClose={onClose}
        maxWidth={720}
      >
        <div className="flex flex-col gap-4">
          {!lockScope && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-alt ring-1 ring-border self-start">
              <ScopeButton
                active={scope === 'member'}
                icon={<Users size={13} />}
                label="Members"
                onClick={() => changeScope('member')}
              />
              <ScopeButton
                active={scope === 'studio'}
                icon={<Building2 size={13} />}
                label="Studio"
                onClick={() => changeScope('studio')}
              />
            </div>
          )}

          <div className="rounded-2xl bg-[#c8c8c4] p-2.5 sm:p-3 ring-1 ring-[#b8b8b4]">
            <div className="space-y-3">
              {/* Draft rows */}
              <div className="space-y-2">
                {drafts.map((d, i) => (
                  <DraftRowCard
                    key={d.tempId}
                    index={i}
                    draft={d}
                    scope={scope}
                    canRemove={drafts.length > 1}
                    onChange={(patch) => updateDraft(d.tempId, patch)}
                    onRemove={() => removeDraft(d.tempId)}
                  />
                ))}
              </div>

              {/* Add row + Add from template buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={addEmpty}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-full border-2 border-[#6f706d] bg-white/65 text-[13px] font-bold text-[#454644] shadow-sm hover:bg-white transition-colors focus-ring"
                  aria-label="Add another task"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Task
                </button>
                <button
                  type="button"
                  onClick={() => setTemplatePickerOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-full bg-white/90 text-[13px] font-bold text-[#454644] shadow-sm hover:bg-white transition-colors focus-ring"
                >
                  <FileText size={13} />
                  Add from template
                </button>
              </div>
            </div>
          </div>

          {/* Recipient picker (member scope only) */}
          {scope === 'member' && (
            <Field label="Send to">
              <MemberMultiSelect
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
            </Field>
          )}

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
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-bold bg-gold text-black hover:bg-gold-muted disabled:opacity-100 disabled:bg-gold/55 disabled:text-black disabled:cursor-not-allowed"
            >
              {submitMutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Send size={13} strokeWidth={2.5} />
              )}
              Submit
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

function ScopeButton({
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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
        active
          ? 'bg-gold/15 text-gold'
          : 'text-text-muted hover:text-text'
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
  scope,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number
  draft: DraftRow
  scope: AssignedTaskScope
  canRemove: boolean
  onChange: (patch: Partial<DraftRow>) => void
  onRemove: () => void
}) {
  const isStudio = scope === 'studio'
  return (
    <div className="rounded-2xl border border-[#bdbdb8] bg-[#efefec] p-3 sm:p-4 space-y-2.5 shadow-[0_7px_18px_rgba(20,20,20,0.12)]">
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

      <input
        type="text"
        autoFocus={index === 0 && !draft.title}
        value={draft.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Task title"
        className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-[14px] font-semibold text-text placeholder:text-text-muted focus:outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/10"
      />

      {isStudio && (
        <StudioRoomTabs
          value={
            draft.studioSpace === 'Studio A' || draft.studioSpace === 'Studio B'
              ? draft.studioSpace
              : null
          }
          onChange={(studioSpace) => onChange({ studioSpace })}
        />
      )}

      <div className="pt-1 space-y-3 border-t border-border/70">
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          placeholder="Description"
          className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-border text-[12px] text-text placeholder:text-text-muted focus:outline-none focus:border-gold/50 resize-none"
        />

        {!isStudio && (
          <FlywheelStagePicker
            value={draft.stage}
            onChange={(next) => onChange({ stage: next })}
            label="Flywheel stage"
          />
        )}

        <RecurrencePicker
          value={draft.recurrence}
          onChange={(next) => onChange({ recurrence: next })}
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-light mb-1">
              Due date
            </label>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) => onChange({ dueDate: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-border text-[12px] text-text focus:outline-none focus:border-gold/50"
            />
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.isRequired}
            onClick={() => onChange({ isRequired: !draft.isRequired })}
            style={
              draft.isRequired
                ? { color: '#fff', backgroundColor: '#ef4444' }
                : { color: '#dc2626', backgroundColor: '#fef2f2' }
            }
            className={`self-end min-h-8 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ring-1 transition-all ${
              draft.isRequired
                ? 'bg-red-500 text-white ring-red-400/60 shadow-[0_6px_18px_rgba(239,68,68,0.24)]'
                : 'bg-red-50 text-red-600 ring-red-300 hover:bg-red-100 hover:ring-red-400'
            }`}
          >
            <Flame
              size={13}
              strokeWidth={2.4}
              className={draft.isRequired ? 'fill-white/25 text-white' : ''}
              aria-hidden="true"
            />
            Priority
          </button>
        </div>
      </div>
    </div>
  )
}

function StudioRoomTabs({
  value,
  onChange,
}: {
  value: 'Studio A' | 'Studio B' | null
  onChange: (next: 'Studio A' | 'Studio B' | null) => void
}) {
  const studios = [
    {
      label: 'Studio A',
      value: 'Studio A',
      activeStyle: {
        backgroundColor: '#e7e5e4',
        color: '#27272a',
        boxShadow: '0 0 0 2px #3f403e, 0 5px 12px rgba(20, 20, 20, 0.18)',
      },
    },
    {
      label: 'Studio B',
      value: 'Studio B',
      activeStyle: {
        backgroundColor: '#e2e8f0',
        color: '#27272a',
        boxShadow: '0 0 0 2px #3f403e, 0 5px 12px rgba(20, 20, 20, 0.18)',
      },
    },
    {
      label: 'Custom',
      value: null,
      activeStyle: {
        backgroundColor: '#e5e7eb',
        color: '#27272a',
        boxShadow: '0 0 0 2px #3f403e, 0 5px 12px rgba(20, 20, 20, 0.18)',
      },
    },
  ] as const

  return (
    <div
      className="grid grid-cols-3 gap-1 p-1.5 rounded-xl bg-surface-hover ring-1 ring-border shadow-inner"
      role="tablist"
      aria-label="Studio"
    >
      {studios.map((studio) => (
        <button
          key={studio.label}
          type="button"
          role="tab"
          aria-selected={value === studio.value}
          onClick={() => onChange(studio.value)}
          style={value === studio.value ? studio.activeStyle : undefined}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-all ${
            value === studio.value
              ? '-translate-y-px shadow-sm'
              : 'text-text-muted hover:text-text hover:bg-surface-hover'
          }`}
        >
          {value === studio.value && (
            <Check size={13} strokeWidth={3} aria-hidden="true" />
          )}
          {studio.label}
        </button>
      ))}
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
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
        active
          ? '-translate-y-px bg-[#3f403e] text-white ring-2 ring-[#3f403e] shadow-[0_4px_9px_rgba(20,20,20,0.22)]'
          : 'bg-surface-alt text-text-muted ring-1 ring-border hover:text-text hover:bg-surface-hover'
      }`}
    >
      {active && <Check size={11} strokeWidth={3} aria-hidden="true" />}
      {label}
    </button>
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
