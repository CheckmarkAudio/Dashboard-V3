import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { localDateKey } from '../lib/dates'
import { useToast } from '../components/Toast'
import { downsampleSingle } from '../lib/chartData'
import { getKPITrend, type KPITrend } from '../lib/kpi'
import { fetchKPIDefinitions, fetchKPIEntries, kpiKeys } from '../lib/queries/kpi'
import { fetchDirectReports, teamMemberKeys } from '../lib/queries/teamMembers'
import type { MemberKPI, MemberKPIEntry, FlywheelStage } from '../types'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  Target, TrendingUp, TrendingDown, Minus, Plus, Save, Loader2,
} from 'lucide-react'

// Flywheel stage palette — cool-toned, deliberately outside the
// red/yellow/green family (those are reserved for priority / status
// in a future change). Matches the STAGE_STYLES Record used across
// dashboard widgets.
const FLYWHEEL_STAGES: { key: FlywheelStage; label: string; color: string; bg: string }[] = [
  { key: 'deliver', label: 'Deliver', color: 'text-blue-400',   bg: 'bg-blue-500/5' },
  { key: 'capture', label: 'Capture', color: 'text-purple-400', bg: 'bg-purple-500/5' },
  { key: 'share',   label: 'Share',   color: 'text-cyan-400',   bg: 'bg-cyan-500/5' },
  { key: 'attract', label: 'Attract', color: 'text-pink-400',   bg: 'bg-pink-500/5' },
  { key: 'book',    label: 'Book',    color: 'text-orange-400', bg: 'bg-orange-500/5' },
]

function getTrendColor(trend: KPITrend) {
  if (trend === 'up') return '#10b981'
  if (trend === 'down') return '#ef4444'
  return '#C9A84C'
}

const UNIT_LABELS: Record<string, string> = {
  count: '',
  percent: '%',
  hours: 'hrs',
  dollars: '$',
}

