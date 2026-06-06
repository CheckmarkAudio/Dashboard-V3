import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useAuth } from '../../contexts/AuthContext'
import { useTasks } from '../../contexts/TaskContext'
import { fetchTeamAssignedTasks } from '../../lib/queries/assignments'
import { fetchFlywheelStageSummary, flywheelKeys } from '../../lib/queries/flywheelEvents'
import { isFlywheelDemo, demoStageSummary, demoMonthlyTrend, demoTasksByEmployee, demoStudioBuckets, DEMO_STAGE_DONE_RATE } from '../../lib/flywheel/demo'
import { Check, RefreshCcw, Target, CheckSquare, Briefcase, Info, PieChart as PieChartIcon } from 'lucide-react'
import { ExportButtons, toExportColumns } from '../../components/ui'
import { taskExportColumns } from '../../lib/columns/taskColumns'
import { FLYWHEEL_STAGES, normalizeLegacyStage, type FlywheelStage } from '../../lib/flywheel/stages'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
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

// Stage display rows for this page, keyed by the canonical flywheel keys.
// `key` is used for all matching/aggregation; `name` is the display label.
// Subtitles/targets are interim copy — PR3 swaps the % to ledger-derived.
const STAGE_DETAIL: Record<FlywheelStage, { subtitle: string; target: string }> = {
  discovery:  { subtitle: 'Inbound & Content',     target: 'Leads + content / week' },
  workflow:   { subtitle: 'Booking & Admin',        target: 'Sessions booked / month' },
  production: { subtitle: 'Delivery',               target: '95% on-time delivery' },
  education:  { subtitle: 'Community & Learning',    target: 'Workshops + lessons / month' },
  retention:  { subtitle: 'Advocacy & Re-engagement', target: 'Repeat clients + reviews / month' },
}
const STAGES = FLYWHEEL_STAGES.map((s) => ({
  key: s.key,
  name: s.label,
  subtitle: STAGE_DETAIL[s.key].subtitle,
  target: STAGE_DETAIL[s.key].target,
  color: s.hex,
}))

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
// Ensures every tooltip line (value + name) is light on the dark bubble —
// recharts otherwise tints item text with the series color, which can render
// near-invisible on the dark popover.
const tooltipItemStyle = { color: '#e2e2ea' }

/** Round up to a "nice" goal ceiling (50/100/… steps) above a value. */
function niceCeil(n: number): number {
  if (n <= 10) return Math.max(1, Math.ceil(n))
  const mag = Math.pow(10, Math.floor(Math.log10(n)))
  const step = mag / 2
  return Math.ceil(n / step) * step
}

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

// Local-date helpers — keep all date math in local Denver time per the
// project convention (see PR #c6c5bf6 "Calendar local-date key fix").
// Date inputs and ISO timestamps both get compared against the same
// YYYY-MM-DD local format so evening timezones don't slide rows by one
// day in the export.
function localDateKey(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function isoToLocalDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return null
  return localDateKey(d)
}

// Translate a preset into a {from, to} window. Local week starts Monday
// to match the studio's actual work-week cadence.
function presetToRange(preset: Preset): { from: string; to: string } {
  const today = new Date()
  const todayKey = localDateKey(today)

  if (preset === 'today') return { from: todayKey, to: todayKey }

  if (preset === 'week') {
    const day = today.getDay() // 0 (Sun) – 6 (Sat)
    const offsetToMon = day === 0 ? 6 : day - 1
    const start = new Date(today)
    start.setDate(today.getDate() - offsetToMon)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { from: localDateKey(start), to: localDateKey(end) }
  }

  if (preset === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return { from: localDateKey(start), to: localDateKey(end) }
  }

  if (preset === 'quarter') {
    const q = Math.floor(today.getMonth() / 3)
    const start = new Date(today.getFullYear(), q * 3, 1)
    const end = new Date(today.getFullYear(), q * 3 + 3, 0)
    return { from: localDateKey(start), to: localDateKey(end) }
  }

  if (preset === 'year') {
    return {
      from: localDateKey(new Date(today.getFullYear(), 0, 1)),
      to: localDateKey(new Date(today.getFullYear(), 11, 31)),
    }
  }

  // 'all'
  return { from: '1900-01-01', to: '2999-12-31' }
}

