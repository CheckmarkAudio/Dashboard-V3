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

export default function Dashboard() {
  useDocumentTitle('Overview - Checkmark Audio')
  const { tasks, pendingIds, togglePending, submitPending, hasPending } = useTasks()
  const [showCreateTask, setShowCreateTask] = useState(false)

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // Only show incomplete tasks, limit to top 5 for a clean snapshot
  const activeTasks = tasks.filter(t => !t.completed).slice(0, 5)

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">Overview</h1>
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

      {/* 4-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">

        {/* Column 1: Upcoming Tasks */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <Link to="/daily" className="flex items-center gap-1 group">
                <h2 className="text-[13px] font-bold text-text group-hover:text-gold transition-colors">Upcoming Tasks</h2>
                <ChevronRight size={12} className="text-text-muted group-hover:text-gold transition-colors" />
              </Link>
            </div>
            <button onClick={() => setShowCreateTask(true)} className="px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/30 text-[10px] font-semibold flex items-center gap-1 hover:bg-gold/20 transition-colors">
              <Plus size={11} /> Create Task
            </button>
          </div>
          <div className="flex-1 px-4 py-2 space-y-0">
            {activeTasks.map((task) => {
              const isPending = pendingIds.has(task.id)
              return (
                <div key={task.id} className="flex items-center gap-2.5 py-1.5">
                  <button onClick={() => togglePending(task.id)} className="shrink-0">
                    <div className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-all ${isPending ? 'bg-gold/20 border-gold' : 'border-border-light hover:border-gold/50'}`}>
                      {isPending && <Check size={10} className="text-gold" />}
                    </div>
                  </button>
                  <span className="flex-1 text-[13px] text-text truncate">{task.title}</span>
                  <PriorityIcon priority={task.priority} />
                  <span className="text-[9px] text-text-light shrink-0">{task.due.split(',')[0]}</span>
                </div>
              )
            })}
            {tasks.filter(t => !t.completed).length > 5 && (
              <Link to="/daily" className="block text-center text-[10px] text-gold font-medium py-1 hover:underline">
                +{tasks.filter(t => !t.completed).length - 5} more →
              </Link>
            )}
          </div>
          <div className="px-4 py-3 border-t border-border mt-auto">
            <button onClick={submitPending} disabled={!hasPending}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${hasPending ? 'bg-gold text-black hover:bg-gold-muted shadow-md shadow-gold/20' : 'bg-surface-alt text-text-light border border-border cursor-not-allowed'}`}>
              <Check size={13} />
              {hasPending ? `Submit Completed (${pendingIds.size})` : 'Submit Completed'}
            </button>
          </div>
        </div>

        {/* Column 2: Team Snapshot */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-[13px] font-bold text-text">Team</h2>
          </div>
          <div className="flex-1">
            {teamMembers.map((m) => (
              <Link key={m.id} to="/admin/my-team" className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.03] transition-colors border-b border-border/20">
                <div className="w-7 h-7 rounded-full bg-gold/10 text-gold flex items-center justify-center text-[10px] font-bold shrink-0">
                  {m.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-text truncate">{m.name}</p>
                  <p className="text-[10px] text-text-muted">{m.role}</p>
                </div>
                <ChevronRight size={10} className="text-text-light shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Column 3: Calendar */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <Link to="/calendar" className="flex items-center gap-1.5 group">
              <CalendarIcon size={13} className="text-gold" />
              <h2 className="text-[13px] font-bold text-text group-hover:text-gold transition-colors">Calendar</h2>
              <ChevronRight size={12} className="text-text-muted group-hover:text-gold transition-colors" />
            </Link>
            <p className="text-[10px] text-text-muted mt-1">{dateStr}</p>
          </div>
          <div className="flex-1 px-4 py-2 space-y-1">
            {todayEvents.map((event, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <span className="text-[10px] text-text-muted font-medium w-[48px] shrink-0">{event.time}</span>
                <div className="w-1 h-3 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
                <span className="text-[13px] text-text truncate">{event.title}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
