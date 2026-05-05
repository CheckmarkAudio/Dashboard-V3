import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Calendar as CalendarIcon,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Edit2,
  Layers,
  Loader2,
  Plus,
  Repeat,
  Save,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  completeAssignedTask,
  fetchStudioAssignedTasks,
  type CustomTaskDraft,
} from '../../lib/queries/assignments'
import {
  STUDIO_SPACES,
  adminDeleteAssignedTasks,
  adminUpdateAssignedTask,
  type StudioSpace,
} from '../../lib/queries/adminTasks'
import {
  addTaskTemplateItem,
  createTaskTemplate,
  fetchTaskTemplateDetail,
  fetchTaskTemplateLibrary,
} from '../../lib/queries/taskTemplates'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../contexts/AuthContext'
import { Button, Input } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import MultiTaskCreateModal from '../../components/tasks/requests/MultiTaskCreateModal'
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
  const [addModalOpen, setAddModalOpen] = useState(false)
  // PR #102 follow-up — chrome parity with the Members pane.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false)
  const [templatesDropdownOpen, setTemplatesDropdownOpen] = useState(false)
  // When admin clicks a template from the dropdown, fetch its items
  // and feed them as initialDrafts into MultiTaskCreateModal so they
  // can review/edit before committing as studio tasks.
  const [pendingTemplateDrafts, setPendingTemplateDrafts] =
    useState<CustomTaskDraft[] | null>(null)
  const tplDropdownRef = useRef<HTMLDivElement | null>(null)

  const tasksQuery = useQuery({
    queryKey: STUDIO_TASKS_KEY,
    queryFn: () => fetchStudioAssignedTasks(profile?.id ?? '', { includeCompleted: true }),
    enabled: Boolean(profile?.id),
  })
  const tasks = tasksQuery.data ?? []
  const completedCount = tasks.filter((t) => t.is_completed).length

  // Fetch the team's templates for the Templates ▾ dropdown. Same
  // helper the Members pane uses, so cache is shared.
  const templatesQuery = useQuery({
    queryKey: ['admin-templates-library', null, false],
    queryFn: () => fetchTaskTemplateLibrary({ roleTag: null, includeInactive: false }),
    staleTime: 30_000,
  })
  const templates = templatesQuery.data ?? []

  // Close the Templates dropdown on outside-click.
  useEffect(() => {
    if (!templatesDropdownOpen) return
    const onPointer = (e: PointerEvent) => {
      const node = tplDropdownRef.current
      if (node && !node.contains(e.target as Node)) {
        setTemplatesDropdownOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [templatesDropdownOpen])

  // Reset bulk-confirm when select mode flips off.
  useEffect(() => {
    if (!selectMode) {
      setSelectedIds(new Set())
      setBulkConfirm(false)
    }
  }, [selectMode])

  // Auto-clear bulk confirm if the admin walks away.
  useEffect(() => {
    if (!bulkConfirm) return
    const t = setTimeout(() => setBulkConfirm(false), 4000)
    return () => clearTimeout(t)
  }, [bulkConfirm])

  const bulkDeleteMutation = useMutation({
    mutationFn: () => adminDeleteAssignedTasks(Array.from(selectedIds)),
    onSuccess: (result) => {
      toast(
        `Deleted ${result.deleted_count} task${result.deleted_count === 1 ? '' : 's'}`,
        'success',
      )
      setSelectMode(false)
      setSelectedIds(new Set())
      setBulkConfirm(false)
      void queryClient.invalidateQueries({ queryKey: STUDIO_TASKS_KEY })
      void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  // Click a template → fetch its items → pre-load them as studio
  // drafts in MultiTaskCreateModal. Admin reviews/edits before send.
  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => fetchTaskTemplateDetail(templateId),
    onSuccess: (detail) => {
      setTemplatesDropdownOpen(false)
      const drafts: CustomTaskDraft[] = (detail.items ?? []).map((item) => ({
        title: item.title,
        description: item.description ?? null,
        category: item.category ?? null,
        is_required: item.is_required ?? false,
        // studio_space + recurrence_spec stay null on import — admin
        // picks them per row inside the modal before sending.
      }))
      if (drafts.length === 0) {
        toast('That template has no items yet.', 'error')
        return
      }
      setPendingTemplateDrafts(drafts)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

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

  const allSelected = tasks.length > 0 && selectedIds.size === tasks.length
  const someSelected = selectedIds.size > 0
  const handleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === tasks.length ? new Set() : new Set(tasks.map((t) => t.id))))
  }
  const handleBulkDelete = () => {
    if (!someSelected) return
    if (!bulkConfirm) {
      setBulkConfirm(true)
      return
    }
    bulkDeleteMutation.mutate()
  }

  return (
    <div className="space-y-4">
      {/* Action bar — mirrors the Members pane: Save as Template ·
          Select on the left, Templates ▾ on the right. Select mode
          morphs the bar to "N selected · Select all · Delete · Cancel"
          per PR #84's pattern. */}
      {selectMode ? (
        <div className="flex items-center gap-2 mb-1 flex-wrap pb-3 border-b border-border/60">
          <span className="text-[13px] font-semibold text-text">
            {selectedIds.size} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<CheckSquare size={14} aria-hidden="true" />}
            onClick={handleSelectAll}
            disabled={tasks.length === 0}
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={!someSelected || bulkDeleteMutation.isPending}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                !someSelected
                  ? 'bg-rose-500/5 text-rose-400/40 border border-rose-500/15 cursor-not-allowed'
                  : bulkConfirm
                    ? 'bg-rose-500/80 text-white hover:brightness-110 shadow-[0_4px_12px_rgba(244,63,94,0.25)]'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
              }`}
            >
              <Trash2 size={12} aria-hidden="true" />
              {bulkDeleteMutation.isPending
                ? 'Deleting…'
                : bulkConfirm
                  ? `Confirm delete ${selectedIds.size}`
                  : 'Delete'}
            </button>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<X size={14} aria-hidden="true" />}
              onClick={() => setSelectMode(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-1 flex-wrap pb-3 border-b border-border/60">
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<Save size={14} aria-hidden="true" />}
            onClick={() => setSaveAsTemplateOpen(true)}
            disabled={tasks.length === 0}
            title={tasks.length === 0 ? 'No tasks to save' : 'Save current studio tasks as a template'}
          >
            Save as Template
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<CheckSquare size={14} aria-hidden="true" />}
            onClick={() => setSelectMode(true)}
            disabled={tasks.length === 0}
            title={tasks.length === 0 ? 'No tasks to select' : 'Select tasks for bulk delete'}
          >
            Select
          </Button>
          <div className="ml-auto relative" ref={tplDropdownRef}>
            <Button
              variant="primary"
              size="sm"
              iconLeft={<ClipboardList size={14} aria-hidden="true" />}
              onClick={() => setTemplatesDropdownOpen((v) => !v)}
            >
              Templates
              <ChevronDown
                size={14}
                className={`ml-1 transition-transform ${templatesDropdownOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </Button>
            {templatesDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-80 bg-surface border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                <p className="px-3 py-2 border-b border-border text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Apply a template's tasks to Studio
                </p>
                {templatesQuery.isLoading || applyTemplateMutation.isPending ? (
                  <div className="px-3 py-4 text-text-light flex items-center gap-2 text-[12px]">
                    <Loader2 size={14} className="animate-spin" />
                    {applyTemplateMutation.isPending ? 'Loading items…' : 'Loading templates…'}
                  </div>
                ) : templates.length === 0 ? (
                  <p className="px-3 py-4 text-[12px] text-text-light italic">
                    No templates yet. Build one on the Templates page.
                  </p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {templates.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => applyTemplateMutation.mutate(t.id)}
                          className="w-full text-left px-3 py-2.5 hover:bg-surface-hover transition-colors flex items-center gap-2"
                        >
                          <Layers size={12} className="text-gold/70 shrink-0" aria-hidden="true" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-semibold text-text truncate">
                              {t.name}
                            </span>
                            <span className="block text-[10px] text-text-light truncate">
                              {t.item_count} task{t.item_count === 1 ? '' : 's'}
                              {t.role_tag ? ` · ${t.role_tag}` : ''}
                            </span>
                          </span>
                          <ChevronRight size={12} className="text-text-light shrink-0" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Title row — mirrors the Members pane's "All Tasks for X" rhythm. */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-text truncate">Studio Tasks</h1>
            <p className="text-[12px] text-text-muted mt-0.5">
              {tasks.length} task{tasks.length === 1 ? '' : 's'} · {completedCount} complete
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Plus size={14} aria-hidden="true" />}
            onClick={() => setAddModalOpen(true)}
          >
            Add Task
          </Button>
        </div>
      </div>

      {tasksQuery.isLoading ? (
        <div className="py-10 flex items-center justify-center text-text-light">
          <Loader2 size={18} className="animate-spin mr-2" />
          Loading tasks…
        </div>
      ) : tasksQuery.error ? (
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
              onEdit={setEditTask}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={(id) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }}
            />
          )}
          {STUDIO_SPACES.map((space) => (
            <SpaceSection
              key={space}
              label={space}
              tasks={grouped.get(space) ?? []}
              onEdit={setEditTask}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={(id) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }}
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

      {addModalOpen && (
        <MultiTaskCreateModal
          initialScope="studio"
          onClose={() => {
            setAddModalOpen(false)
            void queryClient.invalidateQueries({ queryKey: STUDIO_TASKS_KEY })
            void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
          }}
        />
      )}

      {/* "Apply template" flow — opens MultiTaskCreateModal in studio
          scope with the template's items pre-loaded as drafts so the
          admin can review/edit (especially studio_space, which the
          template doesn't carry) before sending. */}
      {pendingTemplateDrafts && (
        <MultiTaskCreateModal
          initialScope="studio"
          initialDrafts={pendingTemplateDrafts}
          onClose={() => {
            setPendingTemplateDrafts(null)
            void queryClient.invalidateQueries({ queryKey: STUDIO_TASKS_KEY })
            void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
          }}
        />
      )}

      {saveAsTemplateOpen && (
        <SaveAsStudioTemplateModal
          tasks={tasks}
          onClose={() => setSaveAsTemplateOpen(false)}
          onSaved={(name) => {
            setSaveAsTemplateOpen(false)
            toast(`Saved "${name}" template — visible on the Templates tab.`, 'success')
            void queryClient.invalidateQueries({ queryKey: ['admin-templates-library'] })
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
  onEdit,
  selectMode,
  selectedIds,
  onToggleSelect,
}: {
  label: string
  labelDim?: boolean
  tasks: AssignedTask[]
  onEdit: (task: AssignedTask) => void
  selectMode: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
}) {
  // Active rows first so the section doesn't bury what still needs doing.
  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
      const da = a.due_date ?? ''
      const db = b.due_date ?? ''
      if (da !== db) return da.localeCompare(db)
      return a.sort_order - b.sort_order
    })
  }, [tasks])

  return (
    <section>
      <div className="flex items-center gap-2 px-1 pb-1.5">
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

      {sorted.length === 0 ? (
        <p className="text-[11px] text-text-light/70 italic px-2 py-1.5">
          {labelDim ? 'No tasks need a room tag right now.' : 'No tasks yet.'}
        </p>
      ) : (
        <ul className="space-y-0.5">
          {sorted.map((task) => (
            <li key={task.id}>
              <StudioTaskRow
                task={task}
                onEdit={onEdit}
                selectMode={selectMode}
                isSelected={selectedIds.has(task.id)}
                onToggleSelect={onToggleSelect}
              />
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
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  task: AssignedTask
  onEdit: (task: AssignedTask) => void
  selectMode: boolean
  isSelected: boolean
  onToggleSelect: (id: string) => void
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
    <div
      className={`group flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
        isSelected
          ? 'bg-rose-500/10 ring-1 ring-rose-500/25'
          : 'hover:bg-surface-hover'
      }`}
    >
      {/* In select mode the row shows ONLY the rose select-checkbox.
          Outside select mode, only the gold complete-toggle. One mode,
          one checkbox per row — same pattern as PR #84's AssignAdmin
          fix for member tasks. */}
      {selectMode ? (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(task.id)}
          aria-label={`Select task ${task.title}`}
          className="w-4 h-4 rounded border-border accent-rose-500 cursor-pointer"
        />
      ) : (
        <input
          type="checkbox"
          checked={done}
          onChange={() => toggleMutation.mutate()}
          aria-label={`${done ? 'Completed' : 'Open'} — ${task.title}`}
          className="w-4 h-4 rounded border-border accent-gold cursor-pointer"
        />
      )}
      <span
        className={`flex-1 min-w-0 text-[13px] truncate ${
          done ? 'line-through text-text-light' : 'text-text'
        }`}
      >
        {task.title}
      </span>
      {task.recurrence_spec && !confirmDelete && (
        <span className="text-[10px] text-gold/80 shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gold/10 ring-1 ring-gold/25 font-semibold uppercase tracking-wider">
          <Repeat size={10} aria-hidden="true" />
          {task.recurrence_spec.frequency}
        </span>
      )}
      {task.due_date && !confirmDelete && (
        <span className="text-[10px] text-text-light tabular-nums shrink-0 inline-flex items-center gap-1">
          <CalendarIcon size={10} aria-hidden="true" />
          {task.due_date}
        </span>
      )}
      {/* Per-row Edit + Trash hidden in select mode so the bulk bar
          is the one place admins act from. */}
      {!selectMode && !confirmDelete && (
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
      {!selectMode && confirmDelete && (
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

// ─── Save as Template (studio variant) ───────────────────────────────
//
// Crystallises the current studio tasks as a new task_template + items.
// Mirrors the AssignAdmin SaveAsTemplateModal but defaults the name to
// a studio-flavoured suggestion and hides the per-member context.
//
// Templates created here can be applied back to studio (or to any
// member) via the Templates ▾ dropdown — the template itself is
// scope-agnostic; the apply path decides where the items land.

function SaveAsStudioTemplateModal({
  tasks,
  onClose,
  onSaved,
}: {
  tasks: AssignedTask[]
  onClose: () => void
  onSaved: (templateName: string) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('Studio tasks')
  const [description, setDescription] = useState('')
  const [roleTag, setRoleTag] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim() || tasks.length === 0) return
    setSubmitting(true)
    try {
      const tpl = await createTaskTemplate({
        name: name.trim(),
        description: description.trim() || null,
        role_tag: roleTag.trim() || null,
      })
      // Iterate the source tasks; preserve order via sort_order.
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i]
        if (!t) continue
        await addTaskTemplateItem(tpl.id, {
          title: t.title,
          description: t.description ?? null,
          category: t.category ?? null,
          sort_order: i,
          is_required: t.is_required ?? false,
        })
      }
      onSaved(tpl.name)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save template', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-surface rounded-2xl border border-border w-full max-w-lg mx-4 p-6 shadow-2xl animate-fade-in max-h-[90dvh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text">Save studio tasks as template</h2>
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
            id="save-template-name"
            label="Template name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div>
            <label
              htmlFor="save-template-description"
              className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5"
            >
              Description (optional)
            </label>
            <textarea
              id="save-template-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm placeholder:text-text-light focus:border-gold focus:outline-none resize-y"
            />
          </div>
          <Input
            id="save-template-role"
            label="Role tag (optional)"
            placeholder="e.g. cleaning · maintenance"
            value={roleTag}
            onChange={(e) => setRoleTag(e.target.value)}
          />
          <p className="text-[11px] text-text-light">
            Will save {tasks.length} task{tasks.length === 1 ? '' : 's'} as a reusable template.
            You can apply it back to studio (or any member) from the Templates ▾ dropdown.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-5 mt-5 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            loading={submitting}
            disabled={!name.trim() || tasks.length === 0}
          >
            <Save size={14} aria-hidden="true" />
            Save template
          </Button>
        </div>
      </div>
    </div>
  )
}
