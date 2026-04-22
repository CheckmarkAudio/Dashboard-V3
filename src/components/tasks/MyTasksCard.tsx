// ============================================================================
// MyTasksCard — the unified "My Tasks" widget (PR #11).
//
// Historical context:
//   Pre-PR #11: this widget rendered MOCK arrays from MyTasksContext
//   (MY_TODAY_SEED / MY_WEEK_SEED). The context never persisted to a
//   DB. Admin-assigned tasks lived in a separate AssignedTasksWidget.
//   Two widgets, two mental models, two data sources — and one of
//   them was fake.
//
// PR #11 unifies:
//   This widget now reads `assigned_tasks` directly via
//   fetchMemberAssignedTasks. Everything a user has IS admin-assigned
//   (since there's no personal_tasks table yet). When personal tasks
//   land later, merge the two sources here and re-enable the "Assigned"
//   filter pill (structural placeholder retained below).
//
// Features:
//   - Optimistic toggle via completeAssignedTask
//   - postgres_changes realtime subscription (filtered by assigned_to)
//   - Batch origin shown ("from Marketing Onboarding · Assigned by
//     Admin") so users understand context
//   - Click-to-highlight: listens for `highlight-task` CustomEvent;
//     scrolls the matching row into view + flashes a gold ring. Fired
//     by the Notifications widget's assignment rows so click →
//     "here's where your new task is."
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, CheckCircle2, Inbox, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  completeAssignedTask,
  fetchMemberAssignedTasks,
} from '../../lib/queries/assignments'
import { supabase } from '../../lib/supabase'
import type { AssignedTask } from '../../types/assignments'
import { Card, CardHeader, CompletedToggle } from './shared'

interface MyTasksCardProps {
  /**
   * When true, skip the outer `widget-card` wrapper AND the internal
   * `<h2>My Tasks</h2>`. Used on the Overview page, where
   * `DashboardWidgetFrame` already renders the title + description
   * and the surface chrome.
   */
  embedded?: boolean
}

const HIGHLIGHT_EVENT = 'highlight-task'
const HIGHLIGHT_DURATION_MS = 1600

export default function MyTasksCard({ embedded = false }: MyTasksCardProps = {}) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [showCompleted, setShowCompleted] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // ── Data ─────────────────────────────────────────────────────────
  const cacheKey = ['assigned-tasks', profile?.id ?? 'none'] as const
  const tasksQuery = useQuery({
    queryKey: cacheKey,
    queryFn: () => fetchMemberAssignedTasks(profile!.id, { includeCompleted: true }),
    enabled: Boolean(profile?.id),
    refetchInterval: 60_000,
  })

  // Realtime on assigned_tasks for this user — keeps the list in sync
  // without waiting for the 60s poll. Same pattern as the legacy
  // AssignedTasksWidget (now retired).
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
    // cacheKey is stable for a given profile.id; eslint-disable so the
    // array spread warning doesn't fire
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, profile?.id])

  // ── Highlight-on-click from Notifications widget ──────────────────
  // Notification click dispatches one of:
  //   { taskId }  — target a specific task (e.g. future direct link)
  //   { batchId } — target the first task from that batch (current
  //                 use: notifications reference a batch, which may
  //                 span 1..N tasks; we flash the first one so the
  //                 user's eye lands in the right neighborhood)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ taskId?: string; batchId?: string }>).detail
      if (!detail) return
      let targetId: string | null = null
      if (detail.taskId) {
        targetId = detail.taskId
      } else if (detail.batchId) {
        const match = (tasksQuery.data ?? []).find((t) => t.batch?.id === detail.batchId)
        targetId = match?.id ?? null
      }
      if (!targetId) return
      setHighlightedId(targetId)
      const node = rowRefs.current.get(targetId)
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      window.setTimeout(() => setHighlightedId(null), HIGHLIGHT_DURATION_MS)
    }
    window.addEventListener(HIGHLIGHT_EVENT, handler)
    return () => window.removeEventListener(HIGHLIGHT_EVENT, handler)
  }, [tasksQuery.data])

  // ── Optimistic toggle ────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: ({ taskId, next }: { taskId: string; next: boolean }) =>
      completeAssignedTask(taskId, next),
    onMutate: ({ taskId, next }) => {
      queryClient.setQueryData<AssignedTask[]>([...cacheKey], (prev) => {
        if (!prev) return prev
        return prev.map((t) =>
          t.id === taskId
            ? { ...t, is_completed: next, completed_at: next ? new Date().toISOString() : null }
            : t,
        )
      })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: cacheKey })
    },
  })

  const handleToggle = (task: AssignedTask) => {
    toggleMutation.mutate({ taskId: task.id, next: !task.is_completed })
  }

  // ── Partition + sort ─────────────────────────────────────────────
  const { openTasks, doneTasks } = useMemo(() => {
    const tasks = tasksQuery.data ?? []
    const open: AssignedTask[] = []
    const done: AssignedTask[] = []
    for (const t of tasks) {
      if (t.is_completed) done.push(t)
      else open.push(t)
    }
    // Open: required first, then by due_date ascending (nulls last),
    // then by batch created_at desc so newest batch floats up
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

  // ── Header strip ─────────────────────────────────────────────────
  const headerStrip = embedded ? (
    <div className="flex items-center justify-between gap-3 pb-2.5 mb-2 border-b border-white/5 shrink-0">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-text-light">
        {openTasks.length} open
        {doneTasks.length > 0 && (
          <span className="ml-2 text-text-light/70">· {doneTasks.length} done</span>
        )}
      </p>
      <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((s) => !s)} />
    </div>
  ) : (
    <CardHeader>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-bold tracking-tight text-text">My Tasks</h2>
        <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((s) => !s)} />
      </div>
      <p className="mt-1 text-[11px] font-semibold tracking-[0.06em] text-text-light">
        {openTasks.length} open
        {doneTasks.length > 0 && (
          <span className="ml-2 text-text-light/70">· {doneTasks.length} done</span>
        )}
      </p>
    </CardHeader>
  )

  // ── Body ─────────────────────────────────────────────────────────
  const body = (
    <>
      {headerStrip}

      <div
        className={`flex-1 min-h-0 overflow-y-auto space-y-1.5 ${
          embedded ? '' : 'px-3 py-2'
        }`}
      >
        {tasksQuery.isLoading ? (
          <div className="h-full flex items-center justify-center text-text-light py-6">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : tasksQuery.error ? (
          <div className="flex items-center gap-2 text-[13px] text-amber-300 px-2 py-4">
            <AlertCircle size={16} className="shrink-0" />
            <span>Could not load your tasks</span>
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-6">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold/10 ring-1 ring-gold/20 mb-2">
              <Inbox size={18} className="text-gold" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-medium text-text">
              {openTasks.length === 0 && doneTasks.length > 0
                ? 'All done'
                : 'No tasks yet'}
            </p>
            <p className="text-[12px] text-text-light mt-0.5">
              {openTasks.length === 0 && doneTasks.length > 0
                ? 'Toggle to see completed tasks.'
                : 'New tasks from admin will land here.'}
            </p>
          </div>
        ) : (
          <>
            {visibleTasks.map((task) => {
              // Render a visual separator at the Completed boundary so
              // users can see where open ends and done starts.
              const separatorBefore =
                showCompleted &&
                task.is_completed &&
                openTasks.length > 0 &&
                task === doneTasks[0]
              return (
                <div key={task.id}>
                  {separatorBefore && (
                    <div className="mx-2 my-2 flex items-center gap-2">
                      <CheckCircle2
                        size={11}
                        className="text-emerald-400/70"
                        aria-hidden="true"
                      />
                      <p className="text-[11px] font-semibold tracking-[0.06em] text-emerald-400/70">
                        COMPLETED
                      </p>
                      <div className="flex-1 h-px bg-white/[0.05]" aria-hidden="true" />
                    </div>
                  )}
                  <AssignedTaskRow
                    task={task}
                    highlighted={highlightedId === task.id}
                    onToggle={handleToggle}
                    ref={(node) => {
                      if (node) rowRefs.current.set(task.id, node)
                      else rowRefs.current.delete(task.id)
                    }}
                  />
                </div>
              )
            })}
          </>
        )}
      </div>
    </>
  )

  if (embedded) {
    return <div className="flex flex-col h-full min-h-0">{body}</div>
  }
  return <Card className="h-full">{body}</Card>
}