export default function BusinessHealth() {
  useDocumentTitle('Analytics - Checkmark Workspace')
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  // `useTasks` still drives the task-drilldown list + bookings until
  // the Phase 2 flywheel ledger arrives. Task aggregation for the
  // flywheel bars now comes from real assigned_tasks via Supabase
  // (PR #27) so a task tagged with a flywheel stage actually counts
  // in the per-stage metrics.
  const { tasks, bookings, pendingIds, togglePending, submitPending, hasPending } = useTasks()
  const [selectedStage, setSelectedStage] = useState<FlywheelStage>('discovery')
  const [timeFilter, setTimeFilter] = useState<'total' | 'year' | 'month' | 'week' | 'day'>('week')
  const [preset, setPreset] = useState<Preset>('all')
  const [from, setFrom] = useState('1900-01-01')
  const [to, setTo] = useState('2999-12-31')

  // Preset → date range. Clicking a preset pill rewrites from/to so
  // the export reflects the user's expectation. Manual date-picker
  // changes don't reset the preset, but they will visually un-match.
  useEffect(() => {
    const range = presetToRange(preset)
    setFrom(range.from)
    setTo(range.to)
  }, [preset])

  const assignedTasksQuery = useQuery({
    queryKey: ['team-assigned-tasks', profile?.id ?? 'none', 'all'] as const,
    queryFn: () => fetchTeamAssignedTasks(profile!.id, { includeCompleted: true }),
    enabled: Boolean(profile?.id),
  })
  const assignedTasks = assignedTasksQuery.data ?? []

  // Real flywheel-event counts per stage over the active date range —
  // drives the "Flywheel Activity" chart off the ledger (was task-category
  // aggregation). `from`/`to` are yyyy-mm-dd; widen to full-day bounds.
  const flywheelSummaryQuery = useQuery({
    queryKey: flywheelKeys.summary(from || null, to || null, null),
    queryFn: () => fetchFlywheelStageSummary({
      since: from ? `${from}T00:00:00` : null,
      until: to ? `${to}T23:59:59` : null,
    }),
  })
  const flywheelSummary = flywheelSummaryQuery.data ?? []

  // PR3: the "Flywheel KPIs" panel is now ledger-derived. The time toggle
  // (total/year/month/week/day) actually filters now — it drives a separate
  // stage-summary query over the chosen window. Per-stage event counts +
  // each stage's share of total activity replace the old task-based %.
  const kpiRange = useMemo(() => {
    if (timeFilter === 'total') return { since: null as string | null, until: null as string | null }
    const now = new Date()
    const since = new Date(now)
    if (timeFilter === 'day') since.setDate(now.getDate() - 1)
    else if (timeFilter === 'week') since.setDate(now.getDate() - 7)
    else if (timeFilter === 'month') since.setMonth(now.getMonth() - 1)
    else since.setFullYear(now.getFullYear() - 1)
    return { since: since.toISOString(), until: now.toISOString() }
  }, [timeFilter])
  const kpiSummaryQuery = useQuery({
    queryKey: flywheelKeys.summary(kpiRange.since, kpiRange.until, null),
    queryFn: () => fetchFlywheelStageSummary({ since: kpiRange.since, until: kpiRange.until }),
  })
  const kpiByStage = new Map((kpiSummaryQuery.data ?? []).map(s => [s.stage, s.event_count]))
  const kpiTotal = (kpiSummaryQuery.data ?? []).reduce((a, s) => a + s.event_count, 0)
  const selectedCount = kpiByStage.get(selectedStage) ?? 0
  const selectedSharePct = kpiTotal > 0 ? Math.round((selectedCount / kpiTotal) * 100) : 0

  // Tasks filtered by the active from/to range. A task qualifies when
  // EITHER its completed_at (when finished) OR its created_at (when
  // added) falls inside the window — gives "task activity in this
  // period" rather than just "tasks created in this period," which is
  // what admins actually want for retrospective reports.
  const filteredTasks = useMemo(() => {
    if (from === '1900-01-01' && to === '2999-12-31') return assignedTasks
    const inRange = (key: string | null) => key !== null && key >= from && key <= to
    return assignedTasks.filter((t) => {
      const completedKey = isoToLocalDateKey(t.completed_at)
      const createdKey = isoToLocalDateKey(t.created_at)
      return inRange(completedKey) || inRange(createdKey)
    })
  }, [assignedTasks, from, to])

  // Pretty label for the export filename + PDF title. Matches the
  // currently active preset OR the manual date range.
  const rangeLabel = useMemo(() => {
    if (from === '1900-01-01' && to === '2999-12-31') return 'all-time'
    if (from === to) return from
    return `${from}-to-${to}`
  }, [from, to])

  // ── Derived stats — per-stage task counts from real assigned_tasks ──

  const stageStats = useMemo(() => {
    const stats: Record<string, { total: number; done: number; open: number; pct: number }> = {}
    // Demo preview: synthesize per-stage totals (≈80% "done") so the pie,
    // summary cards, and Best/Needs populate without touching the DB.
    if (isFlywheelDemo()) {
      const byKey = new Map(demoStageSummary().map((d) => [d.stage, d.event_count]))
      for (const stage of STAGES) {
        const total = byKey.get(stage.key) ?? 0
        const done = Math.round(total * (DEMO_STAGE_DONE_RATE[stage.key] ?? 0.7))
        stats[stage.key] = { total, done, open: total - done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
      }
      return stats
    }
    for (const stage of STAGES) {
      // Real assigned_tasks tagged to this stage (category stores the
      // canonical key; normalizeLegacyStage tolerates any legacy leftover).
      const matching = assignedTasks.filter(t => normalizeLegacyStage(t.category) === stage.key)
      let total = matching.length
      let done = matching.filter(t => t.is_completed).length
      // Bookings count toward the Workflow stage (booking & administration)
      // until PR2 derives all stages from the flywheel_events ledger.
      if (stage.key === 'workflow') {
        total += bookings.length
        done += bookings.filter(b => b.status === 'Confirmed').length
      }
      stats[stage.key] = {
        total,
        done,
        open: total - done,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
      }
    }
    return stats
  }, [assignedTasks, bookings])

  // Totals cover both surfaces: real tagged tasks + bookings.
  const totalAssignedTagged = assignedTasks.filter(t => normalizeLegacyStage(t.category) !== null).length
  const totalAssignedDone = assignedTasks.filter(t => normalizeLegacyStage(t.category) !== null && t.is_completed).length
  const demoActive = isFlywheelDemo()
  const totalItems = demoActive
    ? Object.values(stageStats).reduce((a, s) => a + s.total, 0)
    : totalAssignedTagged + bookings.length
  const totalDone = demoActive
    ? Object.values(stageStats).reduce((a, s) => a + s.done, 0)
    : totalAssignedDone + bookings.filter(b => b.status === 'Confirmed').length
  const overallPct = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0
  const healthLabel = overallPct >= 85 ? 'Excellent' : overallPct >= 65 ? 'Good' : overallPct >= 40 ? 'Average' : 'Low'

  const stage = STAGES.find(s => s.key === selectedStage) ?? STAGES[0]!
  // Drill-down list: real assigned_tasks tagged to this stage, plus
  // the legacy mock-context tasks so the drilldown isn't blank until
  // the ledger lands. Sort done-last so open work surfaces first.
  const realStageTasks = assignedTasks.filter(t => normalizeLegacyStage(t.category) === selectedStage)
  const mockStageTasks = tasks.filter(t => normalizeLegacyStage(t.stage) === selectedStage)
  const stageTasks = [...realStageTasks.map(t => ({
    id: t.id,
    title: t.title,
    completed: t.is_completed,
    priority: t.is_required,
    due: t.due_date,
  })), ...mockStageTasks]
  const sortedStageTasks = [...stageTasks].sort((a, b) => a.completed === b.completed ? 0 : a.completed ? 1 : -1)

  // ── Donut data — raw task counts per stage, real + mock ──────────────

  const tasksByKpiStage = useMemo(() =>
    STAGES.map(s => ({
      stage: s.name,
      count: stageStats[s.key]?.total ?? 0,
      color: s.color,
    })), [stageStats])

  // ── Empty-state guards ────────────────────────────────────────────────

  // Demo preview feeds the placeholder-backed charts too, so the whole
  // page can be evaluated (Bookings Trend, KPI Performance bar, Tasks by
  // Employee, Studio Tasks). Real mode keeps the empty consts until live.
  const monthlyTrend = demoActive ? demoMonthlyTrend() : MONTHLY_TREND
  const tasksByEmployee = demoActive ? demoTasksByEmployee() : TASKS_BY_EMPLOYEE
  const studioBuckets = demoActive ? demoStudioBuckets() : STUDIO_BUCKETS

  const hasAnyWork      = totalItems > 0
  const hasKpiCounts    = tasksByKpiStage.some(s => s.count > 0)
  const hasTrendData    = monthlyTrend.length > 0
  const hasEmployeeData = tasksByEmployee.length > 0
  const hasStudioData   = studioBuckets.length > 0

  const totalBookingsInTrend = monthlyTrend.reduce((s, r) => s + r.bookings, 0)

  // Tasks & Bookings summary box — sourced from the demo dataset in preview
  // mode (the legacy useTasks mock context is empty), real counts otherwise.
  const bookingsCount = demoActive ? totalBookingsInTrend : bookings.length
  const kpiTaskCount = demoActive
    ? tasksByEmployee.reduce((a, e) => a + e.kpi, 0)
    : tasks.filter(t => normalizeLegacyStage(t.stage) !== null).length
  const studioTaskCount = demoActive
    ? tasksByEmployee.reduce((a, e) => a + e.studio, 0)
    : tasks.filter(t => ['Administrative', 'Coding', 'Maintenance'].includes(t.stage)).length
  const totalTaskCount = demoActive ? kpiTaskCount + studioTaskCount : tasks.length

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
            {hasAnyWork ? [...STAGES].sort((a, b) => (stageStats[b.key]?.pct ?? 0) - (stageStats[a.key]?.pct ?? 0))[0]?.name : '—'}
          </p>
        </div>
        <div className="bg-surface rounded-2xl border border-border px-5 py-4">
          <p className="text-[10px] text-text-light uppercase tracking-wider">Needs Attention</p>
          <p className="text-[20px] font-bold text-text-muted tracking-tight mt-1">
            {hasAnyWork ? [...STAGES].sort((a, b) => (stageStats[a.key]?.pct ?? 0) - (stageStats[b.key]?.pct ?? 0))[0]?.name : '—'}
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
          {/* Refresh — wired 2026-05-17. Invalidates the cached
              assignedTasks query so the export reflects any new
              completions/edits without a page reload. */}
          <button
            type="button"
            onClick={() => {
              void queryClient.invalidateQueries({
                queryKey: ['team-assigned-tasks', profile?.id ?? 'none', 'all'],
              })
            }}
            disabled={assignedTasksQuery.isFetching}
            className="h-9 px-4 rounded-lg bg-gold text-black text-sm font-semibold hover:bg-gold-muted focus-ring flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCcw size={14} className={assignedTasksQuery.isFetching ? 'animate-spin' : ''} />
            {assignedTasksQuery.isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* All-team task export — wired 2026-05-17. Replaces the
          original stub Export PDF + Print buttons. Uses the shared
          `taskExportColumns` from PR #195 so the CSV/PDF schema is
          identical to the per-member + Studio Tasks exports. Rows
          come from `filteredTasks` so the active date range (preset
          or manual) flows through. Filename + PDF title include the
          range label so downloads land clearly named in Downloads. */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] text-text-light tabular-nums">
          Showing {filteredTasks.length} of {assignedTasks.length} team task
          {assignedTasks.length === 1 ? '' : 's'} · range {from} → {to}
        </p>
        <ExportButtons
          filename={`all-team-tasks-${rangeLabel}`}
          title={
            rangeLabel === 'all-time'
              ? 'All Team Tasks — All Time'
              : `All Team Tasks — ${from} to ${to}`
          }
          columns={toExportColumns(taskExportColumns)}
          rows={filteredTasks}
          disabled={assignedTasksQuery.isLoading}
        />
      </div>

      {/* ── 3. Flywheel Activity (done opaque + open translucent) ──
           PR #27: stacked-bar raw counts per stage. Opaque segment is
           completed tasks; translucent segment on top is assigned-
           but-open tasks. Bar color per stage — visually legible at a
           glance. Replaces the old monochrome % bar; real counts tell
           admins how much work is actually tagged to each stage. */}
      {(() => {
        // Real flywheel-event counts per stage from the ledger (PR2).
        const byStage = new Map(flywheelSummary.map(s => [s.stage, s.event_count]))
        const chartData = STAGES.map(s => ({ name: s.name, events: byStage.get(s.key) ?? 0, color: s.color }))
        const maxCount = Math.max(1, ...chartData.map(d => d.events))
        const totalEvents = chartData.reduce((a, d) => a + d.events, 0)
        // Goal ceiling: a "nice" round number above the busiest stage, with
        // headroom. The translucent track behind each bar runs to this goal,
        // so each bar reads as progress toward the target.
        const goal = niceCeil(maxCount * 1.25)
        return (
          <div className="bg-surface rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[16px] font-bold text-text tracking-tight">Flywheel Activity</h2>
              <span className="text-[11px] text-text-light">Events per stage · live ledger</span>
            </div>
            <p className="text-[11px] text-text-light mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Real actions recorded across the flywheel in this date range.</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-[3px] bg-gold/10 ring-1 ring-gold/25" aria-hidden="true" />
                goal · {goal.toLocaleString()}
              </span>
            </p>
            {flywheelSummaryQuery.isLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-gold/20 border-t-gold" />
              </div>
            ) : totalEvents === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-text-light">
                <PieChartIcon size={20} className="mb-2" aria-hidden="true" />
                <p className="text-[12px]">No flywheel events in this range yet.</p>
              </div>
            ) : (
              // Nested inset panel — frames the chart in the same chrome
              // language as the dashboard widgets so it reads as a deliberate
              // module, not a loose graphic.
              <div className="rounded-xl border border-border/60 bg-surface-alt/30 p-4">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barSize={56} barCategoryGap="22%" margin={{ top: 18, right: 8, left: -6, bottom: 0 }}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8a8a93', fontSize: 12, fontWeight: 600 }} />
                      <YAxis domain={[0, goal]} axisLine={false} tickLine={false} tick={{ fill: '#8a8a93', fontSize: 10 }} allowDecimals={false} width={34} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        itemStyle={tooltipItemStyle}
                        formatter={(value) => [`${value} ${Number(value) === 1 ? 'event' : 'events'}`, 'Activity']}
                        cursor={{ fill: 'rgba(201, 168, 76, 0.06)' }}
                      />
                      {/* Solid colored bar = actual; the `background` paints a
                          translucent gold track up to the goal ceiling. */}
                      <Bar dataKey="events" radius={[8, 8, 0, 0]} background={{ fill: 'rgba(201, 168, 76, 0.07)', radius: 8 }}>
                        {chartData.map((d, i) => <Cell key={`ev-${i}`} fill={d.color} fillOpacity={0.95} />)}
                        {/* On-bar count — white + drop-shadow reads on every
                            stage color and in both light/dark themes. */}
                        <LabelList
                          dataKey="events"
                          position="insideTop"
                          offset={12}
                          fill="#ffffff"
                          fontSize={15}
                          style={{ fontWeight: 800, textShadow: '0 1px 3px rgba(0,0,0,0.55)' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
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
            const count = kpiByStage.get(s.key) ?? 0
            const active = selectedStage === s.key
            return (
              <button key={s.key} onClick={() => setSelectedStage(s.key)}
                className={`flex-1 py-3 rounded-xl text-center transition-all ${active ? 'bg-gold/8 border border-gold/20' : 'hover:bg-white/[0.02]'}`}>
                <p className={`text-[13px] font-semibold tracking-tight ${active ? 'text-gold' : 'text-text-muted'}`}>{s.name}</p>
                <p className={`text-[18px] font-bold tracking-tight mt-0.5 tabular-nums ${active ? 'text-text' : 'text-text-light'}`}>{count}</p>
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
              <p className="text-[12px] text-text-light">Activity · {timeFilter === 'total' ? 'all time' : `past ${timeFilter}`}</p>
              <p className="text-[14px] font-bold text-text tabular-nums">{selectedCount} event{selectedCount === 1 ? '' : 's'}</p>
            </div>
            <div className="h-2 bg-surface-alt rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700 ease-out bg-gold" style={{ width: `${selectedSharePct}%` }} />
            </div>
            <p className="text-[10px] text-text-light mt-1">{selectedSharePct}% of all flywheel activity this period</p>
          </div>

          <div className="space-y-0">
            {selectedStage === 'workflow' ? (
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
                    <span className="text-[11px] text-text-light shrink-0">{task.due ? task.due.split(',')[0] : ''}</span>
                  </button>
                )
              })
            )}
            {selectedStage !== 'workflow' && stageTasks.length === 0 && <p className="text-[13px] text-text-light text-center py-6">No tasks in this stage yet.</p>}
            {selectedStage === 'workflow' && bookings.length === 0 && <p className="text-[13px] text-text-light text-center py-6">No bookings yet.</p>}
          </div>

          {hasPending && (
            <button onClick={submitPending} className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold text-black font-semibold text-[13px] tracking-tight hover:bg-gold-muted transition-all shadow-md shadow-gold/20">
              <Check size={14} />
              Submit Completed ({pendingIds.size})
            </button>
          )}
        </div>
      </div>

      {/* ── 4b. Stage Health — completion rate per stage, normalized ── */}
      {(() => {
        const rows = STAGES.map(s => {
          const st = stageStats[s.key] ?? { total: 0, done: 0, pct: 0 }
          return { key: s.key, name: s.name, color: s.color, total: st.total, done: st.done, pct: st.pct }
        })
        const active = rows.filter(r => r.total > 0)
        const ranked = [...active].sort((a, b) => b.pct - a.pct)
        const leading = ranked[0]
        const lagging = ranked[ranked.length - 1]
        const avgPct = active.length ? Math.round(active.reduce((a, r) => a + r.pct, 0) / active.length) : 0
        // Health color by completion rate — same scale for every stage so a
        // high-volume stage doesn't look "best" just for being busy.
        const healthColor = (pct: number) => pct >= 75 ? '#34d399' : pct >= 50 ? '#60a5fa' : pct >= 25 ? '#fb923c' : '#fb7185'
        const healthWord = (pct: number) => pct >= 75 ? 'On track' : pct >= 50 ? 'Steady' : pct >= 25 ? 'Slipping' : 'Needs work'
        return (
          <div className="bg-surface rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[16px] font-bold text-text tracking-tight">Stage Health</h2>
              <span className="text-[11px] text-text-light">Completion rate · {avgPct}% avg</span>
            </div>
            <p className="text-[11px] text-text-light mb-4">
              How much of each stage's work actually gets finished — measured as a rate, so volume doesn't skew it.
            </p>
            {active.length === 0 ? (
              <p className="text-[12px] text-text-light text-center py-6">No stage activity yet to score.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-text-light font-semibold">Leading</p>
                    <p className="text-[15px] font-bold text-text mt-0.5">{leading!.name} <span className="text-emerald-400 tabular-nums">{leading!.pct}%</span></p>
                  </div>
                  <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-text-light font-semibold">Needs attention</p>
                    <p className="text-[15px] font-bold text-text mt-0.5">{lagging!.name} <span className="text-rose-400 tabular-nums">{lagging!.pct}%</span></p>
                  </div>
                </div>
                <div className="space-y-3">
                  {rows.map(r => (
                    <div key={r.key}>
                      <div className="flex items-center justify-between mb-1 text-[12px]">
                        <span className="inline-flex items-center gap-2 font-semibold text-text">
                          <span className="w-2 h-2 rounded-full" style={{ background: r.color }} aria-hidden="true" />
                          {r.name}
                        </span>
                        {r.total > 0 ? (
                          <span className="text-text-muted tabular-nums">
                            <span className="font-bold text-text">{r.pct}%</span>
                            <span className="text-text-light"> · {r.done}/{r.total} done · {healthWord(r.pct)}</span>
                          </span>
                        ) : (
                          <span className="text-text-light italic">no activity</span>
                        )}
                      </div>
                      <div className="h-2.5 rounded-full bg-surface-alt overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${r.pct}%`, background: healthColor(r.pct) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* ── 5. Tasks by KPI Stage donut + Tasks & Bookings summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="text-lg font-bold mb-3">Tasks &amp; Bookings</h2>
          <div className="space-y-0">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <span className="flex items-center gap-2 text-sm text-text-muted"><Briefcase size={14} className="text-text-light" /> Bookings</span>
              <span className="text-xl font-bold tabular-nums text-text">{bookingsCount}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border">
              <span className="flex items-center gap-2 text-sm text-text-muted"><Target size={14} className="text-text-light" /> KPI Tasks</span>
              <span className="text-xl font-bold tabular-nums text-text">{kpiTaskCount}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border">
              <span className="flex items-center gap-2 text-sm text-text-muted"><CheckSquare size={14} className="text-text-light" /> Studio Tasks</span>
              <span className="text-xl font-bold tabular-nums text-text">{studioTaskCount}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="flex items-center gap-2 text-sm text-text-muted"><CheckSquare size={14} className="text-text-light" /> Total Tasks</span>
              <span className="text-xl font-bold tabular-nums text-gold">{totalTaskCount}</span>
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
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-blue-400" /> KPI Tasks</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-violet-400" /> Studio Tasks</span>
          </div>
        </div>
        {hasTrendData ? (
          <div className="h-72" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} barCategoryGap="30%">
                <CartesianGrid stroke="#34343d" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#bcbcc6' }} axisLine={{ stroke: '#34343d' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#bcbcc6' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="bookings" name="Bookings"  fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tasks"    name="KPI Tasks" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="studio"   name="Studio"    fill="#a78bfa" radius={[4, 4, 0, 0]} />
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
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{totalBookingsInTrend || bookings.length}</p>
        </div>
        {hasTrendData ? (
          <div className="h-56" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend}>
                <CartesianGrid stroke="#34343d" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#bcbcc6' }} axisLine={{ stroke: '#34343d' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#bcbcc6' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                <Line type="monotone" dataKey="bookings" stroke="#34d399" strokeWidth={2.5} dot={{ r: 4, fill: '#34d399' }} activeDot={{ r: 6 }} />
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
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-blue-400" /> KPI</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-violet-400" /> Studio</span>
          </div>
        </div>
        {hasEmployeeData ? (
          <div className="h-80" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tasksByEmployee} layout="vertical" barCategoryGap="25%">
                <CartesianGrid stroke="#34343d" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#bcbcc6' }} axisLine={{ stroke: '#34343d' }} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#e2e2ea' }} axisLine={false} tickLine={false} width={120} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="kpi"    name="KPI"    stackId="t" fill="#60a5fa" radius={[4, 0, 0, 4]} />
                <Bar dataKey="studio" name="Studio" stackId="t" fill="#a78bfa" radius={[0, 4, 4, 0]} />
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
            {tasksByEmployee.map(emp => (
              <div key={emp.name} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                <span className="text-sm text-text">{emp.name}</span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-[11px] text-text-muted tabular-nums">
                    <span className="text-blue-400 font-semibold">{emp.kpi}</span>
                    <span className="text-text-light mx-1">·</span>
                    <span className="text-violet-400 font-semibold">{emp.studio}</span>
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
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-blue-400" /> KPI</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-violet-400" /> Studio</span>
        </p>

        <div className="bg-surface-alt/50 rounded-xl py-2 px-3 mb-2 mt-5 text-center">
          <p className="text-sm font-semibold text-text">Studio Tasks (unassigned)</p>
        </div>
        {hasStudioData ? (
          <div className="space-y-0">
            {studioBuckets.map(b => (
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
