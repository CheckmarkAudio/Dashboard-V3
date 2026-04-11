import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { localDateKey } from '../../lib/dates'
import { useAuth } from '../../contexts/AuthContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../components/Toast'
import MetricsEntry from '../../components/MetricsEntry'
import type { PlatformMetric, TeamMember } from '../../types'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

type PlatformKey = PlatformMetric['platform']

const PLATFORMS: { key: PlatformKey; label: string; accent: string }[] = [
  { key: 'instagram', label: 'Instagram', accent: 'text-pink-400' },
  { key: 'tiktok', label: 'TikTok', accent: 'text-cyan-400' },
  { key: 'youtube', label: 'YouTube', accent: 'text-red-400' },
]

function startOfWeekMonday(d = new Date()): string {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return localDateKey(date)
}

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  return localDateKey(d)
}

function computePlatformInsights(
  rows: PlatformMetric[],
  platform: PlatformKey,
): {
  latest: PlatformMetric | null
  weekAgo: PlatformMetric | null
  wowPct: number | null
  declining: boolean
} {
  const sorted = rows
    .filter(r => r.platform === platform)
    .sort((a, b) => (a.metric_date < b.metric_date ? -1 : a.metric_date > b.metric_date ? 1 : 0))

  if (sorted.length === 0) {
    return { latest: null, weekAgo: null, wowPct: null, declining: false }
  }

  const latest = sorted[sorted.length - 1]
  const refDate = addDays(latest.metric_date, -7)

  let weekAgo: PlatformMetric | null = null
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].metric_date <= refDate) {
      weekAgo = sorted[i]
      break
    }
  }

  if (!weekAgo || weekAgo.id === latest.id) {
    return { latest, weekAgo: null, wowPct: null, declining: false }
  }

  const oldC = weekAgo.follower_count
  const newC = latest.follower_count
  if (oldC <= 0) {
    return { latest, weekAgo, wowPct: null, declining: newC < oldC }
  }

  const wowPct = ((newC - oldC) / oldC) * 100
  const declining = newC < oldC

  return { latest, weekAgo, wowPct, declining }
}

