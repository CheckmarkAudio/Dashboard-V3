import { useMemo, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import {
  Card,
  CardHeader,
  CompletedToggle,
  StagePillRow,
  SubmitBar,
  TaskRow,
  countByStage,
  type Stage,
  STAGE_STYLE,
} from '../components/tasks/shared'
import MyTasksCard from '../components/tasks/MyTasksCard'

/**
 * Tasks page — matches the Workspace-UI-Draft tasks.html mockup.
 *
 * Three cards in a mixed grid:
 *   Left (big, full height): Team Tasks — aggregate team-wide tasks
 *     tagged by flywheel stage. Filter pills at top let you slice by
 *     stage.
 *   Top-right: My Tasks — the user's own tasks. Now lives in
 *     `components/tasks/MyTasksCard.tsx` so the same widget mounts
 *     on the Overview page (synched via MyTasksContext).
 *   Bottom-right: Studio Tasks — recurring studio maintenance,
 *     Daily + Weekly segments, Submit Completed button.
 */

// ─── Mock data (Phase-1 placeholder until DB snapshot RPC lands) ──

type StagedTask = {
  id: string
  title: string
  stage: Stage
  done: boolean
  priority?: boolean
}

const TEAM_TASKS: StagedTask[] = [
  { id: 't1',  title: 'Floors, desks, and visible surfaces are tidy',     stage: 'deliver' , done: false },
  { id: 't2',  title: 'Studio space is clean and presentable',            stage: 'capture' , done: false },
  { id: 't3',  title: 'Cables are wrapped and organized',                 stage: 'share'   , done: false },
  { id: 't4',  title: 'Update lead list or project tracker',              stage: 'attract' , done: false },
  { id: 't5',  title: 'Log any new contacts, inquiries, or follow-ups',   stage: 'book'    , done: false },
  { id: 't6',  title: 'Water, supplies, and hospitality items are stocked', stage: 'deliver', done: false },
  { id: 't7',  title: 'Microphones, stands, and headphones are in place', stage: 'capture' , done: false },
  { id: 't8',  title: 'Trash removed if needed',                          stage: 'deliver' , done: false },
  { id: 't9',  title: 'Post behind-the-scenes reel',                      stage: 'share'   , done: false },
  { id: 't10', title: 'Send pre-session confirmations',                   stage: 'book'    , done: true  },
  { id: 't11', title: 'Capture session photos for social',                stage: 'capture' , done: false },
  { id: 't12', title: 'Research new outbound leads',                      stage: 'attract' , done: false },
]

type RecurringTask = { id: string; title: string; frequency: 'Daily' | 'Weekly'; done: boolean }

const STUDIO_TASKS: RecurringTask[] = [
  { id: 's1',  title: 'Submit media content to Dropbox',          frequency: 'Daily',  done: false },
  { id: 's2',  title: 'Take trash out',                           frequency: 'Daily',  done: false },
  { id: 's3',  title: 'Put away cables',                          frequency: 'Daily',  done: false },
  { id: 's4',  title: 'Reset microphones and headphones',         frequency: 'Daily',  done: false },
  { id: 's5',  title: 'Deep clean control room surfaces',         frequency: 'Weekly', done: false },
  { id: 's6',  title: 'Review and restock hospitality supplies',  frequency: 'Weekly', done: false },
  { id: 's7',  title: 'Archive completed session folders',        frequency: 'Weekly', done: false },
  { id: 's8',  title: 'Check backup status on shared drives',     frequency: 'Weekly', done: false },
]

// ─── Card 1: Team Tasks ───────────────────────────────────────────

function TeamTasksCard() {
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())
  const [showCompleted, setShowCompleted] = useState(false)

  const counts = useMemo(() => countByStage(TEAM_TASKS, submitted), [submitted])
  const visible = useMemo(() => {
    return TEAM_TASKS.filter((t) => {
      const isDone = t.done || submitted.has(t.id)
      if (isDone && !showCompleted) return false
      if (stageFilter !== 'all' && t.stage !== stageFilter) return false
      return true
    })
  }, [stageFilter, submitted, showCompleted])

  const todayLabel = new Date()
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase()

  const onSubmit = () => {
    setSubmitted((prev) => {
      const next = new Set(prev)
      checked.forEach((id) => next.add(id))
      return next
    })
    setChecked(new Set())
  }

  return (
    <Card className="lg:row-span-2 h-full">
      <CardHeader>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold/80">
          Today by flywheel stage.
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h2 className="text-[22px] font-bold tracking-tight text-text">Team Tasks</h2>
          <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted((s) => !s)} />
        </div>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gold/80">
          Today · {todayLabel}
        </p>
        <div className="mt-2">
          <StagePillRow counts={counts} active={stageFilter} onChange={setStageFilter} />
        </div>
      </CardHeader>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-2">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-text-light italic">
            {stageFilter === 'all' ? 'No open tasks.' : `No ${STAGE_STYLE[stageFilter].label} tasks today.`}
          </p>
        ) : (
          visible.map((t) => {
            const isDone = t.done || submitted.has(t.id)
            const isPending = checked.has(t.id)
            return (
              <TaskRow
                key={t.id}
                title={t.title}
                priority={t.priority}
                isDone={isDone}
                isPending={isPending}
                onCheck={() =>
                  !isDone &&
                  setChecked((prev) => {
                    const n = new Set(prev)
                    if (n.has(t.id)) n.delete(t.id)
                    else n.add(t.id)
                    return n
                  })
                }
              />
            )
          })
        )}
      </div>

      <SubmitBar count={checked.size} onClick={onSubmit} disabled={checked.size === 0} />
    </Card>
  )
}

