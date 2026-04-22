import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import {
  addTaskTemplateItem,
  createTaskTemplate,
  deleteTaskTemplateItem,
  fetchTaskTemplateDetail,
  taskTemplateKeys,
  updateTaskTemplate,
  updateTaskTemplateItem,
} from '../../../lib/queries/taskTemplates'
import { useToast } from '../../Toast'
import type {
  AddTemplateItemInput,
  TaskTemplateItem,
  UpdateTemplateItemInput,
} from '../../../types/assignments'

/**
 * TemplateEditorModal — create OR edit flow for a task_template.
 *
 * Pass `templateId` to edit an existing template; omit to create a new one.
 *
 * Two sections:
 *   1. Metadata (name / description / role_tag / is_onboarding)
 *   2. Items list — add / edit / delete inline. Each edit fires its
 *      own RPC so the admin sees per-field saves and can't lose work
 *      by closing the modal mid-edit.
 *
 * Archive (is_active=false) is a separate action exposed in the preview
 * modal's footer, not here, so this editor stays focused on content.
 */

interface TemplateEditorModalProps {
  /** Omit for create; pass an id to edit. */
  templateId?: string | null
  onClose: () => void
  /** Fires after a successful save so the page can re-fetch the library. */
  onSaved?: (templateId: string) => void
}

export default function TemplateEditorModal({
  templateId,
  onClose,
  onSaved,
}: TemplateEditorModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = !!templateId

  // ── Metadata state ────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [roleTag, setRoleTag] = useState('')
  const [isOnboarding, setIsOnboarding] = useState(false)

  // ── Existing items (only populated in edit mode) ──────────────────
  const detailQuery = useQuery({
    queryKey: taskTemplateKeys.detail(templateId ?? ''),
    queryFn: () => fetchTaskTemplateDetail(templateId!),
    enabled: isEdit,
  })

  // Seed form fields once when detail lands. `lastSeededFor` prevents
  // the effect from stomping user edits on every re-render.
  const [lastSeededFor, setLastSeededFor] = useState<string | null>(null)
  useEffect(() => {
    if (!isEdit) return
    const t = detailQuery.data?.template
    if (!t || lastSeededFor === t.id) return
    setName(t.name)
    setDescription(t.description ?? '')
    setRoleTag(t.role_tag ?? '')
    setIsOnboarding(t.is_onboarding)
    setLastSeededFor(t.id)
  }, [isEdit, detailQuery.data?.template, lastSeededFor])

  const items = detailQuery.data?.items ?? []

  // ── Save metadata ─────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const tmpl = await createTaskTemplate({
        name: name.trim(),
        description: description.trim() || null,
        role_tag: roleTag.trim() || null,
        is_onboarding: isOnboarding,
      })
      return tmpl
    },
    onSuccess: (tmpl) => {
      toast('Template created', 'success')
      void queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all })
      onSaved?.(tmpl.id)
      onClose()
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to create template', 'error')
    },
  })

  const updateMetadataMutation = useMutation({
    mutationFn: async () => {
      if (!templateId) throw new Error('No template id to update')
      return updateTaskTemplate(templateId, {
        name: name.trim(),
        description: description.trim() || null,
        role_tag: roleTag.trim() || null,
        is_onboarding: isOnboarding,
      })
    },
    onSuccess: () => {
      toast('Template updated', 'success')
      void queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all })
      if (templateId) {
        void queryClient.invalidateQueries({ queryKey: taskTemplateKeys.detail(templateId) })
      }
      onSaved?.(templateId!)
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to update template', 'error')
    },
  })

  const saveMetadata = () => {
    if (!name.trim()) {
      toast('Template needs a name', 'error')
      return
    }
    if (isEdit) updateMetadataMutation.mutate()
    else createMutation.mutate()
  }

  const savingMetadata = createMutation.isPending || updateMetadataMutation.isPending

  return (
    <FloatingDetailModal
      onClose={onClose}
      eyebrow={isEdit ? 'Edit template' : 'New template'}
      title={name.trim() || (isEdit ? 'Untitled' : 'New Template')}
      maxWidth={720}
      footer={
        <div className="flex justify-between items-center gap-3">
          <p className="text-[11px] text-text-light">
            {isEdit
              ? 'Changes to metadata save on click. Item edits save per row.'
              : 'Create the template, then add items.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-text-light hover:text-text"
            >
              Close
            </button>
            <button
              type="button"
              onClick={saveMetadata}
              disabled={savingMetadata || !name.trim()}
              className="px-4 py-2 rounded-lg bg-gold text-black text-sm font-bold disabled:opacity-50 hover:bg-gold-muted"
            >
              {savingMetadata ? 'Saving…' : isEdit ? 'Save metadata' : 'Create template'}
            </button>
          </div>
        </div>
      }
    >
      {/* Metadata section ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marketing Onboarding"
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">
            Description <span className="normal-case text-text-light">(optional)</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Short context for admins"
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring resize-y"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">
              Role tag <span className="normal-case text-text-light">(optional)</span>
            </span>
            <input
              type="text"
              value={roleTag}
              onChange={(e) => setRoleTag(e.target.value)}
              placeholder="marketing · engineer · intern"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
            />
          </label>
          <label className="flex items-end gap-2 cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={isOnboarding}
              onChange={(e) => setIsOnboarding(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-surface-alt text-gold focus-ring"
            />
            <span className="text-[13px] text-text">Onboarding template</span>
          </label>
        </div>
      </div>

      {/* Items section — only shown once template exists ─────────── */}
      {isEdit && (
        <div className="mt-6 pt-6 border-t border-white/5">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-[14px] font-bold text-text">
              Items <span className="text-text-light font-normal">· {items.length}</span>
            </h3>
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-[12px] text-text-light italic">
                No items yet. Add your first one below.
              </p>
            ) : (
              items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onSaved={() => {
                    if (templateId) {
                      void queryClient.invalidateQueries({
                        queryKey: taskTemplateKeys.detail(templateId),
                      })
                      void queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all })
                    }
                  }}
                />
              ))
            )}
          </div>

          <AddItemForm
            templateId={templateId!}
            nextSortOrder={items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0}
            onAdded={() => {
              void queryClient.invalidateQueries({
                queryKey: taskTemplateKeys.detail(templateId!),
              })
              void queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all })
            }}
          />
        </div>
      )}
    </FloatingDetailModal>
  )
}

