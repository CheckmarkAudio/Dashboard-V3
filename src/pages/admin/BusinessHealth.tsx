import { useMemo, useState } from 'react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useTasks, STAGE_COLORS } from '../../contexts/TaskContext'
import { Check, Send } from 'lucide-react'

/* ── Flywheel stages ── */
const STAGES = [
  { name: 'Deliver', subtitle: 'Client Fulfillment', color: '#34d399', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.5)', target: '95% on-time delivery' },
  { name: 'Capture', subtitle: 'Lead Capture Rate', color: '#38bdf8', bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.5)', target: '80% lead-to-session' },
  { name: 'Share', subtitle: 'Content Distribution', color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.5)', target: '3 posts/week' },
  { name: 'Attract', subtitle: 'Consult Demand', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.5)', target: '10 inquiries/month' },
  { name: 'Book', subtitle: 'Paid Sessions', color: '#fb7185', bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.5)', target: '20 sessions/month' },
] as const

/** Tiny SVG gauge meter */
function HealthGauge({ pct }: { pct: number }) {
  const angle = -90 + (pct / 100) * 180
  return (
    <svg width="36" height="22" viewBox="0 0 60 34" fill="none" className="shrink-0">
      <path d="M6 30 A24 24 0 0 1 15.1 10.1" stroke="#f87171" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M15.1 10.1 A24 24 0 0 1 30 6" stroke="#fb923c" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M30 6 A24 24 0 0 1 44.9 10.1" stroke="#a3e635" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M44.9 10.1 A24 24 0 0 1 54 30" stroke="#34d399" strokeWidth="5" strokeLinecap="round" fill="none" />
      <g transform={`rotate(${angle}, 30, 30)`}>
        <line x1="30" y1="30" x2="30" y2="10" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="30" cy="30" r="3" fill="white" />
    </svg>
  )
}