export default function BusinessHealth() {
  useDocumentTitle('Business Health - Checkmark Audio')
  const { profile, isAdmin } = useAuth()
  const { toast } = useToast()
  const [metricsRows, setMetricsRows] = useState<PlatformMetric[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [submittedTodayIds, setSubmittedTodayIds] = useState<Set<string>>(new Set())
  const [weekSubmissionCount, setWeekSubmissionCount] = useState(0)
  const [checklistDoneCount, setChecklistDoneCount] = useState(0)
  const [checklistEligible, setChecklistEligible] = useState(0)
  const [loading, setLoading] = useState(true)

  const today = localDateKey()
  const weekStart = startOfWeekMonday()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const from = addDays(today, -30)

      const [
        { data: mData, error: mErr },
        { data: members, error: memErr },
        { data: todaySubs, error: subErr },
        { count: weekCount, error: wErr },
        { data: instances, error: instErr },
      ] = await Promise.all([
        supabase
          .from('platform_metrics')
          .select('*')
          .gte('metric_date', from)
          .lte('metric_date', today)
          .order('metric_date', { ascending: true }),
        supabase.from('intern_users').select('*').order('display_name'),
        supabase.from('deliverable_submissions').select('intern_id').eq('submission_date', today),
        supabase
          .from('deliverable_submissions')
          .select('id', { count: 'exact', head: true })
          .gte('submission_date', weekStart)
          .lte('submission_date', today),
        supabase
          .from('intern_checklist_instances')
          .select('id, intern_id')
          .eq('frequency', 'daily')
          .eq('period_date', today),
      ])

      if (mErr || memErr) {
        toast('Could not load dashboard data', 'error')
      } else if (subErr || wErr || instErr) {
        toast('Could not load some team activity data', 'error')
      }

      setMetricsRows((mData ?? []) as PlatformMetric[])
      const memberList = (members ?? []) as TeamMember[]
      setTeam(memberList)

      const ids = new Set((todaySubs ?? []).map((r: { intern_id: string }) => r.intern_id))
      setSubmittedTodayIds(ids)

      setWeekSubmissionCount(typeof weekCount === 'number' ? weekCount : 0)

      const instList = instances ?? []
      setChecklistEligible(instList.length)

      if (instList.length === 0) {
        setChecklistDoneCount(0)
      } else {
        const instanceIds = instList.map((i: { id: string }) => i.id)
        const { data: items, error: itemsErr } = await supabase
          .from('intern_checklist_items')
          .select('instance_id, is_completed')
          .in('instance_id', instanceIds)

        if (itemsErr) {
          toast('Could not load checklist completion data', 'error')
          setChecklistDoneCount(0)
        } else {
          const byInstance = new Map<string, boolean[]>()
          for (const row of items ?? []) {
            const r = row as { instance_id: string; is_completed: boolean }
            const arr = byInstance.get(r.instance_id) ?? []
            arr.push(r.is_completed)
            byInstance.set(r.instance_id, arr)
          }
          let done = 0
          for (const inst of instList as { id: string }[]) {
            const flags = byInstance.get(inst.id)
            if (flags && flags.length > 0 && flags.every(Boolean)) done++
          }
          setChecklistDoneCount(done)
        }
      }
    } catch (e) {
      toast('Failed to load business health', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast, today, weekStart])

  useEffect(() => {
    loadData()
  }, [loadData])

  const teamSize = team.filter(m => m.status !== 'inactive').length || team.length
  const contentTarget = teamSize * 5
  const contentPct = contentTarget > 0 ? Math.min(100, (weekSubmissionCount / contentTarget) * 100) : 0

  const platformCards = useMemo(() => {
    return PLATFORMS.map(p => {
      const { latest, weekAgo, wowPct, declining } = computePlatformInsights(metricsRows, p.key)
      const up = wowPct !== null && wowPct > 0
      const down = wowPct !== null && wowPct < 0

      return { ...p, latest, weekAgo, wowPct, declining, up, down }
    })
  }, [metricsRows])

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        role="status"
        aria-live="polite"
      >
        <div
          className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold"
          aria-hidden="true"
        />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">Admin</p>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <BarChart3 size={26} className="text-gold" aria-hidden="true" />
            Business health
          </h1>
          <p className="text-text-muted text-sm mt-1 max-w-2xl">
            Social traction, team follow-through, and weekly content throughput.
            {profile?.display_name && isAdmin && (
              <span className="text-text-light"> Logged in as {profile.display_name}.</span>
            )}
          </p>
        </div>
      </div>

      {/* Social media tracker */}
      <section>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
          Social media tracker
        </h2>
        <p className="text-xs text-text-light mb-4">
          Last 30 days of follower entries. Week-over-week compares the latest reading to the closest
          on-or-before date seven days earlier.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {platformCards.map(
            ({ key, label, accent, latest, weekAgo, wowPct, declining, up, down }) => (
              <div
                key={key}
                className={`bg-surface rounded-2xl border p-5 transition-colors ${
                  declining ? 'border-red-500/35' : 'border-border hover:border-gold/15'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-semibold ${accent}`}>{label}</span>
                  {latest && (
                    <span className="text-[10px] uppercase tracking-wide text-text-light">
                      Updated {new Date(latest.metric_date + 'T12:00:00').toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold tabular-nums">
                  {latest ? latest.follower_count.toLocaleString() : '—'}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  {wowPct !== null && weekAgo ? (
                    <>
                      {up && (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <TrendingUp size={16} aria-hidden="true" />
                          {wowPct >= 0 ? '+' : ''}
                          {wowPct.toFixed(1)}% WoW
                        </span>
                      )}
                      {down && (
                        <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                          <TrendingDown size={16} aria-hidden="true" />
                          {wowPct.toFixed(1)}% WoW
                        </span>
                      )}
                      {!up && !down && (
                        <span className="text-text-muted inline-flex items-center gap-1">
                          <BarChart3 size={14} aria-hidden="true" /> Flat vs week ago
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-text-muted text-xs">Not enough history for a 7d compare</span>
                  )}
                </div>
                {declining && wowPct !== null && (
                  <p className="mt-3 text-xs font-medium text-red-400 flex items-center gap-1.5">
                    <AlertTriangle size={14} aria-hidden="true" />
                    Followers declined vs the prior-week snapshot.
                  </p>
                )}
              </div>
            ),
          )}
        </div>
      </section>

      <MetricsEntry onSaved={loadData} />

      {/* Team scorecard */}
      <section className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-gold" aria-hidden="true" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Team scorecard</h2>
          </div>
          <p className="text-xs text-text-muted">
            Must-do: any deliverable logged today · Checklists: daily instance fully complete (
            {checklistDoneCount}/{checklistEligible || 0} instances)
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-border bg-surface-alt/80">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Position</th>
                <th className="px-5 py-3 font-medium">Submitted today</th>
              </tr>
            </thead>
            <tbody>
              {team.map(m => {
                const ok = submittedTodayIds.has(m.id)
                return (
                  <tr
                    key={m.id}
                    className="border-b border-border/80 hover:bg-surface-hover/30 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-text">{m.display_name}</td>
                    <td className="px-5 py-3.5 text-text-muted capitalize">
                      {(m.position ?? '—').replace(/_/g, ' ')}
                    </td>
                    <td className="px-5 py-3.5">
                      {ok ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                          <CheckCircle2 size={16} aria-hidden="true" />
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-400 font-medium">
                          <XCircle size={16} aria-hidden="true" />
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {team.length === 0 && (
          <p className="p-6 text-center text-text-muted text-sm">No team members found.</p>
        )}
      </section>

      {/* Content output */}
      <section className="bg-surface rounded-2xl border border-border p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 size={18} className="text-gold" aria-hidden="true" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Content output</h2>
        </div>
        <p className="text-xs text-text-muted mb-4">
          Total deliverable submissions this week (Mon–today) vs target of{' '}
          <span className="text-text">{teamSize} × 5 = {contentTarget}</span> per week.
        </p>
        <div className="flex items-baseline justify-between gap-4 mb-2">
          <p className="text-2xl font-bold tabular-nums">
            {weekSubmissionCount}
            <span className="text-text-muted text-lg font-normal"> / {contentTarget}</span>
          </p>
          <p className="text-xs text-text-light">{contentPct.toFixed(0)}% of target</p>
        </div>
        <div
          className="h-2.5 bg-surface-alt rounded-full overflow-hidden border border-border"
          role="progressbar"
          aria-valuenow={Math.round(contentPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Weekly content submissions progress toward target"
        >
          <div
            className="h-full rounded-full bg-gold transition-all duration-500"
            style={{ width: `${contentPct}%` }}
            aria-hidden="true"
          />
        </div>
      </section>
    </div>
  )
}
