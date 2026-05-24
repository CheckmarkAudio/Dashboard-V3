import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Edit2,
  Hourglass,
  Inbox,
  Loader2,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { setUserPreference } from '../../lib/preferences'
import { useAuth } from '../../contexts/AuthContext'
import { completeAssignedTask, fetchMemberAssignedTasks } from '../../lib/queries/assignments'
import {
  cancelMyTaskRequest,
  fetchMyTaskRequests,
  taskRequestKeys,
  type MyTaskRequest,
} from '../../lib/queries/taskRequests'
import { useToast } from '../Toast'
import {
  fetchMyOutgoingPendingReassignRequests,
  taskReassignKeys,
} from '../../lib/queries/taskReassign'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import { supabase } from '../../lib/supabase'
import type { AssignedTask } from '../../types/assignments'
import type { TeamMember } from '../../types'
import {
  CompletedToggle,
  PriorityToggle,
  SourcePill,
  SubmitBar,
  formatDueShort,
  formatShortName,
  rolePositionFor,
  isSelfAssigned,
} from './shared'
import TaskRequestModal from './requests/TaskRequestModal'
import TaskDetailModal from './TaskDetailModal'

// PR #69 — assignment-source filter. "Self" means the user pressed the
// button themselves (assigner === assignee). "Assigned" means someone
// else (admin or task-request approver) put it in their queue.
type SourceFilter = 'all' | 'assigned' | 'self'

interface MyTasksCardProps {
  embedded?: boolean
}

const HIGHLIGHT_EVENT = 'highlight-task'
const HIGHLIGHT_DURATION_MS = 1600

// 2026-05-02 — pending-state shape per task id. A task can have
// EITHER a pending transfer offer (caller wants to hand off) OR a
// pending delete request (caller asked admin to delete) or pending
// edit request (caller asked admin to apply field changes) — never
// more than one, because the server validations would reject extras.
type PendingKind = 'transfer' | 'delete' | 'edit'
interface PendingMeta {
  kind: PendingKind
  // Targeted recipient name for the transfer; null for delete + edit (admin).
  otherPartyName?: string | null
  // Set for kind='delete'/'edit' (rows from task_requests) so the
  // row's hover-X cancel button can call cancel_my_task_request.
  // Null for kind='transfer' — transfer cancel ships separately.
  requestId?: string | null
}

