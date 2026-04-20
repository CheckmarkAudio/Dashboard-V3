import { useMemo, useState, type ReactNode } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import CreateTaskModal from '../components/CreateTaskModal'
import { Check, Plus, Flame, Eye, EyeOff } from 'lucide-react'

/**
 * Tasks page — matches the Workspace-UI-Draft tasks.html mockup.
 *
 * Three cards in a mixed grid:
 *   Left (big, full height): Team Tasks — aggregate team-wide tasks
 *     tagged by flywheel stage. Filter pills at top let you slice by
 *     stage.
 *   Top-right: My Tasks — the user's own tasks, Day/Week tabs,
 *     stage filter pills, time-of-day meta, Submit Completed button.
 *   Bottom-right: Studio Tasks — recurring studio maintenance,
 *     Daily + Weekly segments, Submit Completed button.
 *
 * Data is still mock until Phase 2 (personalized user data model)
 * wires this to Supabase. All state is client-only.
 */

// ─── Flywheel stage model ─────────────────────────────────────────

type Stage = 'deliver' | 'capture' | 'share' | 'attract' | 'book'

const STAGES: readonly Stage[] = ['deliver', 'capture', 'share', 'attract', 'book']

// Stage tag text uses the 400/70 token so the dot does the
// color-coding work while the label recedes — keeps the task title
// and checkbox as the primary visual anchors. The dots stay at full
// 400 saturation for instant scanning.
const STAGE_STYLE: Record<Stage, { label: string; text: string; dot: string; bg: string; ring: string }> = {
  deliver: { label: 'Deliver', text: 'text-blue-400/70',   dot: 'bg-blue-400',   bg: 'bg-blue-500/5',   ring: 'ring-blue-500/15' },
  capture: { label: 'Capture', text: 'text-violet-400/70', dot: 'bg-violet-400', bg: 'bg-violet-500/5', ring: 'ring-violet-500/15' },
  share:   { label: 'Share',   text: 'text-cyan-400/70',   dot: 'bg-cyan-400',   bg: 'bg-cyan-500/5',   ring: 'ring-cyan-500/15' },
  attract: { label: 'Attract', text: 'text-pink-400/70',   dot: 'bg-pink-400',   bg: 'bg-pink-500/5',   ring: 'ring-pink-500/15' },
  book:    { label: 'Book',    text: 'text-orange-400/70', dot: 'bg-orange-400', bg: 'bg-orange-500/5', ring: 'ring-orange-500/15' },
}

// ─── Shared row component ────────────────────────────────────────
// One task in any list. Optionally renders a stage tag on the right
// (for Team / My Tasks) OR a plain meta label (for Studio Tasks).

