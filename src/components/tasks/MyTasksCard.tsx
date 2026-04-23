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
import { Card, CardHeader, CompletedToggle } from './shared'
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
  const [showCompleted, setShowCompleted] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requestsExpanded, setRequestsExpanded] = useState(false)
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
      .channel(`my-tasks:${profile.id}`)
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

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, next }: { taskId: string; next: boolean }) => completeAssignedTask(taskId, next),
    onMutate: ({ taskId, next }) => {
      queryClient.setQueryData<AssignedTask[]>(cacheKey, (previous) => {
        if (!previous) return previous
        return previous.map((task) =>
          task.id === taskId
            ? { ...task, is_completed: next, completed_at: next ? new Date().toISOString() : null }
            : task,
        )
      })
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

  const visibleTasks = showCompleted ? [...openTasks, ...doneTasks] : openTasks

  // PR #17 — header no longer carries the "+ Task" chip. The button
  // lives as an inline link at the bottom of the list (monday-style)
  // so it reads as "the next row you'd add." Header keeps count +
  // pending chip + completed toggle.
  const header = embedded ? (
    <div className="flex items-center justify-between gap-3 pb-2.5 mb-2 border-b border-white/5 shrink-0">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-text-light">
        {openTasks.length} open
        {doneTasks.length > 0 && <span className="ml-2 text-text-light/70">· {doneTasks.length} done</span>}
        {pendingRequests.length > 0 && (
          <button
            type="button"
            onClick={() => setRequestsExpanded((v) => !v)}
            className="ml-2 inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-bold"
            aria-expanded={requestsExpanded}
          >
            <Hourglass size={10} aria-hidden="true" />
            {pendingRequests.length} pending
          </button>
        )}
      </p>
      <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((value) => !value)} />
    </div>
  ) : (
    <CardHeader>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-bold tracking-tight text-text">My Tasks</h2>
        <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((value) => !value)} />
      </div>
      <p className="mt-1 text-[11px] font-semibold tracking-[0.06em] text-text-light">
        {openTasks.length} open
        {doneTasks.length > 0 && <span className="ml-2 text-text-light/70">· {doneTasks.length} done</span>}
        {pendingRequests.length > 0 && (
          <button
            type="button"
            onClick={() => setRequestsExpanded((v) => !v)}
            className="ml-2 inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-bold"
            aria-expanded={requestsExpanded}
          >
            <Hourglass size={10} aria-hidden="true" />
            {pendingRequests.length} pending approval
          </button>
        )}
      </p>
    </CardHeader>
  )

  // Inline "+ Task" row that sits at the bottom of the task list —
  // monday's "+ Add item" pattern. Reads as the next row you'd add.
  const addTaskRow = (
    <button
      type="button"
      onClick={() => setRequestModalOpen(true)}
      className={`w-full inline-flex items-center gap-2 ${
        embedded ? 'px-2 py-1.5' : 'px-2.5 py-2'
      } rounded-[14px] text-[13px] font-semibold text-gold/80 hover:text-gold hover:bg-gold/5 transition-colors text-left`}
      aria-label="Request a new task"
    >
      <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
      Task
    </button>
  )

  const body = (
    <>
      {header}

      {/* PR #16 — pending-request strip. Collapsed by default; the
          "N pending" chip in the header toggles it. Shows title +
          status per request, plus a way to see admin's rejection
          note when resolved. */}
      {requestsExpanded && myRequests.length > 0 && (
        <PendingRequestsList requests={myRequests} />
      )}

      <div className={`flex-1 min-h-0 overflow-y-auto space-y-1.5 ${embedded ? '' : 'px-3 py-2'}`}>
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
                  onToggle={(nextTask) => toggleMutation.mutate({ taskId: nextTask.id, next: !nextTask.is_completed })}
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
        {/* "+ Task" row sits at the END of the task list — monday's
            "+ Add item" pattern. Only render after the list (not in
            the empty state, which already includes it above). */}
        {visibleTasks.length > 0 && <div className="pt-1">{addTaskRow}</div>}
      </div>
    </>
  )

  if (embedded) {
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

  return (
    <>
      <Card className="h-full">{body}</Card>
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
  onToggle,
  onOpenDetail,
  rowRef,
}: {
  task: AssignedTask
  highlighted: boolean
  onToggle: (task: AssignedTask) => void
  onOpenDetail: (task: AssignedTask) => void
  rowRef: (node: HTMLDivElement | null) => void
}) {
  const done = task.is_completed
  const dueLabel = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
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
      className={`group relative flex items-start gap-2.5 px-2 py-2 rounded-xl border border-transparent transition-all text-left cursor-pointer ${
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
          body's onClick doesn't also open the detail modal. */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          if (task.can_complete) onToggle(task)
        }}
        disabled={!task.can_complete}
        aria-label={done ? 'Mark incomplete' : 'Mark complete'}
        aria-pressed={done}
        className={`shrink-0 w-[18px] h-[18px] mt-[2px] rounded-md flex items-center justify-center transition-colors ${
          done
            ? 'bg-emerald-500/80 border border-emerald-500/80 text-white'
            : 'bg-surface-alt border border-border-light group-hover:border-gold/50'
        } ${task.can_complete ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
      >
        {done && <Check size={12} strokeWidth={3} aria-hidden="true" />}
      </button>

      <div className="flex-1 min-w-0">
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
          {(originLabel || task.category || task.assigned_to_name) && dueLabel && <span aria-hidden="true">·</span>}
          {dueLabel && <span>Due {dueLabel}</span>}
        </div>
      </div>
    </div>
  )
}
