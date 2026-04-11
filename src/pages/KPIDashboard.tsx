import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import type { MemberKPI, MemberKPIEntry, FlywheelStage, TeamMember } from '../types'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  Target, TrendingUp, TrendingDown, Minus, Plus, Save, Loader2,
  ChevronDown, Calendar,
} from 'lucide-react'

const FLYWHEEL_STAGES: { key: FlywheelStage; label: string; color: string; bg: string }[] = [
  { key: 'deliver', label: 'Deliver', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { key: 'capture', label: 'Capture', color: 'text-sky-400', bg: 'bg-sky-500/10' },
  { key: 'share', label: 'Share', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { key: 'attract', label: 'Attract', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { key: 'book', label: 'Book', color: 'text-rose-400', bg: 'bg-rose-500/10' },
]

function getKPITrend(entries: MemberKPIEntry[]): 'up' | 'down' | 'flat' {
  if (entries.length < 2) return 'flat'
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
  const recent = sorted.slice(-5)
  const first = recent[0].value
  const last = recent[recent.length - 1].value
  if (last > first) return 'up'
  if (last < first) return 'down'
  return 'flat'
}

function getTrendColor(trend: 'up' | 'down' | 'flat') {
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
  const { profile, isAdmin } = useAuth()
  const { toast } = useToast()
  const [kpis, setKpis] = useState<MemberKPI[]>([])
  const [entries, setEntries] = useState<MemberKPIEntry[]>([])
  const [loading, setLoading] = useState(true)

  // For admin view: show direct reports
  const [directReports, setDirectReports] = useState<TeamMember[]>([])
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)

  // Log entry form
  const [logKpiId, setLogKpiId] = useState<string | null>(null)
  const [logValue, setLogValue] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0])
  const [logSubmitting, setLogSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    try {
      const [kpisRes, entriesRes, membersRes] = await Promise.all([
        supabase.from('member_kpis').select('*'),
        supabase.from('member_kpi_entries').select('*').order('entry_date'),
        isAdmin
          ? supabase.from('intern_users').select('*').eq('managed_by', profile.id).order('display_name')
          : Promise.resolve({ data: null }),
      ])
      if (kpisRes.data) setKpis(kpisRes.data as MemberKPI[])
      if (entriesRes.data) setEntries(entriesRes.data as MemberKPIEntry[])
      if (membersRes.data) setDirectReports(membersRes.data as TeamMember[])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }, [profile, isAdmin])

  useEffect(() => { loadData() }, [loadData])

  const effectiveUserId = viewingUserId ?? profile?.id
  const myKpis = kpis.filter(k => k.intern_id === effectiveUserId)
  const getKpiEntries = (kpiId: string) => entries.filter(e => e.kpi_id === kpiId)

  const handleLogEntry = async () => {
    if (!profile || !logKpiId || !logValue) return
    setLogSubmitting(true)

    const { error } = await supabase.from('member_kpi_entries').upsert({
      kpi_id: logKpiId,
      entry_date: logDate,
      value: parseFloat(logValue),
      notes: logNotes || null,
      entered_by: profile.id,
    }, { onConflict: 'kpi_id,entry_date' })

    if (error) toast('Failed to log entry', 'error')
    else toast('Entry logged')

    setLogSubmitting(false)
    setLogKpiId(null)
    setLogValue('')
    setLogNotes('')
    setLogDate(new Date().toISOString().split('T')[0])
    loadData()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" /></div>

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Flywheel</p>
        <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
          <Target size={24} className="text-gold" /> My KPIs
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Track your key performance indicators. Every metric should always be trending up.
        </p>
      </div>

      {/* Admin: switch between users */}
      {isAdmin && directReports.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setViewingUserId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !viewingUserId ? 'bg-gold/10 text-gold' : 'text-text-muted hover:bg-surface-hover'
            }`}>
            My KPIs
          </button>
          {directReports.map(m => (
            <button key={m.id} onClick={() => setViewingUserId(m.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewingUserId === m.id ? 'bg-gold/10 text-gold' : 'text-text-muted hover:bg-surface-hover'
              }`}>
              {m.display_name}
            </button>
          ))}
        </div>
      )}

      {/* Flywheel stage summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
                  {trend === 'up' && <TrendingUp size={14} className="text-emerald-400" />}
                  {trend === 'down' && <TrendingDown size={14} className="text-red-400" />}
                  {trend === 'flat' && <Minus size={14} className="text-text-muted" />}
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
          <Target size={40} className="mx-auto mb-3 text-text-light opacity-30" />
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
            const chartData = kpiEntries.slice(-30).map(e => ({
              date: e.entry_date.slice(5),
              value: Number(e.value),
            }))
            const latestValue = kpiEntries.length > 0 ? kpiEntries[kpiEntries.length - 1].value : null
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
                      {trend === 'up' && <TrendingUp size={24} className="text-emerald-400" />}
                      {trend === 'down' && <TrendingDown size={24} className="text-red-400" />}
                      {trend === 'flat' && <Minus size={24} className="text-text-muted" />}
                    </div>
                  </div>

                  {chartData.length > 1 ? (
                    <div className="h-44 mt-4">
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
                        <label className="block text-xs font-medium mb-1 text-text-muted">Date</label>
                        <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-lg border border-border text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-text-muted">Value *</label>
                        <input type="number" value={logValue} onChange={e => setLogValue(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-lg border border-border text-sm" placeholder="0" autoFocus />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-text-muted">Notes</label>
                        <input value={logNotes} onChange={e => setLogNotes(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-lg border border-border text-sm" placeholder="Optional" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleLogEntry} disabled={logSubmitting || !logValue}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold hover:bg-gold-muted text-black text-xs font-semibold disabled:opacity-50">
                        {logSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save Entry
                      </button>
                      <button onClick={() => setLogKpiId(null)}
                        className="px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-surface-hover">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-3 border-t border-border">
                    <button onClick={() => { setLogKpiId(kpi.id); setLogDate(new Date().toISOString().split('T')[0]) }}
                      className="flex items-center gap-1.5 text-xs font-medium text-gold hover:text-gold-muted">
                      <Plus size={14} /> Log Today's Entry
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
