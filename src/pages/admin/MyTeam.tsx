import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/Toast'
import type {
  TeamMember, ReportTemplate, TaskAssignment, MemberKPI, MemberKPIEntry,
  WeeklyAdminReview, FlywheelStage,
} from '../../types'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  Users, ClipboardList, Star, TrendingUp, TrendingDown, Minus,
  Plus, X, Save, Loader2, ChevronDown, Target, FileText,
  AlertTriangle, CheckSquare, BarChart3, Calendar,
} from 'lucide-react'

const FLYWHEEL_STAGES: { key: FlywheelStage; label: string; color: string }[] = [
  { key: 'deliver', label: 'Deliver', color: 'text-emerald-400' },
  { key: 'capture', label: 'Capture', color: 'text-sky-400' },
  { key: 'share', label: 'Share', color: 'text-violet-400' },
  { key: 'attract', label: 'Attract', color: 'text-amber-400' },
  { key: 'book', label: 'Book', color: 'text-rose-400' },
]

const TEMPLATE_TYPE_ICONS: Record<string, typeof FileText> = {
  daily: FileText,
  weekly: BarChart3,
  checklist: CheckSquare,
  must_do: AlertTriangle,
}

function startOfWeek(d = new Date()): string {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return date.toISOString().split('T')[0]
}

function getKPITrend(entries: MemberKPIEntry[]): 'up' | 'down' | 'flat' {
  if (entries.length < 2) return 'flat'
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
  const recent = sorted.slice(-3)
  const first = recent[0].value
  const last = recent[recent.length - 1].value
  if (last > first) return 'up'
  if (last < first) return 'down'
  return 'flat'
}

