import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, Archive, Calendar as CalendarIcon, CheckSquare, ChevronDown, ChevronRight,
  ClipboardList, Edit2, Layers, Loader2, Plus, Save, Settings,
  Sparkles, Tag, Trash2, Users, X,
} from 'lucide-react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../components/Toast'
import { Button, Input } from '../../components/ui'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import {
  completeAssignedTask,
  fetchMemberAssignedTasks,
} from '../../lib/queries/assignments'
import { adminDeleteAssignedTasks, adminUpdateAssignedTask } from '../../lib/queries/adminTasks'
import {
  addTaskTemplateItem,
  assignTemplateItemsToMembers,
  createTaskTemplate,
  fetchTaskTemplateDetail,
  fetchTaskTemplateLibrary,
  taskTemplateKeys,
} from '../../lib/queries/taskTemplates'
import type {
  TaskTemplateLibraryEntry,
} from '../../types/assignments'
import MultiTaskCreateModal from '../../components/tasks/requests/MultiTaskCreateModal'
import { supabase } from '../../lib/supabase'
import type { TeamMember } from '../../types'
import type { AssignedTask } from '../../types/assignments'

/**
 * Assign — member-centric task editor.
 *
 * Replaces the legacy widget-grid Assign page (PRs #41–#46) with a
 * sidebar+main pattern per the boss's sketch (2026-04-29). The
 * legacy page (Task Requests / Approval Log / Edit Tasks / Assign /
 * Assign Log / Templates) lives at /admin/assign-classic so the data
 * + components stay reachable for the planned "tabs" integration on
 * this page.
 *
 * Layout:
 *   - Left sidebar (260px): Members list · Templates link · Other
 *   - Main content: Settings · Save as Template · Templates ▾ bar;
 *     "All Tasks for {selected member}" title; two-column task list
 *     with checkbox + label + Edit per row.
 *
 * Wiring:
 *   - Members + tasks fetched from real DB (`team_members`,
 *     `assigned_tasks` via `get_member_assigned_tasks`).
 *   - Checkbox toggles via `complete_assigned_task` (optimistic).
 *   - Edit row → small inline edit modal hitting
 *     `admin_update_assigned_task`.
 *   - "Add Task" → reuses `MultiTaskCreateModal` with the selected
 *     member pre-filled (`defaultRecipientIds` prop).
 *   - "Templates ▾" → applies via `assign_template_to_members` to
 *     the selected member only.
 *   - "Save as Template" → name + role tag prompt, creates a
 *     `task_template`, then loops `add_task_template_item` for each
 *     of the selected member's current tasks.
 *   - "Settings for Tasks" → reserved for future global task
 *     settings (currently disabled).
 *
 * Mounted at the canonical Assign route (`/admin/templates`) and
 * also at `/admin/assign-mockup` for any saved bookmark from the
 * preview phase.
 */

