import { useMemo, useState } from 'react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useTasks } from '../../contexts/TaskContext'
import { Check, Send } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const STAGES = [
  { name: 'Deliver', subtitle: 'Client Fulfillment', target: '95% on-time delivery' },
  { name: 'Capture', subtitle: 'Lead Capture Rate', target: '80% lead-to-session' },
  { name: 'Share', subtitle: 'Content Distribution', target: '3 posts/week' },
  { name: 'Attract', subtitle: 'Consult Demand', target: '10 inquiries/month' },
  { name: 'Book', subtitle: 'Paid Sessions', target: '20 sessions/month' },
] as const

/** Gauge meter — gold monochrome */
function HealthGauge({ pct }: { pct: number }) {
  const angle = -90 + (pct / 100) * 180
  return (
    <svg width="36" height="22" viewBox="0 0 60 34" fill="none" className="shrink-0">
      <path d="M6 30 A24 24 0 0 1 30 6" stroke="#46464e" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M30 6 A24 24 0 0 1 54 30" stroke="#46464e" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M6 30 A24 24 0 0 1 30 6" stroke="#C9A84C" strokeWidth="4" strokeLinecap="round" fill="none" opacity={pct > 50 ? 1 : 0.4} />
      <path d="M30 6 A24 24 0 0 1 54 30" stroke="#C9A84C" strokeWidth="4" strokeLinecap="round" fill="none" opacity={pct > 75 ? 1 : 0.15} />
      <g transform={`rotate(${angle}, 30, 30)`}>
        <line x1="30" y1="30" x2="30" y2="10" stroke="#d0d0d6" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="30" cy="30" r="3" fill="#d0d0d6" />
    </svg>
  )
}

