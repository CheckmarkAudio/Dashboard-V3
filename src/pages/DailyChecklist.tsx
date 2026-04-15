import { useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { useTasks } from '../contexts/TaskContext'
import CreateTaskModal from '../components/CreateTaskModal'
import { Check, Send, Plus, Flame, Eye, EyeOff } from 'lucide-react'

/* ── Shared task row — used identically in all 3 columns ── */
function TaskRow({ title, due, priority, isDone, isPending, onCheck, onClickTitle, hideToday }: {
  title: string; due: string; priority: boolean; isDone: boolean; isPending: boolean
  onCheck: () => void; onClickTitle?: () => void; hideToday?: boolean
}) {
  const isChecked = isDone || isPending
  const isToday = due.toLowerCase().includes('today')
  // When hideToday is true (Today tab / Day filter), show just the time portion
  const dueLabel = hideToday && isToday ? (due.split(',')[1]?.trim() || '') : due.split(',')[0]
  return (
    <div className={`flex items-center gap-2 py-[11px] border-b border-border/30 last:border-0 transition-all ${isDone ? 'opacity-25' : ''}`}>
      <button onClick={onCheck} disabled={isDone} className="shrink-0">
        <div className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-all ${isDone ? 'bg-gold/30 border-gold/40' : isPending ? 'bg-gold/20 border-gold' : 'border-border-light hover:border-gold/50'}`}>
          {isChecked && <Check size={11} className="text-gold" />}
        </div>
      </button>
      <button onClick={onClickTitle} className={`flex-1 text-left text-[14px] font-normal tracking-tight truncate min-w-0 ${isDone ? 'line-through text-text-light' : 'text-text-muted hover:text-gold'} transition-colors`}>
        {title}
      </button>
      {priority && <Flame size={13} className="text-gold shrink-0" />}
      <span className="text-[11px] shrink-0 tabular-nums text-text-light">{dueLabel}</span>
    </div>
  )
}

/* ── Column header bar ── */
function ColumnHeader({ title, right, children }: { title: string; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="px-5 py-3.5 border-b border-border">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-text tracking-tight">{title}</h2>
        {right}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}

/* ── Full-width submit button at bottom of column ── */
function SubmitBar({ count, onClick, disabled }: { count: number; onClick: () => void; disabled: boolean }) {
  return (
    <div className="px-5 py-4 border-t border-border mt-auto">
      <button onClick={onClick} disabled={disabled}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold tracking-tight transition-all ${
          !disabled
            ? 'bg-gold text-black hover:bg-gold-muted shadow-md shadow-gold/20'
            : 'bg-surface-alt text-text-light border border-border cursor-not-allowed'
        }`}
      >
        <Check size={14} />
        {!disabled ? `Submit Completed (${count})` : 'Submit Completed'}
      </button>
    </div>
  )
}

/* ── Pill toggle (shared) ── */
/* ── Show/Hide completed toggle ── */
function CompletedToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-1 text-[10px] text-text-light hover:text-text-muted transition-colors">
      {show ? <EyeOff size={10} /> : <Eye size={10} />}
      {show ? 'Hide' : 'Show'} completed
    </button>
  )
}

function DayWeekToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex bg-surface-alt rounded-lg p-0.5 border border-border">
      {['Day', 'Week'].map(o => (
        <button key={o} onClick={() => onChange(o)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium tracking-tight transition-all ${value === o ? 'bg-gold/12 text-gold' : 'text-text-light hover:text-text-muted'}`}
        >{o}</button>
      ))}
    </div>
  )
}

/* ── Position / role data ── */
const POSITIONS = ['Marketing', 'Media', 'Engineer', 'Intern', 'Admin'] as const
type Position = typeof POSITIONS[number]

type RoleTask = { id: string; title: string; due: string; priority: boolean; done: boolean }

const ROLE_TASKS: Record<Position, RoleTask[]> = {
  Marketing: [
    { id: 'mk1', title: 'Draft Q2 social media calendar', due: 'Today, 5:00 PM', priority: true, done: false },
    { id: 'mk2', title: 'Review Instagram analytics', due: 'Apr 15', priority: false, done: false },
    { id: 'mk3', title: 'Create podcast promo copy', due: 'Apr 16', priority: false, done: true },
    { id: 'mk4', title: 'Update brand guidelines', due: 'Apr 18', priority: false, done: false },
    { id: 'mk5', title: 'Schedule newsletter send', due: 'Today, 3:00 PM', priority: true, done: true },
  ],
  Media: [
    { id: 'md1', title: 'Edit podcast episode 14', due: 'Today, 6:00 PM', priority: true, done: false },
    { id: 'md2', title: 'Color grade promo video', due: 'Apr 15', priority: false, done: false },
    { id: 'md3', title: 'Export stems for client', due: 'Today, 4:00 PM', priority: true, done: true },
    { id: 'md4', title: 'Upload B-roll to drive', due: 'Apr 16', priority: false, done: false },
  ],
  Engineer: [
    { id: 'en1', title: 'Mix Stanford session', due: 'Today, 5:00 PM', priority: true, done: false },
    { id: 'en2', title: 'Master album tracks', due: 'Apr 15', priority: true, done: false },
    { id: 'en3', title: 'Calibrate Studio A', due: 'Apr 16', priority: false, done: true },
    { id: 'en4', title: 'Backup session files', due: 'Apr 18', priority: false, done: false },
  ],
  Intern: [
    { id: 'in1', title: 'Shadow mixing session', due: 'Today, 3:00 PM', priority: true, done: false },
    { id: 'in2', title: 'Audio fundamentals mod 3', due: 'Apr 15', priority: false, done: false },
    { id: 'in3', title: 'Organize sample library', due: 'Apr 16', priority: false, done: true },
    { id: 'in4', title: 'Weekly reflection', due: 'Apr 18', priority: false, done: false },
  ],
  Admin: [
    { id: 'ad1', title: 'Process March invoices', due: 'Today, 5:00 PM', priority: true, done: false },
    { id: 'ad2', title: 'Update availability cal', due: 'Apr 15', priority: false, done: false },
    { id: 'ad3', title: 'File equipment receipts', due: 'Apr 16', priority: false, done: true },
    { id: 'ad4', title: 'Renew software licenses', due: 'Apr 18', priority: true, done: false },
  ],
}

/* ── My tasks data ── */
const MY_TODAY = [
  { id: 'my1', title: 'Draft Q2 social media calendar', due: 'Today, 5:00 PM', priority: true, done: false },
  { id: 'my2', title: 'Schedule newsletter send', due: 'Today, 3:00 PM', priority: true, done: false },
  { id: 'my3', title: 'Respond to influencer DMs', due: 'Today, 12:00 PM', priority: false, done: true },
  { id: 'my4', title: 'Post session highlight reel', due: 'Today, 6:00 PM', priority: false, done: false },
]
const MY_UPCOMING = [
  { id: 'up1', title: 'Review Instagram analytics', due: 'Apr 15', priority: false, done: false },
  { id: 'up2', title: 'Create podcast promo copy', due: 'Apr 16', priority: false, done: false },
  { id: 'up3', title: 'Update brand guidelines', due: 'Apr 18', priority: false, done: false },
  { id: 'up4', title: 'Plan May content calendar', due: 'Apr 21', priority: false, done: false },
  { id: 'up5', title: 'Q2 campaign launch prep', due: 'May 1', priority: true, done: false },
]

/* ── Maintenance tasks ── */
const MAINT_TASKS = [
  { id: 'mt1', title: 'Organize desktop & downloads', done: false },
  { id: 'mt2', title: 'Clear and sort email inbox', done: false },
  { id: 'mt3', title: 'Review and update task notes', done: false },
  { id: 'mt4', title: 'Check team comms', done: false },
  { id: 'mt5', title: 'Back up session files', done: false },
  { id: 'mt6', title: 'Tidy shared drive folders', done: false },
  { id: 'mt7', title: 'Review platform notifications', done: false },
  { id: 'mt8', title: 'Update availability calendar', done: false },
]

/* ═══ COLUMN 1: My Tasks ═══ */
function MyTasksCol() {
  const [timeRange, setTimeRange] = useState('Day')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())
  const [showCreate, setShowCreate] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  const items = timeRange === 'Day' ? MY_TODAY : MY_UPCOMING
  const active = items.filter(t => !t.done && !submitted.has(t.id))
  const completed = items.filter(t => t.done || submitted.has(t.id))
  const sorted = [...active].sort((a, b) => {
    const aD = a.done || submitted.has(a.id); const bD = b.done || submitted.has(b.id)
    return aD === bD ? 0 : aD ? 1 : -1
  })

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
      <ColumnHeader title="My Tasks" right={<DayWeekToggle value={timeRange} onChange={setTimeRange} />} />
      <div className="flex-1 px-5 py-1 space-y-0">
        {sorted.map(t => (
          <TaskRow key={t.id} title={t.title} due={t.due} priority={t.priority}
            isDone={t.done || submitted.has(t.id)} isPending={checked.has(t.id)}
            onCheck={() => !(t.done || submitted.has(t.id)) && setChecked(p => { const n = new Set(p); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })}
            hideToday={timeRange === 'Day'}
          />
        ))}
        {/* + Task button at end of list */}
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 py-[11px] text-[14px] font-normal tracking-tight text-text-light hover:text-gold transition-colors">
          <Plus size={14} className="text-gold" /> Task
        </button>
        {/* Completed section */}
        {completed.length > 0 && (
          <div className="pt-1 mt-1 border-t border-border/30">
            <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted(!showCompleted)} />
            {showCompleted && completed.map(t => (
              <TaskRow key={t.id} title={t.title} due={t.due} priority={t.priority} isDone={true} isPending={false} onCheck={() => {}} hideToday={timeRange === 'Day'} />
            ))}
          </div>
        )}
      </div>
      <SubmitBar count={checked.size} onClick={() => { setSubmitted(p => { const n = new Set(p); checked.forEach(id => n.add(id)); return n }); setChecked(new Set()) }} disabled={checked.size === 0} />
    </div>
  )
}

/* ═══ COLUMN 2: Team Tasks ═══ */
function TeamTasksCol() {
  const [pos, setPos] = useState<Position>('Marketing')
  const [time, setTime] = useState('Week')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())

  const tasks = ROLE_TASKS[pos]
  const [showCompleted, setShowCompleted] = useState(false)
  const active = tasks.filter(t => !t.done && !submitted.has(t.id))
  const completed = tasks.filter(t => t.done || submitted.has(t.id))

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
      <ColumnHeader title="Team Tasks" right={<DayWeekToggle value={time} onChange={setTime} />}>
        <div className="flex gap-0.5 flex-wrap">
          {POSITIONS.map(p => (
            <button key={p} onClick={() => { setPos(p); setChecked(new Set()); setSubmitted(new Set()) }}
              className={`px-1.5 py-0.5 rounded text-[11px] tracking-tight transition-all ${pos === p ? 'text-gold font-medium' : 'text-text-light font-normal hover:text-text-muted'}`}
            >{p}</button>
          ))}
        </div>
      </ColumnHeader>
      <div className="flex-1 px-5 py-1 space-y-0">
        {active.map(t => (
          <TaskRow key={t.id} title={t.title} due={t.due} priority={t.priority}
            isDone={false} isPending={checked.has(t.id)}
            onCheck={() => setChecked(p => { const n = new Set(p); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })}
            hideToday={time === 'Day'}
          />
        ))}
        {completed.length > 0 && (
          <div className="pt-1 mt-1 border-t border-border/30">
            <CompletedToggle show={showCompleted} onToggle={() => setShowCompleted(!showCompleted)} />
            {showCompleted && completed.map(t => (
              <TaskRow key={t.id} title={t.title} due={t.due} priority={t.priority} isDone={true} isPending={false} onCheck={() => {}} hideToday={time === 'Day'} />
            ))}
          </div>
        )}
      </div>
      <SubmitBar count={checked.size} onClick={() => { setSubmitted(p => { const n = new Set(p); checked.forEach(id => n.add(id)); return n }); setChecked(new Set()) }} disabled={checked.size === 0} />
    </div>
  )
}

/* ── Team Dailies data (recurring daily) ── */
const TEAM_DAILIES = [
  { id: 'td1', title: 'Submit media content to Dropbox' },
  { id: 'td2', title: 'Take trash out' },
  { id: 'td3', title: 'Put away cables' },
]

type SignOff = { name: string; date: string }

/* ═══ COLUMN 3: Maintenance ═══ */
function MaintenanceCol() {
  const { profile } = useAuth()
  const [studioTime, setStudioTime] = useState('Day')
  // Team Dailies state
  const [dailyChecked, setDailyChecked] = useState<Set<string>>(new Set())
  const [dailySignOffs, setDailySignOffs] = useState<Record<string, SignOff>>({})
  const dailyHasPending = dailyChecked.size > 0

  const submitDailies = () => {
    const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const name = profile?.display_name ?? 'Unknown'
    setDailySignOffs(prev => {
      const next = { ...prev }
      dailyChecked.forEach(id => { next[id] = { name, date: now } })
      return next
    })
    setDailyChecked(new Set())
  }

  // Maintenance state
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())
  const maintHasPending = checked.size > 0

  const sorted = [...MAINT_TASKS].sort((a, b) => {
    const aD = a.done || submitted.has(a.id); const bD = b.done || submitted.has(b.id)
    return aD === bD ? 0 : aD ? 1 : -1
  })
  const doneCount = MAINT_TASKS.filter(t => t.done || submitted.has(t.id)).length

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
      <ColumnHeader title="Studio Tasks" />

      {/* ── Team Dailies ── */}
      <div className="px-5 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-[11px] font-semibold text-gold uppercase tracking-wider">Team Dailies</p>
          <span className="text-[9px] text-text-light">Resets daily at 9:00 AM</span>
        </div>
        <div className="space-y-0">
          {TEAM_DAILIES.map(t => {
            const signOff = dailySignOffs[t.id]
            const isDone = !!signOff
            const isPending = dailyChecked.has(t.id)
            const isChecked = isDone || isPending
            return (
              <div key={t.id} className={`border-b border-border/30 last:border-0 transition-all ${isDone ? 'opacity-25' : ''}`}>
                <div className="flex items-center gap-2 py-[11px]">
                  <button onClick={() => !isDone && setDailyChecked(p => { const n = new Set(p); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })} disabled={isDone} className="shrink-0">
                    <div className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-all ${isDone ? 'bg-gold/30 border-gold/40' : isPending ? 'bg-gold/20 border-gold' : 'border-border-light hover:border-gold/50'}`}>
                      {isChecked && <Check size={11} className="text-gold" />}
                    </div>
                  </button>
                  <span className={`flex-1 text-[14px] font-normal tracking-tight truncate ${isDone ? 'line-through text-text-light' : 'text-text-muted'}`}>{t.title}</span>
                </div>
                {signOff && (
                  <p className="text-[10px] text-text-light pb-1" style={{ marginLeft: 26 }}>
                    Signed off: {signOff.name} · {signOff.date}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        {/* Submit dailies */}
        {dailyHasPending && (
          <button onClick={submitDailies} className="w-full mt-3 py-2.5 rounded-xl bg-gold text-black text-[13px] font-semibold tracking-tight flex items-center justify-center gap-1.5 hover:bg-gold-muted transition-colors">
            <Check size={13} /> Submit Dailies ({dailyChecked.size})
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-border/40" />

      {/* ── Optional Maintenance ── */}
      <div className="px-5 pt-3 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[11px] font-semibold text-gold uppercase tracking-wider">Additional Tasks</p>
          <span className="text-[9px] text-text-light">{doneCount}/{MAINT_TASKS.length}</span>
        </div>
      </div>
      <div className="flex-1 px-5 py-1 space-y-0">
        {sorted.map(t => {
          const isDone = t.done || submitted.has(t.id)
          const isPending = checked.has(t.id)
          const isChecked = isDone || isPending
          return (
            <div key={t.id} className={`flex items-center gap-2 py-[11px] border-b border-border/30 last:border-0 transition-all ${isDone ? 'opacity-25' : ''}`}>
              <button onClick={() => !isDone && setChecked(p => { const n = new Set(p); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })} disabled={isDone} className="shrink-0">
                <div className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-all ${isDone ? 'bg-gold/30 border-gold/40' : isPending ? 'bg-gold/20 border-gold' : 'border-border-light hover:border-gold/50'}`}>
                  {isChecked && <Check size={11} className="text-gold" />}
                </div>
              </button>
              <span className={`text-[14px] font-normal tracking-tight truncate ${isDone ? 'line-through text-text-light' : 'text-text-muted'}`}>{t.title}</span>
            </div>
          )
        })}
      </div>
      <SubmitBar count={checked.size} onClick={() => { setSubmitted(p => { const n = new Set(p); checked.forEach(id => n.add(id)); return n }); setChecked(new Set()) }} disabled={!maintHasPending} />
    </div>
  )
}

/* ═══ PAGE ═══ */
export default function DailyChecklist() {
  useDocumentTitle('Tasks - Checkmark Audio')
  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <h1 className="text-[28px] font-extrabold tracking-tight text-text mb-4">Tasks</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
        <MaintenanceCol />
        <MyTasksCol />
        <TeamTasksCol />
      </div>
    </div>
  )
}