export default function MyTasksCard({ embedded = false }: MyTasksCardProps = {}) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const realtimeTopicRef = useRef(`my-tasks:${crypto.randomUUID()}`)
  const [showCompleted, setShowCompleted] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  // PR #69 — replaces the stage filter (deferred to the flywheel-event-
  // ledger PR where stages will surface as real KPIs). Splits My Tasks
  // by who put the task in the queue: someone else (admin / approver)
  // vs the user themselves.
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  // 2026-05-17 (Task tweaks PR) — Priority filter, per-session. When
  // on, only is_required tasks render. Stacks with sourceFilter.
  const [priorityOnly, setPriorityOnly] = useState(false)
  // 2026-05-17 (Task tweaks PR) — User-defined task order. Seeded
  // once from `team_members.preferences.my_tasks_order` on profile
  // load; every drag-end mutates this in-memory + fires a
  // debounced DB write so the order follows the user across devices
  // (same pattern as `useWorkspaceLayout`).
  const [savedOrder, setSavedOrder] = useState<string[]>(() => {
    const fromPrefs = (profile?.preferences as Record<string, unknown> | null)?.['my_tasks_order']
    return Array.isArray(fromPrefs) ? (fromPrefs.filter((v) => typeof v === 'string') as string[]) : []
  })
  // Track which user we hydrated for so a profile swap doesn't keep
  // the previous user's order in state.
  const hydratedForUserId = useRef<string | null>(profile?.id ?? null)
  useEffect(() => {
    if (!profile?.id) return
    if (hydratedForUserId.current === profile.id) return
    hydratedForUserId.current = profile.id
    const fromPrefs = (profile.preferences as Record<string, unknown> | null)?.['my_tasks_order']
    setSavedOrder(
      Array.isArray(fromPrefs) ? (fromPrefs.filter((v) => typeof v === 'string') as string[]) : [],
    )
  }, [profile?.id, profile?.preferences])
  // Debounced DB persistence so a burst of drag-end swaps becomes
  // one PATCH (mirrors `useWorkspaceLayout`'s 500ms timer).
  const orderWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistOrder = (next: string[]) => {
    setSavedOrder(next)
    if (!profile?.id) return
    if (orderWriteTimer.current) clearTimeout(orderWriteTimer.current)
    orderWriteTimer.current = setTimeout(() => {
      void setUserPreference(profile.id, 'my_tasks_order', next)
    }, 500)
  }
  useEffect(() => () => {
    if (orderWriteTimer.current) clearTimeout(orderWriteTimer.current)
  }, [])

  // Dnd-kit sensors. Pointer needs a small distance threshold so
  // click-to-open-detail still fires on a quick tap (anything < 5px
  // counts as a click). Keyboard sensor lifted from WorkspacePanel
  // for sortable a11y.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  // PR #37 — pending → Submit pattern. Checking a box adds the task
  // id to this set (visual state only, no RPC). Submit Completed
  // button commits all queued ids in parallel.
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())
  // PR #25 — click task body (not checkbox) opens this detail modal.
  // 2026-05-23 — `detailInitial` pre-selects which composer opens
  // inside the modal (Edit / Delete) so a row-level shortcut button
  // drops the user straight into the right form. null = open in
  // read-only summary mode (existing behavior for body clicks).
  const [detailTask, setDetailTask] = useState<AssignedTask | null>(null)
  const [detailInitial, setDetailInitial] = useState<null | 'edit' | 'delete'>(null)
  const openDetail = useCallback((task: AssignedTask, initial: null | 'edit' | 'delete' = null) => {
    setDetailInitial(initial)
    setDetailTask(task)
  }, [])
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Outgoing task_requests — covers the user's pending New Task
  // requests (kind='create') AND the user's pending Delete requests
  // (kind='delete', target_task_id refs an existing assigned_task).
  const myRequestsQuery = useQuery({
    queryKey: taskRequestKeys.mine(),
    queryFn: () => fetchMyTaskRequests(20),
    enabled: Boolean(profile?.id),
    refetchInterval: 90_000,
    staleTime: 30_000,
  })
  const myRequests = myRequestsQuery.data ?? []

  // 2026-05-02 — outgoing pending reassign requests so MyTasksCard
  // can mark tasks the user has offered to hand off to a teammate.
  // Filtered server-side to status='pending' and to the OUTGOING
  // direction the caller initiated.
  const myOutgoingReassignsQuery = useQuery({
    queryKey: taskReassignKeys.outgoing(),
    queryFn: fetchMyOutgoingPendingReassignRequests,
    enabled: Boolean(profile?.id),
    staleTime: 30_000,
  })
  const myOutgoingReassigns = myOutgoingReassignsQuery.data ?? []

  const cacheKey = ['assigned-tasks', profile?.id ?? 'none'] as const
  const tasksQuery = useQuery({
    queryKey: cacheKey,
    queryFn: () => fetchMemberAssignedTasks(profile!.id, { includeCompleted: true }),
    enabled: Boolean(profile?.id),
    refetchInterval: 60_000,
  })

  useEffect(() => {
    if (!profile?.id) return
    const sub = supabase
      .channel(`${realtimeTopicRef.current}:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assigned_tasks',
          filter: `assigned_to=eq.${profile.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: cacheKey })
        },
      )
      // 2026-05-02 — also listen to the user's own task_requests +
      // task_reassign_requests so the divider/pending section updates
      // live when admin approves/declines or a peer accepts/declines.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_requests' },
        () => {
          void queryClient.invalidateQueries({ queryKey: taskRequestKeys.mine() })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_reassign_requests' },
        () => {
          void queryClient.invalidateQueries({ queryKey: taskReassignKeys.outgoing() })
          void queryClient.invalidateQueries({ queryKey: taskReassignKeys.incoming() })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(sub)
    }
  }, [profile?.id, queryClient])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ taskId?: string; batchId?: string }>).detail
      if (!detail) return
      let targetId: string | null = null
      if (detail.taskId) {
        targetId = detail.taskId
      } else if (detail.batchId) {
        const match = (tasksQuery.data ?? []).find((task) => task.batch?.id === detail.batchId)
        targetId = match?.id ?? null
      }
      if (!targetId) return
      setHighlightedId(targetId)
      rowRefs.current.get(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(() => setHighlightedId(null), HIGHLIGHT_DURATION_MS)
    }

    window.addEventListener(HIGHLIGHT_EVENT, handler)
    return () => window.removeEventListener(HIGHLIGHT_EVENT, handler)
  }, [tasksQuery.data])

  // PR #37 — batch-submit mutation. Takes an array of {id, next}
  // pairs and fires completeAssignedTask for each in parallel.
  // Triggered by the Submit Completed button when pendingIds is
  // non-empty. Individual checkbox clicks no longer fire an RPC —
  // they just toggle membership in `pendingIds`.
  const submitMutation = useMutation({
    mutationFn: async (toggles: { taskId: string; next: boolean }[]) => {
      await Promise.all(
        toggles.map((t) => completeAssignedTask(t.taskId, t.next)),
      )
    },
    onMutate: (toggles) => {
      // Optimistic cache update so rows flip immediately.
      queryClient.setQueryData<AssignedTask[]>(cacheKey, (previous) => {
        if (!previous) return previous
        const byId = new Map(toggles.map((t) => [t.taskId, t.next]))
        return previous.map((task) =>
          byId.has(task.id)
            ? {
                ...task,
                is_completed: byId.get(task.id)!,
                completed_at: byId.get(task.id) ? new Date().toISOString() : null,
              }
            : task,
        )
      })
    },
    onSuccess: () => {
      setPendingIds(new Set())
      // PR #28 — refresh team + studio caches so the Flywheel widget
      // picks up completion state changes.
      void queryClient.invalidateQueries({ queryKey: cacheKey })
      void queryClient.invalidateQueries({ queryKey: ['team-assigned-tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['studio-assigned-tasks'] })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: cacheKey })
    },
  })

  const { openTasks, doneTasks } = useMemo(() => {
    const tasks = tasksQuery.data ?? []
    const open = tasks.filter((task) => !task.is_completed)
    const done = tasks.filter((task) => task.is_completed)

    // 2026-05-17 (Task tweaks PR) — sort honors the user's saved
    // drag order first; only tasks NOT in the saved order fall back
    // to the historic auto-sort (priority → due → newness). New
    // assignments (not yet in the user's saved order) bubble to the
    // TOP so the user notices them, then settle into their preferred
    // spot once the user drags them.
    const orderIndex = new Map<string, number>()
    savedOrder.forEach((id, idx) => orderIndex.set(id, idx))
    open.sort((a, b) => {
      const aIdx = orderIndex.get(a.id)
      const bIdx = orderIndex.get(b.id)
      // Both saved → respect saved order.
      if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx
      // Only one saved → unsaved (new) wins to the top.
      if (aIdx === undefined && bIdx !== undefined) return -1
      if (bIdx === undefined && aIdx !== undefined) return 1
      // Neither saved → original fallback sort (priority → due → newness).
      if (a.is_required !== b.is_required) return a.is_required ? -1 : 1
      const aDue = a.due_date ?? '9999-12-31'
      const bDue = b.due_date ?? '9999-12-31'
      if (aDue !== bDue) return aDue.localeCompare(bDue)
      return (b.batch?.created_at ?? '').localeCompare(a.batch?.created_at ?? '')
    })

    done.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    return { openTasks: open, doneTasks: done }
  }, [tasksQuery.data, savedOrder])

  // PR #69 — team_members lookup so each row can show the assignee's
  // role (e.g. [marketing], [engineer]) instead of "from {template}".
  // Cached for 60s; reused across MemberHighlights / TeamManager.
  const membersQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
    staleTime: 60_000,
  })
  const memberMap = useMemo(() => {
    const m = new Map<string, TeamMember>()
    for (const member of membersQuery.data ?? []) m.set(member.id, member)
    return m
  }, [membersQuery.data])

  // 2026-05-02 — derive pending-state map from the two request
  // queries. Each task can have at most one pending state (transfer
  // OR delete; server enforces this). Transfer takes precedence in
  // the (impossible) collision since it has a richer body line.
  const pendingByTask = useMemo(() => {
    const map = new Map<string, PendingMeta>()
    for (const r of myOutgoingReassigns) {
      if (r.direction !== 'transfer') continue
      map.set(r.task_id, { kind: 'transfer', otherPartyName: r.other_party_name })
    }
    for (const r of myRequests) {
      if (r.kind !== 'delete' && r.kind !== 'edit') continue
      if (r.status !== 'pending') continue
      if (!r.target_task_id) continue
      if (map.has(r.target_task_id)) continue
      map.set(r.target_task_id, { kind: r.kind, otherPartyName: null, requestId: r.id })
    }
    return map
  }, [myOutgoingReassigns, myRequests])

  // Pending NEW task requests — the member asked admin to add a task,
  // pending approval. No materialized assigned_task row exists yet,
  // so these render as their own row type below the divider.
  const pendingNewRequests = useMemo(
    () => myRequests.filter((r) => r.kind === 'create' && r.status === 'pending'),
    [myRequests],
  )

  // PR #69 — assigned/self counts driving the filter pill row.
  const sourceCounts = useMemo(() => {
    const c: Record<SourceFilter, number> = { all: openTasks.length, assigned: 0, self: 0 }
    for (const t of openTasks) {
      if (isSelfAssigned(t)) c.self++
      else c.assigned++
    }
    return c
  }, [openTasks])

  const preFilterVisible = showCompleted ? [...openTasks, ...doneTasks] : openTasks
  const sourceFilteredVisible =
    sourceFilter === 'all'
      ? preFilterVisible
      : sourceFilter === 'self'
        ? preFilterVisible.filter((t) => isSelfAssigned(t))
        : preFilterVisible.filter((t) => !isSelfAssigned(t))

  // 2026-05-17 (Task tweaks PR) — Priority count + filter.
  // Count is computed against the source-filtered list so it always
  // reflects "priority within the current view," not the raw archive.
  const priorityVisibleCount = useMemo(
    () => sourceFilteredVisible.filter((t) => t.is_required).length,
    [sourceFilteredVisible],
  )
  const visibleTasks = priorityOnly
    ? sourceFilteredVisible.filter((t) => t.is_required)
    : sourceFilteredVisible

  // Split into active vs pending — pending rows render dimmer below
  // a divider so the user's working list stays focused on what's
  // actionable right now.
  const { activeVisibleTasks, pendingVisibleTasks } = useMemo(() => {
    const active: AssignedTask[] = []
    const pending: AssignedTask[] = []
    for (const t of visibleTasks) {
      if (pendingByTask.has(t.id)) pending.push(t)
      else active.push(t)
    }
    return { activeVisibleTasks: active, pendingVisibleTasks: pending }
  }, [visibleTasks, pendingByTask])

  // 2026-05-17 (Task tweaks PR) — drag-end handler for the active
  // task list. Computes the new visible order via `arrayMove`, then
  // splices that subset back into `savedOrder` at the positions
  // currently occupied by visible task ids. Tasks that are filtered
  // out (priority off / source filter / completed eye off) keep
  // their relative position in the saved order so toggling a filter
  // off later reveals them in the same spot the user remembered.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const visibleIds = activeVisibleTasks.map((t) => t.id)
    const oldIndex = visibleIds.indexOf(String(active.id))
    const newIndex = visibleIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const newVisibleOrder = arrayMove(visibleIds, oldIndex, newIndex)

    // Splice the rearranged visible-subset back into the full saved
    // order. Start from the current canonical sort (openTasks order,
    // which already honors savedOrder + new-task-bubble-up) so that
    // brand-new tasks not yet in savedOrder also get a stable spot
    // after the first drag.
    const visibleSet = new Set(visibleIds)
    const canonical = openTasks.map((t) => t.id) // includes filtered + unfiltered, in current display order
    const iter = newVisibleOrder[Symbol.iterator]()
    const nextOrder: string[] = []
    for (const id of canonical) {
      if (visibleSet.has(id)) {
        const n = iter.next()
        if (!n.done) nextOrder.push(n.value)
      } else {
        nextOrder.push(id)
      }
    }
    persistOrder(nextOrder)
  }

  // The pending section appears whenever there's anything in it —
  // either a task with an outgoing pending request, or a brand-new
  // task request awaiting admin approval. Hidden otherwise so an
  // empty divider doesn't add noise.
  const hasAnyPending = pendingVisibleTasks.length > 0 || pendingNewRequests.length > 0

  // 2026-05-13 — old `addTaskRow` (duplicate empty-state button)
  // removed. The toolbar at the top of the widget always renders
  // the "+ Task" CTA, so a second button inside the empty state
  // was a duplicate users mistook for two different actions.

  // PR #37 — pending toggle. Adding the id to the set flips the row's
  // visual check state; removing it unqueues. No RPC until Submit.
  const togglePending = (taskId: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  // Commit all queued completions. For each pending id, target state
  // is the opposite of the current is_completed (so a user can queue
  // un-completes too if they check off a done row with show-completed
  // on).
  const submitPending = () => {
    if (pendingIds.size === 0) return
    const currentTasks = tasksQuery.data ?? []
    const toggles = Array.from(pendingIds).map((id) => {
      const t = currentTasks.find((x) => x.id === id)
      return { taskId: id, next: !(t?.is_completed ?? false) }
    })
    submitMutation.mutate(toggles)
  }

  // Sticky bottom footer — two rows:
  //   - SubmitBar (greyed when pendingIds empty, gold when queued)
  //   - + Task · Show-completed eye
  // 2026-05-13 (rev) — toolbar holds ONLY the Submit Completed bar
  // at the top; the +New Task CTA moved to its own footer at the
  // bottom of the widget per user direction ("lets put new task at
  // the bottom of the widget"). Rationale: SubmitBar is reactive
  // (only matters when checks are queued), so it stays high in the
  // visual hierarchy. +New Task is a creation affordance — natural
  // home is below the existing list, like an inbox compose row.
  const toolbar = (
    <div className="shrink-0 mb-2">
      <SubmitBar
        count={pendingIds.size}
        isSubmitting={submitMutation.isPending}
        onClick={submitPending}
      />
    </div>
  )

  // Footer: outlined-gold +New Task button, anchored below the
  // task list. Style matches the Sessions page's "Manage Bookings"
  // button (lined-gold) so it reads as a secondary creation
  // action — distinct from SubmitBar's filled-gold commit pill.
  const footer = (
    <div className="shrink-0 mt-2">
      <button
        type="button"
        onClick={() => setRequestModalOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 h-9 px-3 rounded-xl border-2 border-gold-muted bg-gold/12 text-gold text-[13px] font-bold tracking-tight hover:bg-gold/20 hover:border-gold transition-colors focus-ring"
        aria-label="Request a new task"
      >
        <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
        New Task
      </button>
    </div>
  )

  const body = (
    <>
      {/* Toolbar (formerly footer). Submit Completed bar + Task
          create + show-completed eye live at the TOP of the widget
          now so the +Task affordance is visible without scrolling. */}
      {toolbar}

      {/* 2026-05-17 (Task tweaks rev3) — all filter affordances on a
          single row. The 3 SourcePills are rendered INLINE (not via
          SourceFilterRow) so they're flex siblings of the eye +
          Priority pill — otherwise SourceFilterRow's wrapper div
          becomes one wide flex item that gets pushed to its own
          line. "Self Assigned" shortened to "Self" so the full row
          fits comfortably in the narrow widget column. Due header
          uses `ml-auto` so it always anchors to the right edge. */}
      <div className="shrink-0 flex items-center gap-1.5 px-2 mb-1 flex-wrap">
        <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((value) => !value)} />
        <PriorityToggle
          active={priorityOnly}
          count={priorityVisibleCount}
          onToggle={() => setPriorityOnly((v) => !v)}
        />
        <SourcePill label="All" count={sourceCounts.all} active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')} />
        <SourcePill label="Assigned" count={sourceCounts.assigned} active={sourceFilter === 'assigned'} onClick={() => setSourceFilter('assigned')} />
        <SourcePill label="Self" count={sourceCounts.self} active={sourceFilter === 'self'} onClick={() => setSourceFilter('self')} />
        <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.08em] text-gold/70 whitespace-nowrap">
          Due
        </span>
      </div>

      {/* Skin pass 2026-05-06 — wrap the scrollable task list in
          `.inset-panel` (matches booking + Task Requests + Notifications).
          Inside, `divide-y divide-theme` provides hairline separators
          between every direct child — rows, section eyebrows
          (COMPLETED, PENDING), and the wrapping divs around active
          tasks. The `space-y-1.5` gap is dropped so rows sit flush
          with hairlines between them, like the booking table. Each
          AssignedTaskRow and PendingCreateRequestRow had its own
          `rounded-xl border border-transparent` card chrome flattened
          to flat row + theme-aware bg-tint state. */}
      <div className="flex-1 min-h-0 inset-panel">
        <div className="h-full overflow-y-auto divide-y divide-theme">
        {tasksQuery.isLoading ? (
          <div className="h-full flex items-center justify-center text-text-light py-6">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : tasksQuery.error ? (
          <div className="flex items-center gap-2 text-[13px] text-amber-300 px-2 py-4">
            <AlertCircle size={16} className="shrink-0" />
            <span>{(tasksQuery.error as Error).message}</span>
          </div>
        ) : activeVisibleTasks.length === 0 && !hasAnyPending ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-6">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold/10 ring-1 ring-gold/20 mb-2">
              <Inbox size={18} className="text-gold" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-medium text-text">
              {openTasks.length === 0 && doneTasks.length > 0 ? 'All done' : 'No tasks yet'}
            </p>
            <p className="text-[12px] text-text-light mt-0.5">
              {openTasks.length === 0 && doneTasks.length > 0
                ? 'Toggle to review completed work.'
                : 'Use "+ New Task" above to request your first one. Assigned work also lands here automatically.'}
            </p>
          </div>
        ) : (
          <>
            {/* 2026-05-17 (Task tweaks PR) — Active tasks now sit
                inside a SortableContext + DndContext so admins +
                members can drag-reorder. Drag handle is a small
                grip on the left edge of each row (group-hover for
                visibility — doesn't compete with the existing
                click-to-open-detail behavior). Saved per-user to
                `team_members.preferences.my_tasks_order`. */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={activeVisibleTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {activeVisibleTasks.map((task) => {
                  const separatorBefore =
                    showCompleted &&
                    task.is_completed &&
                    openTasks.length > 0 &&
                    task.id === doneTasks[0]?.id
                  return (
                    <SortableAssignedTaskRow
                      key={task.id}
                      task={task}
                      separatorBefore={separatorBefore}
                      highlighted={highlightedId === task.id}
                      isPending={pendingIds.has(task.id)}
                      onToggle={(nextTask) => togglePending(nextTask.id)}
                      onOpenDetail={(nextTask) => openDetail(nextTask)}
                      onRequestEdit={(nextTask) => openDetail(nextTask, 'edit')}
                      onRequestDelete={(nextTask) => openDetail(nextTask, 'delete')}
                      rowRef={(node) => {
                        if (node) rowRefs.current.set(task.id, node)
                        else rowRefs.current.delete(task.id)
                      }}
                      memberMap={memberMap}
                    />
                  )
                })}
              </SortableContext>
            </DndContext>

            {/* 2026-05-02 — Pending section.
                Divider with PENDING eyebrow; below: tasks with a
                pending outgoing request (transfer / delete) at 60%
                opacity + status badge, then any pending NEW task
                requests (no materialized task yet). The whole block
                is hidden when nothing is pending. */}
            {hasAnyPending && (
              <>
                <div className="mx-2 my-2 flex items-center gap-2">
                  <Hourglass size={11} className="text-amber-300/80" aria-hidden="true" />
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-amber-300/80 uppercase">
                    Pending
                  </p>
                  <div className="flex-1 h-px bg-white/[0.05]" aria-hidden="true" />
                </div>

                {pendingVisibleTasks.map((task) => (
                  <AssignedTaskRow
                    key={task.id}
                    task={task}
                    highlighted={highlightedId === task.id}
                    isPending={pendingIds.has(task.id)}
                    pendingMeta={pendingByTask.get(task.id) ?? null}
                    onToggle={(nextTask) => togglePending(nextTask.id)}
                    onOpenDetail={(nextTask) => openDetail(nextTask)}
                    rowRef={(node) => {
                      if (node) rowRefs.current.set(task.id, node)
                      else rowRefs.current.delete(task.id)
                    }}
                    memberMap={memberMap}
                  />
                ))}

                {pendingNewRequests.map((req) => (
                  <PendingCreateRequestRow key={req.id} request={req} />
                ))}
              </>
            )}
          </>
        )}
        </div>
      </div>

      {/* 2026-05-13 (rev) — +New Task footer pinned BELOW the task
          list. The SubmitBar still anchors the top via {toolbar}. */}
      {footer}
    </>
  )

  // MyTasksCard is only ever mounted inside a DashboardWidgetFrame
  // (team_tasks widget on Overview + Tasks). The `embedded` prop used
  // to switch between a standalone `<Card>` chrome vs widget-embedded
  // body; no caller uses the non-embedded path anymore so we drop it.
  void embedded
  return (
    <>
      <div className="flex flex-col h-full min-h-0">{body}</div>
      {requestModalOpen && <TaskRequestModal onClose={() => setRequestModalOpen(false)} />}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          initialCompose={detailInitial}
          onClose={() => {
            setDetailTask(null)
            setDetailInitial(null)
          }}
        />
      )}
    </>
  )
}

