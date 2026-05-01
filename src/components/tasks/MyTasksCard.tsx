import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, CheckCircle2, Hourglass, Inbox, Loader2, Plus, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { completeAssignedTask, fetchMemberAssignedTasks } from '../../lib/queries/assignments'
import {
  fetchMyTaskRequests,
  taskRequestKeys,
  type MyTaskRequest,
} from '../../lib/queries/taskRequests'
import { supabase } from '../../lib/supabase'
import type { AssignedTask } from '../../types/assignments'
import {
  CompletedToggle,
  StagePillRow,
  SubmitBar,
  formatDueShort,
  taskStage,
  type Stage,
} from './shared'
import TaskRequestModal from './requests/TaskRequestModal'
import TaskDetailModal from './TaskDetailModal'

interface MyTasksCardProps {
  embedded?: boolean
}

const HIGHLIGHT_EVENT = 'highlight-task'
const HIGHLIGHT_DURATION_MS = 1600

export default function MyTasksCard({ embedded = false }: MyTasksCardProps = {}) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const realtimeTopicRef = useRef(`my-tasks:${crypto.randomUUID()}`)
  const [showCompleted, setShowCompleted] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requestsExpanded, setRequestsExpanded] = useState(false)
  // PR #36 — flywheel stage filter. 'all' = no filter; otherwise the
  // active stage. The pill row renders above the task list.
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all')
  // PR #37 — pending → Submit pattern. Checking a box adds the task
  // id to this set (visual state only, no RPC). Submit Completed
  // button commits all queued ids in parallel.
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())
  // PR #25 — click task body (not checkbox) opens this detail modal
  const [detailTask, setDetailTask] = useState<AssignedTask | null>(null)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // PR #16 — user can ask admin for a task. Fetch any outstanding
  // requests so we can show a "Pending approval" affordance inline.
  // Only the pending + recently-resolved window matters here; if the
  // user has 50 old resolved requests we still only render the recent
  // ones (RPC limit 20 matches our use case).
  const myRequestsQuery = useQuery({
    queryKey: taskRequestKeys.mine(),
    queryFn: () => fetchMyTaskRequests(20),
    enabled: Boolean(profile?.id),
    refetchInterval: 90_000,
    staleTime: 30_000,
  })
  const myRequests = myRequestsQuery.data ?? []
  const pendingRequests = myRequests.filter((r) => r.status === 'pending')

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

  // PR #26 — dispatched when the user clicks a task_request_rejected
  // notification. Open the pending-requests strip so the reviewer
  // note is immediately visible.
  useEffect(() => {
    const handler = () => setRequestsExpanded(true)
    window.addEventListener('expand-task-requests', handler)
    return () => window.removeEventListener('expand-task-requests', handler)
  }, [])

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

  // Stage counts — always computed against OPEN tasks (not completed)
  // so the "All" count matches the "N open" line in the header and
  // filtering by stage only reveals work that's still needed.
  const stageCounts = useMemo(() => {
    const c: Record<'all' | Stage, number> = {
      all: openTasks.length,
      deliver: 0, capture: 0, share: 0, attract: 0, book: 0,
    }
    for (const t of openTasks) {
      const s = taskStage(t.category)
      if (s) c[s]++
    }
    return c
  }, [openTasks])

  const preFilterVisible = showCompleted ? [...openTasks, ...doneTasks] : openTasks
  const visibleTasks =
    stageFilter === 'all'
      ? preFilterVisible
      : preFilterVisible.filter((t) => taskStage(t.category) === stageFilter)

  // PR #37 — no header strip. The widget frame already shows "My
  // Tasks" up top; the "N open · M done" counter + completed toggle
  // were extra noise inside the card. Pending-request chip + eye
  // toggle now live in the footer alongside the + Task button.

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
  //   - + Task · pending-requests chip · Show-completed eye
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
        {pendingRequests.length > 0 && (
          <button
            type="button"
            onClick={() => setRequestsExpanded((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition-colors"
            aria-expanded={requestsExpanded}
            title={`${pendingRequests.length} pending approval`}
          >
            <Hourglass size={11} aria-hidden="true" />
            {pendingRequests.length}
          </button>
        )}
        <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((value) => !value)} />
      </div>
    </div>
  )

  const body = (
    <>
      {/* PR #36 — flywheel stage filter. Sits at the TOP of the widget
          body (below the widget-frame title), reads as "filter bar"
          for the list below. */}
      <div className="shrink-0 mb-2">
        <StagePillRow counts={stageCounts} active={stageFilter} onChange={setStageFilter} />
      </div>

      {/* PR #16 — pending-request strip. Collapsed by default; the
          "N pending" chip in the header toggles it. Shows title +
          status per request, plus a way to see admin's rejection
          note when resolved. */}
      {requestsExpanded && myRequests.length > 0 && (
        <PendingRequestsList requests={myRequests} />
      )}

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
        ) : visibleTasks.length === 0 ? (
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
          visibleTasks.map((task) => {
            const separatorBefore =
              showCompleted && task.is_completed && openTasks.length > 0 && task.id === doneTasks[0]?.id
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
                  onToggle={(nextTask) => togglePending(nextTask.id)}
                  onOpenDetail={(nextTask) => setDetailTask(nextTask)}
                  rowRef={(node) => {
                    if (node) rowRefs.current.set(task.id, node)
                    else rowRefs.current.delete(task.id)
                  }}
                />
              </div>
            )
          })
        )}
      </div>

      {/* PR #37 — sticky footer with + Task, pending-requests chip
          (if any), and the show-completed eye. Stays below the scroll
          area so the eye is always reachable. */}
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
 * PendingRequestsList — compact strip of the user's task requests,
 * grouped by status. Shown inline in MyTasksCard when the user
 * toggles the "pending approval" chip.
 */
