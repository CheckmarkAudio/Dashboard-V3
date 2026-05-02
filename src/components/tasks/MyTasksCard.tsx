import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Hourglass,
  Inbox,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { completeAssignedTask, fetchMemberAssignedTasks } from '../../lib/queries/assignments'
import {
  fetchMyTaskRequests,
  taskRequestKeys,
  type MyTaskRequest,
} from '../../lib/queries/taskRequests'
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
  SourceFilterRow,
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
// pending delete request (caller asked admin to delete) — never
// both, because the server validations would reject the second.
type PendingKind = 'transfer' | 'delete'
interface PendingMeta {
  kind: PendingKind
  // Targeted recipient name for the transfer; null for delete (admin).
  otherPartyName?: string | null
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
  // PR #37 — pending → Submit pattern. Checking a box adds the task
  // id to this set (visual state only, no RPC). Submit Completed
  // button commits all queued ids in parallel.
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())
  // PR #25 — click task body (not checkbox) opens this detail modal
  const [detailTask, setDetailTask] = useState<AssignedTask | null>(null)
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

    open.sort((a, b) => {
      if (a.is_required !== b.is_required) return a.is_required ? -1 : 1
      const aDue = a.due_date ?? '9999-12-31'
      const bDue = b.due_date ?? '9999-12-31'
      if (aDue !== bDue) return aDue.localeCompare(bDue)
      return (b.batch?.created_at ?? '').localeCompare(a.batch?.created_at ?? '')
    })

    done.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    return { openTasks: open, doneTasks: done }
  }, [tasksQuery.data])

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
      if (r.kind !== 'delete') continue
      if (r.status !== 'pending') continue
      if (!r.target_task_id) continue
      if (map.has(r.target_task_id)) continue
      map.set(r.target_task_id, { kind: 'delete', otherPartyName: null })
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
  const visibleTasks =
    sourceFilter === 'all'
      ? preFilterVisible
      : sourceFilter === 'self'
        ? preFilterVisible.filter((t) => isSelfAssigned(t))
        : preFilterVisible.filter((t) => !isSelfAssigned(t))

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

  // The pending section appears whenever there's anything in it —
  // either a task with an outgoing pending request, or a brand-new
  // task request awaiting admin approval. Hidden otherwise so an
  // empty divider doesn't add noise.
  const hasAnyPending = pendingVisibleTasks.length > 0 || pendingNewRequests.length > 0

  // Inline "+ Task" row. Sits inside the empty-state call-to-action;
  // the real footer below the list carries the same button at the
  // bottom of a populated widget.
  const addTaskRow = (
    <button
      type="button"
      onClick={() => setRequestModalOpen(true)}
      className="w-full inline-flex items-center gap-2 px-2 py-1.5 rounded-[14px] text-[13px] font-semibold text-gold/80 hover:text-gold hover:bg-gold/5 transition-colors text-left"
      aria-label="Request a new task"
    >
      <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
      Task
    </button>
  )

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
  // The "N pending" expandable strip + chip have been retired —
  // pending requests now render in a dedicated divider section
  // above (always visible when non-empty), so the chip-toggle
  // affordance is no longer needed.
  const footerBar = (
    <div className="shrink-0 space-y-1.5 pt-1.5 mt-1 border-t border-white/5">
      <SubmitBar
        count={pendingIds.size}
        isSubmitting={submitMutation.isPending}
        onClick={submitPending}
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setRequestModalOpen(true)}
          className="flex-1 inline-flex items-center gap-2 px-2 py-1.5 rounded-[10px] text-[13px] font-semibold text-gold/80 hover:text-gold hover:bg-gold/5 transition-colors text-left"
          aria-label="Request a new task"
        >
          <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
          Task
        </button>
        <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((value) => !value)} />
      </div>
    </div>
  )

  const body = (
    <>
      {/* PR #69 — source filter (Assigned vs Self) replaces the stage
          pill row. Stages return as real KPIs in the upcoming flywheel
          event ledger PR; until then they're decorative noise here. */}
      <div className="shrink-0 mb-2">
        <SourceFilterRow counts={sourceCounts} active={sourceFilter} onChange={setSourceFilter} />
      </div>

      {/* PR #69 — column header. Anchors the right-aligned "Due" label
          so users know the date column = due date, not assigned date. */}
      <div className="shrink-0 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2.5 px-2 mb-1">
        <span className="w-[18px]" aria-hidden="true" />
        <span aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-gold/70 whitespace-nowrap">Due</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
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
            <p className="text-[12px] text-text-light mt-0.5 mb-3">
              {openTasks.length === 0 && doneTasks.length > 0
                ? 'Toggle to review completed work.'
                : 'Assigned work and checklist tasks will land here.'}
            </p>
            {/* Empty-state also surfaces the add affordance so a
                brand-new member can request their first task. */}
            {addTaskRow}
          </div>
        ) : (
          <>
            {activeVisibleTasks.map((task) => {
              const separatorBefore =
                showCompleted &&
                task.is_completed &&
                openTasks.length > 0 &&
                task.id === doneTasks[0]?.id
              return (
                <div key={task.id}>
                  {separatorBefore && (
                    <div className="mx-2 my-2 flex items-center gap-2">
                      <CheckCircle2 size={11} className="text-emerald-400/70" aria-hidden="true" />
                      <p className="text-[11px] font-semibold tracking-[0.06em] text-emerald-400/70">COMPLETED</p>
                      <div className="flex-1 h-px bg-white/[0.05]" aria-hidden="true" />
                    </div>
                  )}
                  <AssignedTaskRow
                    task={task}
                    highlighted={highlightedId === task.id}
                    isPending={pendingIds.has(task.id)}
                    pendingMeta={null}
                    onToggle={(nextTask) => togglePending(nextTask.id)}
                    onOpenDetail={(nextTask) => setDetailTask(nextTask)}
                    rowRef={(node) => {
                      if (node) rowRefs.current.set(task.id, node)
                      else rowRefs.current.delete(task.id)
                    }}
                    memberMap={memberMap}
                  />
                </div>
              )
            })}

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
                    onOpenDetail={(nextTask) => setDetailTask(nextTask)}
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

      {/* PR #37 — sticky footer with + Task + show-completed eye.
          Stays below the scroll area so the eye is always reachable. */}
      {footerBar}
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
        <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />
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
  return (
    <div
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-2 py-2 rounded-xl border border-transparent ${
        isRejected
          ? 'bg-rose-500/[0.05] opacity-90'
          : 'bg-white/[0.018] opacity-60'
      }`}
    >
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
        <p className="text-[13px] font-semibold text-text/90 truncate">{request.title}</p>
        <p
          className={`text-[10px] mt-0.5 ${
            isRejected ? 'text-rose-300/80' : 'text-amber-200/80'
          }`}
        >
          {isRejected ? 'Declined' : 'New task — pending admin approval'}
          {isRejected && request.reviewer_note ? ` · "${request.reviewer_note}"` : ''}
        </p>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-text-light/70 whitespace-nowrap mt-[2px]">
        {request.status}
      </span>
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
  rowRef,
  memberMap,
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
  rowRef: (node: HTMLDivElement | null) => void
  memberMap: Map<string, TeamMember>
}) {
  const done = task.is_completed
  // Checkbox shows the pending-but-not-submitted state distinctly so
  // the user knows what they've queued. `checkVisual` is the visual
  // truth: true when either completed OR pending, false otherwise.
  const checkVisual = done !== isPending  // XOR: pending flips the visual
  const dueLabel = formatDueShort(task.due_date)
  const isNew =
    !done &&
    !pendingMeta &&
    Boolean(task.batch?.created_at) &&
    Date.now() - new Date(task.batch!.created_at).getTime() < 24 * 60 * 60 * 1000

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
      className={`group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-2 py-2 rounded-xl border border-transparent transition-all text-left cursor-pointer ${
        highlighted
          ? 'bg-gold/20 ring-2 ring-gold animate-[pulse_0.8s_ease-in-out_2]'
          : pendingMeta
            ? 'bg-white/[0.018] opacity-60 hover:opacity-80 hover:bg-white/[0.03]'
            : done
              ? 'bg-white/[0.018] opacity-60 hover:opacity-80'
              : isNew
                ? 'bg-gold/8 hover:bg-gold/12 hover:border-gold/20'
                : 'bg-white/[0.018] hover:bg-white/[0.04] hover:border-white/10'
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
        className={`shrink-0 w-[18px] h-[18px] mt-[2px] rounded-md flex items-center justify-center transition-colors ${
          isPending
            ? 'bg-gold/30 border border-gold text-gold'
            : done
              ? 'bg-emerald-500/80 border border-emerald-500/80 text-white'
              : 'bg-surface-alt border border-border-light group-hover:border-gold/50'
        } ${canQueue ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
      >
        {checkVisual && <Check size={12} strokeWidth={3} aria-hidden="true" />}
      </button>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-[13px] truncate ${done ? 'line-through text-text-muted' : 'font-semibold text-text'}`}>
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
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 ring-1 ring-rose-500/30 text-rose-300 font-semibold">
                <Trash2 size={9} strokeWidth={2.5} aria-hidden="true" />
                Awaiting admin to delete
              </span>
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

      {/* Due date — right column of the grid, vertically top-aligned
          with the title. Em-dash-style empty state keeps rows aligned
          when there's no date set. */}
      <span
        className={`shrink-0 text-[12px] tabular-nums whitespace-nowrap mt-[2px] ${
          dueLabel ? 'text-text-light' : 'text-text-light/30'
        }`}
        title={dueLabel ? `Due ${dueLabel}` : 'No due date'}
      >
        {dueLabel ?? '—'}
      </span>
    </div>
  )
}
