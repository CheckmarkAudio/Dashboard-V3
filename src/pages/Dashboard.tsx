import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useChecklist } from '../hooks/useChecklist'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { supabase } from '../lib/supabase'
import { localDateKey } from '../lib/dates'
import type { DailyNote, DeliverableSubmission, TeamMember, MemberKPI, MemberKPIEntry } from '../types'
import type { ChecklistItemRow } from '../hooks/useChecklist'
import MustDoCard from '../components/MustDoCard'
import SubmissionModal from '../components/SubmissionModal'
import { useToast } from '../components/Toast'
import {
  AreaChart, Area, ResponsiveContainer,
} from 'recharts'
import {
  Check, FileText, Flame, Loader2,
  ListChecks, Mic, ArrowRight, Target, TrendingUp, TrendingDown, Minus,
  Users, CheckCircle2, XCircle, ClipboardList, Edit2, Plus, X, Trash2, Save,
  ExternalLink,
} from 'lucide-react'

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

// ─── Types for team pulse ────────────────────────────────────────────
interface MemberStatus {
  member: TeamMember
  checklistDone: number
  checklistTotal: number
  submittedToday: boolean
}

// ─── Admin Checklist Editor (inline) ─────────────────────────────────
function AdminChecklistEditor({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const { toast } = useToast()
  const [items, setItems] = useState<ChecklistItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [newItemText, setNewItemText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)

  const dateKey = localDateKey()

  const loadItems = useCallback(async () => {
    setLoading(true)
    const { data: inst } = await supabase
      .from('intern_checklist_instances')
      .select('id')
      .eq('intern_id', member.id)
      .eq('frequency', 'daily')
      .eq('period_date', dateKey)
      .maybeSingle()

    if (inst) {
      setInstanceId(inst.id)
      const { data } = await supabase
        .from('intern_checklist_items')
        .select('*')
        .eq('instance_id', inst.id)
        .order('sort_order')
      setItems((data as ChecklistItemRow[]) ?? [])
    } else {
      setInstanceId(null)
      setItems([])
    }
    setLoading(false)
  }, [member.id, dateKey])

  useEffect(() => { loadItems() }, [loadItems])

  const toggleItem = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const next = !item.is_completed
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_completed: next, completed_at: next ? new Date().toISOString() : null } : i))
    await supabase.from('intern_checklist_items').update({ is_completed: next, completed_at: next ? new Date().toISOString() : null }).eq('id', id)
  }

  const addItem = async () => {
    if (!newItemText.trim() || !instanceId) return
    setSaving(true)
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0
    const { data, error } = await supabase.from('intern_checklist_items').insert({
      instance_id: instanceId,
      category: 'Manager added',
      item_text: newItemText.trim(),
      is_completed: false,
      sort_order: maxOrder,
    }).select('*').single()
    if (error) toast('Failed to add item', 'error')
    else if (data) {
      setItems(prev => [...prev, data as ChecklistItemRow])
      setNewItemText('')
      toast('Item added')
    }
    setSaving(false)
  }

  const updateItemText = async (id: string) => {
    if (!editText.trim()) return
    setSaving(true)
    const { error } = await supabase.from('intern_checklist_items').update({ item_text: editText.trim() }).eq('id', id)
    if (error) toast('Failed to update', 'error')
    else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, item_text: editText.trim() } : i))
      setEditingId(null)
      toast('Item updated')
    }
    setSaving(false)
  }

  const removeItem = async (id: string) => {
    const { error } = await supabase.from('intern_checklist_items').delete().eq('id', id)
    if (error) toast('Failed to remove', 'error')
    else {
      setItems(prev => prev.filter(i => i.id !== id))
      toast('Item removed')
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 size={16} className="animate-spin text-text-muted" />
      </div>
    )
  }

  const done = items.filter(i => i.is_completed).length

  return (
    <div className="border-t border-border bg-surface-alt/30">
      <div className="px-5 py-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2">
          <Edit2 size={13} className="text-gold" />
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
            {member.display_name}'s checklist
          </span>
          {items.length > 0 && (
            <span className="text-xs text-text-light">{done}/{items.length}</span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover text-text-muted" aria-label="Close editor">
          <X size={14} />
        </button>
      </div>

      {items.length === 0 && !instanceId ? (
        <p className="px-5 py-4 text-sm text-text-muted italic">No checklist generated yet for today.</p>
      ) : items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-text-muted italic">Checklist is empty. Add items below.</p>
      ) : (
        <div className="divide-y divide-border/30">
          {items.map(item => (
            <div key={item.id} className="px-5 py-2.5 flex items-center gap-3 group">
              <button onClick={() => toggleItem(item.id)} className="shrink-0">
                <div className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all ${
                  item.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-border-light hover:border-gold/50'
                }`}>
                  {item.is_completed && <Check size={11} className="text-white" />}
                </div>
              </button>
              {editingId === item.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && updateItemText(item.id)}
                    className="flex-1 text-sm px-2 py-1 rounded border border-border bg-surface"
                    autoFocus
                  />
                  <button onClick={() => updateItemText(item.id)} disabled={saving} className="text-gold hover:text-gold-muted">
                    <Save size={14} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-text-muted hover:text-text">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <span className={`flex-1 text-sm ${item.is_completed ? 'text-text-light line-through' : 'text-text'}`}>
                    {item.item_text}
                  </span>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={() => { setEditingId(item.id); setEditText(item.item_text) }}
                      className="p-1 rounded hover:bg-surface-hover text-text-muted"
                      aria-label="Edit item"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400"
                      aria-label="Remove item"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {instanceId && (
        <div className="px-5 py-3 border-t border-border/50 flex items-center gap-2">
          <input
            value={newItemText}
            onChange={e => setNewItemText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Add a task..."
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-border bg-surface placeholder:text-text-light"
          />
          <button
            onClick={addItem}
            disabled={saving || !newItemText.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold hover:bg-gold-muted text-black text-sm font-semibold disabled:opacity-50"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Team Pulse Tab ──────────────────────────────────────────────────
function TeamPulseTab() {
  const { toast } = useToast()
  const [memberStatuses, setMemberStatuses] = useState<MemberStatus[]>([])
  const [teamSubmissions, setTeamSubmissions] = useState<(DeliverableSubmission & { display_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)

  const loadTeamData = useCallback(async () => {
    setLoading(true)
    const today = localDateKey()
    try {
      const [
        { data: members },
        { data: todaySubs },
        { data: instances },
        { data: allSubs },
      ] = await Promise.all([
        supabase.from('intern_users').select('*').order('display_name'),
        supabase.from('deliverable_submissions').select('intern_id').eq('submission_date', today),
        supabase.from('intern_checklist_instances').select('id, intern_id').eq('frequency', 'daily').eq('period_date', today),
        supabase.from('deliverable_submissions').select('*').eq('submission_date', today).order('created_at', { ascending: false }),
      ])

      const memberList = (members ?? []) as TeamMember[]
      const subIds = new Set((todaySubs ?? []).map((r: { intern_id: string }) => r.intern_id))
      const instList = (instances ?? []) as { id: string; intern_id: string }[]

      // Load all checklist items for today's instances
      const instanceMap = new Map<string, string>() // instance_id -> intern_id
      for (const inst of instList) instanceMap.set(inst.id, inst.intern_id)

      let checklistByMember = new Map<string, { done: number; total: number }>()
      if (instList.length > 0) {
        const { data: allItems } = await supabase
          .from('intern_checklist_items')
          .select('instance_id, is_completed')
          .in('instance_id', instList.map(i => i.id))
        for (const row of (allItems ?? []) as { instance_id: string; is_completed: boolean }[]) {
          const memberId = instanceMap.get(row.instance_id)
          if (!memberId) continue
          const cur = checklistByMember.get(memberId) ?? { done: 0, total: 0 }
          cur.total++
          if (row.is_completed) cur.done++
          checklistByMember.set(memberId, cur)
        }
      }

      const statuses: MemberStatus[] = memberList
        .filter(m => m.status !== 'inactive')
        .map(m => ({
          member: m,
          checklistDone: checklistByMember.get(m.id)?.done ?? 0,
          checklistTotal: checklistByMember.get(m.id)?.total ?? 0,
          submittedToday: subIds.has(m.id),
        }))

      setMemberStatuses(statuses)

      const memberMap = new Map(memberList.map(m => [m.id, m.display_name]))
      setTeamSubmissions((allSubs ?? []).map((s: DeliverableSubmission) => ({
        ...s,
        display_name: memberMap.get(s.intern_id) ?? 'Unknown',
      })))
    } catch {
      toast('Failed to load team data', 'error')
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { loadTeamData() }, [loadTeamData])

  const handleReviewSubmission = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('deliverable_submissions').update({
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) toast('Failed to mark as reviewed', 'error')
    loadTeamData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={20} className="animate-spin text-gold" />
      </div>
    )
  }

  const allDone = memberStatuses.filter(s => s.checklistTotal > 0 && s.checklistDone === s.checklistTotal).length
  const withChecklists = memberStatuses.filter(s => s.checklistTotal > 0).length
  const allSubmitted = memberStatuses.filter(s => s.submittedToday).length

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Team</span>
            <Users size={14} className="text-gold" />
          </div>
          <p className="text-xl font-bold">{memberStatuses.length}</p>
          <p className="text-[11px] text-text-light mt-1">Active members</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Checklists</span>
            <ListChecks size={14} className="text-emerald-500" />
          </div>
          <p className="text-xl font-bold">{allDone}/{withChecklists}</p>
          <p className="text-[11px] text-text-light mt-1">Fully complete</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Must-Do</span>
            <CheckCircle2 size={14} className="text-sky-500" />
          </div>
          <p className="text-xl font-bold">{allSubmitted}/{memberStatuses.length}</p>
          <p className="text-[11px] text-text-light mt-1">Submitted today</p>
        </div>
      </div>

      {/* Per-member cards */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Users size={15} className="text-gold" />
            Team Status
          </h2>
          <div className="flex items-center gap-3">
            <Link to="/admin/templates" className="text-xs text-gold font-medium flex items-center gap-1 hover:underline">
              <ClipboardList size={12} /> Templates
            </Link>
            <Link to="/admin/team" className="text-xs text-gold font-medium flex items-center gap-1 hover:underline">
              <ExternalLink size={12} /> Team Manager
            </Link>
          </div>
        </div>
        <div className="divide-y divide-border/50">
          {memberStatuses.map(({ member, checklistDone, checklistTotal, submittedToday }) => {
            const pct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0
            const isEditing = editingMemberId === member.id
            return (
              <div key={member.id}>
                <div className="px-5 py-3.5 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-gold/10 text-gold flex items-center justify-center text-xs font-bold shrink-0">
                    {member.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{member.display_name}</p>
                      <span className="text-[10px] text-text-light capitalize">{(member.position ?? 'member').replace(/_/g, ' ')}</span>
                    </div>
                    {checklistTotal > 0 ? (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-surface-alt rounded-full overflow-hidden max-w-[140px]">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#10b981' : '#C9A84C' }}
                          />
                        </div>
                        <span className="text-[11px] text-text-muted tabular-nums">{checklistDone}/{checklistTotal}</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-text-light mt-0.5">No checklist today</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {submittedToday ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                        <CheckCircle2 size={14} /> Submitted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-text-light">
                        <XCircle size={14} /> No submission
                      </span>
                    )}
                    <button
                      onClick={() => setEditingMemberId(isEditing ? null : member.id)}
                      className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isEditing ? 'bg-gold/10 text-gold' : 'hover:bg-surface-alt text-text-muted hover:text-text'
                      }`}
                      aria-label={`Edit ${member.display_name}'s checklist`}
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
                {isEditing && (
                  <AdminChecklistEditor member={member} onClose={() => setEditingMemberId(null)} />
                )}
              </div>
            )
          })}
        </div>
        {memberStatuses.length === 0 && (
          <p className="p-6 text-center text-text-muted text-sm">No active team members found.</p>
        )}
      </div>

      {/* Team Submissions Today */}
      {teamSubmissions.length > 0 && (
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
                  <button onClick={() => handleReviewSubmission(sub.id)} className="text-xs text-gold font-medium hover:underline">
                    Mark Reviewed
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Personal Dashboard (My Tasks) ──────────────────────────────────
function MyTasksTab() {
  const { profile, isAdmin } = useAuth()
  const { toast } = useToast()
  const [showSubmitModal, setShowSubmitModal] = useState(false)
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
        supabase.from('intern_daily_notes').select('*').eq('intern_id', profile.id).eq('note_date', today).maybeSingle(),
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
          const { data: members } = await supabase.from('intern_users').select('id, display_name')
          const memberMap = new Map((members ?? []).map((m: TeamMember) => [m.id, m.display_name]))
          setTeamSubmissions(subs.map((s: DeliverableSubmission) => ({ ...s, display_name: memberMap.get(s.intern_id) ?? 'Unknown' })))
        }
      }

      try {
        const { data: instances } = await supabase
          .from('intern_checklist_instances')
          .select('id, period_date')
          .eq('frequency', 'daily')
          .eq('intern_id', profile.id)
          .order('period_date', { ascending: false })
          .limit(30)
        if (instances && instances.length > 0) {
          let s = 0
          for (const inst of instances) {
            const { data: cItems } = await supabase
              .from('intern_checklist_items')
              .select('is_completed')
              .eq('instance_id', inst.id)
            if (!cItems || cItems.length === 0) break
            if (cItems.every((ci: { is_completed: boolean }) => ci.is_completed)) s++
            else break
          }
          setStreak(s)
        }
      } catch {}
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
  const kpiChartData = kpiEntries.slice(-14).map(e => ({ date: e.entry_date.slice(5), value: Number(e.value) }))
  const kpiLatest = kpiEntries.length > 0 ? kpiEntries[kpiEntries.length - 1].value : null

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
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm">Today's Tasks</h2>
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
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────
export default function Dashboard() {
  useDocumentTitle('Dashboard - Checkmark Audio')
  const { profile, isAdmin } = useAuth()
  const [adminTab, setAdminTab] = useState<'team' | 'my'>('team')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.display_name?.split(' ')[0] ?? ''

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-text-light text-sm font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-2xl font-bold mt-1">{greeting}, {firstName}</h1>
        </div>
      </div>

      {/* Admin tab bar */}
      {isAdmin && (
        <div className="flex gap-1 bg-surface-alt/50 p-1 rounded-xl border border-border w-fit">
          <button
            onClick={() => setAdminTab('team')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              adminTab === 'team'
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <span className="flex items-center gap-2">
              <Users size={15} /> Team
            </span>
          </button>
          <button
            onClick={() => setAdminTab('my')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              adminTab === 'my'
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <span className="flex items-center gap-2">
              <ListChecks size={15} /> My Tasks
            </span>
          </button>
        </div>
      )}

      {/* Tab content */}
      {isAdmin && adminTab === 'team' ? (
        <TeamPulseTab />
      ) : (
        <MyTasksTab />
      )}
    </div>
  )
}