// ─── Card 3: Studio Tasks ─────────────────────────────────────────

function StudioTasksCard() {
  const { profile } = useAuth()
  const [activeFreq, setActiveFreq] = useState<'Daily' | 'Weekly'>('Daily')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())
  const [signOffs, setSignOffs] = useState<Record<string, { name: string; date: string }>>({})

  const dailyTasks = STUDIO_TASKS.filter((t) => t.frequency === 'Daily')
  const weeklyTasks = STUDIO_TASKS.filter((t) => t.frequency === 'Weekly')

  const onSubmit = () => {
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const name = profile?.display_name ?? 'Someone'
    setSignOffs((prev) => {
      const next = { ...prev }
      checked.forEach((id) => {
        next[id] = { name, date }
      })
      return next
    })
    setSubmitted((prev) => {
      const next = new Set(prev)
      checked.forEach((id) => next.add(id))
      return next
    })
    setChecked(new Set())
  }

  const renderSection = (heading: string, tasks: RecurringTask[]) => (
    <>
      <div className="px-5 pt-4 pb-1 flex items-baseline gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold/80">{heading}</p>
        <span className="text-[11px] text-text-light">Recurring</span>
      </div>
      <div className="px-5">
        {tasks.map((t) => {
          const isDone = t.done || submitted.has(t.id)
          const isPending = checked.has(t.id)
          const signOff = signOffs[t.id]
          return (
            <div
              key={t.id}
              className={`border-b border-white/5 last:border-0 transition-opacity ${
                isDone ? 'opacity-35' : ''
              }`}
            >
              <TaskRow
                title={t.title}
                meta={t.frequency}
                isDone={isDone}
                isPending={isPending}
                onCheck={() =>
                  !isDone &&
                  setChecked((prev) => {
                    const n = new Set(prev)
                    if (n.has(t.id)) n.delete(t.id)
                    else n.add(t.id)
                    return n
                  })
                }
              />
              {signOff && (
                <p className="text-[10px] text-text-light pb-1 pl-[26px]">
                  Signed off · {signOff.name} · {signOff.date}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-bold tracking-tight text-text">Studio Tasks</h2>
        </div>
        <div className="mt-3 flex items-center gap-3">
          {(['Daily', 'Weekly'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFreq(f)}
              className={`text-[12px] font-bold tracking-tight transition-colors ${
                activeFreq === f ? 'text-gold' : 'text-text-light hover:text-text'
              }`}
            >
              {f} Tasks
            </button>
          ))}
        </div>
      </CardHeader>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeFreq === 'Daily' ? renderSection('Daily Tasks', dailyTasks) : renderSection('Weekly Tasks', weeklyTasks)}
      </div>

      <SubmitBar count={checked.size} onClick={onSubmit} disabled={checked.size === 0} />
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function DailyChecklist() {
  useDocumentTitle('Tasks - Checkmark Workspace')
  return (
    <div className="max-w-[1280px] mx-auto animate-fade-in">
      <h1 className="text-[44px] font-bold tracking-[-0.04em] leading-none text-text mb-6">
        Tasks
      </h1>
      {/* Two-column mixed grid:
          - Desktop: Team Tasks spans 2 rows on the left (big column),
            My Tasks + Studio Tasks stack on the right.
          - Mobile: single column, Team first, then My, then Studio. */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)' }}
      >
        <TeamTasksCard />
        <div className="flex flex-col gap-4 min-w-0">
          <MyTasksCard />
          <StudioTasksCard />
        </div>
      </div>
    </div>
  )
}
