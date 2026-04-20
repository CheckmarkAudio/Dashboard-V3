import { useMemo, useState } from 'react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useTasks } from '../../contexts/TaskContext'
import { Check, Download, Printer, RefreshCcw, Target, CheckSquare, Briefcase, Info, PieChart as PieChartIcon } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, CartesianGrid,
} from 'recharts'

/**
 * Analytics — the merged Flywheel + BusinessHealth page.
 *
 * Layout flow (broad → specific → over-time → breakdown):
 *
 *   1. First-run callout    — explains the empty state
 *   2. Summary row          — 4 at-a-glance stat cards
 *   3. Date range + export  — controls
 *   4. KPI Performance      — % completion per flywheel stage (bar)
 *   5. Flywheel drill-down  — stage tabs + selected-stage task list
 *   6. Tasks by KPI Stage   — raw-count donut (complements the % view)
 *   7. Monthly Trend        — bookings/KPI/studio bars, last 6 months
 *   8. Bookings Trend       — line chart, confirmed bookings over time
 *   9. Tasks by Employee    — stacked horizontal bars, KPI vs studio
 *  10. Other Reports        — tabular lists (employees, studio buckets)
 *
 * The old standalone AnalyticsMockup at /admin/flywheel has been
 * removed; everything lives here under Analytics so the admin nav
 * only exposes a single destination for all charts and breakdowns.
 *
 * Data currently derives from the in-memory TaskContext (which starts
 * empty pre-onboarding). Time-based trends, employee breakdowns, and
 * studio buckets have no backing data source yet and render
 * empty-state panels until the Phase 2 flywheel event ledger wires
 * them to Supabase.
 */

// ── Flywheel stages (authoritative order for this page) ────────────────

const STAGES = [
  { name: 'Deliver', subtitle: 'Client Fulfillment', target: '95% on-time delivery', color: '#34d399' },
  { name: 'Capture', subtitle: 'Lead Capture Rate', target: '80% lead-to-session', color: '#38bdf8' },
  { name: 'Share',   subtitle: 'Content Distribution', target: '3 posts/week', color: '#a78bfa' },
  { name: 'Attract', subtitle: 'Consult Demand', target: '10 inquiries/month', color: '#fbbf24' },
  { name: 'Book',    subtitle: 'Paid Sessions', target: '20 sessions/month', color: '#fb7185' },
] as const

// ── Presets + data shapes for sections without a live backing yet ──────

type Preset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all'
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year',    label: 'This Year' },
  { key: 'all',     label: 'All Time' },
]

const MONTHLY_TREND: { month: string; bookings: number; tasks: number; studio: number }[] = []
const TASKS_BY_EMPLOYEE: { name: string; tasks: number; kpi: number; studio: number }[] = []
const STUDIO_BUCKETS: { label: string; count: number }[] = []

// ── Chart primitives ───────────────────────────────────────────────────

const tooltipStyle = { background: '#1e1e25', border: '1px solid #34343d', borderRadius: 8, fontSize: 12, color: '#e2e2ea' }
const tooltipLabelStyle = { color: '#bcbcc6' }

function ChartEmptyState({ height = 'h-64', message }: { height?: string; message: string }) {
  return (
    <div className={`${height} flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-alt/30 text-center px-6`}>
      <Info size={18} className="text-text-light" aria-hidden="true" />
      <p className="text-[13px] text-text-muted max-w-[44ch]">{message}</p>
    </div>
  )
}

function PresetPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-4 h-9 rounded-lg text-sm font-semibold transition-all focus-ring',
        active ? 'bg-gold text-black shadow-sm' : 'bg-surface-alt text-text-muted border border-border hover:text-text hover:bg-surface-hover',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/** Gold-monochrome gauge for the KPI Health summary card. */
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

// ── Page ───────────────────────────────────────────────────────────────