function TaskRow({
  title,
  meta,
  stage,
  priority,
  isDone,
  isPending,
  onCheck,
}: {
  title: string
  meta?: string
  stage?: Stage
  priority?: boolean
  isDone: boolean
  isPending: boolean
  onCheck: () => void
}) {
  const isChecked = isDone || isPending
  const stageStyle = stage ? STAGE_STYLE[stage] : null

  return (
    <div
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center py-2.5 border-b border-white/5 last:border-0 transition-opacity ${
        isDone ? 'opacity-30' : ''
      }`}
    >
      <button
        onClick={onCheck}
        disabled={isDone}
        className="shrink-0"
        aria-label={isChecked ? 'Mark incomplete' : 'Mark complete'}
      >
        <div
          className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-all ${
            isDone
              ? 'bg-gold/30 border-gold/40'
              : isPending
                ? 'bg-gold/20 border-gold'
                : 'border-white/20 hover:border-gold/60'
          }`}
        >
          {isChecked && <Check size={11} className="text-gold" strokeWidth={3} />}
        </div>
      </button>
      <div className="min-w-0 flex items-center gap-2">
        <span
          className={`text-[14px] leading-snug truncate ${
            isDone ? 'line-through text-text-light' : 'text-text'
          }`}
        >
          {title}
        </span>
        {priority && <Flame size={12} className="text-gold shrink-0" aria-hidden="true" />}
      </div>
      {stageStyle ? (
        // Colored-text-only stage label — no pill, no ring. Fixed
        // width (w-[68px]) so every row reserves the same horizontal
        // slot for the tag, which keeps dots vertically aligned across
        // rows even though label text varies (Book vs Capture etc.).
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap w-[68px] ${stageStyle.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot} shrink-0`} aria-hidden="true" />
          {stageStyle.label}
        </span>
      ) : meta ? (
        <span className="text-[12px] text-text-light whitespace-nowrap tabular-nums">{meta}</span>
      ) : null}
    </div>
  )
}

// ─── Stage filter pill strip ──────────────────────────────────────
// "All 22 / Deliver 6 / Capture 9 / …". Clicking a pill filters the
// list below. Active pill uses the stage's color; inactive uses the
// muted gray treatment.

function StagePillRow({
  counts,
  active,
  onChange,
}: {
  counts: Record<'all' | Stage, number>
  active: 'all' | Stage
  onChange: (next: 'all' | Stage) => void
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <StagePill
        label="All"
        count={counts.all}
        tone="gold"
        isActive={active === 'all'}
        onClick={() => onChange('all')}
      />
      {STAGES.map((s) => (
        <StagePill
          key={s}
          label={STAGE_STYLE[s].label}
          count={counts[s]}
          tone={s}
          isActive={active === s}
          onClick={() => onChange(s)}
        />
      ))}
    </div>
  )
}

function StagePill({
  label,
  count,
  tone,
  isActive,
  onClick,
}: {
  label: string
  count: number
  tone: 'gold' | Stage
  isActive: boolean
  onClick: () => void
}) {
  const stageStyle = tone === 'gold' ? null : STAGE_STYLE[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ring-1 whitespace-nowrap ${
        isActive
          ? tone === 'gold'
            ? 'bg-gold/15 text-gold ring-gold/30'
            : `${stageStyle!.bg} ${stageStyle!.text} ${stageStyle!.ring}`
          : 'bg-white/[0.03] text-text-light ring-white/10 hover:text-text'
      }`}
    >
      {stageStyle && (
        <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} aria-hidden="true" />
      )}
      {label}
      <span className={`tabular-nums ${isActive ? 'opacity-100' : 'opacity-70'}`}>{count}</span>
    </button>
  )
}

// ─── Card chrome (widget-card class) ──────────────────────────────

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <article className={`widget-card flex flex-col overflow-hidden ${className}`}>{children}</article>
}

function CardHeader({ children }: { children: ReactNode }) {
  return <div className="px-5 pt-4 pb-3 border-b border-white/5">{children}</div>
}

