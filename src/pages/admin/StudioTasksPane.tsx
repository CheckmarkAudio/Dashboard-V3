import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Calendar as CalendarIcon,
  Check,
  Edit2,
  Loader2,
  Plus,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  assignCustomTasksToMembers,
  completeAssignedTask,
  fetchStudioAssignedTasks,
} from '../../lib/queries/assignments'
import {
  STUDIO_SPACES,
  adminDeleteAssignedTasks,
  adminUpdateAssignedTask,
  type StudioSpace,
} from '../../lib/queries/adminTasks'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../contexts/AuthContext'
import { Button, Input } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { AssignedTask } from '../../types/assignments'

/**
 * StudioTasksPane — admin's "Studio" tab on the Assign page.
 *
 * Lives alongside the Members + Templates tabs in AssignAdmin's sidebar
 * pattern. Shows ALL studio-scope tasks for the team, sectioned by
 * which physical room they belong to (Control Room · Studio A ·
 * Studio B). A fourth "(no space set)" section appears at the top only
 * when there are unbacked-room rows from before the studio_space
 * rollout — disappears once an admin tags them.
 *
 * Per-section: section header + per-task rows + inline "+ Add task"
 * single-line composer (auto-attaches the section's room tag).
 *
 * Per-row: completion checkbox + edit pencil (opens a local
 * StudioTaskEditModal that adds a room picker on top of the standard
 * title/description/stage/due editor) + trash with two-step inline
 * confirm matching PR #84's bulk-delete pattern.
 *
 * Realtime: subscribes to `assigned_tasks` DML events scoped to
 * studio rows so a task created/completed/edited from another session
 * pops in without a manual refetch (mirrors PR #87's pattern on the
 * other admin task surfaces).
 */

const STUDIO_TASKS_KEY = ['admin-studio-tasks'] as const
const NO_SPACE_KEY = '__no_space__'

export default function StudioTasksPane() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [editTask, setEditTask] = useState<AssignedTask | null>(null)

  const tasksQuery = useQuery({
    queryKey: STUDIO_TASKS_KEY,
    queryFn: () => fetchStudioAssignedTasks(profile?.id ?? '', { includeCompleted: true }),
    enabled: Boolean(profile?.id),
  })
  const tasks = tasksQuery.data ?? []

  // Realtime: any DML on assigned_tasks (scope='studio') should
  // refresh the list. Server filter keeps the channel quiet for
  // member-task updates.
  useEffect(() => {
    const sub = supabase
      .channel('admin-studio-tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assigned_tasks', filter: 'scope=eq.studio' },
        () => {
          void queryClient.invalidateQueries({ queryKey: STUDIO_TASKS_KEY })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(sub)
    }
  }, [queryClient])

  // Group tasks by space so each section renders independently.
  // Active rows above completed rows so the sections don't bury what
  // still needs doing.
  const grouped = useMemo(() => {
    const map = new Map<string, AssignedTask[]>()
    for (const space of STUDIO_SPACES) map.set(space, [])
    map.set(NO_SPACE_KEY, [])
    for (const t of tasks) {
      const key = (t.studio_space ?? NO_SPACE_KEY) as string
      const bucket = map.get(key) ?? map.get(NO_SPACE_KEY)!
      bucket.push(t)
    }
    return map
  }, [tasks])

  const noSpaceCount = grouped.get(NO_SPACE_KEY)?.length ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <h2 className="text-base font-bold text-text">Studio Tasks</h2>
          <p className="text-[11px] text-text-light mt-0.5">
            Around-the-studio work — cleaning, patch bay resets, mic stand stage, etc.
          </p>
        </div>
        {tasksQuery.isLoading && <Loader2 size={14} className="animate-spin text-text-light" />}
      </div>

      {tasksQuery.error ? (
        <p className="text-[12px] text-rose-300 px-1">
          {(tasksQuery.error as Error).message}
        </p>
      ) : (
        <>
          {/* "(no space set)" section appears at the TOP only when
              there's something to backfill, so admins notice it
              first instead of having to hunt for it. */}
          {noSpaceCount > 0 && (
            <SpaceSection
              label="No space set"
              labelDim
              tasks={grouped.get(NO_SPACE_KEY) ?? []}
              targetSpace={null}
              onEdit={setEditTask}
            />
          )}
          {STUDIO_SPACES.map((space) => (
            <SpaceSection
              key={space}
              label={space}
              tasks={grouped.get(space) ?? []}
              targetSpace={space}
              onEdit={setEditTask}
            />
          ))}
        </>
      )}

      {editTask && (
        <StudioTaskEditModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: STUDIO_TASKS_KEY })
            void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
            setEditTask(null)
            toast('Task updated', 'success')
          }}
        />
      )}
    </div>
  )
}

