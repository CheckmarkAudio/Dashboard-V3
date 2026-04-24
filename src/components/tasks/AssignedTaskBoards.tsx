import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, Inbox, Loader2, Users } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  completeAssignedTask,
  fetchStudioAssignedTasks,
  fetchTeamAssignedTasks,
} from '../../lib/queries/assignments'
import type { AssignedTask } from '../../types/assignments'
import {
  CompletedToggle,
  StagePillRow,
  formatDueShort,
  taskStage,
  type Stage,
} from './shared'

// These boards are ONLY rendered inside a `DashboardWidgetFrame`
// (studio_tasks / team_board widget slots on the /daily Tasks page).
// The frame already provides the widget-card chrome + title +
// description, so we render body-only here — no inner Card wrapper,
// no duplicate heading. Previously both rendered their own chrome
// which created a visible "double box" (outer widget card + inner
// widget-style card with a bolder heading inside it).

export function TeamAssignedTasksCard() {
  return (
    <AssignmentBoardBody
      emptyTitle="No team tasks"
      emptyBody="Once team-task reads are wired, everyone will show up here."
      queryKeyPrefix="team-assigned-tasks"
      queryFn={fetchTeamAssignedTasks}
      showStagePills
    />
  )
}

export function StudioAssignedTasksCard() {
  return (
    <AssignmentBoardBody
      emptyTitle="No studio tasks"
      emptyBody="Studio tasks need the scope migration before shared tasks can flow here."
      queryKeyPrefix="studio-assigned-tasks"
      queryFn={fetchStudioAssignedTasks}
    />
  )
}

function AssignmentBoardBody({
  emptyTitle,
  emptyBody,
  queryKeyPrefix,
  queryFn,
  showStagePills = false,
}: {
  emptyTitle: string
  emptyBody: string
  queryKeyPrefix: string
  queryFn: (userId: string, opts?: { includeCompleted?: boolean }) => Promise<AssignedTask[]>
  // PR #36 — Team Tasks surfaces the flywheel stage filter at the top
  // like MyTasks. Studio Tasks omits it (studio work isn't
  // flywheel-tagged today).
  showStagePills?: boolean
}) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [showCompleted, setShowCompleted] = useState(false)
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all')
  const cacheKey = [queryKeyPrefix, profile?.id ?? 'none', showCompleted ? 'all' : 'open'] as const

  const tasksQuery = useQuery({
    queryKey: cacheKey,
    queryFn: () => queryFn(profile!.id, { includeCompleted: true }),
    enabled: Boolean(profile?.id),
    refetchInterval: 60_000,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, next }: { taskId: string; next: boolean }) => completeAssignedTask(taskId, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, profile?.id ?? 'none'] })
      void queryClient.invalidateQueries({ queryKey: ['assigned-tasks', profile?.id ?? 'none'] })
    },
  })

  const openTasks = useMemo(
    () => (tasksQuery.data ?? []).filter((t) => !t.is_completed),
    [tasksQuery.data],
  )

  // Stage counts — computed against OPEN tasks so the pill filter is
  // actionable (stages with zero open work show count 0 but stay in
  // the row for visual consistency).
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

  const visibleTasks = useMemo(() => {
    const tasks = tasksQuery.data ?? []
    const openFiltered = showCompleted ? tasks : tasks.filter((task) => !task.is_completed)
    const stageFiltered =
      stageFilter === 'all'
        ? openFiltered
        : openFiltered.filter((t) => taskStage(t.category) === stageFilter)
    return [...stageFiltered].sort((a, b) => {
      const aDue = a.due_date ?? '9999-12-31'
      const bDue = b.due_date ?? '9999-12-31'
      if (aDue !== bDue) return aDue.localeCompare(bDue)
      return a.title.localeCompare(b.title)
    })
  }, [showCompleted, stageFilter, tasksQuery.data])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* PR #36 — flywheel stage filter (Team Tasks widget only). Sits
          at the top as the filter bar for the list below. */}
      {showStagePills && (
        <div className="shrink-0 mb-2">
          <StagePillRow counts={stageCounts} active={stageFilter} onChange={setStageFilter} />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {tasksQuery.isLoading ? (
          <div className="h-full flex items-center justify-center text-text-light py-6">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : tasksQuery.error ? (
          <div className="flex items-start gap-2 text-[13px] text-amber-300 px-2 py-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{(tasksQuery.error as Error).message}</span>
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-6">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.03] ring-1 ring-white/10 mb-2">
              <Inbox size={18} className="text-text-light" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-medium text-text">{emptyTitle}</p>
            <p className="text-[12px] text-text-light mt-0.5 max-w-[28ch]">{emptyBody}</p>
          </div>
        ) : (
          visibleTasks.map((task) => {
            const dueLabel = formatDueShort(task.due_date)
            return (
              <button
                key={task.id}
                type="button"
                disabled={!task.can_complete || toggleMutation.isPending}
                onClick={() => toggleMutation.mutate({ taskId: task.id, next: !task.is_completed })}
                className={`w-full text-left grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-2.5 py-2 rounded-[14px] border border-transparent bg-white/[0.018] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all ${
                  task.is_completed ? 'opacity-40' : ''
                } ${!task.can_complete ? 'cursor-default' : ''}`}
              >
                <span
                  className={`shrink-0 w-[18px] h-[18px] mt-[2px] rounded-[5px] border-[1.5px] flex items-center justify-center ${
                    task.is_completed
                      ? 'bg-gold/30 border-gold/40'
                      : 'border-white/20'
                  }`}
                >
                  {task.is_completed && <Check size={11} className="text-gold" strokeWidth={3} />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-[14px] leading-snug truncate ${task.is_completed ? 'line-through text-text-light' : 'text-text'}`}>
                      {task.title}
                    </p>
                    {task.is_required && !task.is_completed && (
                      <span className="text-[10px] uppercase tracking-wider text-rose-400 font-bold">Required</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-light flex-wrap">
                    {task.assigned_to_name && (
                      <span className="inline-flex items-center gap-1">
                        <Users size={10} />
                        {task.assigned_to_name}
                      </span>
                    )}
                    {task.category && <span>{task.category}</span>}
                  </div>
                </div>
                {/* PR #36 — due date right-aligned inline with title. */}
                <span
                  className={`shrink-0 text-[12px] tabular-nums whitespace-nowrap mt-[2px] ${
                    dueLabel ? 'text-text-light' : 'text-text-light/30'
                  }`}
                  title={dueLabel ? `Due ${dueLabel}` : 'No due date'}
                >
                  {dueLabel ?? '—'}
                </span>
              </button>
            )
          })
        )}
      </div>

      {/* PR #37 — sticky footer: show-completed eye, right-aligned.
          No +Task button here (these boards don't support self-
          requesting), so the eye sits alone on the right. */}
      <div className="shrink-0 flex items-center justify-end pt-1.5 mt-1 border-t border-white/5">
        <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((value) => !value)} />
      </div>
    </div>
  )
}