export default function BusinessHealth() {
  useDocumentTitle('Analytics - Checkmark Workspace')
  const { tasks, bookings, pendingIds, togglePending, submitPending, hasPending } = useTasks()
  const [selectedStage, setSelectedStage] = useState<typeof STAGES[number]['name']>('Deliver')
  const [timeFilter, setTimeFilter] = useState<'total' | 'year' | 'month' | 'week' | 'day'>('week')
  const [preset, setPreset] = useState<Preset>('all')
  const [from, setFrom] = useState('1900-01-01')
  const [to, setTo] = useState('2999-12-31')

  // ── Derived stats from TaskContext ────────────────────────────────────

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

  // ── Donut data (raw task counts per stage) ────────────────────────────

  const tasksByKpiStage = useMemo(() =>
    STAGES.map(s => ({
      stage: s.name,
      count: s.name === 'Book' ? bookings.length : tasks.filter(t => t.stage === s.name).length,
      color: s.color,
    })), [tasks, bookings])

  // ── Empty-state guards ────────────────────────────────────────────────

  const hasAnyWork      = totalItems > 0
  const hasKpiCounts    = tasksByKpiStage.some(s => s.count > 0)
  const hasTrendData    = MONTHLY_TREND.length > 0
  const hasEmployeeData = TASKS_BY_EMPLOYEE.length > 0
  const hasStudioData   = STUDIO_BUCKETS.length > 0

  const totalBookingsInTrend = MONTHLY_TREND.reduce((s, r) => s + r.bookings, 0)

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* ── Heading ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Admin</p>
        <h1 className="text-2xl font-bold mt-1">Analytics</h1>
        <p className="text-text-muted text-sm mt-1">
          Bookings, tasks, and sessions across KPIs, employees, and studio work.
        </p>
      </div>

      {/* ── First-run callout (always shown until there's real data) ── */}
      {!hasAnyWork && (
        <div className="bg-surface rounded-2xl border border-gold/30 bg-gold/[0.04] p-5">
          <div className="flex items-center gap-3">
            <span className="shrink-0 w-10 h-10 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center">
              <PieChartIcon size={18} className="text-gold" aria-hidden="true" />
            </span>
            <p className="text-[14px] text-text">
              Analytics will populate with Tasks, Booking &amp; Session data.
            </p>
          </div>
        </div>
      )}

      {/* ── 1. Summary row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
          <p className="text-[20px] font-bold text-gold tracking-tight mt-1">
            {hasAnyWork ? [...STAGES].sort((a, b) => (stageStats[b.name]?.pct ?? 0) - (stageStats[a.name]?.pct ?? 0))[0]?.name : '—'}
          </p>
        </div>
        <div className="bg-surface rounded-2xl border border-border px-5 py-4">
          <p className="text-[10px] text-text-light uppercase tracking-wider">Needs Attention</p>
          <p className="text-[20px] font-bold text-text-muted tracking-tight mt-1">
            {hasAnyWork ? [...STAGES].sort((a, b) => (stageStats[a.name]?.pct ?? 0) - (stageStats[b.name]?.pct ?? 0))[0]?.name : '—'}
          </p>
        </div>
      </div>

      {/* ── 2. Date range + export ── */}
      <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
        <h2 className="text-lg font-bold">Date Range</h2>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(p => (
            <PresetPill key={p.key} active={preset === p.key} onClick={() => setPreset(p.key)}>
              {p.label}
            </PresetPill>
          ))}
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="flex-1 h-9 px-3 rounded-lg border border-border bg-surface-alt text-sm" aria-label="Start date" />
            <span className="text-text-muted text-sm">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="flex-1 h-9 px-3 rounded-lg border border-border bg-surface-alt text-sm" aria-label="End date" />
          </div>
          <button type="button" className="h-9 px-4 rounded-lg bg-gold text-black text-sm font-semibold hover:bg-gold-muted focus-ring flex items-center gap-1.5">
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" className="h-9 px-4 rounded-lg bg-gold text-black text-sm font-semibold hover:bg-gold-muted focus-ring flex items-center gap-1.5">
          <Download size={14} /> Export PDF
        </button>
        <button type="button" className="h-9 px-4 rounded-lg border border-border bg-surface text-text text-sm font-semibold hover:bg-surface-hover focus-ring flex items-center gap-1.5">
          <Printer size={14} /> Print
        </button>
      </div>

      {/* ── 3. KPI Performance bar (completion % per stage) ── */}
      {(() => {
        const chartData = STAGES.map(s => ({
          name: s.name,
          completed: stageStats[s.name]?.pct ?? 0,
          remaining: 100 - (stageStats[s.name]?.pct ?? 0),
        }))
        return (
          <div className="bg-surface rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-text tracking-tight">KPI Performance</h2>
              <span className="text-[11px] text-text-light">Completion by stage</span>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={32} barGap={8}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6e6e76', fontSize: 12 }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#46464e', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(value) => [`${Number(value ?? 0)}%`, 'Completed']}
                    cursor={{ fill: 'rgba(201, 168, 76, 0.05)' }}
                  />
                  <Bar dataKey="completed" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill="#C9A84C" fillOpacity={0.8} />)}
                  </Bar>
                  <Bar dataKey="remaining" radius={[6, 6, 0, 0]} stackId="a">
                    {chartData.map((_, i) => <Cell key={i} fill="#2c2c34" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      })()}

      {/* ── 4. Flywheel drill-down (stage tabs + task list) ── */}
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

        <div className="px-5 py-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold text-gold uppercase tracking-wider">Selected Stage</p>
          </div>
          <h2 className="text-[22px] font-extrabold text-text tracking-tight">{stage.name}</h2>
          <p className="text-[13px] text-text-muted mt-0.5">{stage.subtitle} · Target: {stage.target}</p>

          <div className="mt-4 mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] text-text-light">Progress</p>
              <p className="text-[14px] font-bold text-text">{stats.pct}%</p>
            </div>
            <div className="h-2 bg-surface-alt rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700 ease-out bg-gold" style={{ width: `${stats.pct}%` }} />
            </div>
          </div>

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
            {selectedStage !== 'Book' && stageTasks.length === 0 && <p className="text-[13px] text-text-light text-center py-6">No tasks in this stage yet.</p>}
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

      {/* ── 5. Tasks by KPI Stage donut + Tasks & Bookings summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="text-lg font-bold mb-3">Tasks &amp; Bookings</h2>
          <div className="space-y-0">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <span className="flex items-center gap-2 text-sm text-text-muted"><Briefcase size={14} className="text-text-light" /> Bookings</span>
              <span className="text-xl font-bold tabular-nums text-text">{bookings.length}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border">
              <span className="flex items-center gap-2 text-sm text-text-muted"><Target size={14} className="text-text-light" /> KPI Tasks</span>
              <span className="text-xl font-bold tabular-nums text-text">{tasks.filter(t => ['Deliver','Capture','Share','Attract'].includes(t.stage)).length}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border">
              <span className="flex items-center gap-2 text-sm text-text-muted"><CheckSquare size={14} className="text-text-light" /> Studio Tasks</span>
              <span className="text-xl font-bold tabular-nums text-text">{tasks.filter(t => ['Administrative','Coding','Maintenance'].includes(t.stage)).length}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="flex items-center gap-2 text-sm text-text-muted"><CheckSquare size={14} className="text-text-light" /> Total Tasks</span>
              <span className="text-xl font-bold tabular-nums text-gold">{tasks.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="text-lg font-bold mb-3">Tasks by KPI Stage</h2>
          {hasKpiCounts ? (
            <div className="h-64" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={tasksByKpiStage} dataKey="count" nameKey="stage" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                    {tasksByKpiStage.map(entry => <Cell key={entry.stage} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState message="The donut will split across Deliver, Capture, Share, Attract, and Book as your team completes tasks tagged with KPI stages." />
          )}
        </div>
      </div>

      {/* ── 6. Monthly Trend ── */}
      <div className="bg-surface rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Monthly Trend</h2>
            <p className="text-[13px] text-text-muted mt-0.5">Bookings, KPI tasks, and studio tasks — last 6 months.</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-400" /> Bookings</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-gold" /> KPI Tasks</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-amber-400" /> Studio Tasks</span>
          </div>
        </div>
        {hasTrendData ? (
          <div className="h-72" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MONTHLY_TREND} barCategoryGap="30%">
                <CartesianGrid stroke="#34343d" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#bcbcc6' }} axisLine={{ stroke: '#34343d' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#bcbcc6' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="bookings" name="Bookings"  fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tasks"    name="KPI Tasks" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                <Bar dataKey="studio"   name="Studio"    fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ChartEmptyState height="h-72" message="The 6-month grouped bar chart will show bookings, KPI tasks, and studio tasks side-by-side per month." />
        )}
      </div>

      {/* ── 7. Bookings Trend ── */}
      <div className="bg-surface rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Bookings Trend</h2>
            <p className="text-[13px] text-text-muted mt-0.5">Confirmed sessions over the tracked period.</p>
          </div>
          <p className="text-2xl font-bold text-gold tabular-nums">{totalBookingsInTrend || bookings.length}</p>
        </div>
        {hasTrendData ? (
          <div className="h-56" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MONTHLY_TREND}>
                <CartesianGrid stroke="#34343d" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#bcbcc6' }} axisLine={{ stroke: '#34343d' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#bcbcc6' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                <Line type="monotone" dataKey="bookings" stroke="#C9A84C" strokeWidth={2.5} dot={{ r: 4, fill: '#C9A84C' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ChartEmptyState height="h-56" message="A line will trace confirmed bookings over time once sessions are created in the Booking page." />
        )}
      </div>

      {/* ── 8. Tasks by Employee (stacked horizontal bars) ── */}
      <div className="bg-surface rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Tasks by Employee</h2>
            <p className="text-[13px] text-text-muted mt-0.5">KPI-assigned vs. studio (unassigned) work per person.</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-400" /> KPI</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-amber-400" /> Studio</span>
          </div>
        </div>
        {hasEmployeeData ? (
          <div className="h-80" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TASKS_BY_EMPLOYEE} layout="vertical" barCategoryGap="25%">
                <CartesianGrid stroke="#34343d" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#bcbcc6' }} axisLine={{ stroke: '#34343d' }} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#e2e2ea' }} axisLine={false} tickLine={false} width={120} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="kpi"    name="KPI"    stackId="t" fill="#34d399" radius={[4, 0, 0, 4]} />
                <Bar dataKey="studio" name="Studio" stackId="t" fill="#fbbf24" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ChartEmptyState height="h-80" message="A stacked bar will show each employee's KPI and studio task counts once tasks start being completed." />
        )}
      </div>

      {/* ── 9. Other Reports (tabular) ── */}
      <div className="bg-surface rounded-2xl border border-border p-5">
        <h2 className="text-lg font-bold mb-3">Other Reports</h2>

        <div className="bg-surface-alt/50 rounded-xl py-2 px-3 mb-2 text-center">
          <p className="text-sm font-semibold text-text">Tasks by Employee</p>
        </div>
        {hasEmployeeData ? (
          <div className="space-y-0">
            {TASKS_BY_EMPLOYEE.map(emp => (
              <div key={emp.name} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                <span className="text-sm text-text">{emp.name}</span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-[11px] text-text-muted tabular-nums">
                    <span className="text-emerald-400 font-semibold">{emp.kpi}</span>
                    <span className="text-text-light mx-1">·</span>
                    <span className="text-amber-400 font-semibold">{emp.studio}</span>
                  </span>
                  <span className="font-bold text-text tabular-nums w-8 text-right">{emp.tasks}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <ChartEmptyState height="h-32" message="Each team member will list here with their KPI vs. studio task counts once work is logged." />
        )}
        <p className="text-[11px] text-text-light mt-2 flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400" /> KPI</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Studio</span>
        </p>

        <div className="bg-surface-alt/50 rounded-xl py-2 px-3 mb-2 mt-5 text-center">
          <p className="text-sm font-semibold text-text">Studio Tasks (unassigned)</p>
        </div>
        {hasStudioData ? (
          <div className="space-y-0">
            {STUDIO_BUCKETS.map(b => (
              <div key={b.label} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                <span className="text-sm text-text">{b.label}</span>
                <span className="font-bold text-text tabular-nums">{b.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <ChartEmptyState height="h-32" message="Studio maintenance tasks (setup, cleanup, gear inventory, etc.) will appear here as they're logged." />
        )}
      </div>
    </div>
  )
}
