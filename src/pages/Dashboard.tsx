import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTasks } from '../contexts/TaskContext'
import CreateTaskModal from '../components/CreateTaskModal'
import {
  ChevronRight, Instagram, Music2, Youtube,
  Clock, Check, Calendar as CalendarIcon, Send, Plus,
  LogIn, LogOut, X, FileText, Flame,
} from 'lucide-react'
import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts'

/* ── Self Report Modal ── */
function SelfReportModal({ clockInTime, onClose }: { clockInTime: string; onClose: () => void }) {
  const { tasks, bookings } = useTasks()
  const [wentWell, setWentWell] = useState('')
  const [toImprove, setToImprove] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const completedTasks = tasks.filter(t => t.completed)
  const completedBookings = bookings.filter(b => b.status === 'Confirmed')
  const totalCompleted = completedTasks.length + completedBookings.length

  const now = new Date()
  const clockOutTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  const handleSubmit = () => {
    setSubmitted(true)
    setTimeout(onClose, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl border border-border w-full max-w-lg mx-4 p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-text">Self Report</h2>
            <p className="text-[11px] text-text-muted">Clocked in: {clockInTime} · Clocking out: {clockOutTime}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted"><X size={18} /></button>
        </div>

        {submitted ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-gold" />
            </div>
            <p className="text-sm font-semibold text-text">Report submitted! Great work today.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-surface-alt rounded-xl border border-border p-3 text-center">
                <p className="text-lg font-bold text-gold">{totalCompleted}</p>
                <p className="text-[9px] text-text-muted uppercase">Total</p>
              </div>
              <div className="bg-surface-alt rounded-xl border border-border p-3 text-center">
                <p className="text-lg font-bold text-gold">{completedTasks.length}</p>
                <p className="text-[9px] text-text-muted uppercase">Tasks</p>
              </div>
              <div className="bg-surface-alt rounded-xl border border-border p-3 text-center">
                <p className="text-lg font-bold text-gold">{completedBookings.length}</p>
                <p className="text-[9px] text-text-muted uppercase">Bookings</p>
              </div>
              <div className="bg-surface-alt rounded-xl border border-border p-3 text-center">
                <p className="text-lg font-bold text-gold">{completedBookings.length}</p>
                <p className="text-[9px] text-text-muted uppercase">Sessions</p>
              </div>
            </div>

            {/* Completed tasks list */}
            {completedTasks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Completed Tasks</p>
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
                  {completedTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-alt/50">
                      <Check size={10} className="text-gold shrink-0" />
                      <span className="text-[12px] text-text-muted truncate">{t.title}</span>
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded shrink-0 ml-auto" style={{ color: t.stageColor, backgroundColor: t.stageColor + '15' }}>{t.stage}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmed bookings with date & duration */}
            {completedBookings.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Confirmed Bookings</p>
                <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                  {completedBookings.map(b => {
                    // Calculate duration
                    const [sh, sm] = b.startTime.split(':').map(Number)
                    const [eh, em] = b.endTime.split(':').map(Number)
                    const mins = (eh * 60 + em) - (sh * 60 + sm)
                    const durHrs = Math.floor(mins / 60)
                    const durMins = mins % 60
                    const durLabel = durHrs > 0 ? `${durHrs}h${durMins > 0 ? ` ${durMins}m` : ''}` : `${durMins}m`
                    return (
                      <div key={b.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-surface-alt/50">
                        <Check size={10} className="text-gold shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[12px] text-text truncate block">{b.client} — {b.description}</span>
                          <span className="text-[9px] text-text-muted">{b.date} · {b.startTime}–{b.endTime} · {b.studio}</span>
                        </div>
                        <span className="text-[9px] font-semibold text-gold bg-gold/10 px-1.5 py-0.5 rounded shrink-0">{durLabel}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Completed sessions — bookings that were actually worked today */}
            {(() => {
              const SESSION_TYPE_LABELS: Record<string, string> = {
                engineering: 'Engineering', training: 'Training', education: 'Education',
                music_lesson: 'Music Lesson', consultation: 'Consultation',
              }
              const todayStr = new Date().toISOString().split('T')[0]
              const todaySessions = completedBookings.filter(b => b.date === todayStr || b.date <= todayStr)
              if (todaySessions.length === 0) return null
              // Group by type
              const byType: Record<string, typeof todaySessions> = {}
              for (const s of todaySessions) {
                const key = s.type
                if (!byType[key]) byType[key] = []
                byType[key].push(s)
              }
              return (
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Completed Sessions</p>
                  <div className="space-y-1.5">
                    {Object.entries(byType).map(([type, sessions]) => (
                      <div key={type} className="px-2.5 py-2 rounded-lg bg-surface-alt/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-text">{SESSION_TYPE_LABELS[type] ?? type}</span>
                          <span className="text-[9px] font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded">{sessions.length} session{sessions.length > 1 ? 's' : ''}</span>
                        </div>
                        {sessions.map(s => (
                          <div key={s.id} className="flex items-center gap-1.5 text-[10px] text-text-muted">
                            <FileText size={8} className="shrink-0" />
                            <span className="truncate">{s.client} · {s.startTime}–{s.endTime}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* What went well */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">What went well?</label>
              <textarea
                value={wentWell}
                onChange={e => setWentWell(e.target.value)}
                rows={2}
                placeholder="Highlights from today..."
                className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm placeholder:text-text-light focus:border-gold resize-none"
              />
            </div>

            {/* What to improve */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">What to improve?</label>
              <textarea
                value={toImprove}
                onChange={e => setToImprove(e.target.value)}
                rows={2}
                placeholder="Areas to focus on next time..."
                className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm placeholder:text-text-light focus:border-gold resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              className="w-full py-3 rounded-xl bg-gold text-black text-sm font-bold hover:bg-gold-muted transition-all"
            >
              Submit Report & Clock Out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Social platform icons (match mockup colors) ── */
const platforms = [
  { name: 'Instagram', icon: Instagram, color: '#E1306C', bg: 'rgba(225, 48, 108, 0.12)', followers: '128.4K', asOf: 'As of Apr 9, 2026' },
  { name: 'TikTok', icon: Music2, color: '#ffffff', bg: 'rgba(255, 255, 255, 0.08)', followers: '128.4K', asOf: 'As of Apr 9, 2026' },
  { name: 'YouTube', icon: Youtube, color: '#FF0000', bg: 'rgba(255, 0, 0, 0.12)', followers: '128.4K', asOf: 'As of Apr 9, 2026' },
]

/* ── Team snapshot (placeholder) ── */
const teamMembers = [
  { id: 'jordan', name: 'Jordan Lee', role: 'Lead Engineer', contact: 'jordan@checkmar...' },
  { id: 'sam', name: 'Sam Rivera', role: 'Audio Intern', contact: 'sam@checkmark...' },
  { id: 'alex', name: 'Alex Kim', role: 'Marketing', contact: 'alex@checkmark...' },
  { id: 'taylor', name: 'Taylor Morgan', role: 'Operations', contact: 'taylor@checkmark...' },
  { id: 'taylor2', name: 'Taylor Morganson', role: 'Operations', contact: 'taylor@checkmark...' },
]

/* ── Today's agenda (placeholder) ── */
const todayEvents = [
  { time: '9:00 AM', title: 'Email and inbox review', color: '#C9A84C' },
  { time: '10:30 AM', title: 'Content breakdown', color: '#38bdf8' },
  { time: '1:00 PM', title: 'Walk', color: '#a78bfa' },
  { time: '3:00 PM', title: 'Metrics discussion', color: '#34d399' },
]

function PriorityIcon({ priority }: { priority: boolean }) {
  if (!priority) return null
  return (
    <Flame size={12} className="text-gold shrink-0" />
  )
}

/* ── Team Tasks widget for Overview (same data as Tasks page) ── */
const POSITIONS_OV = ['Marketing', 'Media', 'Engineer', 'Intern', 'Admin'] as const
type PositionOV = typeof POSITIONS_OV[number]
const ROLE_TASKS_OV: Record<PositionOV, { id: string; title: string; due: string; priority: boolean; done: boolean }[]> = {
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

function TeamTasksWidget() {
  const [pos, setPos] = useState<PositionOV>('Marketing')
  const [time, setTime] = useState('Day')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())

  const tasks = ROLE_TASKS_OV[pos]
  // Overview: always hide completed
  const filtered = tasks.filter(t => !t.done && !submitted.has(t.id))
  const sorted = [...filtered].sort((a, b) => {
    const aD = a.done || submitted.has(a.id); const bD = b.done || submitted.has(b.id)
    return aD === bD ? 0 : aD ? 1 : -1
  })

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
      <div className="px-5 py-3.5 border-b border-border">
        <div className="flex items-center justify-between">
          <Link to="/daily" className="flex items-center gap-1 group">
            <h2 className="text-[16px] font-bold text-text tracking-tight group-hover:text-gold transition-colors">Team Tasks</h2>
            <ChevronRight size={12} className="text-text-muted group-hover:text-gold transition-colors" />
          </Link>
          <div className="flex bg-surface-alt rounded-lg p-0.5 border border-border">
            {['Day', 'Week'].map(o => (
              <button key={o} onClick={() => setTime(o)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium tracking-tight transition-all ${time === o ? 'bg-gold/12 text-gold' : 'text-text-light hover:text-text-muted'}`}
              >{o}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-0.5 flex-wrap mt-2">
          {POSITIONS_OV.map(p => (
            <button key={p} onClick={() => { setPos(p); setChecked(new Set()); setSubmitted(new Set()) }}
              className={`px-1.5 py-0.5 rounded text-[11px] tracking-tight transition-all ${pos === p ? 'text-gold font-medium' : 'text-text-light font-normal hover:text-text-muted'}`}
            >{p}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 px-5 py-1 space-y-0">
        {sorted.map(t => {
          const isDone = t.done || submitted.has(t.id)
          const isPending = checked.has(t.id)
          const isChecked = isDone || isPending
          const dueLabel = time === 'Day' && t.due.toLowerCase().includes('today') ? (t.due.split(',')[1]?.trim() || '') : t.due.split(',')[0]
          return (
            <div key={t.id} className={`flex items-center gap-2 py-[11px] border-b border-border/30 last:border-0 transition-all ${isDone ? 'opacity-25' : ''}`}>
              <button onClick={() => !isDone && setChecked(p => { const n = new Set(p); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })} disabled={isDone} className="shrink-0">
                <div className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-all ${isDone ? 'bg-gold/30 border-gold/40' : isPending ? 'bg-gold/20 border-gold' : 'border-border-light hover:border-gold/50'}`}>
                  {isChecked && <Check size={11} className="text-gold" />}
                </div>
              </button>
              <span className={`flex-1 text-[14px] font-normal tracking-tight truncate min-w-0 ${isDone ? 'line-through text-text-light' : 'text-text-muted'}`}>{t.title}</span>
              {t.priority && <Flame size={13} className="text-gold shrink-0" />}
              <span className="text-[11px] shrink-0 tabular-nums text-text-light">{dueLabel}</span>
            </div>
          )
        })}
      </div>
      <div className="px-5 py-4 border-t border-border mt-auto">
        <button onClick={() => { setSubmitted(p => { const n = new Set(p); checked.forEach(id => n.add(id)); return n }); setChecked(new Set()) }} disabled={checked.size === 0}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold tracking-tight transition-all ${checked.size > 0 ? 'bg-gold text-black hover:bg-gold-muted shadow-md shadow-gold/20' : 'bg-surface-alt text-text-light border border-border cursor-not-allowed'}`}>
          <Check size={14} />
          {checked.size > 0 ? `Submit Completed (${checked.size})` : 'Submit Completed'}
        </button>
      </div>
    </div>
  )
}

/* ── Calendar widget (synced with bookings — mirrors Calendar page Today column) ── */
const BOOKING_TYPE_LABELS: Record<string, string> = {
  engineering: 'Engineering', training: 'Training', education: 'Education',
  music_lesson: 'Music Lesson', consultation: 'Consultation',
}

function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`
}

function durationLabel(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  const hrs = Math.floor(mins / 60)
  const rm = mins % 60
  return hrs > 0 ? `${hrs}h${rm > 0 ? ` ${rm}m` : ''}` : `${rm}m`
}

function CalendarWidget() {
  const { bookings } = useTasks()
  const today = new Date()
  const todayKey = today.toISOString().split('T')[0]
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // Show all bookings for today — bookings are the single source of truth
  const todayBookings = bookings
    .filter(b => b.date === todayKey && b.status !== 'Cancelled')
    .sort((a, b) => {
      const am = parseInt(a.startTime.replace(':', ''))
      const bm = parseInt(b.startTime.replace(':', ''))
      return am - bm
    })

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
      <div className="px-5 py-3.5 border-b border-border">
        <div className="flex items-center justify-between">
          <Link to="/calendar" className="flex items-center gap-1.5 group">
            <CalendarIcon size={14} className="text-gold" />
            <h2 className="text-[16px] font-bold text-text tracking-tight group-hover:text-gold transition-colors">Calendar</h2>
            <ChevronRight size={12} className="text-text-muted group-hover:text-gold transition-colors" />
          </Link>
        </div>
        <p className="text-[11px] text-text-light mt-1">{dateLabel}</p>
      </div>
      <div className="flex-1 px-5 py-2">
        {todayBookings.length > 0 ? (
          <div className="space-y-0">
            {todayBookings.map(b => (
              <div key={b.id} className="py-3 border-b border-border/20 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[14px] font-medium text-text tracking-tight">{b.client}</p>
                  <span className="text-[10px] font-semibold text-gold bg-gold/10 px-1.5 py-0.5 rounded">{durationLabel(b.startTime, b.endTime)}</span>
                </div>
                <p className="text-[12px] text-text-muted">{b.description}</p>
                <p className="text-[12px] text-text-light mt-0.5">{formatTime12(b.startTime)} – {formatTime12(b.endTime)}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-semibold text-gold/70 bg-gold/5 border border-gold/15 px-1.5 py-0.5 rounded">{BOOKING_TYPE_LABELS[b.type] ?? b.type}</span>
                  <span className="text-[10px] text-text-light">{b.studio} · {b.assignee}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-text-light italic py-6 text-center">No bookings today</p>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Audio')
  const { tasks, bookings, pendingIds, togglePending, submitPending, hasPending } = useTasks()
  const [showCreateTask, setShowCreateTask] = useState(false)

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // Only show incomplete tasks, limit to top 5 for a clean snapshot
  const activeTasks = tasks.filter(t => !t.completed).slice(0, 5)

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[28px] font-extrabold tracking-tight text-text">Overview</h1>
        <div className="flex items-center gap-4">
          {platforms.map((p) => (
            <div key={p.name} className="flex items-center gap-1.5">
              <p.icon size={13} className="text-gold" />
              <span className="text-[11px] font-semibold text-text-muted">{p.followers}</span>
            </div>
          ))}
        </div>
      </div>

      {showCreateTask && <CreateTaskModal onClose={() => setShowCreateTask(false)} />}

      {/* 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">

        {/* Column 1: Team */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-border">
            <h2 className="text-[16px] font-bold text-text tracking-tight">Team</h2>
          </div>
          <div className="flex-1 py-1">
            {teamMembers.map((m) => (
              <Link key={m.id} to={`/profile/${m.id}`} className="flex items-center gap-3.5 px-5 py-3 hover:bg-white/[0.03] transition-colors border-b border-border/20 last:border-0">
                <div className="w-10 h-10 rounded-full bg-gold/10 text-gold flex items-center justify-center text-[14px] font-bold shrink-0">
                  {m.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-text tracking-tight truncate">{m.name}</p>
                  <p className="text-[12px] text-text-light mt-0.5">{m.role}</p>
                </div>
                <ChevronRight size={12} className="text-text-light shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Column 2: Calendar (synced with bookings) */}
        <CalendarWidget />

        {/* Column 3: Team Tasks */}
        <TeamTasksWidget />

      </div>

      {/* Mini KPI Chart */}
      <div className="bg-surface rounded-2xl border border-border p-4 mt-3">
        <div className="flex items-center justify-between mb-2">
          <Link to="/admin/health" className="flex items-center gap-1 group">
            <h2 className="text-[14px] font-bold text-text tracking-tight group-hover:text-gold transition-colors">KPI Performance</h2>
            <ChevronRight size={12} className="text-text-light group-hover:text-gold transition-colors" />
          </Link>
          <span className="text-[10px] text-text-light">{tasks.filter(t => t.completed).length + bookings.filter(b => b.status === 'Confirmed').length} / {tasks.length + bookings.length} completed</span>
        </div>
        <div className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[
              { name: 'Deliver', pct: (() => { const s = tasks.filter(t => t.stage === 'Deliver'); return s.length ? Math.round(s.filter(t => t.completed).length / s.length * 100) : 0 })() },
              { name: 'Capture', pct: (() => { const s = tasks.filter(t => t.stage === 'Capture'); return s.length ? Math.round(s.filter(t => t.completed).length / s.length * 100) : 0 })() },
              { name: 'Share', pct: (() => { const s = tasks.filter(t => t.stage === 'Share'); return s.length ? Math.round(s.filter(t => t.completed).length / s.length * 100) : 0 })() },
              { name: 'Attract', pct: (() => { const s = tasks.filter(t => t.stage === 'Attract'); return s.length ? Math.round(s.filter(t => t.completed).length / s.length * 100) : 0 })() },
              { name: 'Book', pct: bookings.length ? Math.round(bookings.filter(b => b.status === 'Confirmed').length / bookings.length * 100) : 0 },
            ]} barSize={24}>
              <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                {[0,1,2,3,4].map(i => <Cell key={i} fill="#C9A84C" fillOpacity={0.7} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between px-1 mt-1">
          {['Deliver', 'Capture', 'Share', 'Attract', 'Book'].map(s => (
            <span key={s} className="text-[9px] text-text-light">{s}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
