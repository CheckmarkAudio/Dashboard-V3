import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminOverviewProvider } from '../../contexts/AdminOverviewContext'
import { supabase } from '../../lib/supabase'
import { localDateKey } from '../../lib/dates'
import { useToast } from '../Toast'
import ApprovalsPanel from '../admin/ApprovalsPanel'
import AdminChecklistEditor from './AdminChecklistEditor'
import type { DeliverableSubmission, TeamMember } from '../../types'
import {
  CheckCircle2, ClipboardList, Edit2, ExternalLink,
  ListChecks, Loader2, Users, XCircle,
} from 'lucide-react'

interface MemberStatus {
  member: TeamMember
  checklistDone: number
  checklistTotal: number
  submittedToday: boolean
}

export default function TeamPulseTab() {
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

      const checklistByMember = new Map<string, { done: number; total: number }>()
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
      {/* Phase 5.3 — pending task_edit_requests, admin-only. Lives at the top
          of TeamPulseTab so approvals are never more than one click away. */}
      <AdminOverviewProvider>
        <ApprovalsPanel />
      </AdminOverviewProvider>

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
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Tasks</span>
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
                      <p className="text-[11px] text-text-light mt-0.5">No tasks today</p>
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
                      aria-label={`Edit ${member.display_name}'s tasks`}
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
