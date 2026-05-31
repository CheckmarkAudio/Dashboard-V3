import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Plus, X, Save, Loader2, Target } from 'lucide-react'
import type { TeamMember, MemberKPI, MemberKPIEntry, FlywheelStage } from '../../types'
import { downsampleSingle } from '../../lib/chartData'
import { getKPITrend } from '../../lib/kpi'
import { FLYWHEEL_STAGES as FLYWHEEL_STAGES_CANON } from '../../lib/flywheel/stages'

const FLYWHEEL_STAGES: { key: FlywheelStage; label: string; color: string }[] =
  FLYWHEEL_STAGES_CANON.map((s) => ({ key: s.key, label: s.label, color: s.text }))

/** MyTeam cards use a tighter 3-point window. */
const TEAM_CARD_TREND_WINDOW = 3

export interface MemberKPIPanelProps {
  reports: TeamMember[]
  selectedMember: TeamMember | null
  onSelectMember: (member: TeamMember) => void
  getMemberKpis: (memberId: string) => MemberKPI[]
  getKpiEntries: (kpiId: string) => MemberKPIEntry[]
  onCreateKpi: (data: {
    name: string
    stage: FlywheelStage
    unit: string
    target: string
  }) => Promise<void>
  onDeleteKpi: (kpiId: string) => void
}

export default function MemberKPIPanel({
  reports, selectedMember, onSelectMember, getMemberKpis, getKpiEntries, onCreateKpi, onDeleteKpi,
}: MemberKPIPanelProps) {
  const [showKpiForm, setShowKpiForm] = useState(false)
  const [kpiName, setKpiName] = useState('')
  const [kpiStage, setKpiStage] = useState<FlywheelStage>('discovery')
  const [kpiUnit, setKpiUnit] = useState('count')
  const [kpiTarget, setKpiTarget] = useState('')
  const [kpiSubmitting, setKpiSubmitting] = useState(false)

  const handleCreateKpi = async () => {
    if (!kpiName) return
    setKpiSubmitting(true)
    await onCreateKpi({ name: kpiName, stage: kpiStage, unit: kpiUnit, target: kpiTarget })
    setKpiSubmitting(false)
    setShowKpiForm(false)
    setKpiName('')
    setKpiTarget('')
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {reports.map(m => (
          <button key={m.id} onClick={() => onSelectMember(m)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedMember?.id === m.id ? 'bg-gold/10 text-gold ring-1 ring-gold/30' : 'bg-surface border border-border text-text-muted hover:text-text'
            }`}>
            {m.display_name}
          </button>
        ))}
      </div>

      {selectedMember && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{selectedMember.display_name}'s KPIs</h2>
            <button onClick={() => setShowKpiForm(!showKpiForm)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-gold hover:bg-gold/10">
              {showKpiForm ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
              {showKpiForm ? 'Cancel' : 'Add KPI'}
            </button>
          </div>

          {showKpiForm && (
            <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="myteam-kpi-name" className="block text-sm font-medium mb-1.5">KPI Name *</label>
                  <input id="myteam-kpi-name" required value={kpiName} onChange={e => setKpiName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
                    placeholder="e.g. Content Pieces Submitted" />
                </div>
                <div>
                  <label htmlFor="myteam-kpi-stage" className="block text-sm font-medium mb-1.5">Flywheel Stage</label>
                  <select id="myteam-kpi-stage" value={kpiStage} onChange={e => setKpiStage(e.target.value as FlywheelStage)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
                    {FLYWHEEL_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="myteam-kpi-unit" className="block text-sm font-medium mb-1.5">Unit</label>
                  <select id="myteam-kpi-unit" value={kpiUnit} onChange={e => setKpiUnit(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
                    <option value="count">Count</option>
                    <option value="percent">Percent</option>
                    <option value="hours">Hours</option>
                    <option value="dollars">Dollars</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="myteam-kpi-target" className="block text-sm font-medium mb-1.5">Target Value</label>
                  <input id="myteam-kpi-target" type="number" value={kpiTarget} onChange={e => setKpiTarget(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
                    placeholder="e.g. 5" />
                </div>
              </div>
              <button onClick={handleCreateKpi} disabled={kpiSubmitting || !kpiName}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-semibold disabled:opacity-50">
                {kpiSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
                Create KPI
              </button>
            </div>
          )}

          {getMemberKpis(selectedMember.id).length === 0 ? (
            <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-muted">
              <Target size={32} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
              <p>No KPIs assigned yet. Add one to start tracking.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {getMemberKpis(selectedMember.id).map(kpi => {
                const entries = getKpiEntries(kpi.id)
                const trend = getKPITrend(entries, TEAM_CARD_TREND_WINDOW)
                const chartData = downsampleSingle(
                  entries.slice(-30).map(e => ({
                    date: e.entry_date.slice(5),
                    value: Number(e.value),
                  })),
                  'value',
                  60,
                )
                const latestValue = entries.length > 0 ? (entries[entries.length - 1]?.value ?? null) : null
                const stageInfo = FLYWHEEL_STAGES.find(s => s.key === kpi.flywheel_stage)

                return (
                  <div key={kpi.id} className="bg-surface rounded-2xl border border-border p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-sm">{kpi.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${stageInfo?.color ?? 'text-text-muted'} bg-surface-alt`}>
                            {stageInfo?.label ?? kpi.flywheel_stage}
                          </span>
                          <span className="text-[10px] text-text-light">{kpi.unit}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-bold">{latestValue ?? '—'}</p>
                          {kpi.target_value != null && (
                            <p className="text-[10px] text-text-light">Target: {kpi.target_value}</p>
                          )}
                        </div>
                        {trend === 'up' && (
                          <span className="inline-flex items-center shrink-0">
                            <TrendingUp size={20} className="text-emerald-400" aria-hidden="true" />
                            <span className="sr-only">Trending up</span>
                          </span>
                        )}
                        {trend === 'down' && (
                          <span className="inline-flex items-center shrink-0">
                            <TrendingDown size={20} className="text-red-400" aria-hidden="true" />
                            <span className="sr-only">Trending down</span>
                          </span>
                        )}
                        {trend === 'flat' && (
                          <span className="inline-flex items-center shrink-0">
                            <Minus size={20} className="text-text-muted" aria-hidden="true" />
                            <span className="sr-only">No change</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {chartData.length > 1 && (
                      <>
                        <div className="h-32" aria-hidden="true">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <defs>
                                <linearGradient id={`kpi-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#C9A84C'} stopOpacity={0.3} />
                                  <stop offset="100%" stopColor={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#C9A84C'} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} width={30} />
                              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                              {kpi.target_value != null && (
                                <ReferenceLine y={Number(kpi.target_value)} stroke="#C9A84C" strokeDasharray="4 4" strokeOpacity={0.5} />
                              )}
                              <Area type="monotone" dataKey="value"
                                stroke={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#C9A84C'}
                                fill={`url(#kpi-${kpi.id})`} strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <span className="sr-only">
                          {`Area chart of ${kpi.name} for the last ${chartData.length} data points. `}
                          {trend === 'up' && 'Values are trending upward.'}
                          {trend === 'down' && 'Values are trending downward.'}
                          {trend === 'flat' && 'Values are relatively flat.'}
                          {kpi.target_value != null && ` Target reference line at ${kpi.target_value}.`}
                        </span>
                      </>
                    )}

                    <div className="flex justify-end mt-2">
                      <button onClick={() => onDeleteKpi(kpi.id)}
                        className="text-xs text-red-400 hover:text-red-300 font-medium">Delete KPI</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
