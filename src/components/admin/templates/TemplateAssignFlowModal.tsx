import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Send, Users } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import MemberMultiSelect from '../../members/MemberMultiSelect'
import {
  assignTemplateItemsToMembers,
  assignTemplateToMembers,
  taskTemplateKeys,
} from '../../../lib/queries/taskTemplates'
import { useToast } from '../../Toast'
import type { TaskTemplate, TaskTemplateItem } from '../../../types/assignments'

/**
 * TemplateAssignFlowModal — 3-step wizard to assign a template (full
 * or partial) to one or more members.
 *
 * Step 1: recipients (MemberMultiSelect).
 * Step 2: items (preview from the template, default = all selected).
 * Step 3: overrides + confirm (due date, optional title/description
 *          overrides, summary of what will be created).
 *
 * User can back-navigate between steps. Cancel is always available.
 * On confirm: calls assign_template_to_members (all items selected)
 * or assign_template_items_to_members (subset). Both RPCs are atomic
 * on the backend so we don't need to split the call.
 */

interface TemplateAssignFlowModalProps {
  template: TaskTemplate
  items: TaskTemplateItem[]
  /** Optional pre-selection of item IDs carried from preview modal. */
  initialItemIds?: string[]
  onClose: () => void
  onAssigned?: () => void
}

type Step = 'recipients' | 'items' | 'confirm'

