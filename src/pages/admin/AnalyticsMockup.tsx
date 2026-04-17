import { useState } from 'react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts'
import {
  Download, Printer, RefreshCcw, Target, CheckSquare, Briefcase, Info, PieChart as PieChartIcon,
} from 'lucide-react'

/**
 * Flywheel Analytics.
 *
 * The page layout is the permanent design — Tasks & Bookings summary,
 * tasks-by-KPI donut, Other Reports (employee + studio breakdowns),
 * monthly trend bar chart, bookings line, employee stacked bars.
 *
 * The data that drives it starts empty on purpose. Pre-onboarding, the
 * original demo numbers (42 Deliver tasks, 7 hardcoded employees, etc.)
 * lived in `const` blocks at the top of this file and gave anyone
 * viewing the page a false impression of activity. Those are all
 * replaced with empty arrays / zero counts. Each section detects the
 * empty case and renders a calm placeholder instead of a chart
 * showing `0 / 0 / 0`, so the overall layout still communicates
 * "this is where analytics live" without fabricating anything.
 *
 * When the flywheel event ledger ships (Phase 2 of the rebuild
 * blueprint), this page's data sources will switch to live Supabase
 * queries and the charts will naturally populate with real numbers.
 */

// ── Preset date filters ────────────────────────────────────────────────

type Preset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all'
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year',    label: 'This Year' },
  { key: 'all',     label: 'All Time' },
]

// ── Live-data shapes (currently empty; populated once the flywheel
//    event ledger + real queries land) ────────────────────────────────

const MONTHLY_TREND: { month: string; bookings: number; tasks: number; studio: number }[] = []
const TASKS_BY_KPI: { stage: string; count: number; color: string }[] = []
const TASKS_BY_EMPLOYEE: { name: string; tasks: number; kpi: number; studio: number }[] = []
const STUDIO_BUCKETS: { label: string; count: number }[] = []

const TOTAL_BOOKINGS   = MONTHLY_TREND.reduce((s, r) => s + r.bookings, 0)
const TOTAL_TASKS      = MONTHLY_TREND.reduce((s, r) => s + r.tasks, 0)
const TOTAL_STUDIO     = MONTHLY_TREND.reduce((s, r) => s + r.studio, 0)
const TOTAL_KPI_TASKS  = TOTAL_TASKS - TOTAL_STUDIO

// ── Small primitives ───────────────────────────────────────────────────

function PresetPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-4 h-9 rounded-lg text-sm font-semibold transition-all focus-ring',
        active
          ? 'bg-gold text-black shadow-sm'
          : 'bg-surface-alt text-text-muted border border-border hover:text-text hover:bg-surface-hover',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function SummaryStat({
  icon: Icon, label, value, accent,
}: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string | number; accent?: 'gold' | 'emerald' | 'muted' }) {
  const accentClass = accent === 'gold'    ? 'text-gold'
                    : accent === 'emerald' ? 'text-emerald-400'
                    : 'text-text'
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
      <span className="flex items-center gap-2 text-sm text-text-muted">
        <Icon size={14} className="text-text-light" />
        {label}
      </span>
      <span className={`text-xl font-bold tabular-nums ${accentClass}`}>{value}</span>
    </div>
  )
}

/**
 * Empty-state panel for chart containers. Keeps the section's height
 * so the layout grid doesn't collapse, and gives a single consistent
 * message across every chart on the page.
 */
function ChartEmptyState({ height = 'h-64', message }: { height?: string; message: string }) {
  return (
    <div className={`${height} flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-alt/30 text-center px-6`}>
      <Info size={18} className="text-text-light" aria-hidden="true" />
      <p className="text-[13px] text-text-muted max-w-[44ch]">{message}</p>
    </div>
  )
}

// ── Chart tooltip style (reused) ───────────────────────────────────────
const tooltipStyle = {
  background: '#1e1e25',
  border: '1px solid #34343d',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e2ea',
}
const tooltipLabelStyle = { color: '#bcbcc6' }

// ── Page ───────────────────────────────────────────────────────────────

