import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import { duplicateTaskTemplate, taskTemplateKeys } from '../../../lib/queries/taskTemplates'
import { useToast } from '../../Toast'
import type { TaskTemplate } from '../../../types/assignments'

/**
 * TemplateDuplicateModal — small confirm: rename + click to clone.
 * Clones the template + all items via duplicate_task_template RPC.
 * Opens the new template's editor on success so the admin can start
 * tweaking the copy immediately.
 */

interface TemplateDuplicateModalProps {
  sourceTemplate: TaskTemplate
  onClose: () => void
  onDuplicated?: (newTemplateId: string) => void
}

export default function TemplateDuplicateModal({
  sourceTemplate,
  onClose,
  onDuplicated,
}: TemplateDuplicateModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [name, setName] = useState(`${sourceTemplate.name} (copy)`)

  const mutation = useMutation({
    mutationFn: () => duplicateTaskTemplate(sourceTemplate.id, name.trim()),
    onSuccess: (detail) => {
      toast(`Duplicated — "${detail.template.name}"`, 'success')
      void queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all })
      onDuplicated?.(detail.template.id)
      onClose()
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to duplicate', 'error')
    },
  })

  return (
    <FloatingDetailModal
      onClose={onClose}
      eyebrow="Duplicate template"
      title={sourceTemplate.name}
      maxWidth={480}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-text-light hover:text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-black text-sm font-bold disabled:opacity-50 hover:bg-gold-muted"
          >
            <Copy size={14} aria-hidden="true" />
            {mutation.isPending ? 'Duplicating…' : 'Duplicate'}
          </button>
        </div>
      }
    >
      <p className="text-[13px] text-text-light mb-4">
        Creates a full copy of this template and all its items under a new name.
        Existing assignments of the original template stay unchanged.
      </p>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">
          New name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
        />
      </label>
    </FloatingDetailModal>
  )
}
