import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, FileText, Loader2, Plus, Send, Trash2, Users } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import { useToast } from '../../Toast'
import MemberMultiSelect from '../../members/MemberMultiSelect'
import {
  assignCustomTasksToMembers,
  type CustomTaskDraft,
} from '../../../lib/queries/assignments'
import type { AssignedTaskScope } from '../../../types/assignments'
import { Field, FlywheelStagePicker, type FlywheelStage } from './formAtoms'
import AddFromTemplateModal from './AddFromTemplateModal'

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
    stage: null,
    dueDate: '',
    isRequired: false,
  }
}

export default function MultiTaskCreateModal({
  onClose,
  initialScope = 'member',
  defaultRecipientIds,
}: {
  onClose: () => void
  initialScope?: AssignedTaskScope
  // PR #52 — when the modal opens from a per-member context (the
  // new member-centric Assign page), pre-select that member as the
  // recipient. Pass an empty array (or omit) for the default
  // empty-set behaviour used by the Hub Quick Assign flow.
  defaultRecipientIds?: string[]
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [scope, setScope] = useState<AssignedTaskScope>(initialScope)
  const [drafts, setDrafts] = useState<DraftRow[]>(() => [emptyRow()])
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
          category: d.stage,
          due_date: d.dueDate || null,
          is_required: d.isRequired,
          show_on_overview: true,
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
        maxWidth={680}
      >
        <div className="flex flex-col gap-4">
          {/* Scope toggle — Members vs Studio */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-alt ring-1 ring-border self-start">
            <ScopeButton
              active={scope === 'member'}
              icon={<Users size={13} />}
              label="Members"
              onClick={() => setScope('member')}
            />
            <ScopeButton
              active={scope === 'studio'}
              icon={<Building2 size={13} />}
              label="Studio"
              onClick={() => setScope('studio')}
            />
          </div>

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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold text-text-light hover:text-text hover:bg-white/[0.04] transition-colors ring-1 ring-border"
            >
              <FileText size={13} />
              Add from template
            </button>
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
              className="flex-1 inline-flex items-center justify-center py-2 rounded-lg text-[13px] font-semibold bg-white/[0.04] text-text-light hover:text-text hover:bg-white/[0.08]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={!canSubmit}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-bold bg-gradient-to-b from-gold to-gold-muted text-black hover:brightness-105 disabled:opacity-50"
            >
              {submitMutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Send size={13} strokeWidth={2.5} />
              )}
              Send {validDraftCount} task{validDraftCount === 1 ? '' : 's'}
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
    <div className="rounded-xl border border-border bg-surface-alt/40 p-3 space-y-2">
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
        className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-border text-[13px] font-semibold text-text placeholder:text-text-muted focus:outline-none focus:border-gold/50"
      />

      <textarea
        value={draft.description}
        onChange={(e) => onChange({ description: e.target.value })}
        rows={2}
        placeholder="Description (optional)"
        className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text placeholder:text-text-muted focus:outline-none focus:border-gold/50 resize-none"
      />

      <FlywheelStagePicker
        value={draft.stage}
        onChange={(next) => onChange({ stage: next })}
        label="Flywheel stage"
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
            className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text focus:outline-none focus:border-gold/50"
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-1.5 text-[12px] text-text cursor-pointer">
          <input
            type="checkbox"
            checked={draft.isRequired}
            onChange={(e) => onChange({ isRequired: e.target.checked })}
            className="accent-gold"
          />
          Required
        </label>
      </div>
    </div>
  )
}
