import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, Inbox, Loader2, Search, Users, X } from 'lucide-react'
import FloatingDetailModal from '../../FloatingDetailModal'
import { useToast } from '../../Toast'
import {
  adminTaskKeys,
  adminUpdateAssignedTask,
  fetchAllAssignedTasks,
} from '../../../lib/queries/adminTasks'
import {
  FlywheelStagePicker,
  type FlywheelStage,
} from '../../tasks/requests/formAtoms'
import { CompletedToggle, formatDueShort } from '../../tasks/shared'
import type { AssignedTask } from '../../../types/assignments'

/**
 * AdminEditTasksModal — PR #40.
 *
 * Opens from AdminEditTasksWidget. Shows every in-flight task across
 * the team with click-to-expand edit rows. Admin can rename, re-stage,
 * re-date, or clear fields. Save fires `admin_update_assigned_task`
 * RPC which also posts a `task_edited` notification to the current
 * assignee so they know what changed.
 *
 * Filters: search (title), assignee dropdown, show-completed toggle.
 * No pagination for first iteration — studios rarely have >100 live
 * tasks, and the list virtualises poorly at this layout.
 */
export default function AdminEditTasksModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showCompleted, setShowCompleted] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)

  const tasksQuery = useQuery({
    queryKey: adminTaskKeys.list(showCompleted),
    queryFn: () => fetchAllAssignedTasks({ includeCompleted: showCompleted }),
  })

  const tasks = tasksQuery.data ?? []

  // Build the assignee dropdown options from whichever tasks have an
  // assignee set. "Studio" rows get grouped under a special sentinel.
  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>()
    let hasStudio = false
    for (const t of tasks) {
      if (t.scope === 'studio') {
        hasStudio = true
      } else if (t.assigned_to && t.assigned_to_name) {
        map.set(t.assigned_to, t.assigned_to_name)
      }
    }
    const list = Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (hasStudio) list.unshift({ id: '__studio__', name: 'Studio (shared)' })
    return list
  }, [tasks])

  const visibleTasks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return tasks.filter((t) => {
      if (assigneeFilter === '__studio__') {
        if (t.scope !== 'studio') return false
      } else if (assigneeFilter !== 'all') {
        if (t.assigned_to !== assigneeFilter) return false
      }
      if (term && !(t.title ?? '').toLowerCase().includes(term)) return false
      return true
    })
  }, [tasks, searchTerm, assigneeFilter])

  return (
    <FloatingDetailModal
      title="Edit tasks"
      eyebrow={`${tasks.length} tracked · click a row to edit`}
      onClose={onClose}
      maxWidth={720}
    >
      <div className="flex flex-col gap-3">
        {/* Filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[180px] relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title…"
              className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text placeholder:text-text-muted focus:outline-none focus:border-gold/50"
            />
          </div>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-surface-alt border border-border text-[12px] text-text focus:outline-none focus:border-gold/50"
          >
            <option value="all">All assignees</option>
            {assigneeOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((v) => !v)} />
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
          {tasksQuery.isLoading ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 size={18} className="animate-spin text-text-muted" />
            </div>
          ) : tasksQuery.error ? (
            <div className="flex items-center gap-2 text-[13px] text-amber-300 py-4">
              <AlertCircle size={16} />
              <span>{(tasksQuery.error as Error).message}</span>
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="py-10 flex flex-col items-center text-center">
              <Inbox size={18} className="text-text-muted" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text">No matching tasks.</p>
            </div>
          ) : (
            visibleTasks.map((task) => (
              <EditableRow
                key={task.id}
                task={task}
                isEditing={editingId === task.id}
                onOpenEdit={() => setEditingId(task.id)}
                onCancelEdit={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null)
                  toast('Task updated.', 'success')
                  void queryClient.invalidateQueries({ queryKey: adminTaskKeys.all })
                  // Touch the viewer-side caches so the task flips
                  // instantly wherever it's visible.
                  void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
                  void queryClient.invalidateQueries({ queryKey: ['team-assigned-tasks'] })
                  void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
                }}
                onError={(err) => toast(err.message, 'error')}
              />
            ))
          )}
        </div>
      </div>
    </FloatingDetailModal>
  )
}

// Capitalised stored category → FlywheelStage. DB stores "Deliver"
// etc; the picker uses the same title-case union, so no conversion
// needed — just a safe coercion.
function asStage(value: string | null | undefined): FlywheelStage | null {
  if (!value) return null
  if (value === 'Deliver' || value === 'Capture' || value === 'Share' || value === 'Attract' || value === 'Book') {
    return value
  }
  return null
}

function EditableRow({
  task,
  isEditing,
  onOpenEdit,
  onCancelEdit,
  onSaved,
  onError,
}: {
  task: AssignedTask
  isEditing: boolean
  onOpenEdit: () => void
  onCancelEdit: () => void
  onSaved: () => void
  onError: (err: Error) => void
}) {
  const [title, setTitle] = useState(task.title ?? '')
  const [description, setDescription] = useState(task.description ?? '')
  const [stage, setStage] = useState<FlywheelStage | null>(asStage(task.category))
  const [dueDate, setDueDate] = useState(task.due_date ?? '')

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof adminUpdateAssignedTask>[1] = {}
      if (title.trim() && title.trim() !== (task.title ?? '')) payload.title = title.trim()
      if (description.trim() !== (task.description ?? '')) {
        if (description.trim() === '') payload.clearDescription = true
        else payload.description = description.trim()
      }
      if (stage !== asStage(task.category)) {
        if (stage === null) payload.clearCategory = true
        else payload.category = stage
      }
      if ((dueDate || null) !== (task.due_date ?? null)) {
        if (!dueDate) payload.clearDue = true
        else payload.due_date = dueDate
      }
      return adminUpdateAssignedTask(task.id, payload)
    },
    onSuccess: onSaved,
    onError: (err: Error) => onError(err),
  })

  if (!isEditing) {
    // Collapsed row — title + assignee + due label. Click anywhere to
    // enter edit mode.
    return (
      <button
        type="button"
        onClick={onOpenEdit}
        className={`w-full text-left grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-3 py-2 rounded-xl border border-transparent hover:bg-white/[0.03] hover:border-white/[0.08] transition-all ${
          task.is_completed ? 'opacity-50' : ''
        }`}
      >
        <div className="min-w-0">
          <p className={`text-[13px] truncate ${task.is_completed ? 'line-through text-text-muted' : 'font-semibold text-text'}`}>
            {task.title ?? 'Untitled task'}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-light flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Users size={10} />
              {task.assigned_to_name ?? (task.scope === 'studio' ? 'Studio' : '—')}
            </span>
            {task.category && <span>{task.category}</span>}
            {/* PR #70 — `Required` tag retired sitewide. */}
          </div>
        </div>
        <span className={`shrink-0 text-[12px] tabular-nums mt-[2px] ${formatDueShort(task.due_date) ? 'text-text-light' : 'text-text-light/30'}`}>
          {formatDueShort(task.due_date) ?? '—'}
        </span>
      </button>
    )
  }

  // Expanded row — inline edit form.
  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-gold uppercase">
          Editing
        </span>
        <button
          type="button"
          onClick={onCancelEdit}
          className="inline-flex items-center justify-center p-1 rounded-md text-text-muted hover:text-text hover:bg-white/[0.04]"
          aria-label="Cancel"
        >
          <X size={13} />
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-border text-[13px] text-text focus:outline-none focus:border-gold/50"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-border text-[13px] text-text focus:outline-none focus:border-gold/50 resize-none"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Flywheel stage</label>
        <FlywheelStagePicker value={stage} onChange={setStage} />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-border text-[13px] text-text focus:outline-none focus:border-gold/50"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || title.trim() === ''}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold bg-gradient-to-b from-gold to-gold-muted text-black hover:brightness-105 disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Check size={13} strokeWidth={3} />
          )}
          Save changes
        </button>
        <button
          type="button"
          onClick={onCancelEdit}
          className="flex-1 inline-flex items-center justify-center py-2 rounded-lg text-[12px] font-semibold bg-white/[0.04] text-text-light hover:text-text hover:bg-white/[0.08]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