export default function AssignAdmin() {
  useDocumentTitle('Assign - Checkmark Workspace')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // ─── Members fetch ─────────────────────────────────────────────
  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })
  const members: TeamMember[] = teamQuery.data ?? []
  const activeMembers = useMemo(
    () => members.filter((m) => m.status?.toLowerCase() !== 'inactive'),
    [members],
  )

  // ─── Selected member + persisted-in-URL hash so refresh stays put.
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(
    () => (typeof window !== 'undefined' ? window.location.hash.slice(1) || null : null),
  )
  // Default to first member once the list loads + nothing was hashed.
  useEffect(() => {
    if (selectedMemberId) return
    const first = activeMembers[0]
    if (!first) return
    setSelectedMemberId(first.id)
  }, [selectedMemberId, activeMembers])
  // Reflect the selection in the URL hash so a deep link works.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!selectedMemberId) return
    if (window.location.hash !== `#${selectedMemberId}`) {
      history.replaceState(null, '', `#${selectedMemberId}`)
    }
  }, [selectedMemberId])

  const selectedMember = activeMembers.find((m) => m.id === selectedMemberId)
    ?? activeMembers[0]
    ?? null

  // ─── Tasks for the selected member ──────────────────────────────
  const tasksQuery = useQuery({
    queryKey: ['assign-page-member-tasks', selectedMember?.id ?? 'none'],
    queryFn: () =>
      fetchMemberAssignedTasks(selectedMember!.id, { includeCompleted: true }),
    enabled: Boolean(selectedMember?.id),
  })
  const tasks = tasksQuery.data ?? []

  // 2026-05-02 — realtime sync for the selected member's task list.
  // Without this, a task the member completes/edits/deletes from
  // their My Tasks widget on a parallel session sat stale on the
  // admin's open AssignAdmin until React Query's default 5min
  // invalidation. Filter on assigned_to so we only fire on rows
  // for the currently-viewed member. Requires assigned_tasks in
  // supabase_realtime publication w/ REPLICA IDENTITY FULL —
  // shipped in migration 20260502180000_realtime_task_sync.sql.
  useEffect(() => {
    if (!selectedMember?.id) return
    const memberId = selectedMember.id
    const sub = supabase
      .channel(`assign-admin:${memberId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assigned_tasks',
          filter: `assigned_to=eq.${memberId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ['assign-page-member-tasks', memberId],
          })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(sub)
    }
  }, [selectedMember?.id, queryClient])

  // ─── Templates (real fetch for the dropdown) ────────────────────
  const templatesQuery = useQuery({
    queryKey: taskTemplateKeys.library(null, false),
    queryFn: () => fetchTaskTemplateLibrary({ roleTag: null, includeInactive: false }),
  })
  const templates = templatesQuery.data ?? []

  // ─── Local UI state ─────────────────────────────────────────────
  const [templatesDropdownOpen, setTemplatesDropdownOpen] = useState(false)
  const [editTask, setEditTask] = useState<AssignedTask | null>(null)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false)
  // PR #53 — selected template opens a confirmation modal where the
  // admin can uncheck items before applying. Replaces the prior
  // "click template = instantly assign" behaviour.
  const [previewTemplate, setPreviewTemplate] = useState<TaskTemplateLibraryEntry | null>(null)
  const tplDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!templatesDropdownOpen) return
    const handle = (e: MouseEvent) => {
      if (tplDropdownRef.current && !tplDropdownRef.current.contains(e.target as Node)) {
        setTemplatesDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [templatesDropdownOpen])

  // ─── Mutations ──────────────────────────────────────────────────
  const completeMutation = useMutation({
    mutationFn: ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) =>
      completeAssignedTask(taskId, isCompleted),
    // Optimistic — flip the row's completed_at right away; rollback
    // on error by invalidating.
    onMutate: async ({ taskId, isCompleted }) => {
      const key = ['assign-page-member-tasks', selectedMember?.id ?? 'none'] as const
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<AssignedTask[]>(key)
      queryClient.setQueryData<AssignedTask[]>(key, (rows) =>
        rows?.map((r) =>
          r.id === taskId
            ? { ...r, completed_at: isCompleted ? new Date().toISOString() : null }
            : r,
        ) ?? rows,
      )
      return { prev, key }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev && ctx?.key) queryClient.setQueryData(ctx.key, ctx.prev)
      toast('Failed to update task', 'error')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
    },
  })

  // PR #53 — stable callbacks for the task row so React.memo on
  // TaskRow can skip re-renders for unchanged rows. Without these,
  // every parent render created brand-new arrow functions for
  // onToggle / onEdit, defeating the memo and causing every
  // checkbox in the list to re-paint when one task toggled (the
  // "all checkmarks blink yellow" symptom).
  const completeMutate = completeMutation.mutate
  const handleToggle = useCallback(
    (task: AssignedTask) => {
      completeMutate({ taskId: task.id, isCompleted: !task.completed_at })
    },
    [completeMutate],
  )
  const handleEdit = useCallback((task: AssignedTask) => {
    setEditTask(task)
  }, [])

  // ─── Bulk select + delete ──────────────────────────────────────
  // Two state machines:
  //   - selectMode: false → rows render normally with hover-only Trash
  //                 true  → rows render a select-checkbox on the far
  //                         left + the top action bar swaps to
  //                         "N selected · Select all · Delete · Cancel"
  //   - selectedIds: which rows the admin checked while in selectMode
  // Reset both whenever the selected member changes — bulk delete is
  // strictly scoped to the currently-viewed member per locked
  // decision #8.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false)
  useEffect(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
    setBulkConfirm(false)
  }, [selectedMember?.id])

  const deleteMutation = useMutation({
    mutationFn: (taskIds: string[]) => adminDeleteAssignedTasks(taskIds),
    onSuccess: ({ deleted_count }) => {
      const key = ['assign-page-member-tasks', selectedMember?.id ?? 'none']
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-assigned-tasks'] })
      // Member-side caches that show the same task rows from the
      // assignee's perspective.
      void queryClient.invalidateQueries({ queryKey: ['team-assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
      toast(
        `Deleted ${deleted_count} task${deleted_count === 1 ? '' : 's'}.`,
        'success',
      )
      setSelectMode(false)
      setSelectedIds(new Set())
      setBulkConfirm(false)
    },
    onError: (err) => {
      toast(`Delete failed: ${(err as Error).message}`, 'error')
      setBulkConfirm(false)
    },
  })

  // Per-row delete is fired by the TaskRow's own two-step inline
  // confirm pill (matches the bulk-Delete UX); no window.confirm
  // dialog. Parent just runs the mutation.
  const deleteMutate = deleteMutation.mutate
  const handleDelete = useCallback(
    (task: AssignedTask) => {
      deleteMutate([task.id])
    },
    [deleteMutate],
  )

  const handleToggleSelect = useCallback((task: AssignedTask) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(task.id)) next.delete(task.id)
      else next.add(task.id)
      return next
    })
  }, [])

  const memberHasNoTasks = !tasksQuery.isLoading && tasks.length === 0
  const completedCount = tasks.filter((t) => t.completed_at).length
  const allSelected = tasks.length > 0 && selectedIds.size === tasks.length
  const someSelected = selectedIds.size > 0
  const handleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(tasks.map((t) => t.id)))
  }
  const handleBulkDelete = () => {
    if (!someSelected) return
    if (!bulkConfirm) {
      setBulkConfirm(true)
      // Reset the confirm prompt if the admin walks away without acting.
      setTimeout(() => setBulkConfirm(false), 4000)
      return
    }
    deleteMutation.mutate(Array.from(selectedIds))
  }

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-in">
      {/* Page header — mirrors Settings page rhythm so headers align across admin */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Assign</h1>
      </div>

      {/* Two-column shell: Sidebar | Main content.
          PR #63 — `items-stretch` so the sidebar grows to the same height
          as the main pane (bottom borders flush). Mirrors the `/calendar`
          pattern (`grid-cols-[300px_1fr] gap-3 items-stretch`). The aside
          loses `h-fit sticky top-4` because that pinned the sidebar at
          its content height and broke the bottom-flush requirement. */}
      <div className="grid grid-cols-[260px_1fr] gap-6 items-stretch">
        {/* ─── Sidebar ───────────────────────────────────────────── */}
        <aside className="rounded-xl border border-border bg-surface p-3">
          {/* Members */}
          <div>
            <div className="flex items-center gap-2 px-2 pb-2 mb-2 border-b border-border/60">
              <Users size={14} className="text-gold" aria-hidden="true" />
              <h2 className="text-sm font-bold text-text">Members</h2>
              {activeMembers.length > 0 && (
                <span className="ml-auto text-[11px] text-text-light tabular-nums">
                  {activeMembers.length}
                </span>
              )}
            </div>
            {teamQuery.isLoading ? (
              <div className="px-3 py-4 text-text-light flex items-center gap-2 text-[12px]">
                <Loader2 size={14} className="animate-spin" />
                Loading…
              </div>
            ) : (
              <ul className="space-y-1">
                {activeMembers.map((m) => {
                  const isSelected = selectedMember?.id === m.id
                  const initial = m.display_name?.charAt(0)?.toUpperCase() ?? '?'
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedMemberId(m.id)}
                        aria-current={isSelected ? 'true' : undefined}
                        className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all text-left ${
                          isSelected
                            ? 'bg-gold/12 ring-1 ring-gold/30'
                            : 'hover:bg-surface-hover'
                        }`}
                      >
                        <div
                          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                            isSelected
                              ? 'bg-gold/25 ring-1 ring-gold/40 text-gold'
                              : 'bg-surface-alt border border-border-light text-text-muted'
                          }`}
                        >
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[13px] truncate ${
                              isSelected ? 'font-bold text-text' : 'font-semibold text-text-muted'
                            }`}
                          >
                            {m.display_name}
                          </p>
                          {m.position && (
                            <p className="text-[10px] text-text-light truncate">
                              {m.position.replace(/_/g, ' ')}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <ChevronRight size={12} className="text-gold shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Templates link — PR #56 points at the dedicated full-
              page Templates manager (`/admin/template-library`).
              Same functionality as the legacy widget but with more
              breathing room. The legacy widget version is still
              reachable via the "Legacy Assign" link below for
              reference. */}
          <div className="mt-4 pt-3 border-t border-border/60">
            <Link
              to="/admin/template-library"
              className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-surface-hover transition-colors group"
            >
              <Layers size={14} className="text-gold/70 group-hover:text-gold" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-text">Templates</p>
                <p className="text-[10px] text-text-light">Manage on dedicated page</p>
              </div>
              <ChevronRight size={12} className="text-text-light shrink-0" aria-hidden="true" />
            </Link>
          </div>

          {/* Other — clickable path to the preserved legacy widget
              grid (Task Requests / Approval Log / Edit / Assign /
              Assign Log / Templates). PR #55 switched from `<a>` to
              `<Link>` so the navigation stays client-side and keeps
              the auth context warm. */}
          <div className="mt-3 pt-3 border-t border-border/60">
            <p className="px-2 text-[10px] uppercase tracking-wider text-text-light/70 font-semibold">
              Other
            </p>
            <ul className="mt-1 space-y-0.5">
              <li>
                <Link
                  to="/admin/assign-classic"
                  className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-surface-hover transition-colors group"
                >
                  <Archive size={14} className="text-amber-300/70 group-hover:text-amber-300 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-text">Legacy Assign</p>
                    <p className="text-[10px] text-text-light">Old widget-grid view</p>
                  </div>
                  <ChevronRight size={12} className="text-text-light shrink-0" aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>
        </aside>

        {/* ─── Main content ──────────────────────────────────────── */}
        <main className="rounded-xl border border-border bg-surface p-5">
          {/* Top action bar.
              Default mode  → Settings · Save as Template · Select · Templates ▾
              Select mode   → N selected · Select all · Delete · Cancel
              Lives INSIDE the main card so the right pane starts at the same
              Y as the sidebar (mirrors Settings page rhythm). */}
          {selectMode ? (
            <div className="flex items-center gap-2 mb-4 flex-wrap pb-4 border-b border-border/60">
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
                  disabled={!someSelected || deleteMutation.isPending}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                    !someSelected
                      ? 'bg-rose-500/5 text-rose-400/40 border border-rose-500/15 cursor-not-allowed'
                      : bulkConfirm
                        ? 'bg-rose-500/80 text-white hover:brightness-110 shadow-[0_4px_12px_rgba(244,63,94,0.25)]'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                  }`}
                >
                  <Trash2 size={12} aria-hidden="true" />
                  {bulkConfirm
                    ? `Confirm delete ${selectedIds.size}`
                    : `Delete${someSelected ? ` (${selectedIds.size})` : ''}`}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<X size={14} aria-hidden="true" />}
                  onClick={() => {
                    setSelectMode(false)
                    setSelectedIds(new Set())
                    setBulkConfirm(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
          <div className="flex items-center gap-2 mb-4 flex-wrap pb-4 border-b border-border/60">
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Settings size={14} aria-hidden="true" />}
              disabled
              title="Coming soon"
            >
              Settings for Tasks
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Save size={14} aria-hidden="true" />}
              onClick={() => setSaveAsTemplateOpen(true)}
              disabled={!selectedMember || tasks.length === 0}
              title={
                !selectedMember
                  ? 'Pick a member first'
                  : tasks.length === 0
                    ? 'No tasks to save as a template'
                    : 'Save these tasks as a new template'
              }
            >
              Save as Template
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<CheckSquare size={14} aria-hidden="true" />}
              onClick={() => setSelectMode(true)}
              disabled={!selectedMember || tasks.length === 0}
              title={
                tasks.length === 0
                  ? 'No tasks to select'
                  : 'Select tasks for bulk delete'
              }
            >
              Select
            </Button>

            <div className="ml-auto relative" ref={tplDropdownRef}>
              <Button
                variant="primary"
                size="sm"
                iconLeft={<ClipboardList size={14} aria-hidden="true" />}
                onClick={() => setTemplatesDropdownOpen((v) => !v)}
                disabled={!selectedMember}
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
                    Add a template's tasks to {selectedMember?.display_name}
                  </p>
                  {templatesQuery.isLoading ? (
                    <div className="px-3 py-4 text-text-light flex items-center gap-2 text-[12px]">
                      <Loader2 size={14} className="animate-spin" />
                      Loading templates…
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
                            onClick={() => {
                              // PR #53 — open the preview modal
                              // instead of applying immediately, so
                              // the admin can uncheck items they
                              // don't want.
                              setPreviewTemplate(t)
                              setTemplatesDropdownOpen(false)
                            }}
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

          {/* Title row — chrome stripped since this lives inside the main
              card now (was a double-box otherwise). */}
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-text truncate">
                  All Tasks for {selectedMember?.display_name ?? 'Selected Member'}
                </h1>
                <p className="text-[12px] text-text-muted mt-0.5">
                  {tasks.length} task{tasks.length === 1 ? '' : 's'} · {completedCount} complete
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Plus size={14} aria-hidden="true" />}
                onClick={() => setAddTaskOpen(true)}
                disabled={!selectedMember}
              >
                Add Task
              </Button>
            </div>

            {tasksQuery.isLoading ? (
              <div className="py-10 flex items-center justify-center text-text-light">
                <Loader2 size={18} className="animate-spin mr-2" />
                Loading tasks…
              </div>
            ) : tasksQuery.error ? (
              <div className="py-6 flex items-start gap-2 text-amber-300">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Could not load tasks</p>
                  <p className="text-xs text-text-light mt-0.5">
                    {(tasksQuery.error as Error).message}
                  </p>
                </div>
              </div>
            ) : memberHasNoTasks ? (
              <div className="py-10 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold/10 ring-1 ring-gold/20 mb-2">
                  <Sparkles size={16} className="text-gold" aria-hidden="true" />
                </div>
                <p className="text-[14px] font-semibold text-text">No tasks yet.</p>
                <p className="text-[12px] text-text-light mt-1">
                  Add a task or apply a template to get started.
                </p>
              </div>
            ) : (
              // Two-column task list with vertical divider per sketch.
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 relative">
                <div
                  className="absolute left-1/2 top-0 bottom-0 w-px bg-border/60 -translate-x-1/2"
                  aria-hidden="true"
                />
                {tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    selectMode={selectMode}
                    isSelected={selectedIds.has(t.id)}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSelect={handleToggleSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ─── Modals ─────────────────────────────────────────────── */}
      {addTaskOpen && selectedMember && (
        <MultiTaskCreateModal
          onClose={() => {
            setAddTaskOpen(false)
            void queryClient.invalidateQueries({
              queryKey: ['assign-page-member-tasks', selectedMember.id],
            })
          }}
          initialScope="member"
          defaultRecipientIds={[selectedMember.id]}
        />
      )}

      {editTask && (
        <SingleTaskEditModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSaved={() => {
            setEditTask(null)
            void queryClient.invalidateQueries({
              queryKey: ['assign-page-member-tasks', selectedMember?.id],
            })
          }}
        />
      )}

      {saveAsTemplateOpen && selectedMember && (
        <SaveAsTemplateModal
          tasks={tasks}
          memberName={selectedMember.display_name}
          onClose={() => setSaveAsTemplateOpen(false)}
          onSaved={(name) => {
            toast(`Saved "${name}" as a new template`)
            setSaveAsTemplateOpen(false)
            void queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all })
          }}
        />
      )}

      {previewTemplate && selectedMember && (
        <TemplatePreviewBeforeApplyModal
          template={previewTemplate}
          memberId={selectedMember.id}
          memberName={selectedMember.display_name}
          onClose={() => setPreviewTemplate(null)}
          onApplied={(taskCount) => {
            toast(
              `Added ${taskCount} task${taskCount === 1 ? '' : 's'} to ${selectedMember.display_name}`,
            )
            setPreviewTemplate(null)
            void queryClient.invalidateQueries({
              queryKey: ['assign-page-member-tasks', selectedMember.id],
            })
            void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
            void queryClient.invalidateQueries({ queryKey: ['admin-log'] })
          }}
        />
      )}
    </div>
  )
}

// ─── Task row atom ──────────────────────────────────────────────────
//
// PR #53 — wrapped in `memo` so toggling a single task doesn't re-
// render every other row. Combined with stable handlers in the
// parent (handleToggle / handleEdit captured via useCallback), this
// kills the "all checkmarks blink yellow" symptom that happened
// because every checkbox re-rendered when one task changed and the
// browser briefly re-painted the gold accent on each.

const TaskRow = memo(function TaskRow({
  task,
  selectMode,
  isSelected,
  onToggle,
  onEdit,
  onDelete,
  onSelect,
}: {
  task: AssignedTask
  selectMode: boolean
  isSelected: boolean
  onToggle: (task: AssignedTask) => void
  onEdit: (task: AssignedTask) => void
  onDelete: (task: AssignedTask) => void
  onSelect: (task: AssignedTask) => void
}) {
  const done = Boolean(task.completed_at)
  // Per-row inline two-step delete confirm — first click on the trash
  // icon flips the row into a rose-filled "Confirm delete" pill (same
  // pattern as the bulk Delete button), second click commits. Auto-
  // resets after 4s if the admin walks away. Replaces the prior
  // window.confirm dialog so the UX matches the bulk path.
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 4000)
    return () => clearTimeout(t)
  }, [confirmDelete])
  // Reset the confirm prompt if the admin enters bulk select mode mid-confirm.
  useEffect(() => {
    if (selectMode) setConfirmDelete(false)
  }, [selectMode])

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${
        isSelected ? 'bg-rose-500/10 ring-1 ring-rose-500/25' : 'hover:bg-surface-hover'
      }`}
    >
      {/* In select mode the row shows ONLY the rose select-checkbox,
          NOT the gold complete-toggle. (Pre-fix the row showed both,
          which made every row read as having two checkboxes side by
          side — confusing.) Outside select mode, only the gold
          complete-toggle shows. One mode, one checkbox per row. */}
      {selectMode ? (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(task)}
          aria-label={`Select task ${task.title}`}
          className="w-4 h-4 rounded border-border accent-rose-500 cursor-pointer"
        />
      ) : (
        <input
          type="checkbox"
          checked={done}
          onChange={() => onToggle(task)}
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
      {task.due_date && !confirmDelete && (
        <span className="text-[10px] text-text-light tabular-nums shrink-0 inline-flex items-center gap-1">
          <CalendarIcon size={10} aria-hidden="true" />
          {formatDueShort(task.due_date)}
        </span>
      )}
      {/* Per-row actions — Edit + Trash hidden until hover so the row
          stays clean on glance. Suppressed in select mode so the bulk
          bar is the one place the admin acts from. */}
      {!selectMode && !confirmDelete && (
        <>
          <button
            type="button"
            onClick={() => onEdit(task)}
            title={`Edit "${task.title}"`}
            aria-label={`Edit ${task.title}`}
            className="p-1.5 rounded-lg text-text-muted opacity-0 group-hover:opacity-100 hover:bg-surface hover:text-gold transition-all focus-ring"
          >
            <Edit2 size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            title={`Delete "${task.title}"`}
            aria-label={`Delete ${task.title}`}
            className="p-1.5 rounded-lg text-text-muted opacity-0 group-hover:opacity-100 hover:bg-rose-500/15 hover:text-rose-300 transition-all focus-ring"
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        </>
      )}
      {/* Inline rose-filled "Confirm delete" pill replaces the trash
          icon on first click. Same shape + shadow as the bulk Delete
          confirm. Auto-resets after 4s. */}
      {!selectMode && confirmDelete && (
        <>
          <button
            type="button"
            onClick={() => {
              setConfirmDelete(false)
              onDelete(task)
            }}
            aria-label={`Confirm delete ${task.title}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-500/80 text-white hover:brightness-110 shadow-[0_4px_12px_rgba(244,63,94,0.25)]"
          >
            <Trash2 size={11} aria-hidden="true" />
            Confirm delete
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            aria-label="Cancel delete"
            className="p-1 rounded-md text-text-muted hover:text-text"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  )
})

function formatDueShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(d)
  due.setHours(0, 0, 0, 0)
  if (due.getTime() === today.getTime()) return 'Today'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Single-task edit modal ─────────────────────────────────────────
//
// Smaller than AdminEditTasksModal — opens scoped to ONE task. Hits
// `admin_update_assigned_task` directly. Title / description /
// category / due date are the editable fields, matching the admin
// RPC's payload shape.

function SingleTaskEditModal({
  task,
  onClose,
  onSaved,
}: {
  task: AssignedTask
  onClose: () => void
  onSaved: (updated: AssignedTask) => void
}) {
  const { toast } = useToast()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [category, setCategory] = useState<string>(task.category ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ?? '')

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof adminUpdateAssignedTask>[1] = {}
      if (title.trim() !== task.title) {
        payload.title = title.trim()
      }
      const trimmedDesc = description.trim()
      const currentDesc = task.description ?? ''
      if (trimmedDesc !== currentDesc) {
        if (trimmedDesc) payload.description = trimmedDesc
        else payload.clearDescription = true
      }
      const currentCategory = task.category ?? ''
      if (category !== currentCategory) {
        if (category) payload.category = category
        else payload.clearCategory = true
      }
      const currentDue = task.due_date ?? ''
      if (dueDate !== currentDue) {
        if (dueDate) payload.due_date = dueDate
        else payload.clearDue = true
      }
      return adminUpdateAssignedTask(task.id, payload)
    },
    onSuccess: (updated) => {
      toast('Task updated')
      onSaved(updated)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-surface rounded-2xl border border-border w-full max-w-lg mx-4 p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text">Edit task</h2>
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
            id="edit-task-title"
            label="Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div>
            <label
              htmlFor="edit-task-description"
              className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5"
            >
              Description
            </label>
            <textarea
              id="edit-task-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm placeholder:text-text-light focus:border-gold focus:outline-none resize-y"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-task-category"
                className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5"
              >
                Flywheel stage
              </label>
              <select
                id="edit-task-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
              >
                <option value="">—</option>
                <option value="deliver">Deliver</option>
                <option value="capture">Capture</option>
                <option value="share">Share</option>
                <option value="attract">Attract</option>
                <option value="book">Book</option>
              </select>
            </div>
            <Input
              id="edit-task-due"
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
            Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Save-as-Template modal ─────────────────────────────────────────
//
// Take the selected member's CURRENT tasks and crystallise them as
// a new `task_template`. Loops `add_task_template_item` for each
// task, copying title / description / category. Completion state +
// task ids don't carry over (templates are blueprints, not state).

function SaveAsTemplateModal({
  tasks,
  memberName,
  onClose,
  onSaved,
}: {
  tasks: AssignedTask[]
  memberName: string
  onClose: () => void
  onSaved: (templateName: string) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(`${memberName}'s tasks`)
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
      onSaved(name.trim())
    } catch (err) {
      toast(`Save failed: ${(err as Error).message}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-surface rounded-2xl border border-border w-full max-w-lg mx-4 p-6 shadow-2xl animate-fade-in"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-text">Save as Template</h2>
            <p className="text-[12px] text-text-muted mt-0.5">
              Snapshots {tasks.length} task{tasks.length === 1 ? '' : 's'} into a reusable
              template.
            </p>
          </div>
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
            id="sat-name"
            label="Template name"
            required
            placeholder="e.g. Engineer Onboarding"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            id="sat-description"
            label="Description"
            placeholder="Optional"
            value={description ?? ''}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div>
            <label
              htmlFor="sat-role"
              className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5"
            >
              <Tag size={11} className="inline-block mr-1" aria-hidden="true" />
              Role tag
            </label>
            <select
              id="sat-role"
              value={roleTag}
              onChange={(e) => setRoleTag(e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
            >
              <option value="">No role</option>
              <option value="engineer">Engineer</option>
              <option value="marketing">Marketing</option>
              <option value="media">Media</option>
              <option value="intern">Intern</option>
              <option value="dev">Dev</option>
              <option value="admin">Admin</option>
              <option value="ops">Ops</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-5 mt-5 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            loading={submitting}
            disabled={!name.trim()}
          >
            Save template
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Template-preview-before-apply modal (PR #53) ──────────────────
//
// Opens when the admin picks a template from the "Templates ▾"
// dropdown. Shows every item in the template with a checkbox so the
// admin can uncheck items they don't want to assign. Defaults to all
// checked. Submit calls `assignTemplateItemsToMembers` with the
// selected subset, scoped to the currently-selected member.

function TemplatePreviewBeforeApplyModal({
  template,
  memberId,
  memberName,
  onClose,
  onApplied,
}: {
  template: TaskTemplateLibraryEntry
  memberId: string
  memberName: string
  onClose: () => void
  onApplied: (taskCount: number) => void
}) {
  const { toast } = useToast()
  const detailQuery = useQuery({
    queryKey: taskTemplateKeys.detail(template.id),
    queryFn: () => fetchTaskTemplateDetail(template.id),
  })
  const items = detailQuery.data?.items ?? []
  // Default: all items checked. Admin unchecks what they don't want.
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  // Once the items load, populate the selection set with all of them.
  useEffect(() => {
    if (items.length === 0) return
    setSelectedItemIds((prev) =>
      prev.size === 0 ? new Set(items.map((i) => i.id)) : prev,
    )
  }, [items])

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAll = () => setSelectedItemIds(new Set(items.map((i) => i.id)))
  const selectNone = () => setSelectedItemIds(new Set())

  const applyMutation = useMutation({
    mutationFn: () =>
      assignTemplateItemsToMembers(
        template.id,
        Array.from(selectedItemIds),
        [memberId],
      ),
    onSuccess: (summary) => {
      onApplied(summary.task_count)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const allChecked = items.length > 0 && selectedItemIds.size === items.length
  const noneChecked = selectedItemIds.size === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-surface rounded-2xl border border-border w-full max-w-lg mx-4 shadow-2xl animate-fade-in flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-preview-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 id="template-preview-title" className="text-lg font-bold text-text">
              {template.name}
            </h2>
            <p className="text-[12px] text-text-muted mt-0.5">
              Pick which tasks to add to{' '}
              <span className="font-semibold text-text">{memberName}</span>.
              {template.role_tag && (
                <span> Tagged <span className="text-gold">{template.role_tag}</span>.</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3">
          {detailQuery.isLoading ? (
            <div className="py-10 flex items-center justify-center text-text-light">
              <Loader2 size={18} className="animate-spin mr-2" />
              Loading template…
            </div>
          ) : detailQuery.error ? (
            <div className="py-6 px-4 flex items-start gap-2 text-amber-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Could not load template</p>
                <p className="text-xs text-text-light mt-0.5">
                  {(detailQuery.error as Error).message}
                </p>
              </div>
            </div>
          ) : items.length === 0 ? (
            <p className="text-[13px] text-text-light italic px-4 py-8 text-center">
              This template has no items yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((it) => {
                const selected = selectedItemIds.has(it.id)
                return (
                  <li key={it.id}>
                    <label className="flex items-start gap-3 px-3 py-2 rounded-xl hover:bg-surface-hover transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleItem(it.id)}
                        className="mt-0.5 w-4 h-4 rounded border-border accent-gold cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] ${selected ? 'text-text font-medium' : 'text-text-light line-through'}`}>
                          {it.title}
                        </p>
                        {it.description && (
                          <p className="text-[11px] text-text-light mt-0.5 line-clamp-2">
                            {it.description}
                          </p>
                        )}
                        {it.category && (
                          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-surface text-[10px] text-text-muted">
                            <Tag size={9} aria-hidden="true" />
                            {it.category}
                          </span>
                        )}
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-4 border-t border-border shrink-0 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-text-muted">
              {selectedItemIds.size} of {items.length} selected
            </span>
            <div className="ml-auto flex items-center gap-2">
              {allChecked ? (
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  Uncheck all
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Check all
                </Button>
              )}
              <Button variant="ghost" onClick={onClose} disabled={applyMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => applyMutation.mutate()}
                loading={applyMutation.isPending}
                disabled={noneChecked}
                iconLeft={!applyMutation.isPending ? <Plus size={14} aria-hidden="true" /> : undefined}
              >
                {`Apply ${selectedItemIds.size} task${selectedItemIds.size === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
