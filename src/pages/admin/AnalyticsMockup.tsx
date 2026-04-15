import { useState } from 'react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { Download, Printer, RefreshCcw, Target, CheckSquare, Briefcase } from 'lucide-react'

/**
 * Analytics mockup — modelled after the accountant P&L / Other Reports layout.
 * All data is hard-coded for the design pass; the real page will hydrate
 * these same shapes from bookings + tasks queries later.
 *
 * Accent colour swap vs. the reference: the reference uses blue as its
 * primary accent; we substitute the Checkmark gold so the mockup stays on
 * brand. Flywheel stage colours (emerald/sky/violet/amber/rose) come from
 * the index.css theme tokens.
 */

// ── Mock data ───────────────────────────────────────────────────────────

type Preset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all'
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year',    label: 'This Year' },
  { key: 'all',     label: 'All Time' },
]

// Monthly bookings + tasks trend (for the grouped bar chart at the bottom)
const MONTHLY_TREND = [
  { month: '2025-10', bookings: 18, tasks: 64, studio: 12 },
  { month: '2025-11', bookings: 25, tasks: 82, studio: 18 },
  { month: '2025-12', bookings:  9, tasks: 31, studio:  7 },
  { month: '2026-01', bookings: 28, tasks: 95, studio: 22 },
  { month: '2026-02', bookings: 22, tasks: 78, studio: 15 },
  { month: '2026-03', bookings: 12, tasks: 48, studio:  9 },
]

// Tasks broken down by flywheel KPI stage
const TASKS_BY_KPI = [
  { stage: 'Deliver', count: 42, color: '#34d399' }, // emerald-400
  { stage: 'Capture', count: 35, color: '#38bdf8' }, // sky-400
  { stage: 'Share',   count: 28, color: '#a78bfa' }, // violet-400
  { stage: 'Attract', count: 31, color: '#fbbf24' }, // amber-400
  { stage: 'Book',    count: 22, color: '#fb7185' }, // rose-400
]

// Tasks by employee (for the Other Reports-style list)
const TASKS_BY_EMPLOYEE = [
  { name: 'Jordan Lee',     tasks: 34, kpi: 28, studio: 6 },
  { name: 'Sam Rivera',     tasks: 28, kpi: 22, studio: 6 },
  { name: 'Alex Kim',       tasks: 24, kpi: 19, studio: 5 },
  { name: 'Taylor Morgan',  tasks: 22, kpi: 17, studio: 5 },
  { name: 'Casey Chen',     tasks: 18, kpi: 14, studio: 4 },
  { name: 'Morgan Davis',   tasks: 15, kpi: 12, studio: 3 },
  { name: 'Riley Thompson', tasks: 12, kpi:  9, studio: 3 },
]

const STUDIO_BUCKETS = [
  { label: 'Setup / Teardown',    count: 18 },
  { label: 'Studio Maintenance',  count: 14 },
  { label: 'Gear Inventory',      count: 11 },
  { label: 'Cable Management',    count:  8 },
  { label: 'General Cleanup',     count:  7 },
]

// Derived totals for the summary card
const TOTAL_BOOKINGS = MONTHLY_TREND.reduce((s, r) => s + r.bookings, 0)
const TOTAL_TASKS   = MONTHLY_TREND.reduce((s, r) => s + r.tasks, 0)
const TOTAL_STUDIO  = MONTHLY_TREND.reduce((s, r) => s + r.studio, 0)
const TOTAL_KPI_TASKS = TOTAL_TASKS - TOTAL_STUDIO

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

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Flywheel</p>
        <h1 className="text-2xl font-bold mt-1">Analytics</h1>
        <p className="text-text-muted text-sm mt-1">
          Bookings and tasks across KPIs, employees, and studio work.
        </p>
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
        {/* Tasks overview — mirror of "Profit & Loss" */}
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="text-lg font-bold mb-3">Tasks &amp; Bookings</h2>
          <div className="space-y-0">
            <SummaryStat icon={Briefcase}  label="Bookings"   value={TOTAL_BOOKINGS}   accent="muted" />
            <SummaryStat icon={Target}     label="KPI Tasks"  value={TOTAL_KPI_TASKS}  accent="muted" />
            <SummaryStat icon={CheckSquare} label="Studio Tasks" value={TOTAL_STUDIO} accent="muted" />
            <SummaryStat icon={CheckSquare} label="Total Tasks" value={TOTAL_TASKS}   accent="gold" />
          </div>

          {/* Donut — tasks by KPI stage */}
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-light mb-2">Tasks by KPI Stage</p>
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
                  <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 12, color: '#bcbcc6' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Other reports — mirror of the right card */}
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="text-lg font-bold mb-3">Other Reports</h2>

          {/* Tasks by Employee */}
          <div className="bg-surface-alt/50 rounded-xl py-2 px-3 mb-2 text-center">
            <p className="text-sm font-semibold text-text">Tasks by Employee</p>
          </div>
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
          <p className="text-[11px] text-text-light mt-2 flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400" /> KPI</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Studio</span>
          </p>

          {/* Studio Tasks breakdown */}
          <div className="bg-surface-alt/50 rounded-xl py-2 px-3 mb-2 mt-5 text-center">
            <p className="text-sm font-semibold text-text">Studio Tasks (unassigned)</p>
          </div>
          <div className="space-y-0">
            {STUDIO_BUCKETS.map(b => (
              <div key={b.label} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                <span className="text-sm text-text">{b.label}</span>
                <span className="font-bold text-text tabular-nums">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Monthly trend — grouped bar chart (mirror of Income/Expenses/Profit) ── */}
      <div className="bg-surface rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Monthly Trend</h2>
            <p className="text-[13px] text-text-muted mt-0.5">Bookings, KPI tasks, and studio tasks — last 6 months.</p>
          </div>
          {/* Custom legend dots so colours match the bar palette */}
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-400" /> Bookings</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-gold" /> KPI Tasks</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-amber-400" /> Studio Tasks</span>
          </div>
        </div>
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
        <div className="h-56" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={MONTHLY_TREND}>
              <defs>
                <linearGradient id="bookings-line" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
              </defs>
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
      </div>

      {/* ── Tasks by Employee — stacked horizontal-ish bar chart ── */}
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
      </div>
    </div>
  )
}
