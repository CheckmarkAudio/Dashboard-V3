import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowRightLeft, Check, Inbox, Loader2, Users } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  completeAssignedTask,
  fetchStudioAssignedTasks,
  fetchTeamAssignedTasks,
} from '../../lib/queries/assignments'
import { requestTaskReassignment } from '../../lib/queries/taskReassign'
import type { AssignedTask } from '../../types/assignments'
import {
  CompletedToggle,
  StagePillRow,
  SubmitBar,
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

  // PR #37 — pending → Submit pattern. Checking a row adds its id to
  // `pendingIds`; Submit Completed commits all queued toggles at once.
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())

  const togglePending = (taskId: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const submitMutation = useMutation({
    mutationFn: async (toggles: { taskId: string; next: boolean }[]) => {
      await Promise.all(
        toggles.map((t) => completeAssignedTask(t.taskId, t.next)),
      )
    },
    onSuccess: () => {
      setPendingIds(new Set())
      void queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, profile?.id ?? 'none'] })
      void queryClient.invalidateQueries({ queryKey: ['assigned-tasks', profile?.id ?? 'none'] })
    },
  })

  // PR #38 — request-to-take feature. When a user hovers over a team
  // task assigned to someone else (can_complete=false but assigned_to
  // is set), a "Request to take" overlay appears. Clicking fires the
  // RPC which inserts a task_reassign_requests row + notifies the
  // current assignee. Once the request is sent we remember the task
  // id locally so the overlay shows "Request sent" instead of letting
  // the user fire again.
  const [requestedTaskIds, setRequestedTaskIds] = useState<Set<string>>(() => new Set())
  const reassignMutation = useMutation({
    mutationFn: (taskId: string) => requestTaskReassignment(taskId),
    onSuccess: (_data, taskId) => {
      setRequestedTaskIds((prev) => {
        const next = new Set(prev)
        next.add(taskId)
        return next
      })
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
            const isPending = pendingIds.has(task.id)
            const checkVisual = task.is_completed !== isPending // XOR
            // PR #38 — a task qualifies for the "Request to take"
            // overlay when: it's member-scope + someone else's +
            // incomplete + caller can't complete. Studio tasks and
            // own rows take the normal checkbox path.
            const canRequestTransfer =
              !task.can_complete &&
              !task.is_completed &&
              task.scope === 'member' &&
              Boolean(task.assigned_to) &&
              task.assigned_to !== profile?.id
            const alreadyRequested = requestedTaskIds.has(task.id)

            return (
              <TeamTaskRow
                key={task.id}
                task={task}
                dueLabel={dueLabel}
                isPending={isPending}
                checkVisual={checkVisual}
                canRequestTransfer={canRequestTransfer}
                alreadyRequested={alreadyRequested}
                isRequesting={reassignMutation.isPending}
                disableCheckbox={!task.can_complete || submitMutation.isPending}
                onTogglePending={() => togglePending(task.id)}
                onRequestTake={() => reassignMutation.mutate(task.id)}
              />
            )
          })
        )}
      </div>

      {/* PR #37 — sticky footer: Submit Completed bar (greyed until
          user queues at least one pending toggle) + show-completed
          eye. No +Task button here since these boards don't support
          self-requesting. */}
      <div className="shrink-0 space-y-1.5 pt-1.5 mt-1 border-t border-white/5">
        <SubmitBar
          count={pendingIds.size}
          isSubmitting={submitMutation.isPending}
          onClick={() => {
            if (pendingIds.size === 0) return
            const tasks = tasksQuery.data ?? []
            const toggles = Array.from(pendingIds).map((id) => {
              const t = tasks.find((x) => x.id === id)
              return { taskId: id, next: !(t?.is_completed ?? false) }
            })
            submitMutation.mutate(toggles)
          }}
        />
        <div className="flex items-center justify-end">
          <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((value) => !value)} />
        </div>
      </div>
    </div>
  )
}

// Single task row. Two interaction modes:
//   - Own/studio (can_complete=true): button-style row, click to
//     toggle the pending set, sibling rows join the Submit batch.
//   - Peer's member task (canRequestTransfer=true): non-interactive
//     row with a hover overlay showing "Request to take this task".
//     Clicking the overlay fires the reassign RPC; after success the
//     overlay flips to a confirmed "Request sent" state.
// Both variants share the grid-layout + stage pill + due-label look.
function TeamTaskRow({
  task,
  dueLabel,
  isPending,
  checkVisual,
  canRequestTransfer,
  alreadyRequested,
  isRequesting,
  disableCheckbox,
  onTogglePending,
  onRequestTake,
}: {
  task: AssignedTask
  dueLabel: string | null
  isPending: boolean
  checkVisual: boolean
  canRequestTransfer: boolean
  alreadyRequested: boolean
  isRequesting: boolean
  disableCheckbox: boolean
  onTogglePending: () => void
  onRequestTake: () => void
}) {
  const rowBase = 'relative w-full text-left grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-2.5 py-2 rounded-[14px] border transition-all'

  const rowContent = (
    <>
      <span
        className={`shrink-0 w-[18px] h-[18px] mt-[2px] rounded-[5px] border-[1.5px] flex items-center justify-center ${
          isPending
            ? 'bg-gold/30 border-gold'
            : task.is_completed
              ? 'bg-gold/30 border-gold/40'
              : 'border-white/20'
        }`}
      >
        {checkVisual && <Check size={11} className="text-gold" strokeWidth={3} />}
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
      <span
        className={`shrink-0 text-[12px] tabular-nums whitespace-nowrap mt-[2px] ${
          dueLabel ? 'text-text-light' : 'text-text-light/30'
        }`}
        title={dueLabel ? `Due ${dueLabel}` : 'No due date'}
      >
        {dueLabel ?? '—'}
      </span>
    </>
  )

  if (canRequestTransfer) {
    // Non-own member task. Render as a div (not button) so clicks go
    // to the overlay, not a toggle. Overlay fades in on hover/focus.
    return (
      <div
        className={`group ${rowBase} bg-white/[0.018] border-transparent cursor-default overflow-hidden`}
        tabIndex={0}
      >
        {rowContent}
        <div
          className={`absolute inset-0 rounded-[14px] flex items-center justify-center transition-opacity ${
            alreadyRequested
              ? 'bg-emerald-500/15 ring-1 ring-emerald-500/30 opacity-100'
              : 'bg-gold/10 ring-1 ring-gold/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          }`}
        >
          {alreadyRequested ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-300">
              <Check size={12} strokeWidth={3} />
              Request sent
            </span>
          ) : (
            <button
              type="button"
              onClick={onRequestTake}
              disabled={isRequesting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-gradient-to-b from-gold to-gold-muted text-black hover:brightness-105 shadow-[0_6px_14px_rgba(214,170,55,0.25)] disabled:opacity-60"
            >
              <ArrowRightLeft size={12} strokeWidth={2.5} />
              Request to take this task
            </button>
          )}
        </div>
      </div>
    )
  }

  // Own task or studio-pool task — standard checkbox-button row.
  return (
    <button
      type="button"
      disabled={disableCheckbox}
      onClick={onTogglePending}
      className={`${rowBase} ${
        isPending
          ? 'bg-gold/8 border-gold/30'
          : 'bg-white/[0.018] border-transparent hover:bg-white/[0.03] hover:border-white/[0.08]'
      } ${task.is_completed && !isPending ? 'opacity-40' : ''} ${
        !task.can_complete ? 'cursor-default opacity-60' : ''
      }`}
    >
      {rowContent}
    </button>
  )
}