function SubmitBar({
  count,
  onClick,
  disabled,
}: {
  count: number
  onClick: () => void
  disabled: boolean
}) {
  return (
    <div className="px-5 py-4 border-t border-white/5 mt-auto">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all ${
          disabled
            ? 'bg-white/[0.03] text-text-light ring-1 ring-white/5 cursor-not-allowed'
            : 'bg-gradient-to-b from-gold to-gold-muted text-black hover:brightness-105 shadow-[0_14px_28px_rgba(214,170,55,0.22)]'
        }`}
      >
        <Check size={14} strokeWidth={3} />
        {disabled ? 'Submit Completed' : `Submit Completed (${count})`}
      </button>
    </div>
  )
}

function DayWeekToggle({ value, onChange }: { value: 'Day' | 'Week'; onChange: (v: 'Day' | 'Week') => void }) {
  return (
    <div className="flex bg-white/[0.03] rounded-lg p-1 ring-1 ring-white/5">
      {(['Day', 'Week'] as const).map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-3 py-1 rounded-md text-[11px] font-bold tracking-tight transition-colors ${
            value === o ? 'bg-gold/16 text-gold' : 'text-text-light hover:text-text'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

function CompletedToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 text-[11px] text-text-light hover:text-text transition-colors py-1"
    >
      {show ? <EyeOff size={11} /> : <Eye size={11} />}
      {show ? 'Hide' : 'Show'} completed
    </button>
  )
}

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

type MyTask = {
  id: string
  title: string
  stage: Stage
  due: string
  priority?: boolean
  done: boolean
}

const MY_TODAY: MyTask[] = [
  { id: 'm1', title: 'Draft Q2 social media calendar',    stage: 'share',   due: '5:00 PM',  priority: true,  done: false },
  { id: 'm2', title: 'Schedule newsletter send',          stage: 'share',   due: '3:00 PM',  priority: true,  done: false },
  { id: 'm3', title: 'Post session highlight reel',       stage: 'share',   due: '6:00 PM',                    done: false },
  { id: 'm4', title: 'Follow up on three pending inquiries', stage: 'book', due: 'Today',    priority: true,  done: false },
  { id: 'm5', title: 'Respond to influencer DMs',         stage: 'capture', due: '12:00 PM',                   done: true  },
]

const MY_WEEK: MyTask[] = [
  { id: 'w1', title: 'Review Instagram analytics',        stage: 'capture', due: 'Apr 15',                     done: false },
  { id: 'w2', title: 'Create podcast promo copy',         stage: 'share',   due: 'Apr 16',                     done: false },
  { id: 'w3', title: 'Plan May content calendar',         stage: 'share',   due: 'Apr 21',                     done: false },
  { id: 'w4', title: 'Q2 campaign launch prep',           stage: 'attract', due: 'May 1',   priority: true,  done: false },
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

// ─── Helpers ──────────────────────────────────────────────────────

function countByStage(tasks: { stage: Stage; done: boolean }[], submitted: Set<string> = new Set<string>(), idKey: (t: any) => string = (t) => t.id) {
  const active = tasks.filter((t) => !t.done && !submitted.has(idKey(t)))
  const counts: Record<'all' | Stage, number> = { all: active.length, deliver: 0, capture: 0, share: 0, attract: 0, book: 0 }
  for (const t of active) counts[t.stage]++
  return counts
}

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
                stage={t.stage}
                priority={t.priority}
                isDone={isDone}
                isPending={isPending}
                onCheck={() =>
                  !isDone &&
                  setChecked((prev) => {
                    const n = new Set(prev)
                    n.has(t.id) ? n.delete(t.id) : n.add(t.id)
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

// ─── Card 2: My Tasks ─────────────────────────────────────────────

function MyTasksCard() {
  const [timeRange, setTimeRange] = useState<'Day' | 'Week'>('Day')
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())
  const [showCompleted, setShowCompleted] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const items = timeRange === 'Day' ? MY_TODAY : MY_WEEK

  const counts = useMemo(() => countByStage(items, submitted), [items, submitted])
  const visible = useMemo(() => {
    return items.filter((t) => {
      const isDone = t.done || submitted.has(t.id)
      if (isDone && !showCompleted) return false
      if (stageFilter !== 'all' && t.stage !== stageFilter) return false
      return true
    })
  }, [items, stageFilter, submitted, showCompleted])

  const onSubmit = () => {
    setSubmitted((prev) => {
      const next = new Set(prev)
      checked.forEach((id) => next.add(id))
      return next
    })
    setChecked(new Set())
  }

  return (
    <Card>
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-bold tracking-tight text-text">My Tasks</h2>
          <DayWeekToggle value={timeRange} onChange={setTimeRange} />
        </div>
        <div className="mt-3">
          <StagePillRow counts={counts} active={stageFilter} onChange={setStageFilter} />
        </div>
      </CardHeader>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-2">
        {visible.map((t) => {
          const isDone = t.done || submitted.has(t.id)
          const isPending = checked.has(t.id)
          return (
            <TaskRow
              key={t.id}
              title={t.title}
              meta={t.due}
              priority={t.priority}
              isDone={isDone}
              isPending={isPending}
              onCheck={() =>
                !isDone &&
                setChecked((prev) => {
                  const n = new Set(prev)
                  n.has(t.id) ? n.delete(t.id) : n.add(t.id)
                  return n
                })
              }
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
                    n.has(t.id) ? n.delete(t.id) : n.add(t.id)
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