export default function KPIDashboard() {
  useDocumentTitle('My KPIs - Checkmark Audio')
  const { profile, isAdmin } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // For admin view: show direct reports
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)

  // Log entry form
  const [logKpiId, setLogKpiId] = useState<string | null>(null)
  const [logValue, setLogValue] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [logDate, setLogDate] = useState(localDateKey())

  // Phase 3.1 — react-query reads. Each query has its own cache entry,
  // so navigating away and back is instant until staleTime expires.
  const kpisQuery = useQuery({
    queryKey: kpiKeys.definitions(),
    queryFn: fetchKPIDefinitions,
    enabled: !!profile,
  })
  const entriesQuery = useQuery({
    queryKey: kpiKeys.entries(),
    queryFn: fetchKPIEntries,
    enabled: !!profile,
  })
  const directReportsQuery = useQuery({
    queryKey: teamMemberKeys.byManager(profile?.id ?? ''),
    queryFn: () => fetchDirectReports(profile!.id),
    enabled: !!profile && isAdmin,
  })

  // Surface query errors via the toast system (react-query puts them
  // on `query.error`; we want a visible signal, not just a silent
  // `isError` flag).
  if (kpisQuery.error) toast('Failed to load KPIs', 'error')
  if (entriesQuery.error) toast('Failed to load KPI entries', 'error')

  const kpis: MemberKPI[] = kpisQuery.data ?? []
  const entries: MemberKPIEntry[] = entriesQuery.data ?? []
  const directReports = directReportsQuery.data ?? []
  const loading = kpisQuery.isLoading || entriesQuery.isLoading

  const effectiveUserId = viewingUserId ?? profile?.id
  const myKpis = useMemo(
    () => kpis.filter((k) => k.intern_id === effectiveUserId),
    [kpis, effectiveUserId],
  )

  // Phase 3.5 — group entries by kpi_id once so per-card lookups stay
  // O(1) instead of scanning the full entry list for every render of
  // every KPI row.
  const entriesByKpi = useMemo(() => {
    const map = new Map<string, MemberKPIEntry[]>()
    for (const e of entries) {
      const arr = map.get(e.kpi_id)
      if (arr) arr.push(e)
      else map.set(e.kpi_id, [e])
    }
    return map
  }, [entries])
  const getKpiEntries = (kpiId: string) => entriesByKpi.get(kpiId) ?? []

  // Phase 3.1 — mutation owns its own lifecycle; invalidating the
  // entries query is what triggers the refetch (no hand-rolled reload).
  const logEntryMutation = useMutation({
    mutationFn: async (input: {
      kpi_id: string
      entry_date: string
      value: number
      notes: string | null
    }) => {
      const { error } = await supabase.from('member_kpi_entries').upsert(
        {
          kpi_id: input.kpi_id,
          entry_date: input.entry_date,
          value: input.value,
          notes: input.notes,
          entered_by: profile!.id,
        },
        { onConflict: 'kpi_id,entry_date' },
      )
      if (error) throw error
    },
    onSuccess: () => {
      toast('Entry logged')
      queryClient.invalidateQueries({ queryKey: kpiKeys.entries() })
      setLogKpiId(null)
      setLogValue('')
      setLogNotes('')
      setLogDate(localDateKey())
    },
    onError: () => {
      toast('Failed to log entry', 'error')
    },
  })

  const handleLogEntry = () => {
    if (!profile || !logKpiId || !logValue) return
    logEntryMutation.mutate({
      kpi_id: logKpiId,
      entry_date: logDate,
      value: parseFloat(logValue),
      notes: logNotes || null,
    })
  }
  const logSubmitting = logEntryMutation.isPending

  if (loading) return (
    <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Flywheel</p>
        <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
          <Target size={24} className="text-gold" aria-hidden="true" /> My KPIs
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Track your key performance indicators. Every metric should always be trending up.
        </p>
      </div>

      {/* Admin: switch between users */}
      {isAdmin && directReports.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setViewingUserId(null)}
            aria-current={!viewingUserId ? 'true' : undefined}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !viewingUserId ? 'bg-gold/10 text-gold' : 'text-text-muted hover:bg-surface-hover'
            }`}>
            My KPIs
          </button>
          {directReports.map(m => (
            <button key={m.id} onClick={() => setViewingUserId(m.id)}
              aria-current={viewingUserId === m.id ? 'true' : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewingUserId === m.id ? 'bg-gold/10 text-gold' : 'text-text-muted hover:bg-surface-hover'
              }`}>
              {m.display_name}
            </button>
          ))}
        </div>
      )}

      {/* Flywheel stage summary */}
      <p id="kpi-flywheel-stage-summary-desc" className="sr-only">
        Each card is a flywheel stage. The number is how many KPIs are assigned to that stage; the icon reflects whether recent entries for those KPIs are trending up, down, or flat.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" aria-describedby="kpi-flywheel-stage-summary-desc">
        {FLYWHEEL_STAGES.map(stage => {
          const stageKpis = myKpis.filter(k => k.flywheel_stage === stage.key)
          const hasKpi = stageKpis.length > 0
          const stageEntries = stageKpis.flatMap(k => getKpiEntries(k.id))
          const trend = hasKpi ? getKPITrend(stageEntries) : null

          return (
            <div key={stage.key} className={`bg-surface rounded-xl border border-border p-3 text-center ${!hasKpi ? 'opacity-50' : ''}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${stage.color}`}>{stage.label}</p>
              {hasKpi ? (
                <div className="flex items-center justify-center gap-1 mt-1">
                  {trend === 'up' && (
                    <>
                      <TrendingUp size={14} className="text-emerald-400" aria-hidden="true" />
                      <span className="sr-only">Trending up</span>
                    </>
                  )}
                  {trend === 'down' && (
                    <>
                      <TrendingDown size={14} className="text-red-400" aria-hidden="true" />
                      <span className="sr-only">Trending down</span>
                    </>
                  )}
                  {trend === 'flat' && (
                    <>
                      <Minus size={14} className="text-text-muted" aria-hidden="true" />
                      <span className="sr-only">Flat trend</span>
                    </>
                  )}
                  <span className="text-xs font-medium text-text">{stageKpis.length} KPI{stageKpis.length > 1 ? 's' : ''}</span>
                </div>
              ) : (
                <p className="text-[10px] text-text-light mt-1">No KPIs</p>
              )}
            </div>
          )
        })}
      </div>

      {myKpis.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-8 text-center">
          <Target size={40} className="mx-auto mb-3 text-text-light opacity-30" aria-hidden="true" />
          <p className="text-text-muted">No KPIs assigned yet.</p>
          <p className="text-xs text-text-light mt-1">Your manager will set up KPIs tied to your flywheel responsibilities.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {myKpis.map(kpi => {
            const kpiEntries = getKpiEntries(kpi.id)
            const trend = getKPITrend(kpiEntries)
            const trendColor = getTrendColor(trend)
            const stageInfo = FLYWHEEL_STAGES.find(s => s.key === kpi.flywheel_stage)
            // Phase 3.4 — downsample ensures the chart stays crisp even if
            // a KPI accumulates a year of entries; 30-day windows stay
            // verbatim (downsample is a no-op when points <= maxPoints).
            const chartData = downsampleSingle(
              kpiEntries.slice(-30).map((e) => ({
                date: e.entry_date.slice(5),
                value: Number(e.value),
              })),
              'value',
              60,
            )
            const latestValue = kpiEntries.length > 0 ? (kpiEntries[kpiEntries.length - 1]?.value ?? null) : null
            const unitLabel = UNIT_LABELS[kpi.unit] ?? ''

            return (
              <div key={kpi.id} className="bg-surface rounded-2xl border border-border overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h3 className="font-semibold">{kpi.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${stageInfo?.bg ?? 'bg-surface-alt'} ${stageInfo?.color ?? 'text-text-muted'}`}>
                          {stageInfo?.label ?? kpi.flywheel_stage}
                        </span>
                        {kpi.target_value != null && (
                          <span className="text-[10px] text-text-light">Target: {kpi.unit === 'dollars' ? '$' : ''}{kpi.target_value}{unitLabel}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-2xl font-bold tabular-nums">
                          {latestValue != null ? (
                            <>{kpi.unit === 'dollars' ? '$' : ''}{latestValue}{unitLabel}</>
                          ) : '—'}
                        </p>
                      </div>
                      {trend === 'up' && (
                        <>
                          <TrendingUp size={24} className="text-emerald-400" aria-hidden="true" />
                          <span className="sr-only">Trending up</span>
                        </>
                      )}
                      {trend === 'down' && (
                        <>
                          <TrendingDown size={24} className="text-red-400" aria-hidden="true" />
                          <span className="sr-only">Trending down</span>
                        </>
                      )}
                      {trend === 'flat' && (
                        <>
                          <Minus size={24} className="text-text-muted" aria-hidden="true" />
                          <span className="sr-only">Flat trend</span>
                        </>
                      )}
                    </div>
                  </div>

                  {chartData.length > 1 ? (
                    <>
                      <div className="h-44 mt-4" aria-hidden="true">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id={`area-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={trendColor} stopOpacity={0.25} />
                                <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} width={35} />
                            <Tooltip
                              contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                              labelStyle={{ color: '#aaa' }}
                            />
                            {kpi.target_value != null && (
                              <ReferenceLine y={Number(kpi.target_value)} stroke="#C9A84C" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: 'Target', position: 'right', fill: '#C9A84C', fontSize: 10 }} />
                            )}
                            <Area type="monotone" dataKey="value" stroke={trendColor} fill={`url(#area-${kpi.id})`} strokeWidth={2.5} dot={{ r: 3, fill: trendColor }} activeDot={{ r: 5 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <span className="sr-only">
                        {kpi.name}
                        {latestValue != null
                          ? `: area chart of recent values; latest ${kpi.unit === 'dollars' ? '$' : ''}${latestValue}${unitLabel}.`
                          : ': area chart of recent values; no latest value logged.'}
                      </span>
                    </>
                  ) : (
                    <div className="h-24 mt-4 flex items-center justify-center rounded-xl border border-dashed border-border text-text-light text-xs">
                      Log entries to see your trend chart
                    </div>
                  )}
                </div>

                {/* Log entry inline form */}
                {logKpiId === kpi.id ? (
                  <div className="px-5 py-4 bg-surface-alt/50 border-t border-border space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label htmlFor={`kpi-entry-date-${kpi.id}`} className="block text-xs font-medium mb-1 text-text-muted">Date</label>
                        <input id={`kpi-entry-date-${kpi.id}`} type="date" value={logDate} onChange={e => setLogDate(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-lg border border-border text-sm" />
                      </div>
                      <div>
                        <label htmlFor={`kpi-entry-value-${kpi.id}`} className="block text-xs font-medium mb-1 text-text-muted">Value *</label>
                        <input id={`kpi-entry-value-${kpi.id}`} type="number" value={logValue} onChange={e => setLogValue(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-lg border border-border text-sm" placeholder="0" autoFocus />
                      </div>
                      <div>
                        <label htmlFor={`kpi-entry-notes-${kpi.id}`} className="block text-xs font-medium mb-1 text-text-muted">Notes</label>
                        <input id={`kpi-entry-notes-${kpi.id}`} value={logNotes} onChange={e => setLogNotes(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-lg border border-border text-sm" placeholder="Optional" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleLogEntry} disabled={logSubmitting || !logValue}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold hover:bg-gold-muted text-black text-xs font-semibold disabled:opacity-50">
                        {logSubmitting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
                        Save Entry
                      </button>
                      <button onClick={() => setLogKpiId(null)}
                        className="px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-surface-hover">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-3 border-t border-border">
                    <button onClick={() => { setLogKpiId(kpi.id); setLogDate(localDateKey()) }}
                      className="flex items-center gap-1.5 text-xs font-medium text-gold hover:text-gold-muted">
                      <Plus size={14} aria-hidden="true" /> Log Today's Entry
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