export default function BusinessHealth() {
  useDocumentTitle('Analytics - Checkmark Audio')
  const { tasks, bookings, pendingIds, togglePending, submitPending, hasPending } = useTasks()
  const [selectedStage, setSelectedStage] = useState('Deliver')
  const [timeFilter, setTimeFilter] = useState<'total' | 'year' | 'month' | 'week' | 'day'>('week')

  // Compute per-stage stats — Book uses bookings, others use tasks
  const stageStats = useMemo(() => {
    const stats: Record<string, { total: number; done: number; pct: number }> = {}
    for (const stage of STAGES) {
      if (stage.name === 'Book') {
        const total = bookings.length
        const done = bookings.filter(b => b.status === 'Confirmed').length
        stats[stage.name] = { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
      } else {
        const stageTasks = tasks.filter(t => t.stage === stage.name)
        const done = stageTasks.filter(t => t.completed).length
        const total = stageTasks.length
        stats[stage.name] = { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
      }
    }
    return stats
  }, [tasks, bookings])

  const totalItems = tasks.length + bookings.length
  const totalDone = tasks.filter(t => t.completed).length + bookings.filter(b => b.status === 'Confirmed').length
  const overallPct = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0

  const sortedStages = [...STAGES].sort((a, b) => (stageStats[b.name]?.pct ?? 0) - (stageStats[a.name]?.pct ?? 0))
  const bestStage = sortedStages[0]?.name ?? 'Deliver'
  const weakStage = sortedStages[sortedStages.length - 1]?.name ?? 'Attract'

  const healthLevel = overallPct >= 85 ? 'Excellent' : overallPct >= 65 ? 'Good' : overallPct >= 40 ? 'Average' : 'Low'
  const HEALTH_STYLES: Record<string, { color: string; bg: string; border: string }> = {
    Excellent: { color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' },
    Good:      { color: '#a3e635', bg: 'rgba(163, 230, 53, 0.12)', border: 'rgba(163, 230, 53, 0.35)' },
    Average:   { color: '#fb923c', bg: 'rgba(251, 146, 60, 0.12)', border: 'rgba(251, 146, 60, 0.35)' },
    Low:       { color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' },
  }
  const healthStyle = HEALTH_STYLES[healthLevel]
  const stageColor = (name: string) => STAGES.find(s => s.name === name)?.color ?? '#C9A84C'

  const stage = STAGES.find(s => s.name === selectedStage) ?? STAGES[0]
  const stageTasks = tasks.filter(t => t.stage === selectedStage)
  const sortedStageTasks = [...stageTasks].sort((a, b) => a.completed === b.completed ? 0 : a.completed ? 1 : -1)
  const stats = stageStats[selectedStage] ?? { total: 0, done: 0, pct: 0 }

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      {/* ── Flywheel Task Tracker ── */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gold mb-1">Checkmark Audio KPI System</p>
            <h1 className="text-2xl lg:text-3xl font-bold text-text">Flywheel Task Tracker</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <div className="bg-surface-alt rounded-xl border border-border px-3.5 py-2.5 min-w-[130px]">
              <p className="text-[10px] text-text-muted uppercase tracking-wide">Tasks Completed</p>
              <p className="text-sm font-bold text-text mt-0.5">{totalDone} / {totalItems}</p>
            </div>
            <div className="bg-surface-alt rounded-xl border border-border px-3.5 py-2.5 min-w-[130px]">
              <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1.5">KPI Health</p>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border" style={{ color: healthStyle.color, backgroundColor: healthStyle.bg, borderColor: healthStyle.border }}>{healthLevel}</span>
                <span className="text-xs font-semibold" style={{ color: healthStyle.color }}>{overallPct}%</span>
                <HealthGauge pct={overallPct} />
              </div>
            </div>
            <div className="bg-surface-alt rounded-xl border border-border px-3.5 py-2.5 min-w-[130px]">
              <p className="text-[10px] text-text-muted uppercase tracking-wide">Best Stage</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: stageColor(bestStage) }}>{bestStage}</p>
            </div>
            <div className="bg-surface-alt rounded-xl border border-border px-3.5 py-2.5 min-w-[130px]">
              <p className="text-[10px] text-text-muted uppercase tracking-wide">Needs Attention</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: stageColor(weakStage) }}>{weakStage}</p>
            </div>
          </div>
        </div>

        {/* Divider + KPIs */}
        <div className="border-t border-border/50 pt-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">Flywheel KPIs</p>
            <div className="flex gap-1 bg-surface-alt/50 p-1 rounded-xl border border-border">
              {(['total', 'year', 'month', 'week', 'day'] as const).map(tf => (
                <button key={tf} onClick={() => setTimeFilter(tf)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${timeFilter === tf ? 'bg-gold text-black shadow-sm' : 'text-text-muted hover:text-text hover:bg-surface-hover'}`}>
                  {tf.charAt(0).toUpperCase() + tf.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Stage chips */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-2.5">
              {STAGES.map((s) => {
                const st = stageStats[s.name] ?? { pct: 0 }
                const active = selectedStage === s.name
                return (
                  <button key={s.name} onClick={() => setSelectedStage(s.name)}
                    className={`relative rounded-xl border-2 p-3.5 text-left transition-all ${active ? 'shadow-lg scale-[1.02]' : 'hover:scale-[1.01]'}`}
                    style={{ backgroundColor: active ? s.bg : 'rgba(20,20,22,0.8)', borderColor: active ? s.color : 'rgba(42,42,42,0.8)' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-bold" style={{ color: s.color }}>{s.name}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">{s.subtitle}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2"
                        style={{ borderColor: s.color + '60', backgroundColor: s.color + '15', color: s.color }}>
                        {st.pct}%
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Selected stage panel */}
            <div className="bg-surface-alt rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">Selected Stage</p>
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border" style={{ color: stage.color, borderColor: stage.color, backgroundColor: stage.bg }}>Live KPI Component</span>
              </div>
              <h2 className="text-2xl font-bold text-text">{stage.name}</h2>
              <p className="text-sm text-text-muted mt-0.5">KPI: {stage.subtitle}</p>
              <p className="text-sm text-text-muted">Target: {stage.target}</p>

              {/* Progress bar */}
              <div className="mt-4 mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-text-muted">Progress toward target</p>
                  <p className="text-sm font-bold text-text">{stats.pct}%</p>
                </div>
                <div className="h-2.5 bg-surface rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${stats.pct}%`, backgroundColor: stage.color }} />
                </div>
              </div>

              {/* Stage items */}
              {selectedStage === 'Book' ? (
                <div className="space-y-2">
                  {bookings.map(b => {
                    const isConfirmed = b.status === 'Confirmed'
                    return (
                      <div key={b.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isConfirmed ? 'border-emerald-500/20 bg-emerald-500/[0.04] opacity-60' : 'border-border bg-surface'}`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${isConfirmed ? 'bg-emerald-500/30 border-emerald-500/50' : 'border-[#fb7185]/40 bg-[#fb7185]/10'}`}>
                          {isConfirmed && <Check size={13} className="text-emerald-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm ${isConfirmed ? 'line-through text-text-light' : 'text-text'}`}>{b.client} — {b.description}</span>
                          <p className="text-[10px] text-text-muted">{b.startTime}–{b.endTime} · {b.studio}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${isConfirmed ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/30'}`}>{b.status}</span>
                      </div>
                    )
                  })}
                  {bookings.length === 0 && <p className="text-sm text-text-muted text-center py-4">No bookings yet.</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedStageTasks.map(task => {
                    const isPending = pendingIds.has(task.id)
                    const isChecked = task.completed || isPending
                    return (
                      <button key={task.id} onClick={() => !task.completed && togglePending(task.id)} disabled={task.completed}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${task.completed ? 'border-gold/15 bg-gold/[0.04] opacity-50' : isPending ? 'border-gold/30 bg-gold/[0.06]' : 'border-border bg-surface hover:border-border-light'}`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${task.completed ? 'bg-gold border-gold' : isPending ? 'bg-gold/20 border-gold' : 'border-border-light'}`}>
                          {isChecked && <Check size={13} className={task.completed ? 'text-black' : 'text-gold'} />}
                        </div>
                        <span className={`flex-1 text-sm ${task.completed ? 'line-through text-text-light' : 'text-text'}`}>{task.title}</span>
                        <span className="text-[11px] text-text-muted shrink-0">Tap to update</span>
                      </button>
                    )
                  })}
                  {stageTasks.length === 0 && <p className="text-sm text-text-muted text-center py-4">No tasks in this stage yet.</p>}
                </div>
              )}

              {hasPending && (
                <button onClick={submitPending} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold text-black font-semibold text-sm hover:bg-gold-muted transition-all shadow-lg shadow-gold/20 animate-pulse-gold">
                  <Send size={14} />
                  Submit {pendingIds.size} completed task{pendingIds.size > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