// ─── Section ─────────────────────────────────────────────────────────

function SpaceSection({
  label,
  labelDim,
  tasks,
  targetSpace,
  onEdit,
}: {
  label: string
  labelDim?: boolean
  tasks: AssignedTask[]
  /** The space that newly-added tasks in this section will be tagged
   * with. NULL when this is the "(no space set)" backfill section —
   * +Add is hidden there since you'd just be adding more untagged rows. */
  targetSpace: StudioSpace | null
  onEdit: (task: AssignedTask) => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const addMutation = useMutation({
    mutationFn: () => {
      if (!targetSpace) throw new Error('cannot add to no-space section')
      return assignCustomTasksToMembers(
        [],
        [{ title: draft.trim(), studio_space: targetSpace }],
        { scope: 'studio' },
      )
    },
    onSuccess: () => {
      toast(`Task added to ${targetSpace}`, 'success')
      setDraft('')
      setComposerOpen(false)
      void queryClient.invalidateQueries({ queryKey: STUDIO_TASKS_KEY })
      void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const canSend = draft.trim().length > 0 && !addMutation.isPending

  // Active rows first so the section doesn't bury what still needs doing.
  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
      const da = a.due_date ?? ''
      const db = b.due_date ?? ''
      if (da !== db) return da.localeCompare(db) // empty sorts first; flip if undesired
      return a.sort_order - b.sort_order
    })
  }, [tasks])

  return (
    <section>
      <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
        <div className="flex items-center gap-2">
          <h3
            className={`text-[10px] font-bold uppercase tracking-[0.08em] ${
              labelDim ? 'text-text-light/70' : 'text-gold'
            }`}
          >
            {label}
          </h3>
          <span className="tabular-nums text-[10px] font-bold text-text-light/70 px-1.5 py-0.5 rounded-full bg-surface-alt ring-1 ring-border">
            {tasks.length}
          </span>
        </div>
        {targetSpace && !composerOpen && (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-text-light hover:text-gold hover:bg-surface-hover focus-ring"
          >
            <Plus size={11} aria-hidden="true" />
            Add task
          </button>
        )}
      </div>

      {composerOpen && targetSpace && (
        <div className="mb-2 px-2 py-2 rounded-xl bg-surface-alt/40 border border-border space-y-1.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`New task for ${targetSpace}…`}
            maxLength={200}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSend) {
                e.preventDefault()
                addMutation.mutate()
              } else if (e.key === 'Escape') {
                setDraft('')
                setComposerOpen(false)
              }
            }}
            className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-[13px] placeholder:text-text-light focus:border-gold focus:outline-none"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setDraft('')
                setComposerOpen(false)
              }}
              className="px-2 py-1 rounded text-[11px] font-semibold text-text-light hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => addMutation.mutate()}
              disabled={!canSend}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-500/20 ring-1 ring-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              <Plus size={11} aria-hidden="true" />
              {addMutation.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-[11px] text-text-light/70 italic px-2 py-1.5">
          {labelDim ? 'No tasks need a room tag right now.' : 'No tasks yet.'}
        </p>
      ) : (
        <ul className="space-y-0.5">
          {sorted.map((task) => (
            <li key={task.id}>
              <StudioTaskRow task={task} onEdit={onEdit} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────

function StudioTaskRow({
  task,
  onEdit,
}: {
  task: AssignedTask
  onEdit: (task: AssignedTask) => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Auto-reset the inline confirm if the admin walks away.
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 4000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  const toggleMutation = useMutation({
    mutationFn: () => completeAssignedTask(task.id, !task.is_completed),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STUDIO_TASKS_KEY })
      void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })
  const deleteMutation = useMutation({
    mutationFn: () => adminDeleteAssignedTasks([task.id]),
    onSuccess: () => {
      toast('Task deleted', 'success')
      void queryClient.invalidateQueries({ queryKey: STUDIO_TASKS_KEY })
      void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const done = task.is_completed
  return (
    <div className="group flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-hover transition-colors">
      <input
        type="checkbox"
        checked={done}
        onChange={() => toggleMutation.mutate()}
        aria-label={`${done ? 'Completed' : 'Open'} — ${task.title}`}
        className="w-4 h-4 rounded border-border accent-gold cursor-pointer"
      />
      <span
        className={`flex-1 min-w-0 text-[13px] truncate ${
          done ? 'line-through text-text-light' : 'text-text'
        }`}
      >
        {task.title}
      </span>
      {task.due_date && !confirmDelete && (
        <span className="text-[10px] text-text-light tabular-nums shrink-0 inline-flex items-center gap-1">
          <CalendarIcon size={10} aria-hidden="true" />
          {task.due_date}
        </span>
      )}
      {!confirmDelete && (
        <>
          <RowAction
            icon={Edit2}
            label={`Edit ${task.title}`}
            onClick={() => onEdit(task)}
            tone="gold"
          />
          <RowAction
            icon={Trash2}
            label={`Delete ${task.title}`}
            onClick={() => setConfirmDelete(true)}
            tone="rose"
          />
        </>
      )}
      {confirmDelete && (
        <span className="inline-flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-white bg-rose-500/80 hover:brightness-110"
          >
            <Trash2 size={11} aria-hidden="true" />
            {deleteMutation.isPending ? 'Deleting…' : 'Confirm delete'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="inline-flex items-center px-1.5 py-1 rounded-md text-[10px] font-semibold text-text-light hover:text-text"
          >
            Keep
          </button>
        </span>
      )}
    </div>
  )
}

function RowAction({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  tone: 'gold' | 'rose'
}) {
  const hoverClass =
    tone === 'rose'
      ? 'hover:text-rose-300 hover:bg-rose-500/10'
      : 'hover:text-gold hover:bg-surface'
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-lg text-text-muted opacity-0 group-hover:opacity-100 transition-all focus-ring ${hoverClass}`}
    >
      <Icon size={12} aria-hidden="true" />
    </button>
  )
}

// ─── Edit modal ──────────────────────────────────────────────────────

function StudioTaskEditModal({
  task,
  onClose,
  onSaved,
}: {
  task: AssignedTask
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [studioSpace, setStudioSpace] = useState<string>(task.studio_space ?? '')

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof adminUpdateAssignedTask>[1] = {}
      if (title.trim() !== task.title) payload.title = title.trim()
      const trimmedDesc = description.trim()
      const currentDesc = task.description ?? ''
      if (trimmedDesc !== currentDesc) {
        if (trimmedDesc) payload.description = trimmedDesc
        else payload.clearDescription = true
      }
      const currentDue = task.due_date ?? ''
      if (dueDate !== currentDue) {
        if (dueDate) payload.due_date = dueDate
        else payload.clearDue = true
      }
      const currentSpace = task.studio_space ?? ''
      if (studioSpace !== currentSpace) {
        if (studioSpace) payload.studio_space = studioSpace as StudioSpace
        else payload.clearStudioSpace = true
      }
      return adminUpdateAssignedTask(task.id, payload)
    },
    onSuccess: onSaved,
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-surface rounded-2xl border border-border w-full max-w-lg mx-4 p-6 shadow-2xl animate-fade-in max-h-[90dvh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text">Edit studio task</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <Input
            id="studio-task-title"
            label="Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div>
            <label
              htmlFor="studio-task-description"
              className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5"
            >
              Description
            </label>
            <textarea
              id="studio-task-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm placeholder:text-text-light focus:border-gold focus:outline-none resize-y"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="studio-task-space"
                className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5"
              >
                Room
              </label>
              <select
                id="studio-task-space"
                value={studioSpace}
                onChange={(e) => setStudioSpace(e.target.value)}
                className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
              >
                <option value="">— No space set —</option>
                {STUDIO_SPACES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <Input
              id="studio-task-due"
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-5 mt-5 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!title.trim()}
          >
            <Check size={14} aria-hidden="true" />
            Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}
