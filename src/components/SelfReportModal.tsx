import { useState, useEffect } from 'react'
import { useTasks } from '../contexts/TaskContext'
import { Check, X, FileText, ChevronDown } from 'lucide-react'

const SESSION_TYPE_LABELS: Record<string, string> = {
  engineering: 'Engineering', training: 'Training', education: 'Education',
  music_lesson: 'Music Lesson', consultation: 'Consultation',
}

export default function SelfReportModal({ clockInTime, onClose, onLogout }: { clockInTime: string; onClose: () => void; onLogout: () => void }) {
  const { tasks, bookings } = useTasks()
  const [wentWell, setWentWell] = useState('')
  const [toImprove, setToImprove] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const completedTasks = tasks.filter(t => t.completed)
  const completedBookings = bookings.filter(b => b.status === 'Confirmed')
  const totalCompleted = completedTasks.length + completedBookings.length

  // Group sessions by type
  const todayStr = new Date().toISOString().split('T')[0] ?? ''
  const todaySessions = completedBookings.filter(b => b.date <= todayStr)
  const sessionsByType: Record<string, typeof todaySessions> = {}
  for (const s of todaySessions) {
    const group = sessionsByType[s.type] ?? []
    group.push(s)
    sessionsByType[s.type] = group
  }

  // Live clock that updates every second
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
  const clockOutTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })

  const handleSubmit = () => {
    setSubmitted(true)
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
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-gold" />
            </div>
            <p className="text-[15px] font-semibold text-text">Report submitted!</p>
            <p className="text-[12px] text-text-muted mt-1">Great work today. Clocked out at {clockOutTime}</p>
            <button
              onClick={onLogout}
              className="mt-5 px-6 py-2.5 rounded-xl bg-gold text-black text-[13px] font-bold hover:bg-gold-muted transition-all"
            >
              Log Out
            </button>
            <p className="text-[10px] text-text-light mt-3">Or close this window to stay logged in</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary counts */}
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
                <p className="text-lg font-bold text-gold">{todaySessions.length}</p>
                <p className="text-[9px] text-text-muted uppercase">Sessions</p>
              </div>
            </div>

            {/* Collapsible completed details dropdown */}
            {totalCompleted > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <button onClick={() => setShowDetails(!showDetails)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-alt/50 transition-colors">
                  <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">View Completed Details</span>
                  <ChevronDown size={14} className={`text-text-light transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                </button>

                {showDetails && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Completed Tasks */}
                    {completedTasks.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">Completed Tasks</p>
                        {completedTasks.map(t => (
                          <div key={t.id} className="flex items-center gap-1.5 text-[12px] text-text-muted py-1">
                            <Check size={9} className="text-gold shrink-0" />
                            <span>{t.title}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Confirmed Bookings */}
                    {completedBookings.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">Confirmed Bookings</p>
                        {completedBookings.map(b => (
                          <div key={b.id} className="flex items-center gap-1.5 text-[12px] text-text-muted py-1">
                            <Check size={9} className="text-gold shrink-0" />
                            <span>{b.client} · {b.startTime}–{b.endTime}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Completed Sessions by type */}
                    {Object.keys(sessionsByType).length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">Completed Sessions</p>
                        {Object.entries(sessionsByType).map(([type, sessions]) => (
                          <div key={type} className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[12px] font-semibold text-text">{SESSION_TYPE_LABELS[type] ?? type}</span>
                              <span className="text-[9px] font-semibold text-gold bg-gold/10 px-1.5 py-0.5 rounded">{sessions.length} session{sessions.length > 1 ? 's' : ''}</span>
                            </div>
                            {sessions.map(s => (
                              <div key={s.id} className="flex items-center gap-1.5 text-[11px] text-text-muted py-0.5">
                                <FileText size={8} className="shrink-0" />
                                <span>{s.client} · {s.startTime}–{s.endTime}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* What went well */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">What went well?</label>
              <textarea value={wentWell} onChange={e => setWentWell(e.target.value)} rows={2} placeholder="Highlights from today..."
                className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm placeholder:text-text-light focus:border-gold resize-none" />
            </div>

            {/* What to improve */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">What to improve?</label>
              <textarea value={toImprove} onChange={e => setToImprove(e.target.value)} rows={2} placeholder="Areas to focus on next time..."
                className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm placeholder:text-text-light focus:border-gold resize-none" />
            </div>

            <button onClick={handleSubmit} className="w-full py-3 rounded-xl bg-gold text-black text-sm font-bold hover:bg-gold-muted transition-all">
              Submit Report & Clock Out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