export default function TemplateAssignFlowModal({
  template,
  items,
  initialItemIds,
  onClose,
  onAssigned,
}: TemplateAssignFlowModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const allItemIds = useMemo(() => items.map((i) => i.id), [items])
  const [step, setStep] = useState<Step>('recipients')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    () => new Set(initialItemIds && initialItemIds.length > 0 ? initialItemIds : allItemIds),
  )
  const [dueDate, setDueDate] = useState('')
  const [titleOverride, setTitleOverride] = useState('')
  const [descriptionOverride, setDescriptionOverride] = useState('')

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllItems = () => setSelectedItems(new Set(allItemIds))
  const clearItems = () => setSelectedItems(new Set())

  const isAllItemsSelected =
    selectedItems.size === items.length && items.every((i) => selectedItems.has(i.id))

  const assignMutation = useMutation({
    mutationFn: async () => {
      const overrides = {
        due_date: dueDate || null,
        title_override: titleOverride.trim() || null,
        description_override: descriptionOverride.trim() || null,
      }
      const memberIds = Array.from(selectedMembers)
      if (isAllItemsSelected) {
        return assignTemplateToMembers(template.id, memberIds, overrides)
      }
      return assignTemplateItemsToMembers(
        template.id,
        Array.from(selectedItems),
        memberIds,
        overrides,
      )
    },
    onSuccess: (summary) => {
      toast(
        `Assigned to ${summary.recipient_count} ${summary.recipient_count === 1 ? 'member' : 'members'} · ${summary.task_count} tasks`,
        'success',
      )
      // Invalidate everything that cares — admin's recent list, member
      // assigned tasks, notifications. Backend is atomic so a single
      // successful return means all four are in sync.
      void queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['admin-recent-assignments'] })
      void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
      onAssigned?.()
      onClose()
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to assign', 'error')
    },
  })

  // ── Step navigation ──────────────────────────────────────────────
  const nextFromRecipients = () => {
    if (selectedMembers.size === 0) {
      toast('Pick at least one recipient', 'error')
      return
    }
    setStep('items')
  }

  const nextFromItems = () => {
    if (selectedItems.size === 0) {
      toast('Pick at least one item', 'error')
      return
    }
    setStep('confirm')
  }

  // ── Footer for each step ─────────────────────────────────────────
  const stepFooter = () => {
    if (step === 'recipients') {
      return (
        <div className="flex justify-between items-center gap-3">
          <p className="text-[11px] text-text-light">Step 1 of 3</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-text-light hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={nextFromRecipients}
              disabled={selectedMembers.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-black text-sm font-bold disabled:opacity-50 hover:bg-gold-muted"
            >
              Next: Items
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )
    }
    if (step === 'items') {
      return (
        <div className="flex justify-between items-center gap-3">
          <p className="text-[11px] text-text-light">Step 2 of 3</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('recipients')}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm text-text-light hover:text-text"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back
            </button>
            <button
              type="button"
              onClick={nextFromItems}
              disabled={selectedItems.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-black text-sm font-bold disabled:opacity-50 hover:bg-gold-muted"
            >
              Next: Confirm
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )
    }
    // confirm
    return (
      <div className="flex justify-between items-center gap-3">
        <p className="text-[11px] text-text-light">Step 3 of 3</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep('items')}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm text-text-light hover:text-text"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back
          </button>
          <button
            type="button"
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-black text-sm font-bold disabled:opacity-50 hover:bg-gold-muted"
          >
            <Send size={14} aria-hidden="true" />
            {assignMutation.isPending
              ? 'Assigning…'
              : `Assign to ${selectedMembers.size} ${selectedMembers.size === 1 ? 'member' : 'members'}`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <FloatingDetailModal
      onClose={onClose}
      eyebrow={`Assign · ${template.name}`}
      title={
        step === 'recipients'
          ? 'Pick recipients'
          : step === 'items'
            ? 'Pick items'
            : 'Confirm assignment'
      }
      maxWidth={640}
      footer={stepFooter()}
    >
      {step === 'recipients' && (
        <MemberMultiSelect
          selectedIds={selectedMembers}
          onToggle={toggleMember}
          maxHeightClass="max-h-[56vh]"
        />
      )}

      {step === 'items' && (
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-light">
              Items <span className="text-gold">· {selectedItems.size} of {items.length} selected</span>
            </p>
            <div className="flex gap-2 text-[11px]">
              <button
                type="button"
                onClick={selectAllItems}
                className="text-gold/80 hover:text-gold font-semibold"
              >
                Select all
              </button>
              <span className="text-text-light/30">·</span>
              <button
                type="button"
                onClick={clearItems}
                className="text-text-light hover:text-text font-semibold"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-[56vh] overflow-y-auto rounded-lg border border-border bg-surface-alt divide-y divide-border">
            {items.map((item) => {
              const active = selectedItems.has(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={`w-full px-3 py-2.5 flex items-start gap-3 text-left transition-colors ${
                    active ? 'bg-gold/10 text-text' : 'text-text-muted hover:bg-surface-hover'
                  }`}
                >
                  <span
                    className={`shrink-0 w-[18px] h-[18px] mt-[2px] rounded-md flex items-center justify-center ${
                      active
                        ? 'bg-gold border border-gold text-black'
                        : 'bg-surface border border-border-light'
                    }`}
                    aria-hidden="true"
                  >
                    {active && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium text-text truncate">
                      {item.title}
                      {/* PR #70 — `Required` tag retired sitewide. */}
                    </span>
                    {(item.category || item.default_due_offset_days != null) && (
                      <span className="block text-[11px] text-text-light truncate">
                        {item.category}
                        {item.category && item.default_due_offset_days != null && ' · '}
                        {item.default_due_offset_days != null &&
                          `Due +${item.default_due_offset_days}d`}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-5">
          <div className="rounded-lg bg-surface-alt border border-border p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-light mb-2">
              Summary
            </p>
            <div className="flex items-center gap-2 text-[13px] text-text mb-1">
              <Users size={14} className="text-gold" aria-hidden="true" />
              <span className="font-bold">{selectedMembers.size}</span>
              {selectedMembers.size === 1 ? 'member' : 'members'}
              <span className="text-text-light">·</span>
              <span className="font-bold">{selectedItems.size}</span>
              {selectedItems.size === 1 ? 'item' : 'items'}
              {!isAllItemsSelected && (
                <span className="ml-1 text-[10px] uppercase tracking-wider text-gold bg-gold/10 ring-1 ring-gold/25 rounded-full px-1.5 py-0.5">
                  Partial
                </span>
              )}
            </div>
            <p className="text-[12px] text-text-light">
              Total new tasks: <span className="text-text font-bold">{selectedMembers.size * selectedItems.size}</span>
            </p>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">
                Due date <span className="normal-case text-text-light">(optional — overrides per-item offsets)</span>
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">
                Title override <span className="normal-case text-text-light">(optional)</span>
              </span>
              <input
                type="text"
                value={titleOverride}
                onChange={(e) => setTitleOverride(e.target.value)}
                placeholder={template.name}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">
                Description override <span className="normal-case text-text-light">(optional)</span>
              </span>
              <textarea
                value={descriptionOverride}
                onChange={(e) => setDescriptionOverride(e.target.value)}
                rows={2}
                placeholder={template.description ?? 'Inherits from template'}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring resize-y"
              />
            </label>
          </div>
        </div>
      )}
    </FloatingDetailModal>
  )
}
