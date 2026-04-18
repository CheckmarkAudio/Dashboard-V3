import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useChecklist } from '../../hooks/useChecklist'
import { supabase } from '../../lib/supabase'
import { localDateKey } from '../../lib/dates'
import { downsampleSingle } from '../../lib/chartData'
import { getKPITrend } from '../../lib/kpi'
import { useToast } from '../Toast'
import MustDoCard from '../MustDoCard'
import SubmissionModal from '../SubmissionModal'
import PublishChecklistModal from '../admin/PublishChecklistModal'
import type { DailyNote, DeliverableSubmission, MemberKPI, MemberKPIEntry } from '../../types'
import {
  AreaChart, Area, ResponsiveContainer,
} from 'recharts'
import {
  ArrowRight, Check, FileText, Flame, ListChecks,
  Loader2, Mic, Minus, Send, Target, TrendingDown, TrendingUp,
} from 'lucide-react'

export default function YourDayTab() {
  const { profile, isAdmin } = useAuth()
  const { toast } = useToast()
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [todayNote, setTodayNote] = useState<DailyNote | null>(null)
  const [streak, setStreak] = useState(0)
  const [todaySessions, setTodaySessions] = useState<{ id: string; client_name: string; start_time: string; end_time: string; session_type: string; status: string }[]>([])
  const [teamSubmissions, setTeamSubmissions] = useState<(DeliverableSubmission & { display_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [mustDoKey, setMustDoKey] = useState(0)

  const [primaryKpi, setPrimaryKpi] = useState<MemberKPI | null>(null)
  const [kpiEntries, setKpiEntries] = useState<MemberKPIEntry[]>([])

  const daily = useChecklist('daily', new Date())

  const loadData = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    const today = localDateKey()

    try {
      const [noteRes, sessRes, kpisRes] = await Promise.all([
        supabase.from('team_daily_notes').select('*').eq('intern_id', profile.id).eq('note_date', today).maybeSingle(),
        supabase.from('sessions').select('*').eq('session_date', today).order('start_time'),
        supabase.from('member_kpis').select('*').eq('intern_id', profile.id).limit(1),
      ])
      if (noteRes.error) toast('Failed to load daily note', 'error')
      if (sessRes.error) toast('Failed to load sessions', 'error')
      if (kpisRes.error) toast('Failed to load KPIs', 'error')
      if (noteRes.data) setTodayNote(noteRes.data as DailyNote)
      if (sessRes.data) setTodaySessions(sessRes.data)

      if (kpisRes.data && kpisRes.data.length > 0) {
        const kpi = kpisRes.data[0] as MemberKPI
        setPrimaryKpi(kpi)
        const { data: eData } = await supabase
          .from('member_kpi_entries')
          .select('*')
          .eq('kpi_id', kpi.id)
          .order('entry_date')
          .limit(30)
        if (eData) setKpiEntries(eData as MemberKPIEntry[])
      }

      if (isAdmin) {
        const { data: subs } = await supabase
          .from('deliverable_submissions')
          .select('*')
          .eq('submission_date', today)
          .order('created_at', { ascending: false })
        if (subs) {
          const { data: members } = await supabase.from('team_members').select('id, display_name')
          const memberMap = new Map((members ?? []).map((m: { id: string; display_name: string }) => [m.id, m.display_name]))
          setTeamSubmissions(subs.map((s: DeliverableSubmission) => ({ ...s, display_name: memberMap.get(s.intern_id) ?? 'Unknown' })))
        }
      }

      try {
        const { data: instances } = await supabase
          .from('team_checklist_instances')
          .select('id, period_date')
          .eq('frequency', 'daily')
          .eq('intern_id', profile.id)
          .order('period_date', { ascending: false })
          .limit(30)
        if (instances && instances.length > 0) {
          let s = 0
          for (const inst of instances) {
            const { data: cItems } = await supabase
              .from('team_checklist_items')
              .select('is_completed')
              .eq('instance_id', inst.id)
            if (!cItems || cItems.length === 0) break
            if (cItems.every((ci: { is_completed: boolean }) => ci.is_completed)) s++
            else break
          }
          setStreak(s)
        }
      } catch { /* streak is non-critical */ }
    } catch (err) { console.error('Dashboard load error:', err) }
    finally { setLoading(false) }
  }, [profile, isAdmin, toast])

  useEffect(() => { loadData() }, [loadData])

  const handleReviewSubmission = async (id: string) => {
    if (!profile) return
    const { error } = await supabase.from('deliverable_submissions').update({
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) toast('Failed to mark as reviewed', 'error')
    loadData()
  }

  const kpiTrend = kpiEntries.length > 0 ? getKPITrend(kpiEntries) : null
  // Phase 3.4/3.5 — memoize + downsample the sparkline input so it
  // isn't rebuilt on every parent render and stays crisp even with a
  // long entry history.
  const kpiChartData = useMemo(
    () =>
      downsampleSingle(
        kpiEntries.slice(-14).map((e) => ({
          date: e.entry_date.slice(5),
          value: Number(e.value),
        })),
        'value',
        30,
      ),
    [kpiEntries],
  )
  const kpiLatest = kpiEntries.length > 0 ? (kpiEntries[kpiEntries.length - 1]?.value ?? null) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={20} className="animate-spin text-gold" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className={`grid gap-4 grid-cols-2 ${primaryKpi ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <div className="bg-surface rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Daily Progress</span>
            <ListChecks size={14} className="text-gold" aria-hidden="true" />
          </div>
          <p className="text-xl font-bold">{daily.completedCount}/{daily.totalCount}</p>
          <div
            className="h-1.5 bg-surface-alt rounded-full overflow-hidden mt-2"
            role="progressbar"
            aria-valuenow={daily.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Daily progress"
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${daily.percentage}%`,
                backgroundColor: daily.percentage === 100 ? '#10b981' : '#C9A84C',
              }}
            />
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Streak</span>
            <Flame size={14} className="text-orange-500" aria-hidden="true" />
          </div>
          <p className="text-xl font-bold">{streak} day{streak !== 1 ? 's' : ''}</p>
          <p className="text-[11px] text-text-light mt-1">Consecutive 100%</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Daily Note</span>
            <FileText size={14} className="text-emerald-500" aria-hidden="true" />
          </div>
          {todayNote ? (
            <p className="text-sm font-semibold text-emerald-400">Submitted</p>
          ) : (
            <Link to="/notes" className="text-sm font-semibold text-gold hover:underline">
              Submit now
            </Link>
          )}
        </div>

        {primaryKpi && (
          <Link to="/kpis" className="bg-surface rounded-2xl border border-border p-4 hover:border-gold/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide truncate">{primaryKpi.name}</span>
              <Target size={14} className="text-gold shrink-0" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold">{kpiLatest ?? '—'}</p>
              {kpiTrend === 'up' && (
                <>
                  <TrendingUp size={16} className="text-emerald-400" aria-hidden="true" />
                  <span className="sr-only">Trending up</span>
                </>
              )}
              {kpiTrend === 'down' && (
                <>
                  <TrendingDown size={16} className="text-red-400" aria-hidden="true" />
                  <span className="sr-only">Trending down</span>
                </>
              )}
              {kpiTrend === 'flat' && (
                <>
                  <Minus size={16} className="text-text-muted" aria-hidden="true" />
                  <span className="sr-only">Flat trend</span>
                </>
              )}
            </div>
            {kpiChartData.length > 1 && (
              <>
                <span className="sr-only">
                  {primaryKpi.name} trend chart (decorative). Latest recorded value: {kpiLatest ?? '—'}.
                </span>
                <div className="h-8 mt-1 -mx-1" aria-hidden="true">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={kpiChartData}>
                      <defs>
                        <linearGradient id="dashKpi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={kpiTrend === 'up' ? '#10b981' : kpiTrend === 'down' ? '#ef4444' : '#C9A84C'} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={kpiTrend === 'up' ? '#10b981' : kpiTrend === 'down' ? '#ef4444' : '#C9A84C'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="value"
                        stroke={kpiTrend === 'up' ? '#10b981' : kpiTrend === 'down' ? '#ef4444' : '#C9A84C'}
                        fill="url(#dashKpi)" strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </Link>
        )}
      </div>

      {/* Must-Do */}
      <MustDoCard key={mustDoKey} onSubmit={() => setShowSubmitModal(true)} />

      {/* Today's Checklist inline */}
      {daily.totalCount > 0 && (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
            <h2 className="font-semibold text-sm">Today's Tasks</h2>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowPublishModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:text-gold-muted transition-colors focus-ring rounded px-2 py-1"
                title="Publish today's list to the team as a template"
              >
                <Send size={12} aria-hidden="true" />
                Publish to team
              </button>
            )}
          </div>
          <div className="divide-y divide-border/50">
            {Object.entries(daily.grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-5 py-2.5 bg-surface-alt/50">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">{category}</span>
                </div>
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => daily.toggleItem(item.id)}
                    aria-pressed={item.is_completed}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        item.is_completed
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-border-light hover:border-gold/50'
                      }`}
                      aria-hidden="true"
                    >
                      {item.is_completed && <Check size={14} className="text-white" aria-hidden="true" />}
                    </div>
                    <span className={`text-sm ${item.is_completed ? 'text-text-light line-through' : 'text-text'}`}>
                      {item.item_text}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Sessions */}
      {todaySessions.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic size={14} className="text-gold" aria-hidden="true" />
              <h2 className="font-semibold text-sm">Today's Sessions</h2>
            </div>
            <Link to="/sessions" className="text-xs text-gold font-medium flex items-center gap-1">
              View all <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
          <div className="divide-y divide-border/50">
            {todaySessions.map(s => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{s.client_name ?? 'Studio Session'}</p>
                  <p className="text-xs text-text-muted capitalize">{s.session_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-text-muted">{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</p>
                  <span className={`text-[10px] font-semibold uppercase ${
                    s.status === 'confirmed' ? 'text-emerald-400' : s.status === 'pending' ? 'text-gold' : 'text-text-light'
                  }`}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin: Team Submissions Today (when on My Tasks tab) */}
      {isAdmin && teamSubmissions.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm">Team Submissions Today</h2>
          </div>
          <div className="divide-y divide-border/50">
            {teamSubmissions.map(sub => (
              <div key={sub.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{sub.display_name}</p>
                  <p className="text-xs text-text-muted capitalize">{sub.submission_type.replace(/_/g, ' ')}</p>
                  {sub.notes && <p className="text-xs text-text-light mt-0.5">{sub.notes}</p>}
                </div>
                {sub.reviewed_by ? (
                  <span className="text-xs text-emerald-400 font-medium">Reviewed</span>
                ) : (
                  <button
                    onClick={() => handleReviewSubmission(sub.id)}
                    className="text-xs text-gold font-medium hover:underline"
                  >
                    Mark Reviewed
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showSubmitModal && (
        <SubmissionModal
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={() => { setMustDoKey(k => k + 1); loadData() }}
        />
      )}

      {/* Phase 5.1.5 — admin-only: publish own daily checklist to the team. */}
      <PublishChecklistModal
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        sourceItemCount={daily.totalCount}
        sourceCategoryCount={Object.keys(daily.grouped).length}
        onPublished={() => { daily.reload?.(); loadData() }}
      />
    </div>
  )
}
