import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, Plus, Send, Trash2 } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import { useToast } from '../../Toast'
import { submitTaskRequest, taskRequestKeys } from '../../../lib/queries/taskRequests'
import {
  Field,
  RecurrencePicker,
  recurrenceToSpec,
  type RecurrenceFrequency,
} from './formAtoms'

interface RequestDraft {
  tempId: string
  title: string
  description: string
  dueDate: string
  priority: boolean
  recurrence: RecurrenceFrequency
}

function emptyRequestDraft(): RequestDraft {
  return {
    tempId:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    title: '',
    description: '',
    dueDate: '',
    priority: false,
    recurrence: 'off',
  }
}

export default function TaskRequestModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<RequestDraft[]>(() => [emptyRequestDraft()])

  const updateDraft = (tempId: string, patch: Partial<RequestDraft>) => {
    setDrafts((prev) =>
      prev.map((draft) => (draft.tempId === tempId ? { ...draft, ...patch } : draft)),
    )
  }

  const addDraft = () => setDrafts((prev) => [...prev, emptyRequestDraft()])

  const removeDraft = (tempId: string) => {
    setDrafts((prev) =>
      prev.length === 1 ? prev : prev.filter((draft) => draft.tempId !== tempId),
    )
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const requests = drafts
        .filter((draft) => draft.title.trim().length > 0)
        .map((draft) =>
          submitTaskRequest({
            title: draft.title.trim(),
            description: draft.description.trim() || null,
            due_date: draft.dueDate || null,
            recurrence_spec: recurrenceToSpec(draft.recurrence),
            is_required: draft.priority,
          }),
        )
      return Promise.all(requests)
    },
    onSuccess: (results) => {
      const count = results.length
      toast(
        `${count} task request${count === 1 ? '' : 's'} submitted — admin has been notified.`,
        'success',
      )
      void queryClient.invalidateQueries({ queryKey: taskRequestKeys.mine() })
      void queryClient.invalidateQueries({ queryKey: taskRequestKeys.pending() })
      onClose()
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Submit failed', 'error')
    },
  })

  const validDraftCount = drafts.filter((draft) => draft.title.trim().length > 0).length
  const canSubmit = validDraftCount > 0 && !submitMutation.isPending

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canSubmit) submitMutation.mutate()
  }

  return (
    <FloatingDetailModal
      onClose={onClose}
      eyebrow="Request tasks"
      title="Ask admin to add tasks"
      maxWidth={680}
      ariaLabel="Submit task requests for admin approval"
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
            form="task-request-form"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold text-black text-[13px] font-bold hover:bg-gold-muted focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={13} aria-hidden="true" />
            {submitMutation.isPending ? 'Sending…' : `Submit ${validDraftCount} for approval`}
          </button>
        </div>
      }
    >
      <form id="task-request-form" onSubmit={handleSubmit} className="space-y-4 px-4 py-3">
        <p className="text-[12px] text-text-light leading-snug">
          Add one task or build a short list. Admin reviews each request separately before it lands in My Tasks.
        </p>

        <div className="space-y-3">
          {drafts.map((draft, index) => (
            <RequestDraftCard
              key={draft.tempId}
              draft={draft}
              index={index}
              canRemove={drafts.length > 1}
              onChange={(patch) => updateDraft(draft.tempId, patch)}
              onRemove={() => removeDraft(draft.tempId)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addDraft}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gold/35 text-[13px] font-bold text-gold/90 hover:text-gold hover:bg-gold/[0.06] hover:border-gold/60 transition-colors focus-ring"
        >
          <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
          Add another task
        </button>
      </form>
    </FloatingDetailModal>
  )
}

function RequestDraftCard({
  draft,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  draft: RequestDraft
  index: number
  canRemove: boolean
  onChange: (patch: Partial<RequestDraft>) => void
  onRemove: () => void
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-alt/40 p-3 space-y-3" aria-label={`Task ${index + 1}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold tracking-[0.08em] text-text-muted uppercase">
          Task {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove task ${index + 1}`}
            className="inline-flex items-center justify-center p-1.5 rounded-md text-text-muted hover:text-rose-300 hover:bg-rose-500/10 focus-ring"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      <Field label="What needs doing?">
        <input
          type="text"
          value={draft.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="e.g. Prep studio B for Tuesday session"
          className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus-ring placeholder:text-text-light/70"
          maxLength={200}
          autoFocus={index === 0}
        />
      </Field>

      <Field label="Description (optional)">
        <textarea
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={2}
          placeholder="Any context admin should know?"
          className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-sm focus-ring placeholder:text-text-light/70 resize-none"
          maxLength={2000}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Due date (optional)">
          <input
            type="date"
            value={draft.dueDate}
            onChange={(event) => onChange({ dueDate: event.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus-ring text-text"
          />
        </Field>

        <Field label="Priority">
          <button
            type="button"
            role="switch"
            aria-checked={draft.priority}
            onClick={() => onChange({ priority: !draft.priority })}
            className={`w-full inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl ring-1 text-[13px] font-semibold transition-colors ${
              draft.priority
                ? 'bg-rose-500/10 text-rose-200 ring-rose-500/40'
                : 'bg-surface-alt text-text-muted ring-border hover:text-text'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Flag size={13} aria-hidden="true" />
              {draft.priority ? 'High · Required' : 'Normal'}
            </span>
            <span
              className={`inline-block w-8 h-4 rounded-full relative transition-colors ${
                draft.priority ? 'bg-rose-500/60' : 'bg-white/10'
              }`}
              aria-hidden="true"
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                  draft.priority ? 'left-4' : 'left-0.5'
                }`}
              />
            </span>
          </button>
        </Field>
      </div>

      <RecurrencePicker
        value={draft.recurrence}
        onChange={(recurrence) => onChange({ recurrence })}
      />
    </section>
  )
}
