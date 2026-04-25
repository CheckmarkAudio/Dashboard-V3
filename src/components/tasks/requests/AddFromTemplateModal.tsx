import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, FileText, Loader2 } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import {
  fetchTaskTemplateDetail,
  fetchTaskTemplateLibrary,
  taskTemplateKeys,
} from '../../../lib/queries/taskTemplates'
import type { CustomTaskDraft } from '../../../lib/queries/assignments'

/**
 * AddFromTemplateModal — PR #42 sub-modal.
 *
 * Two-step flow inside one modal:
 *   1. Pick a template (clickable card grid).
 *   2. Tick which items from that template to import.
 * Click "Add N tasks" → returns the selected items as
 * `CustomTaskDraft[]` to the parent (MultiTaskCreateModal), which
 * appends them as editable rows.
 *
 * The returned drafts are independent of the source template — they
 * become free-standing custom tasks that the admin can edit before
 * submitting. No template-link is preserved (intentional, so the
 * caller can mix-and-match without source coupling).
 */
export default function AddFromTemplateModal({
  onCancel,
  onAdd,
}: {
  onCancel: () => void
  onAdd: (drafts: CustomTaskDraft[]) => void
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(new Set())

  const libraryQuery = useQuery({
    queryKey: taskTemplateKeys.library(null, false),
    queryFn: () => fetchTaskTemplateLibrary({ roleTag: null, includeInactive: false }),
  })

  const detailQuery = useQuery({
    queryKey: selectedTemplateId
      ? taskTemplateKeys.detail(selectedTemplateId)
      : ['template-detail', 'none'],
    queryFn: () => fetchTaskTemplateDetail(selectedTemplateId!),
    enabled: Boolean(selectedTemplateId),
  })

  const templates = libraryQuery.data ?? []
  const detail = detailQuery.data

  const toggleItem = (id: string) => {
    setCheckedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAdd = () => {
    if (!detail) return
    const drafts: CustomTaskDraft[] = detail.items
      .filter((item) => checkedItemIds.has(item.id))
      .map((item) => ({
        title: item.title,
        description: item.description ?? null,
        category: item.category ?? null,
        is_required: item.is_required ?? false,
      }))
    onAdd(drafts)
  }

  return (
    <FloatingDetailModal
      title={detail ? detail.template.name : 'Add from template'}
      eyebrow={
        detail
          ? `${detail.items.length} item${detail.items.length === 1 ? '' : 's'} · pick what to import`
          : 'Pick a template to import items from'
      }
      onClose={onCancel}
      maxWidth={560}
    >
      {!selectedTemplateId ? (
        // Step 1: pick a template
        libraryQuery.isLoading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 size={18} className="animate-spin text-text-muted" />
          </div>
        ) : libraryQuery.error ? (
          <p className="text-[13px] text-amber-300 py-4">
            {(libraryQuery.error as Error).message}
          </p>
        ) : templates.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[14px] text-text">No templates yet.</p>
            <p className="mt-1 text-[12px] text-text-muted">
              Create one from the Templates widget on the right of this page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedTemplateId(t.id)
                  setCheckedItemIds(new Set())
                }}
                className="text-left p-3 rounded-xl border border-border hover:border-gold/50 hover:bg-gold/5 transition-colors flex items-start gap-2"
              >
                <FileText size={16} className="text-gold/70 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-text truncate">{t.name}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {t.item_count} item{t.item_count === 1 ? '' : 's'}
                    {t.role_tag ? ` · ${t.role_tag}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        // Step 2: pick items
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedTemplateId(null)
              setCheckedItemIds(new Set())
            }}
            className="self-start inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text"
          >
            <ChevronLeft size={13} />
            Back to templates
          </button>

          {detailQuery.isLoading ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 size={18} className="animate-spin text-text-muted" />
            </div>
          ) : detailQuery.error ? (
            <p className="text-[13px] text-amber-300 py-4">
              {(detailQuery.error as Error).message}
            </p>
          ) : !detail ? null : (
            <>
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                <button
                  type="button"
                  onClick={() => setCheckedItemIds(new Set(detail.items.map((i) => i.id)))}
                  className="text-[11px] font-semibold text-gold/80 hover:text-gold"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setCheckedItemIds(new Set())}
                  className="text-[11px] font-semibold text-text-muted hover:text-text"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                {detail.items.map((item) => {
                  const checked = checkedItemIds.has(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={`w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-xl border transition-colors ${
                        checked
                          ? 'bg-gold/8 border-gold/30'
                          : 'bg-white/[0.018] border-transparent hover:bg-white/[0.03] hover:border-white/[0.08]'
                      }`}
                    >
                      <span
                        className={`shrink-0 w-[18px] h-[18px] mt-[1px] rounded-[5px] border-[1.5px] flex items-center justify-center ${
                          checked ? 'bg-gold/30 border-gold' : 'border-white/20'
                        }`}
                      >
                        {checked && <span className="w-[8px] h-[8px] rounded-[1px] bg-gold" aria-hidden="true" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-text truncate">{item.title}</p>
                        {item.description && (
                          <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        {(item.category || item.is_required) && (
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-text-light flex-wrap">
                            {item.category && <span>{item.category}</span>}
                            {item.is_required && (
                              <span className="text-rose-400 font-bold uppercase tracking-wider">
                                Required
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 inline-flex items-center justify-center py-2 rounded-lg text-[12px] font-semibold bg-white/[0.04] text-text-light hover:text-text hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={checkedItemIds.size === 0}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold bg-gradient-to-b from-gold to-gold-muted text-black hover:brightness-105 disabled:opacity-50"
                >
                  Add {checkedItemIds.size} task{checkedItemIds.size === 1 ? '' : 's'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </FloatingDetailModal>
  )
}