export default function AnalyticsMockup() {
  useDocumentTitle('Flywheel Analytics - Checkmark Audio')
  const [preset, setPreset] = useState<Preset>('all')
  const [from, setFrom] = useState('1900-01-01')
  const [to, setTo] = useState('2999-12-31')

  const hasTrendData    = MONTHLY_TREND.length > 0
  const hasKpiData      = TASKS_BY_KPI.length > 0 && TASKS_BY_KPI.some(k => k.count > 0)
  const hasEmployeeData = TASKS_BY_EMPLOYEE.length > 0
  const hasStudioData   = STUDIO_BUCKETS.length > 0

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Flywheel</p>
        <h1 className="text-2xl font-bold mt-1">Analytics</h1>
        <p className="text-text-muted text-sm mt-1">
          Bookings and tasks across KPIs, employees, and studio work.
        </p>
      </div>

      {/* ── First-run notice ──
          PieChartIcon matches the Flywheel nav entry in Layout.tsx so
          the callout reads as in-family with the sidebar iconography. */}
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

      {/* ── Date Range card ── */}
      <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
        <h2 className="text-lg font-bold">Date Range</h2>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(p => (
            <PresetPill key={p.key} active={preset === p.key} onClick={() => setPreset(p.key)}>
              {p.label}
            </PresetPill>
          ))}
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="flex-1 h-9 px-3 rounded-lg border border-border bg-surface-alt text-sm"
              aria-label="Start date"
            />
            <span className="text-text-muted text-sm">to</span>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="flex-1 h-9 px-3 rounded-lg border border-border bg-surface-alt text-sm"
              aria-label="End date"
            />
          </div>
          <button
            type="button"
            className="h-9 px-4 rounded-lg bg-gold text-black text-sm font-semibold hover:bg-gold-muted focus-ring flex items-center gap-1.5"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Export bar ── */}
      <div className="flex items-center justify-end gap-2">
        <button type="button" className="h-9 px-4 rounded-lg bg-gold text-black text-sm font-semibold hover:bg-gold-muted focus-ring flex items-center gap-1.5">
          <Download size={14} /> Export PDF
        </button>
        <button type="button" className="h-9 px-4 rounded-lg border border-border bg-surface text-text text-sm font-semibold hover:bg-surface-hover focus-ring flex items-center gap-1.5">
          <Printer size={14} /> Print
        </button>
      </div>

      {/* ── Two-column: Tasks overview (donut) + Other Reports (lists) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks overview */}
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="text-lg font-bold mb-3">Tasks &amp; Bookings</h2>
          <div className="space-y-0">
            <SummaryStat icon={Briefcase}   label="Bookings"     value={TOTAL_BOOKINGS}   accent="muted" />
            <SummaryStat icon={Target}      label="KPI Tasks"    value={TOTAL_KPI_TASKS}  accent="muted" />
            <SummaryStat icon={CheckSquare} label="Studio Tasks" value={TOTAL_STUDIO}     accent="muted" />
            <SummaryStat icon={CheckSquare} label="Total Tasks"  value={TOTAL_TASKS}      accent="gold" />
          </div>

          {/* Donut — tasks by KPI stage */}
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-light mb-2">Tasks by KPI Stage</p>
            {hasKpiData ? (
              <div className="h-64" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={TASKS_BY_KPI}
                      dataKey="count"
                      nameKey="stage"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {TASKS_BY_KPI.map(entry => (
                        <Cell key={entry.stage} fill={entry.color} />
                      ))}
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

        {/* Other reports */}
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="text-lg font-bold mb-3">Other Reports</h2>

          {/* Tasks by Employee */}
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
            <ChartEmptyState height="h-40" message="Each team member will list here with their KPI vs. studio task counts once work is logged." />
          )}
          <p className="text-[11px] text-text-light mt-2 flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400" /> KPI</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Studio</span>
          </p>

          {/* Studio Tasks breakdown */}
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
            <ChartEmptyState height="h-40" message="Studio maintenance tasks (setup, cleanup, gear inventory, etc.) will appear here as they're logged." />
          )}
        </div>
      </div>

      {/* ── Monthly trend — grouped bar chart ── */}
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
                <Bar dataKey="bookings" name="Bookings"    fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tasks"    name="KPI Tasks"   fill="#C9A84C" radius={[4, 4, 0, 0]} />
                <Bar dataKey="studio"   name="Studio"      fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ChartEmptyState height="h-72" message="The 6-month grouped bar chart will show bookings, KPI tasks, and studio tasks side-by-side per month." />
        )}
      </div>

      {/* ── Bookings trend line ── */}
      <div className="bg-surface rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Bookings Trend</h2>
            <p className="text-[13px] text-text-muted mt-0.5">Confirmed sessions over the tracked period.</p>
          </div>
          <p className="text-2xl font-bold text-gold tabular-nums">{TOTAL_BOOKINGS}</p>
        </div>
        {hasTrendData ? (
          <div className="h-56" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MONTHLY_TREND}>
                <CartesianGrid stroke="#34343d" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#bcbcc6' }} axisLine={{ stroke: '#34343d' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#bcbcc6' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                <Line
                  type="monotone"
                  dataKey="bookings"
                  stroke="#C9A84C"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#C9A84C' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ChartEmptyState height="h-56" message="A line will trace confirmed bookings over time once sessions are created in the Booking page." />
        )}
      </div>

      {/* ── Tasks by Employee — stacked horizontal bar chart ── */}
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
    </div>
  )
}