function PendingRequestsList({ requests }: { requests: MyTaskRequest[] }) {
  const ordered = [...requests].sort((a, b) => {
    // pending first, then rejected (with note), then approved
    const weight = (s: MyTaskRequest['status']) =>
      s === 'pending' ? 0 : s === 'rejected' ? 1 : 2
    if (weight(a.status) !== weight(b.status)) return weight(a.status) - weight(b.status)
    return b.created_at.localeCompare(a.created_at)
  })
  return (
    <div className="px-3 pb-2 space-y-1.5">
      {ordered.slice(0, 6).map((r) => (
        <RequestRow key={r.id} request={r} />
      ))}
    </div>
  )
}

function RequestRow({ request }: { request: MyTaskRequest }) {
  const tone =
    request.status === 'pending'
      ? 'bg-amber-500/10 ring-amber-500/30 text-amber-200'
      : request.status === 'approved'
        ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200'
        : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'
  const icon =
    request.status === 'pending' ? (
      <Hourglass size={11} aria-hidden="true" />
    ) : request.status === 'approved' ? (
      <Check size={11} aria-hidden="true" />
    ) : (
      <X size={11} aria-hidden="true" />
    )
  return (
    <div className={`rounded-lg ring-1 px-2.5 py-1.5 text-[12px] ${tone}`}>
      <div className="flex items-center gap-1.5 font-semibold">
        {icon}
        <span className="truncate">{request.title}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider opacity-70">
          {request.status}
        </span>
      </div>
      {request.status === 'rejected' && request.reviewer_note && (
        <p className="mt-0.5 text-[11px] opacity-90">{request.reviewer_note}</p>
      )}
    </div>
  )
}

function AssignedTaskRow({
  task,
  highlighted,
  isPending,
  onToggle,
  onOpenDetail,
  rowRef,
}: {
  task: AssignedTask
  highlighted: boolean
  isPending: boolean
  onToggle: (task: AssignedTask) => void
  onOpenDetail: (task: AssignedTask) => void
  rowRef: (node: HTMLDivElement | null) => void
}) {
  const done = task.is_completed
  // Checkbox shows the pending-but-not-submitted state distinctly so
  // the user knows what they've queued. `checkVisual` is the visual
  // truth: true when either completed OR pending, false otherwise.
  const checkVisual = done !== isPending  // XOR: pending flips the visual
  const dueLabel = formatDueShort(task.due_date)
  const isNew =
    !done &&
    Boolean(task.batch?.created_at) &&
    Date.now() - new Date(task.batch!.created_at).getTime() < 24 * 60 * 60 * 1000

  const originLabel = (() => {
    if (task.source_type === 'daily_checklist') return 'Daily checklist'
    if (task.source_type === 'custom') return 'Assigned directly'
    if (task.batch?.title) return `from ${task.batch.title}`
    return null
  })()

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
        } else if (event.key === ' ' && task.can_complete) {
          event.preventDefault()
          onToggle(task)
        }
      }}
      className={`group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-2 py-2 rounded-xl border border-transparent transition-all text-left cursor-pointer ${
        highlighted
          ? 'bg-gold/20 ring-2 ring-gold animate-[pulse_0.8s_ease-in-out_2]'
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
          if (task.can_complete) onToggle(task)
        }}
        disabled={!task.can_complete}
        aria-label={done ? 'Mark incomplete' : 'Mark complete'}
        aria-pressed={checkVisual}
        className={`shrink-0 w-[18px] h-[18px] mt-[2px] rounded-md flex items-center justify-center transition-colors ${
          isPending
            ? 'bg-gold/30 border border-gold text-gold'
            : done
              ? 'bg-emerald-500/80 border border-emerald-500/80 text-white'
              : 'bg-surface-alt border border-border-light group-hover:border-gold/50'
        } ${task.can_complete ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
      >
        {checkVisual && <Check size={12} strokeWidth={3} aria-hidden="true" />}
      </button>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-[13px] truncate ${done ? 'line-through text-text-muted' : 'font-semibold text-text'}`}>
            {task.title}
          </p>
          {isNew && (
            <span className="shrink-0 inline-flex items-center justify-center px-1.5 h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none uppercase tracking-wide">
              New
            </span>
          )}
          {task.is_required && !done && (
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-rose-400 font-bold">Required</span>
          )}
          {task.scope === 'studio' && !done && (
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-cyan-300 font-bold">Studio</span>
          )}
        </div>
        {task.description && (
          <p className={`text-[12px] mt-0.5 truncate ${done ? 'text-text-light' : 'text-text-muted'}`}>
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-light flex-wrap">
          {originLabel && <span>{originLabel}</span>}
          {originLabel && task.category && <span aria-hidden="true">·</span>}
          {task.category && <span>{task.category}</span>}
          {(originLabel || task.category) && task.assigned_to_name && <span aria-hidden="true">·</span>}
          {task.assigned_to_name && <span>{task.assigned_to_name}</span>}
        </div>
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
