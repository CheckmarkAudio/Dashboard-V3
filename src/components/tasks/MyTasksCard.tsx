// ============================================================================
// MyTasksCard — the personal "My Tasks" widget. Used in two places:
//   • /daily Tasks page (right column, sits above Studio Tasks)
//   • Overview page    (replaces the old generic "Tasks" widget)
//
// State (which boxes are pending, which got submitted) lives in
// MyTasksContext so the two surfaces stay in sync — checking on
// Overview shows pending on /daily and vice versa.
//
// Local state (range Day/Week, stage filter, show completed): each
// surface keeps its own so admins can compare different slices side
// by side without the toggles fighting each other.
// ============================================================================

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import CreateTaskModal from '../CreateTaskModal'
import { useMyTasks, type MyTask } from '../../contexts/MyTasksContext'
import {
  Card,
  CardHeader,
  CompletedToggle,
  DayWeekToggle,
  StagePillRow,
  SubmitBar,
  TaskRow,
  countByStage,
  type Stage,
} from './shared'

type Range = 'Day' | 'Week'

export default function MyTasksCard() {
  const { today, week, pendingIds, submittedIds, togglePending, submitPending } = useMyTasks()
  const [range, setRange] = useState<Range>('Day')
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all')
  const [showCompleted, setShowCompleted] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const items: MyTask[] = range === 'Day' ? today : week

  const counts = useMemo(
    () => countByStage(items, submittedIds),
    [items, submittedIds],
  )

  const visible = useMemo(
    () =>
      items.filter((t) => {
        const isDone = t.done || submittedIds.has(t.id)
        if (isDone && !showCompleted) return false
        if (stageFilter !== 'all' && t.stage !== stageFilter) return false
        return true
      }),
    [items, stageFilter, submittedIds, showCompleted],
  )

  const pendingInVisible = useMemo(
    () => visible.reduce((n, t) => (pendingIds.has(t.id) ? n + 1 : n), 0),
    [visible, pendingIds],
  )

  return (
    <Card className="h-full">
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}

      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-bold tracking-tight text-text">My Tasks</h2>
          <DayWeekToggle value={range} onChange={setRange} />
        </div>
        <div className="mt-2.5">
          <StagePillRow counts={counts} active={stageFilter} onChange={setStageFilter} />
        </div>
      </CardHeader>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1">
        {visible.map((t) => {
          const isDone = t.done || submittedIds.has(t.id)
          const isPending = pendingIds.has(t.id)
          return (
            <TaskRow
              key={t.id}
              title={t.title}
              meta={t.due}
              priority={t.priority}
              isDone={isDone}
              isPending={isPending}
              onCheck={() => !isDone && togglePending(t.id)}
            />
          )
        })}
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 py-2.5 text-[13px] font-semibold text-gold/80 hover:text-gold transition-colors"
        >
          <Plus size={13} strokeWidth={2.2} /> Task
        </button>
        <div className="pt-1">
          <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((s) => !s)} />
        </div>
      </div>

      <SubmitBar count={pendingInVisible} onClick={submitPending} />
    </Card>
  )
}