export default function BusinessHealth() {
  useDocumentTitle('Analytics - Checkmark Audio')
  const { tasks, bookings, pendingIds, togglePending, submitPending, hasPending } = useTasks()
  const [selectedStage, setSelectedStage] = useState('Deliver')
  const [timeFilter, setTimeFilter] = useState<'total' | 'year' | 'month' | 'week' | 'day'>('week')

  const stageStats = useMemo(() => {
    const stats: Record<string, { total: number; done: number; pct: number }> = {}
    for (const stage of STAGES) {
      if (stage.name === 'Book') {
        const total = bookings.length
        const done = bookings.filter(b => b.status === 'Confirmed').length
        stats[stage.name] = { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
      } else {
        const st = tasks.filter(t => t.stage === stage.name)
        const done = st.filter(t => t.completed).length
        stats[stage.name] = { total: st.length, done, pct: st.length > 0 ? Math.round((done / st.length) * 100) : 0 }
      }
    }
    return stats
  }, [tasks, bookings])

  const totalItems = tasks.length + bookings.length
  const totalDone = tasks.filter(t => t.completed).length + bookings.filter(b => b.status === 'Confirmed').length
  const overallPct = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0
  const healthLabel = overallPct >= 85 ? 'Excellent' : overallPct >= 65 ? 'Good' : overallPct >= 40 ? 'Average' : 'Low'

  const stage = STAGES.find(s => s.name === selectedStage) ?? STAGES[0]
  const stageTasks = tasks.filter(t => t.stage === selectedStage)
  const sortedStageTasks = [...stageTasks].sort((a, b) => a.completed === b.completed ? 0 : a.completed ? 1 : -1)
  const stats = stageStats[selectedStage] ?? { total: 0, done: 0, pct: 0 }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <h1 className="text-[28px] font-extrabold tracking-tight text-text mb-4">Analytics</h1>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-surface rounded-2xl border border-border px-5 py-4">
          <p className="text-[10px] text-text-light uppercase tracking-wider">Completed</p>
          <p className="text-[20px] font-bold text-text tracking-tight mt-1">{totalDone} / {totalItems}</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border px-5 py-4">
          <p className="text-[10px] text-text-light uppercase tracking-wider">KPI Health</p>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-[20px] font-bold text-gold tracking-tight">{overallPct}%</p>
            <HealthGauge pct={overallPct} />
          </div>
          <p className="text-[11px] text-text-light mt-0.5">{healthLabel}</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border px-5 py-4">
          <p className="text-[10px] text-text-light uppercase tracking-wider">Best Stage</p>
          <p className="text-[20px] font-bold text-gold tracking-tight mt-1">{[...STAGES].sort((a, b) => (stageStats[b.name]?.pct ?? 0) - (stageStats[a.name]?.pct ?? 0))[0]?.name}</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border px-5 py-4">
          <p className="text-[10px] text-text-light uppercase tracking-wider">Needs Attention</p>
          <p className="text-[20px] font-bold text-text-muted tracking-tight mt-1">{[...STAGES].sort((a, b) => (stageStats[a.name]?.pct ?? 0) - (stageStats[b.name]?.pct ?? 0))[0]?.name}</p>
        </div>
      </div>

      {/* KPI Chart — detailed */}
      {(() => {
        const chartData = STAGES.map(s => ({
          name: s.name,
          completed: stageStats[s.name]?.pct ?? 0,
          remaining: 100 - (stageStats[s.name]?.pct ?? 0),
        }))
        return (
          <div className="bg-surface rounded-2xl border border-border p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-text tracking-tight">KPI Performance</h2>
              <span className="text-[11px] text-text-light">Completion by stage</span>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={32} barGap={8}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6e6e76', fontSize: 12 }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#46464e', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: '#1b1b22', border: '1px solid #2c2c34', borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: '#d0d0d6', fontWeight: 700 }}
                    itemStyle={{ color: '#b0b0b8' }}
                    formatter={(value: number) => [`${value}%`, 'Completed']}
                    cursor={{ fill: 'rgba(201, 168, 76, 0.05)' }}
                  />
                  <Bar dataKey="completed" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill="#C9A84C" fillOpacity={0.8} />
                    ))}
                  </Bar>
                  <Bar dataKey="remaining" radius={[6, 6, 0, 0]} stackId="a">
                    {chartData.map((_, i) => (
                      <Cell key={i} fill="#2c2c34" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      })()}

      {/* Flywheel */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-text tracking-tight">Flywheel KPIs</h2>
          <div className="flex bg-surface-alt rounded-lg p-0.5 border border-border">
            {(['total', 'year', 'month', 'week', 'day'] as const).map(tf => (
              <button key={tf} onClick={() => setTimeFilter(tf)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium tracking-tight transition-all ${timeFilter === tf ? 'bg-gold/12 text-gold' : 'text-text-light hover:text-text-muted'}`}>
                {tf.charAt(0).toUpperCase() + tf.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stage tabs */}
        <div className="px-5 py-3 border-b border-border/50 flex gap-1">
          {STAGES.map(s => {
            const st = stageStats[s.name] ?? { pct: 0 }
            const active = selectedStage === s.name
            return (
              <button key={s.name} onClick={() => setSelectedStage(s.name)}
                className={`flex-1 py-3 rounded-xl text-center transition-all ${active ? 'bg-gold/8 border border-gold/20' : 'hover:bg-white/[0.02]'}`}>
                <p className={`text-[13px] font-semibold tracking-tight ${active ? 'text-gold' : 'text-text-muted'}`}>{s.name}</p>
                <p className={`text-[18px] font-bold tracking-tight mt-0.5 ${active ? 'text-text' : 'text-text-light'}`}>{st.pct}%</p>
              </button>
            )
          })}
        </div>

        {/* Selected stage detail */}
        <div className="px-5 py-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold text-gold uppercase tracking-wider">Selected Stage</p>
          </div>
          <h2 className="text-[22px] font-extrabold text-text tracking-tight">{stage.name}</h2>
          <p className="text-[13px] text-text-muted mt-0.5">{stage.subtitle} · Target: {stage.target}</p>

          {/* Progress bar — gold only */}
          <div className="mt-4 mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] text-text-light">Progress</p>
              <p className="text-[14px] font-bold text-text">{stats.pct}%</p>
            </div>
            <div className="h-2 bg-surface-alt rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700 ease-out bg-gold" style={{ width: `${stats.pct}%` }} />
            </div>
          </div>

          {/* Task/booking list */}
          <div className="space-y-0">
            {selectedStage === 'Book' ? (
              bookings.map(b => {
                const isDone = b.status === 'Confirmed'
                return (
                  <div key={b.id} className={`flex items-center gap-2 py-[11px] border-b border-border/30 last:border-0 ${isDone ? 'opacity-25' : ''}`}>
                    <div className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 ${isDone ? 'bg-gold/30 border-gold/40' : 'border-border-light'}`}>
                      {isDone && <Check size={11} className="text-gold" />}
                    </div>
                    <span className={`flex-1 text-[14px] font-normal tracking-tight truncate ${isDone ? 'line-through text-text-light' : 'text-text-muted'}`}>{b.client} — {b.description}</span>
                    <span className="text-[11px] text-text-light shrink-0">{b.startTime}–{b.endTime}</span>
                  </div>
                )
              })
            ) : (
              sortedStageTasks.map(task => {
                const isPending = pendingIds.has(task.id)
                const isChecked = task.completed || isPending
                return (
                  <button key={task.id} onClick={() => !task.completed && togglePending(task.id)} disabled={task.completed}
                    className={`w-full flex items-center gap-2 py-[11px] border-b border-border/30 last:border-0 text-left transition-all ${task.completed ? 'opacity-25' : ''}`}>
                    <div className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 transition-all ${task.completed ? 'bg-gold/30 border-gold/40' : isPending ? 'bg-gold/20 border-gold' : 'border-border-light hover:border-gold/50'}`}>
                      {isChecked && <Check size={11} className="text-gold" />}
                    </div>
                    <span className={`flex-1 text-[14px] font-normal tracking-tight truncate ${task.completed ? 'line-through text-text-light' : 'text-text-muted'}`}>{task.title}</span>
                    <span className="text-[11px] text-text-light shrink-0">{task.due.split(',')[0]}</span>
                  </button>
                )
              })
            )}
            {selectedStage !== 'Book' && stageTasks.length === 0 && <p className="text-[13px] text-text-light text-center py-6">No tasks in this stage.</p>}
            {selectedStage === 'Book' && bookings.length === 0 && <p className="text-[13px] text-text-light text-center py-6">No bookings yet.</p>}
          </div>

          {hasPending && (
            <button onClick={submitPending} className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold text-black font-semibold text-[13px] tracking-tight hover:bg-gold-muted transition-all shadow-md shadow-gold/20">
              <Check size={14} />
              Submit Completed ({pendingIds.size})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
