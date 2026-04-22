import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  Check,
  Copy,
  GraduationCap,
  Loader2,
  Pencil,
  RotateCcw,
  Send,
  Tag,
  Trash2,
} from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import {
  archiveTaskTemplate,
  deleteTaskTemplate,
  fetchTaskTemplateDetail,
  taskTemplateKeys,
  unarchiveTaskTemplate,
} from '../../../lib/queries/taskTemplates'
import { useToast } from '../../Toast'
import TemplateAssignFlowModal from './TemplateAssignFlowModal'
import TemplateDuplicateModal from './TemplateDuplicateModal'
import TemplateEditorModal from './TemplateEditorModal'

/**
 * TemplatePreviewModal — admin sees template metadata + full item list.
 *
 * Click a card on the Assign page → this opens. Footer actions:
 *   - Edit → opens TemplateEditorModal
 *   - Duplicate → opens TemplateDuplicateModal
 *   - Assign → opens TemplateAssignFlowModal
 *   - Archive / Unarchive → toggles is_active via updateTaskTemplate
 *
 * Each action flow handles its own close; this modal stays open so the
 * admin can return to preview context.
 */

interface TemplatePreviewModalProps {
  templateId: string
  onClose: () => void
}

export default function TemplatePreviewModal({
  templateId,
  onClose,
}: TemplatePreviewModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [editorOpen, setEditorOpen] = useState(false)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  const detailQuery = useQuery({
    queryKey: taskTemplateKeys.detail(templateId),
    queryFn: () => fetchTaskTemplateDetail(templateId),
  })

  const archiveMutation = useMutation({
    mutationFn: () => archiveTaskTemplate(templateId),
    onSuccess: () => {
      toast('Template archived', 'success')
      void queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all })
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to archive', 'error')
    },
  })

  const unarchiveMutation = useMutation({
    mutationFn: () => unarchiveTaskTemplate(templateId),
    onSuccess: () => {
      toast('Template restored', 'success')
      void queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all })
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to restore', 'error')
    },
  })

  // Hard delete. Backend PR #10 migration — past assigned_tasks are
  // preserved via ON DELETE SET NULL on source_template_id / _item_id
  // (shipped in PR #8). Toast is honest about what was preserved.
  const deleteMutation = useMutation({
    mutationFn: () => deleteTaskTemplate(templateId),
    onSuccess: (result) => {
      const preserved = result.assignments_preserved
      toast(
        preserved > 0
          ? `Deleted "${result.template_name}" — ${preserved} past ${preserved === 1 ? 'assignment' : 'assignments'} preserved`
          : `Deleted "${result.template_name}"`,
        'success',
      )
      void queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all })
      onClose()
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to delete', 'error')
    },
  })

  const template = detailQuery.data?.template
  const items = detailQuery.data?.items ?? []

  const loading = detailQuery.isLoading
  const isArchived = template ? !template.is_active : false

  return (
    <>
      <FloatingDetailModal
        onClose={onClose}
        eyebrow={template?.role_tag ? `Template · ${template.role_tag}` : 'Template'}
        title={template?.name ?? (loading ? 'Loading…' : 'Template')}
        maxWidth={720}
        footer={
          template ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const msg =
                    `Permanently delete "${template.name}"?\n\n` +
                    `The template and its ${items.length} ${items.length === 1 ? 'item' : 'items'} will be removed. ` +
                    `Past assignments already sent to team members will stay intact — ` +
                    `they keep the tasks they received.`
                  if (confirm(msg)) {
                    deleteMutation.mutate()
                  }
                }}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold text-text-light hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
              >
                <Trash2 size={14} aria-hidden="true" />
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
              {isArchived ? (
                <button
                  type="button"
                  onClick={() => unarchiveMutation.mutate()}
                  disabled={unarchiveMutation.isPending}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold text-text-light hover:text-gold hover:bg-gold/5 disabled:opacity-50"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Archive "${template.name}"? It won't appear in the library until restored.`)) {
                      archiveMutation.mutate()
                    }
                  }}
                  disabled={archiveMutation.isPending}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold text-text-light hover:text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                >
                  <Archive size={14} aria-hidden="true" />
                  Archive
                </button>
              )}
              <button
                type="button"
                onClick={() => setDuplicateOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold text-text-light hover:text-gold hover:bg-gold/5"
              >
                <Copy size={14} aria-hidden="true" />
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => setEditorOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold bg-surface-alt text-text ring-1 ring-border hover:bg-surface-hover"
              >
                <Pencil size={14} aria-hidden="true" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setAssignOpen(true)}
                disabled={items.length === 0 || isArchived}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-black text-[13px] font-bold disabled:opacity-40 hover:bg-gold-muted"
              >
                <Send size={14} aria-hidden="true" />
                Assign
              </button>
            </div>
          ) : null
        }
      >
        {loading ? (
          <div className="py-10 flex items-center justify-center text-text-light">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : detailQuery.error || !template ? (
          <p className="py-6 text-[13px] text-rose-300">Could not load template.</p>
        ) : (
          <>
            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {template.role_tag && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 ring-1 ring-gold/25 text-gold text-[10px] font-bold uppercase tracking-wider">
                  <Tag size={10} aria-hidden="true" />
                  {template.role_tag}
                </span>
              )}
              {template.is_onboarding && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/25 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                  <GraduationCap size={10} aria-hidden="true" />
                  Onboarding
                </span>
              )}
              {isArchived && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.05] text-text-light text-[10px] font-bold uppercase tracking-wider">
                  Archived
                </span>
              )}
            </div>

            {template.description && (
              <p className="text-[13px] text-text-muted mb-4 leading-relaxed">
                {template.description}
              </p>
            )}

            {/* Items list */}
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-[13px] font-bold text-text">
                Items <span className="text-text-light font-normal">· {items.length}</span>
              </h3>
            </div>

            {items.length === 0 ? (
              <p className="text-[12px] text-text-light italic py-4">
                This template has no items yet. Click Edit to add some.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-surface-alt border border-border"
                  >
                    <span
                      className="shrink-0 w-[18px] h-[18px] mt-[2px] rounded-md flex items-center justify-center bg-surface border border-border-light"
                      aria-hidden="true"
                    >
                      <Check size={12} className="text-text-light/40" strokeWidth={3} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-text">
                        {item.title}
                        {item.is_required && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-rose-400 font-bold">
                            Required
                          </span>
                        )}
                      </p>
                      {item.description && (
                        <p className="text-[12px] text-text-light mt-0.5">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-light">
                        {item.category && <span>{item.category}</span>}
                        {item.category && item.default_due_offset_days != null && (
                          <span aria-hidden="true">·</span>
                        )}
                        {item.default_due_offset_days != null && (
                          <span>Due +{item.default_due_offset_days}d</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </FloatingDetailModal>

      {/* Sub-modals. Render outside the main FloatingDetailModal so
          the backdrop stacks cleanly on top of the preview. */}
      {editorOpen && template && (
        <TemplateEditorModal
          templateId={template.id}
          onClose={() => setEditorOpen(false)}
        />
      )}
      {duplicateOpen && template && (
        <TemplateDuplicateModal
          sourceTemplate={template}
          onClose={() => setDuplicateOpen(false)}
        />
      )}
      {assignOpen && template && (
        <TemplateAssignFlowModal
          template={template}
          items={items}
          onClose={() => setAssignOpen(false)}
        />
      )}
    </>
  )
}