/**
 * 2026-05-02 — Row variant for a pending NEW task request that
 * doesn't have a materialized assigned_task row yet. Same dimmer
 * visual rhythm as a pending-state assigned task; rejected requests
 * stay visible so the member can read the admin's note.
 */
function PendingCreateRequestRow({ request }: { request: MyTaskRequest }) {
  const isRejected = request.status === 'rejected'
  const isPending = request.status === 'pending'
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const cancelMutation = useMutation({
    mutationFn: () => cancelMyTaskRequest(request.id),
    onSuccess: () => {
      toast('Request cancelled.', 'success')
      void queryClient.invalidateQueries({ queryKey: taskRequestKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['admin-log'] })
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Cancel failed', 'error'),
  })
  useEffect(() => {
    if (!cancelConfirm) return
    const id = window.setTimeout(() => setCancelConfirm(false), 4000)
    return () => window.clearTimeout(id)
  }, [cancelConfirm])

  // Mirror AssignedTaskRow's pending shape so create / edit / delete
  // pending rows all read with the same rhythm: leading 18px square +
  // title + status badge + optional cancel pill + due-date column.
  const dueLabel = formatDueShort(request.due_date)

  return (
    <div className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-3 py-2 bg-surface-alt/40 hover:bg-surface-hover transition-colors">
      {/* Leading square — visually substitutes for the row's normal
          checkbox. Plus icon (amber) for pending; Hourglass (rose)
          for rejected — same colors as the badge for consistency. */}
      <span
        className={`shrink-0 w-[18px] h-[18px] mt-[2px] rounded-md flex items-center justify-center ${
          isRejected
            ? 'bg-rose-500/15 ring-1 ring-rose-500/30 text-rose-300'
            : 'bg-amber-500/15 ring-1 ring-amber-500/30 text-amber-300'
        }`}
        aria-hidden="true"
      >
        {isRejected ? <Hourglass size={10} /> : <Plus size={10} strokeWidth={3} />}
      </span>

      <div className="min-w-0">
        <p
          className={`text-[13px] truncate ${
            isRejected ? 'text-text/80' : 'font-semibold text-text-muted'
          }`}
        >
          {request.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] flex-wrap">
          {isRejected ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 ring-1 ring-rose-500/30 text-rose-300 font-semibold">
              <Hourglass size={9} strokeWidth={2.5} aria-hidden="true" />
              Declined
              {request.reviewer_note && (
                <span className="font-normal italic text-rose-300/80 ml-1 truncate max-w-[18ch]">
                  · "{request.reviewer_note}"
                </span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 ring-1 ring-amber-500/30 text-amber-300 font-semibold">
              <Plus size={9} strokeWidth={3} aria-hidden="true" />
              Awaiting new task approval
            </span>
          )}
          {isPending && (
            cancelConfirm ? (
              <span className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white bg-rose-500/80 hover:brightness-110"
                >
                  {cancelMutation.isPending ? '…' : 'Cancel?'}
                </button>
                <button
                  type="button"
                  onClick={() => setCancelConfirm(false)}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-text-light hover:text-text"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setCancelConfirm(true)}
                aria-label="Cancel this request"
                title="Cancel this request"
                className="inline-flex items-center justify-center w-5 h-5 rounded text-rose-300/70 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 size={12} strokeWidth={2.25} aria-hidden="true" />
              </button>
            )
          )}
        </div>
      </div>

      {/* Right column matches AssignedTaskRow's due-date slot: real
          date if the requester set one, em-dash placeholder otherwise. */}
      <span
        className={`shrink-0 text-[12px] tabular-nums whitespace-nowrap mt-[2px] ${
          dueLabel ? 'text-text-muted' : 'text-text-light/40'
        }`}
      >
        {dueLabel ?? '—'}
      </span>
    </div>
  )
}

/**
 * 2026-05-17 (Task tweaks PR) — Sortable wrapper around
 * `AssignedTaskRow`. Renders a small left-edge grip handle (only
 * appears on row hover so it doesn't compete visually with the
 * checkbox + title in the resting state). The handle owns the
 * dnd-kit listeners; the rest of the row keeps the click-to-open-
 * detail behavior unchanged. `isPending` here is the
 * Submit-Completed queue state on the parent — distinct from the
 * mid-flight pending state used downstream. Pending mid-flight
 * tasks are routed through the OLD non-sortable render path so
 * users can't drag a row that's mid-request.
 */
function SortableAssignedTaskRow({
  task,
  separatorBefore,
  highlighted,
  isPending,
  onToggle,
  onOpenDetail,
  onRequestEdit,
  onRequestDelete,
  rowRef,
  memberMap,
}: {
  task: AssignedTask
  separatorBefore: boolean
  highlighted: boolean
  isPending: boolean
  onToggle: (task: AssignedTask) => void
  onOpenDetail: (task: AssignedTask) => void
  onRequestEdit: (task: AssignedTask) => void
  onRequestDelete: (task: AssignedTask) => void
  rowRef: (node: HTMLDivElement | null) => void
  memberMap: Map<string, TeamMember>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })
  // 2026-05-23 (rev) — drag listeners now attach to a DEDICATED handle
  // button on the right of each row (passed down via `dragHandleProps`)
  // instead of the whole row container. Earlier whole-row-draggable
  // pattern was causing accidental drags + click conflicts with the
  // body's modal-open onClick. The 5px PointerSensor threshold helped
  // but didn't eliminate the friction.
  //
  // The wrapper div keeps the hover-lift visual (CSS-only — no drag
  // intent) and the active-drag scale/shadow (driven by useSortable's
  // isDragging, independent of where the listeners live). Cursor on
  // the wrapper stays default; only the handle button gets cursor-grab.
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style} className="group/sortable">
      {separatorBefore && (
        <div className="mx-2 my-2 flex items-center gap-2">
          <CheckCircle2 size={11} className="text-emerald-400/70" aria-hidden="true" />
          <p className="text-[11px] font-semibold tracking-[0.06em] text-emerald-400/70">COMPLETED</p>
          <div className="flex-1 h-px bg-border" aria-hidden="true" />
        </div>
      )}
      <div
        className={`rounded-md transition-all duration-150 ease-out ${
          isDragging
            ? 'scale-[1.02] shadow-2xl ring-1 ring-gold/30 bg-surface'
            : 'hover:-translate-y-[1px] hover:shadow-md'
        }`}
      >
        <AssignedTaskRow
          task={task}
          highlighted={highlighted}
          isPending={isPending}
          pendingMeta={null}
          onToggle={onToggle}
          onOpenDetail={onOpenDetail}
          onRequestEdit={onRequestEdit}
          onRequestDelete={onRequestDelete}
          rowRef={rowRef}
          memberMap={memberMap}
          dragHandle={
            <button
              type="button"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Drag to reorder ${task.title}`}
              title="Drag to reorder"
              className="shrink-0 inline-flex flex-col items-center justify-center gap-[3px] w-5 h-6 rounded text-text-light/50 hover:text-text-muted hover:bg-surface-hover cursor-grab active:cursor-grabbing transition-colors focus-ring"
            >
              {/* Two stacked horizontal lines — classic reorder handle.
                  Per user: "two lines to visually show it". */}
              <span className="block w-3 h-[1.5px] rounded-full bg-current" aria-hidden="true" />
              <span className="block w-3 h-[1.5px] rounded-full bg-current" aria-hidden="true" />
            </button>
          }
        />
      </div>
    </div>
  )
}

function AssignedTaskRow({
  task,
  highlighted,
  isPending,
  pendingMeta,
  onToggle,
  onOpenDetail,
  onRequestEdit,
  onRequestDelete,
  rowRef,
  memberMap,
  dragHandle,
}: {
  task: AssignedTask
  highlighted: boolean
  isPending: boolean
  // 2026-05-02 — when set, render the row in the dimmer "pending"
  // state and show a status badge ("Awaiting transfer to X" /
  // "Awaiting admin to delete"). Disables the Submit-Completed
  // queue toggle since the task is mid-flight.
  pendingMeta: PendingMeta | null
  onToggle: (task: AssignedTask) => void
  onOpenDetail: (task: AssignedTask) => void
  // 2026-05-23 — hover-revealed inline Edit + Delete affordances.
  // Both pre-route through MyTasksCard's parent handler (which opens
  // TaskDetailModal in compose mode), so members get the existing
  // request-flow and admins get direct edit/delete — same logic the
  // modal has had since PR #97, just surfaced at the row level so
  // you don't have to open the modal first.
  onRequestEdit?: (task: AssignedTask) => void
  onRequestDelete?: (task: AssignedTask) => void
  rowRef: (node: HTMLDivElement | null) => void
  memberMap: Map<string, TeamMember>
  // 2026-05-23 — dedicated drag handle injected by the Sortable
  // wrapper. Rendered on the far right of the row so the row body
  // stays a clean click target for the modal-open flow. Only the
  // SortableAssignedTaskRow provides this; PendingAssignedTaskRow
  // and the pending list omit it (those rows aren't reorderable).
  dragHandle?: React.ReactNode
}) {
  const done = task.is_completed
  // Checkbox shows the pending-but-not-submitted state distinctly so
  // the user knows what they've queued. `checkVisual` is the visual
  // truth: true when either completed OR pending, false otherwise.
  const checkVisual = done !== isPending  // XOR: pending flips the visual
  const dueLabel = formatDueShort(task.due_date)
  // Skin pass 2026-05-06 — `isNew` (auto-tint rows whose batch was
  // created in the last 24h) removed per user feedback: there's no
  // surrounding UI explaining the gold tint, so it just looked like
  // random rows were highlighted. The transient `highlighted` flash
  // (notification-click → 1.6s gold ring) is preserved — that one
  // IS communicating something specific.

  // PR #69 — replaced "from {template}" / "Assigned directly" subtext
  // with the assignee's role tag (looked up from the team_members
  // cache by `assigned_to`) plus first-name + last-initial. Studio-
  // scope tasks keep their existing "Studio" pill on the title row, so
  // the subtext stays one line of metadata across all task widgets.
  const assignee = task.assigned_to ? memberMap.get(task.assigned_to) : undefined
  const roleLabel = rolePositionFor(assignee?.position)
  const shortName = formatShortName(task.assigned_to_name)

  // Toggling complete on a task that's mid-request would race with
  // the admin/peer's decision. Suppress the queue toggle for pending
  // tasks; click body still opens detail so the user can read the
  // pending state in context.
  const canQueue = task.can_complete && !pendingMeta

  // Cancel-pending-request UX. Two-step inline confirm so a
  // mis-click doesn't pop the request out of the queue. Only
  // available for delete/edit kinds — transfer cancel is a
  // separate flow on task_reassign_requests.
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!pendingMeta?.requestId) throw new Error('no request id')
      return cancelMyTaskRequest(pendingMeta.requestId)
    },
    onSuccess: () => {
      toast('Request cancelled.', 'success')
      void queryClient.invalidateQueries({ queryKey: taskRequestKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['admin-log'] })
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Cancel failed', 'error'),
  })
  const canCancelRequest =
    pendingMeta?.requestId && (pendingMeta.kind === 'delete' || pendingMeta.kind === 'edit')
  // Auto-reset the inline confirm if the user walks away.
  useEffect(() => {
    if (!cancelConfirm) return
    const id = window.setTimeout(() => setCancelConfirm(false), 4000)
    return () => window.clearTimeout(id)
  }, [cancelConfirm])

  // PR #25 — split click surfaces. Checkbox toggles completion;
  // body-click opens the detail modal. Keyboard: Space toggles
  // (monday convention), Enter opens detail.
  //
  // PR #36 — layout is a 3-col grid so the due-date label sits
  // right-aligned inline with the title (not buried in the sub-meta
  // line). Empty right column when no due date.
  return (
    <div
      ref={rowRef}
      onClick={() => onOpenDetail(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          onOpenDetail(task)
        } else if (event.key === ' ' && canQueue) {
          event.preventDefault()
          onToggle(task)
        }
      }}
      // Skin pass 2026-05-06 — flattened from rounded-xl border card
      // to flat row inside MyTasksCard's inset-panel + divide-theme
      // stack. State (highlighted/pending/done/new/default) now
      // communicated by bg tint alone with theme-aware tokens.
      className={`group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-3 py-2 transition-all text-left cursor-pointer ${
        highlighted
          ? 'bg-gold/20 ring-2 ring-gold ring-inset animate-[pulse_0.8s_ease-in-out_2]'
          : pendingMeta
            ? 'bg-surface-alt/40 hover:bg-surface-hover'
            : done
              ? 'bg-surface-alt/30 opacity-60 hover:opacity-80'
              : 'hover:bg-surface-hover'
      }`}
    >
      {/* Checkbox — independent click target. stopPropagation so the
          body's onClick doesn't also open the detail modal. PR #37
          adds a gold "pending submit" state: click queues the toggle,
          Submit Completed commits it. */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          if (canQueue) onToggle(task)
        }}
        disabled={!canQueue}
        aria-label={done ? 'Mark incomplete' : 'Mark complete'}
        aria-pressed={checkVisual}
        className={`shrink-0 w-[18px] h-[18px] mt-[2px] rounded-md border-[1.5px] flex items-center justify-center transition-colors ${
          isPending
            ? 'bg-gold/30 border-gold text-gold'
            : done
              ? 'bg-emerald-500/80 border-emerald-500/80 text-white'
              : 'checkbox-empty'
        } ${canQueue ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
      >
        {checkVisual && <Check size={12} strokeWidth={3} aria-hidden="true" />}
      </button>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={`text-[13px] truncate ${
              done
                ? 'line-through text-text-muted'
                : pendingMeta
                  ? 'font-semibold text-text-muted'
                  : 'font-semibold text-text'
            }`}
          >
            {task.title}
          </p>
          {/* PR #70 — `New` + `Required` tags retired. The new-row gold
              background tint already signals freshness; required-task
              context lives in the detail modal. Studio scope still
              gets a tag since it's a meaningful row-type distinction. */}
          {task.scope === 'studio' && !done && (
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-cyan-300 font-bold">Studio</span>
          )}
        </div>
        {/* PR #69 — `[role] · First L.` line. When the row is in a
            pending state, this line is replaced by a status badge
            so the user immediately sees what's mid-flight. */}
        {pendingMeta ? (
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] flex-wrap">
            {pendingMeta.kind === 'transfer' ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gold/15 ring-1 ring-gold/30 text-gold/90 font-semibold">
                <ArrowRightLeft size={9} strokeWidth={2.5} aria-hidden="true" />
                Awaiting {pendingMeta.otherPartyName ?? 'teammate'}
              </span>
            ) : pendingMeta.kind === 'edit' ? (
              // Orange (not gold) so the three pending kinds each
              // pop visually: rose=delete, marigold/amber=create,
              // orange=edit. Surface formula matches amber + rose
              // exactly (bg/15 + ring/30 + text-{color}-300) — the
              // row no longer sits at opacity-60, so badges render
              // at full saturation and read at equal weight to the
              // admin queue.
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/15 ring-1 ring-orange-500/30 text-orange-300 font-semibold">
                <Edit2 size={9} strokeWidth={2.5} aria-hidden="true" />
                Awaiting edit approval
              </span>
            ) : (
              // Delete badge uses Minus (not Trash2) because the
              // cancel button to the right is already a Trash icon —
              // double-Trash would visually conflate "this is a
              // delete request" with "click to cancel."
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 ring-1 ring-rose-500/30 text-rose-300 font-semibold">
                <Minus size={9} strokeWidth={3} aria-hidden="true" />
                Awaiting deletion approval
              </span>
            )}
            {/* Cancel-request inline action for delete/edit kinds.
                Two-step: visible Trash2 icon → click → "Cancel?"
                rose pill → second click commits via
                cancel_my_task_request. Always visible (not
                hover-gated) since the row is already pending and
                the action is destructive but reversible (re-submit). */}
            {canCancelRequest && (
              cancelConfirm ? (
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      cancelMutation.mutate()
                    }}
                    disabled={cancelMutation.isPending}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white bg-rose-500/80 hover:brightness-110 transition-all"
                  >
                    {cancelMutation.isPending ? '…' : 'Cancel?'}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setCancelConfirm(false)
                    }}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-text-light hover:text-text"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setCancelConfirm(true)
                  }}
                  aria-label="Cancel this request"
                  title="Cancel this request"
                  className="inline-flex items-center justify-center w-5 h-5 rounded text-rose-300/70 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 size={12} strokeWidth={2.25} aria-hidden="true" />
                </button>
              )
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-light flex-wrap">
            {roleLabel && <span className="lowercase">{roleLabel}</span>}
            {roleLabel && shortName && <span aria-hidden="true">·</span>}
            {shortName && <span>{shortName}</span>}
          </div>
        )}
      </div>

      {/* Right column — due date + hover-revealed action buttons
          (Edit + Delete) + (sortable rows only) drag handle.
          Layout left→right: [Edit Delete (hover)] [Due date] [Grip].
          Drag handle is always visible (per user — discoverability
          over cleanliness) and is the ONLY surface bound to drag
          listeners, so clicking the row body always opens the modal
          cleanly without accidental drags. */}
      <div className="shrink-0 flex items-center gap-1 mt-[2px]">
        {!pendingMeta && (onRequestEdit || onRequestDelete) && (
          <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5">
            {onRequestEdit && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onRequestEdit(task)
                }}
                aria-label="Edit task"
                title="Edit"
                className="inline-flex items-center justify-center w-6 h-6 rounded text-text-light hover:text-gold hover:bg-gold/10 transition-colors focus-ring"
              >
                <Edit2 size={12} aria-hidden="true" />
              </button>
            )}
            {onRequestDelete && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onRequestDelete(task)
                }}
                aria-label="Delete task"
                title="Delete"
                className="inline-flex items-center justify-center w-6 h-6 rounded text-text-light hover:text-rose-300 hover:bg-rose-500/10 transition-colors focus-ring"
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <span
          className={`text-[12px] tabular-nums whitespace-nowrap ${
            dueLabel ? 'text-text-light' : 'text-text-light/30'
          }`}
          title={dueLabel ? `Due ${dueLabel}` : 'No due date'}
        >
          {dueLabel ?? '—'}
        </span>
        {dragHandle}
      </div>
    </div>
  )
}