// ═══ ItemRow — displays one item, toggles to edit mode inline ═══════
function ItemRow({
  item,
  onSaved,
}: {
  item: TaskTemplateItem
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [category, setCategory] = useState(item.category ?? '')
  const [isRequired, setIsRequired] = useState(item.is_required)
  const [defaultDueOffset, setDefaultDueOffset] = useState(
    item.default_due_offset_days?.toString() ?? '',
  )

  const updateMutation = useMutation({
    mutationFn: async () => {
      const patch: UpdateTemplateItemInput = {
        title: title.trim(),
        category: category.trim() || null,
        is_required: isRequired,
        default_due_offset_days: defaultDueOffset ? Number(defaultDueOffset) : null,
      }
      return updateTaskTemplateItem(item.id, patch)
    },
    onSuccess: () => {
      toast('Item saved', 'success')
      setEditing(false)
      onSaved()
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to save item', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTaskTemplateItem(item.id),
    onSuccess: () => {
      toast('Item deleted', 'success')
      onSaved()
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to delete item', 'error')
    },
  })

  if (!editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-alt border border-border group">
        <GripVertical
          size={14}
          className="text-text-light/50 shrink-0"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-text truncate">
            {item.title}
            {item.is_required && (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-rose-400 font-bold">
                Required
              </span>
            )}
          </p>
          {(item.category || item.default_due_offset_days != null) && (
            <p className="text-[11px] text-text-light truncate">
              {item.category}
              {item.category && item.default_due_offset_days != null && ' · '}
              {item.default_due_offset_days != null &&
                `Due +${item.default_due_offset_days}d`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="p-1.5 rounded text-text-light hover:text-gold hover:bg-white/5"
          aria-label="Edit item"
        >
          <Pencil size={12} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete "${item.title}"? Past assignments keep the copy.`)) {
              deleteMutation.mutate()
            }
          }}
          disabled={deleteMutation.isPending}
          className="p-1.5 rounded text-text-light hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
          aria-label="Delete item"
        >
          <Trash2 size={12} aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div className="px-3 py-3 rounded-lg bg-surface-alt border border-gold/40 space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Item title"
        className="w-full px-2 py-1.5 rounded bg-surface border border-border text-sm focus-ring"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          className="px-2 py-1.5 rounded bg-surface border border-border text-[12px] focus-ring"
        />
        <input
          type="number"
          value={defaultDueOffset}
          onChange={(e) => setDefaultDueOffset(e.target.value)}
          placeholder="Due +N days"
          min={0}
          className="px-2 py-1.5 rounded bg-surface border border-border text-[12px] focus-ring"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-[12px]">
        <input
          type="checkbox"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-border bg-surface text-gold focus-ring"
        />
        Required
      </label>
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-2.5 py-1 rounded text-[12px] text-text-light hover:text-text"
        >
          <X size={12} className="inline -mt-0.5 mr-1" aria-hidden="true" />
          Cancel
        </button>
        <button
          type="button"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || !title.trim()}
          className="px-2.5 py-1 rounded text-[12px] bg-gold text-black font-bold disabled:opacity-50"
        >
          <Check size={12} className="inline -mt-0.5 mr-1" aria-hidden="true" />
          {updateMutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ═══ AddItemForm — appends to the item list ═══════════════════════
function AddItemForm({
  templateId,
  nextSortOrder,
  onAdded,
}: {
  templateId: string
  nextSortOrder: number
  onAdded: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [isRequired, setIsRequired] = useState(false)
  const [defaultDueOffset, setDefaultDueOffset] = useState('')

  const addMutation = useMutation({
    mutationFn: () => {
      const input: AddTemplateItemInput = {
        title: title.trim(),
        category: category.trim() || null,
        sort_order: nextSortOrder,
        is_required: isRequired,
        default_due_offset_days: defaultDueOffset ? Number(defaultDueOffset) : null,
      }
      return addTaskTemplateItem(templateId, input)
    },
    onSuccess: () => {
      toast('Item added', 'success')
      setTitle('')
      setCategory('')
      setIsRequired(false)
      setDefaultDueOffset('')
      setOpen(false)
      onAdded()
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to add item', 'error')
    },
  })

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border-light text-[13px] text-text-muted hover:text-gold hover:border-gold/40 transition-colors"
      >
        <Plus size={14} aria-hidden="true" />
        Add item
      </button>
    )
  }

  return (
    <div className="mt-3 px-3 py-3 rounded-lg bg-surface-alt border border-gold/40 space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New item title"
        autoFocus
        className="w-full px-2 py-1.5 rounded bg-surface border border-border text-sm focus-ring"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          className="px-2 py-1.5 rounded bg-surface border border-border text-[12px] focus-ring"
        />
        <input
          type="number"
          value={defaultDueOffset}
          onChange={(e) => setDefaultDueOffset(e.target.value)}
          placeholder="Due +N days"
          min={0}
          className="px-2 py-1.5 rounded bg-surface border border-border text-[12px] focus-ring"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-[12px]">
        <input
          type="checkbox"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-border bg-surface text-gold focus-ring"
        />
        Required
      </label>
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2.5 py-1 rounded text-[12px] text-text-light hover:text-text"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending || !title.trim()}
          className="px-2.5 py-1 rounded text-[12px] bg-gold text-black font-bold disabled:opacity-50"
        >
          {addMutation.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
    </div>
  )
}