export default function MyTeam() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [reports, setReports] = useState<TeamMember[]>([])
  const [allMembers, setAllMembers] = useState<TeamMember[]>([])
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [assignments, setAssignments] = useState<TaskAssignment[]>([])
  const [kpis, setKpis] = useState<MemberKPI[]>([])
  const [kpiEntries, setKpiEntries] = useState<MemberKPIEntry[]>([])
  const [reviews, setReviews] = useState<WeeklyAdminReview[]>([])
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<'overview' | 'assign' | 'review' | 'kpis'>('overview')
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)

  // Review form state
  const [reviewScores, setReviewScores] = useState<Record<FlywheelStage, number>>({
    deliver: 3, capture: 3, share: 3, attract: 3, book: 3,
  })
  const [reviewStrengths, setReviewStrengths] = useState('')
  const [reviewImprovements, setReviewImprovements] = useState('')
  const [reviewActions, setReviewActions] = useState('')
  const [reviewKpiOnTrack, setReviewKpiOnTrack] = useState(true)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  // KPI form state
  const [showKpiForm, setShowKpiForm] = useState(false)
  const [kpiName, setKpiName] = useState('')
  const [kpiStage, setKpiStage] = useState<FlywheelStage>('deliver')
  const [kpiUnit, setKpiUnit] = useState('count')
  const [kpiTarget, setKpiTarget] = useState('')
  const [kpiSubmitting, setKpiSubmitting] = useState(false)

  // Assignment form
  const [assignTemplateId, setAssignTemplateId] = useState('')
  const [assignMemberIds, setAssignMemberIds] = useState<Set<string>>(new Set())
  const [assignSubmitting, setAssignSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    try {
      const [membersRes, templatesRes, assignRes, kpisRes, entriesRes, reviewsRes] = await Promise.all([
        supabase.from('intern_users').select('*').order('display_name'),
        supabase.from('report_templates').select('*').order('name'),
        supabase.from('task_assignments').select('*'),
        supabase.from('member_kpis').select('*'),
        supabase.from('member_kpi_entries').select('*').order('entry_date'),
        supabase.from('weekly_admin_reviews').select('*').order('week_start', { ascending: false }),
      ])

      const members = (membersRes.data ?? []) as TeamMember[]
      setAllMembers(members)
      setReports(members.filter(m => m.managed_by === profile.id))
      if (templatesRes.data) setTemplates(templatesRes.data as ReportTemplate[])
      if (assignRes.data) setAssignments(assignRes.data as TaskAssignment[])
      if (kpisRes.data) setKpis(kpisRes.data as MemberKPI[])
      if (entriesRes.data) setKpiEntries(entriesRes.data as MemberKPIEntry[])
      if (reviewsRes.data) setReviews(reviewsRes.data as WeeklyAdminReview[])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }, [profile])

  useEffect(() => { loadData() }, [loadData])

  const getMemberKpis = (memberId: string) => kpis.filter(k => k.intern_id === memberId)
  const getKpiEntries = (kpiId: string) => kpiEntries.filter(e => e.kpi_id === kpiId)
  const getMemberAssignments = (memberId: string) =>
    assignments.filter(a => a.is_active && (a.intern_id === memberId || a.position === allMembers.find(m => m.id === memberId)?.position))
  const getLatestReview = (memberId: string) =>
    reviews.find(r => r.intern_id === memberId)

  // Review handlers
  const handleSubmitReview = async () => {
    if (!profile || !selectedMember) return
    setReviewSubmitting(true)
    const weekStart = startOfWeek()
    const overall = Object.values(reviewScores).reduce((a, b) => a + b, 0) / 5

    const { error } = await supabase.from('weekly_admin_reviews').upsert({
      intern_id: selectedMember.id,
      reviewer_id: profile.id,
      week_start: weekStart,
      flywheel_scores: reviewScores,
      kpi_on_track: reviewKpiOnTrack,
      strengths: reviewStrengths || null,
      improvements: reviewImprovements || null,
      action_items: reviewActions ? reviewActions.split('\n').filter(Boolean) : [],
      overall_score: Math.round(overall * 10) / 10,
    }, { onConflict: 'intern_id,week_start' })

    if (error) toast('Failed to submit review', 'error')
    else toast('Weekly review submitted')
    setReviewSubmitting(false)
    loadData()
  }

  // KPI handlers
  const handleCreateKpi = async () => {
    if (!profile || !selectedMember || !kpiName) return
    setKpiSubmitting(true)
    const { error } = await supabase.from('member_kpis').insert({
      intern_id: selectedMember.id,
      name: kpiName,
      flywheel_stage: kpiStage,
      unit: kpiUnit,
      target_value: kpiTarget ? parseFloat(kpiTarget) : null,
      created_by: profile.id,
    })
    if (error) toast('Failed to create KPI', 'error')
    else toast('KPI created')
    setKpiSubmitting(false)
    setShowKpiForm(false)
    setKpiName('')
    setKpiTarget('')
    loadData()
  }

  const handleDeleteKpi = async (kpiId: string) => {
    if (!confirm('Delete this KPI and all its entries?')) return
    await supabase.from('member_kpis').delete().eq('id', kpiId)
    toast('KPI deleted')
    loadData()
  }

  // Assignment handlers
  const handleAssignTemplate = async () => {
    if (!assignTemplateId || assignMemberIds.size === 0) return
    setAssignSubmitting(true)
    const inserts = Array.from(assignMemberIds)
      .filter(id => !assignments.some(a => a.template_id === assignTemplateId && a.intern_id === id && a.is_active))
      .map(id => ({ template_id: assignTemplateId, intern_id: id, position: null, is_active: true }))

    if (inserts.length > 0) {
      const { error } = await supabase.from('task_assignments').insert(inserts)
      if (error) toast('Failed to assign', 'error')
      else toast(`Assigned to ${inserts.length} member${inserts.length > 1 ? 's' : ''}`)
    } else {
      toast('Already assigned', 'error')
    }
    setAssignSubmitting(false)
    setAssignTemplateId('')
    setAssignMemberIds(new Set())
    loadData()
  }

  const handleRemoveAssignment = async (id: string) => {
    await supabase.from('task_assignments').delete().eq('id', id)
    toast('Assignment removed')
    loadData()
  }

  const selectMemberForReview = (member: TeamMember) => {
    setSelectedMember(member)
    setActiveTab('review')
    const existing = getLatestReview(member.id)
    if (existing && existing.week_start === startOfWeek()) {
      setReviewScores(existing.flywheel_scores as Record<FlywheelStage, number>)
      setReviewStrengths(existing.strengths ?? '')
      setReviewImprovements(existing.improvements ?? '')
      setReviewActions(Array.isArray(existing.action_items) ? existing.action_items.join('\n') : '')
      setReviewKpiOnTrack(existing.kpi_on_track ?? true)
    } else {
      setReviewScores({ deliver: 3, capture: 3, share: 3, attract: 3, book: 3 })
      setReviewStrengths('')
      setReviewImprovements('')
      setReviewActions('')
      setReviewKpiOnTrack(true)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold" /></div>

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Admin</p>
        <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
          <Users size={24} className="text-gold" /> My Team
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Manage your direct reports, assign tasks, track KPIs, and write weekly reviews.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-8 text-center">
          <Users size={32} className="mx-auto mb-3 text-text-light opacity-30" />
          <p className="text-text-muted">No team members are reporting to you yet.</p>
          <p className="text-xs text-text-light mt-1">Go to Team Manager and set "Reports To" for members you manage.</p>
        </div>
      ) : (
        <>
          {/* Tab navigation */}
          <div className="flex items-center gap-1 bg-surface rounded-xl border border-border p-1">
            {([
              { key: 'overview' as const, label: 'Overview', icon: Users },
              { key: 'assign' as const, label: 'Assign Tasks', icon: ClipboardList },
              { key: 'review' as const, label: 'Weekly Review', icon: Star },
              { key: 'kpis' as const, label: 'KPI Metrics', icon: Target },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key ? 'bg-gold/10 text-gold' : 'text-text-muted hover:text-text hover:bg-surface-hover'
                }`}>
                <tab.icon size={15} /> {tab.label}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.map(member => {
                const memberKpis = getMemberKpis(member.id)
                const memberAssigns = getMemberAssignments(member.id)
                const latestReview = getLatestReview(member.id)
                const primaryKpi = memberKpis[0]
                const primaryEntries = primaryKpi ? getKpiEntries(primaryKpi.id) : []
                const trend = primaryEntries.length > 0 ? getKPITrend(primaryEntries) : null
                const chartData = primaryEntries.slice(-14).map(e => ({
                  date: e.entry_date.slice(5),
                  value: Number(e.value),
                }))

                return (
                  <div key={member.id} className="bg-surface rounded-2xl border border-border p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gold/15 text-gold flex items-center justify-center text-sm font-bold">
                        {member.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{member.display_name}</h3>
                        <p className="text-xs text-text-muted capitalize">{(member.position ?? 'intern').replace(/_/g, ' ')}</p>
                      </div>
                      {trend && (
                        <div className="ml-auto">
                          {trend === 'up' && <TrendingUp size={18} className="text-emerald-400" />}
                          {trend === 'down' && <TrendingDown size={18} className="text-red-400" />}
                          {trend === 'flat' && <Minus size={18} className="text-text-muted" />}
                        </div>
                      )}
                    </div>

                    {chartData.length > 1 && (
                      <div className="h-16 mb-3 -mx-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id={`grad-${member.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#C9A84C'} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#C9A84C'} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="value" stroke={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#C9A84C'} fill={`url(#grad-${member.id})`} strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div className="space-y-1.5 text-xs text-text-muted">
                      {primaryKpi && (
                        <div className="flex items-center justify-between">
                          <span>{primaryKpi.name}</span>
                          <span className="font-medium text-text">
                            {primaryEntries.length > 0 ? primaryEntries[primaryEntries.length - 1].value : '—'}
                            {primaryKpi.target_value != null && <span className="text-text-light"> / {primaryKpi.target_value}</span>}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span>Assigned templates</span>
                        <span className="font-medium text-text">{memberAssigns.length}</span>
                      </div>
                      {latestReview && (
                        <div className="flex items-center justify-between">
                          <span>Last review</span>
                          <span className="font-medium text-text">{latestReview.overall_score}/5 ({latestReview.week_start})</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1.5 mt-3 pt-3 border-t border-border">
                      <button onClick={() => selectMemberForReview(member)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium text-gold hover:bg-gold/10">
                        <Star size={12} /> Review
                      </button>
                      <button onClick={() => { setSelectedMember(member); setActiveTab('kpis') }}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium text-violet-400 hover:bg-violet-500/10">
                        <Target size={12} /> KPIs
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ASSIGN TASKS TAB */}
          {activeTab === 'assign' && (
            <div className="space-y-6">
              <div className="bg-surface rounded-2xl border border-border p-6">
                <h2 className="font-semibold mb-4">Assign Template to Members</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-text-muted">Template</label>
                    <select value={assignTemplateId} onChange={e => setAssignTemplateId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
                      <option value="">Select a template...</option>
                      {templates.map(t => {
                        const Icon = TEMPLATE_TYPE_ICONS[t.type] ?? FileText
                        return <option key={t.id} value={t.id}>[{t.type.replace('_', '-')}] {t.name}</option>
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-text-muted">Members</label>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                      {reports.map(m => (
                        <label key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover cursor-pointer">
                          <input type="checkbox" checked={assignMemberIds.has(m.id)}
                            onChange={() => {
                              const next = new Set(assignMemberIds)
                              if (next.has(m.id)) next.delete(m.id)
                              else next.add(m.id)
                              setAssignMemberIds(next)
                            }} className="rounded border-border" />
                          <span className="text-sm">{m.display_name}</span>
                          <span className="text-xs text-text-muted capitalize ml-auto">{(m.position ?? 'intern').replace(/_/g, ' ')}</span>
                        </label>
                      ))}
                    </div>
                    {reports.length > 1 && (
                      <button onClick={() => setAssignMemberIds(new Set(reports.map(m => m.id)))}
                        className="text-xs text-gold font-medium mt-1.5">Select all</button>
                    )}
                  </div>
                  <button onClick={handleAssignTemplate}
                    disabled={assignSubmitting || !assignTemplateId || assignMemberIds.size === 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-semibold disabled:opacity-50">
                    {assignSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />}
                    Assign Template
                  </button>
                </div>
              </div>

              {/* Current assignments list */}
              <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-semibold text-sm">Active Assignments</h2>
                </div>
                {reports.map(member => {
                  const memberAssigns = getMemberAssignments(member.id)
                  if (memberAssigns.length === 0) return null
                  return (
                    <div key={member.id} className="border-b border-border/50 last:border-0">
                      <div className="px-5 py-2.5 bg-surface-alt/50">
                        <span className="text-xs font-semibold text-text-muted">{member.display_name}</span>
                      </div>
                      {memberAssigns.map(a => {
                        const tpl = templates.find(t => t.id === a.template_id)
                        if (!tpl) return null
                        return (
                          <div key={a.id} className="px-5 py-2.5 flex items-center justify-between hover:bg-surface-hover/30">
                            <div className="flex items-center gap-2">
                              {(() => { const Icon = TEMPLATE_TYPE_ICONS[tpl.type] ?? FileText; return <Icon size={14} className="text-text-muted" /> })()}
                              <span className="text-sm">{tpl.name}</span>
                              <span className="text-[10px] text-text-light capitalize px-1.5 py-0.5 rounded bg-surface-alt">{tpl.type.replace('_', '-')}</span>
                            </div>
                            {a.intern_id && (
                              <button onClick={() => handleRemoveAssignment(a.id)}
                                className="text-xs text-red-400 hover:text-red-300 font-medium">Remove</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* WEEKLY REVIEW TAB */}
          {activeTab === 'review' && (
            <div className="space-y-6">
              <div className="flex gap-2 flex-wrap">
                {reports.map(m => (
                  <button key={m.id} onClick={() => selectMemberForReview(m)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      selectedMember?.id === m.id ? 'bg-gold/10 text-gold ring-1 ring-gold/30' : 'bg-surface border border-border text-text-muted hover:text-text'
                    }`}>
                    <div className="w-6 h-6 rounded-full bg-gold/15 text-gold flex items-center justify-center text-[10px] font-bold">
                      {m.display_name?.charAt(0)?.toUpperCase()}
                    </div>
                    {m.display_name}
                  </button>
                ))}
              </div>

              {selectedMember && (
                <div className="bg-surface rounded-2xl border border-border p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">Weekly Review: {selectedMember.display_name}</h2>
                      <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                        <Calendar size={12} /> Week of {startOfWeek()}
                      </p>
                    </div>
                  </div>

                  {/* Flywheel scores */}
                  <div>
                    <label className="block text-sm font-medium mb-3">Flywheel Stage Scores</label>
                    <div className="grid grid-cols-5 gap-3">
                      {FLYWHEEL_STAGES.map(stage => (
                        <div key={stage.key} className="text-center">
                          <p className={`text-xs font-semibold mb-2 ${stage.color}`}>{stage.label}</p>
                          <div className="flex flex-col items-center gap-1">
                            {[5, 4, 3, 2, 1].map(n => (
                              <button key={n} onClick={() => setReviewScores({ ...reviewScores, [stage.key]: n })}
                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                  reviewScores[stage.key] >= n
                                    ? 'bg-gold/20 text-gold border border-gold/40'
                                    : 'bg-surface-alt text-text-light border border-border hover:border-gold/20'
                                }`}>
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input type="checkbox" checked={reviewKpiOnTrack}
                        onChange={e => setReviewKpiOnTrack(e.target.checked)} className="rounded border-border" />
                      KPI on track this week
                    </label>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${reviewKpiOnTrack ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {reviewKpiOnTrack ? 'On Track' : 'Needs Attention'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Strengths</label>
                    <textarea value={reviewStrengths} onChange={e => setReviewStrengths(e.target.value)} rows={3}
                      className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-none"
                      placeholder="What did they do well this week?" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Areas for Improvement</label>
                    <textarea value={reviewImprovements} onChange={e => setReviewImprovements(e.target.value)} rows={3}
                      className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-none"
                      placeholder="Where can they improve?" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Action Items (one per line)</label>
                    <textarea value={reviewActions} onChange={e => setReviewActions(e.target.value)} rows={3}
                      className="w-full px-3 py-2.5 rounded-lg border border-border text-sm resize-none"
                      placeholder={"Submit content by 3pm daily\nUpdate pipeline before EOD"} />
                  </div>

                  <div className="flex justify-end">
                    <button onClick={handleSubmitReview} disabled={reviewSubmitting}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-semibold disabled:opacity-50">
                      {reviewSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Submit Review
                    </button>
                  </div>
                </div>
              )}

              {/* Past reviews */}
              {selectedMember && (() => {
                const memberReviews = reviews.filter(r => r.intern_id === selectedMember.id)
                if (memberReviews.length === 0) return null
                return (
                  <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                    <div className="px-5 py-4 border-b border-border">
                      <h2 className="font-semibold text-sm">Past Reviews</h2>
                    </div>
                    <div className="divide-y divide-border/50">
                      {memberReviews.map(r => (
                        <div key={r.id} className="px-5 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Week of {r.week_start}</span>
                            <span className="text-sm font-bold">{r.overall_score}/5</span>
                          </div>
                          <div className="flex gap-2 mb-2">
                            {FLYWHEEL_STAGES.map(s => (
                              <span key={s.key} className={`text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-alt ${s.color}`}>
                                {s.label}: {(r.flywheel_scores as Record<string, number>)?.[s.key] ?? '—'}
                              </span>
                            ))}
                          </div>
                          {r.strengths && <p className="text-xs text-text-muted mt-1"><span className="font-medium text-emerald-400">Strengths:</span> {r.strengths}</p>}
                          {r.improvements && <p className="text-xs text-text-muted mt-1"><span className="font-medium text-amber-400">Improve:</span> {r.improvements}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* KPI METRICS TAB */}
          {activeTab === 'kpis' && (
            <div className="space-y-6">
              <div className="flex gap-2 flex-wrap">
                {reports.map(m => (
                  <button key={m.id} onClick={() => setSelectedMember(m)}
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
                      {showKpiForm ? <X size={14} /> : <Plus size={14} />}
                      {showKpiForm ? 'Cancel' : 'Add KPI'}
                    </button>
                  </div>

                  {showKpiForm && (
                    <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1.5">KPI Name *</label>
                          <input required value={kpiName} onChange={e => setKpiName(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
                            placeholder="e.g. Content Pieces Submitted" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Flywheel Stage</label>
                          <select value={kpiStage} onChange={e => setKpiStage(e.target.value as FlywheelStage)}
                            className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
                            {FLYWHEEL_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Unit</label>
                          <select value={kpiUnit} onChange={e => setKpiUnit(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg border border-border text-sm">
                            <option value="count">Count</option>
                            <option value="percent">Percent</option>
                            <option value="hours">Hours</option>
                            <option value="dollars">Dollars</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Target Value</label>
                          <input type="number" value={kpiTarget} onChange={e => setKpiTarget(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg border border-border text-sm"
                            placeholder="e.g. 5" />
                        </div>
                      </div>
                      <button onClick={handleCreateKpi} disabled={kpiSubmitting || !kpiName}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-semibold disabled:opacity-50">
                        {kpiSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Create KPI
                      </button>
                    </div>
                  )}

                  {getMemberKpis(selectedMember.id).length === 0 ? (
                    <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-muted">
                      <Target size={32} className="mx-auto mb-3 opacity-30" />
                      <p>No KPIs assigned yet. Add one to start tracking.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {getMemberKpis(selectedMember.id).map(kpi => {
                        const entries = getKpiEntries(kpi.id)
                        const trend = getKPITrend(entries)
                        const chartData = entries.slice(-30).map(e => ({
                          date: e.entry_date.slice(5),
                          value: Number(e.value),
                        }))
                        const latestValue = entries.length > 0 ? entries[entries.length - 1].value : null
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
                                {trend === 'up' && <TrendingUp size={20} className="text-emerald-400" />}
                                {trend === 'down' && <TrendingDown size={20} className="text-red-400" />}
                                {trend === 'flat' && <Minus size={20} className="text-text-muted" />}
                              </div>
                            </div>

                            {chartData.length > 1 && (
                              <div className="h-32">
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
                            )}

                            <div className="flex justify-end mt-2">
                              <button onClick={() => handleDeleteKpi(kpi.id)}
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
          )}
        </>
      )}
    </div>
  )
}