// ─── AssignedTaskRow ─────────────────────────────────────────────────
// Uses React's callback-ref pattern so MyTasksCard can hold a Map of
// rowRefs for scroll-into-view. forwardRef would also work; callback
// ref keeps the map maintenance simple.

interface AssignedTaskRowProps {
  task: AssignedTask
  highlighted: boolean
  onToggle: (task: AssignedTask) => void
  ref: (node: HTMLDivElement | null) => void
}

function AssignedTaskRow({ task, highlighted, onToggle, ref }: AssignedTaskRowProps) {
  const done = task.is_completed
  const due = task.due_date ? new Date(task.due_date) : null
  const dueLabel = due
    ? due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  const isNew =
    !done && !task.completed_at && task.batch?.created_at
      ? Date.now() - new Date(task.batch.created_at).getTime() < 24 * 60 * 60 * 1000
      : false

  // Origin label — helps users understand WHERE a task came from,
  // per the user's feedback that "tasks should feel integrated."
  const originLabel = (() => {
    if (task.source_type === 'custom') return 'Assigned directly'
    if (task.batch?.title) return `from ${task.batch.title}`
    return null
  })()

  return (
    <div
      ref={ref}
      onClick={() => onToggle(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
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
      <span
        className={`shrink-0 w-[18px] h-[18px] mt-[2px] rounded-md flex items-center justify-center transition-colors ${
          done
            ? 'bg-emerald-500/80 border border-emerald-500/80 text-white'
            : 'bg-surface-alt border border-border-light group-hover:border-gold/50'
        }`}
        aria-hidden="true"
      >
        {done && <Check size={12} strokeWidth={3} />}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={`text-[13px] truncate ${
              done ? 'line-through text-text-muted' : 'font-semibold text-text'
            }`}
          >
            {task.title}
          </p>
          {isNew && (
            <span className="shrink-0 inline-flex items-center justify-center px-1.5 h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none uppercase tracking-wide">
              New
            </span>
          )}
          {task.is_required && !done && (
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-rose-400 font-bold">
              Required
            </span>
          )}
        </div>
        {task.description && (
          <p
            className={`text-[12px] mt-0.5 truncate ${
              done ? 'text-text-light' : 'text-text-muted'
            }`}
          >
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-light flex-wrap">
          {originLabel && <span>{originLabel}</span>}
          {originLabel && task.category && <span aria-hidden="true">·</span>}
          {task.category && <span>{task.category}</span>}
          {(originLabel || task.category) && dueLabel && <span aria-hidden="true">·</span>}
          {dueLabel && <span>Due {dueLabel}</span>}
        </div>
      </div>
    </div>
  )
}
