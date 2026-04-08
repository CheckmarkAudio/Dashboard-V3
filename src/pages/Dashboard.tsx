import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { TeamMember, DailyNote, Lead } from '../types'
import {
  Users, FileText, Target, TrendingUp, Clock, CheckCircle2, AlertCircle,
  ArrowRight, Sparkles, BarChart3, ChevronRight,
} from 'lucide-react'

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [recentNotes, setRecentNotes] = useState<DailyNote[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [profile])

  const loadData = async () => {
    if (!profile) { setLoading(false); return }
    try {
      if (isAdmin) {
        const [usersRes, notesRes, leadsRes] = await Promise.all([
          supabase.from('intern_users').select('*'),
          supabase.from('intern_daily_notes').select('*').order('submitted_at', { ascending: false }).limit(10),
          supabase.from('intern_leads').select('*'),
        ])
        if (usersRes.data) setTeamMembers(usersRes.data as TeamMember[])
        if (notesRes.data) setRecentNotes(notesRes.data as DailyNote[])
        if (leadsRes.data) setLeads(leadsRes.data as Lead[])
      } else {
        const [notesRes, leadsRes] = await Promise.all([
          supabase.from('intern_daily_notes').select('*').eq('intern_id', profile.id).order('submitted_at', { ascending: false }).limit(5),
          supabase.from('intern_leads').select('*').eq('intern_id', profile.id),
        ])
        if (notesRes.data) setRecentNotes(notesRes.data as DailyNote[])
        if (leadsRes.data) setLeads(leadsRes.data as Lead[])
      }
    } catch (err) { console.error('Dashboard load error:', err) }
    finally { setLoading(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-200 border-t-brand-600" />
      </div>
    )
  }

  const activeLeads = leads.filter(l => !['closed_won', 'closed_lost'].includes(l.status))
  const followUps = leads.filter(l => l.needs_follow_up)
  const todayNotes = recentNotes.filter(n => n.note_date === new Date().toISOString().split('T')[0])

  const stats = isAdmin
    ? [
        { label: 'Team Members', value: teamMembers.length, icon: Users, gradient: 'from-brand-500 to-brand-600', bg: 'bg-brand-50', shadow: 'shadow-brand-100' },
        { label: 'Notes Today', value: todayNotes.length, icon: FileText, gradient: 'from-emerald-500 to-green-600', bg: 'bg-green-50', shadow: 'shadow-green-100' },
        { label: 'Active Leads', value: activeLeads.length, icon: Target, gradient: 'from-violet-500 to-purple-600', bg: 'bg-purple-50', shadow: 'shadow-purple-100' },
        { label: 'Follow-ups', value: followUps.length, icon: AlertCircle, gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', shadow: 'shadow-amber-100' },
      ]
    : [
        { label: 'My Notes', value: recentNotes.length, icon: FileText, gradient: 'from-brand-500 to-brand-600', bg: 'bg-brand-50', shadow: 'shadow-brand-100' },
        { label: 'My Leads', value: leads.length, icon: Target, gradient: 'from-violet-500 to-purple-600', bg: 'bg-purple-50', shadow: 'shadow-purple-100' },
        { label: 'Active Leads', value: activeLeads.length, icon: TrendingUp, gradient: 'from-emerald-500 to-green-600', bg: 'bg-green-50', shadow: 'shadow-green-100' },
        { label: 'Follow-ups', value: followUps.length, icon: AlertCircle, gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', shadow: 'shadow-amber-100' },
      ]

  const parseContent = (content: string) => {
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) return parsed.map((p: { answer?: string }) => p.answer).filter(Boolean).join(' ')
    } catch {}
    return content
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 via-brand-700 to-brand-800 p-8 text-white shadow-xl shadow-brand-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-brand-200" />
            <span className="text-brand-200 text-sm font-medium">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <h1 className="text-3xl font-bold">Welcome back, {profile?.display_name?.split(' ')[0]}</h1>
          <p className="text-brand-200 mt-2 max-w-lg">
            {isAdmin
              ? `You have ${teamMembers.length} team members. ${todayNotes.length} notes submitted today.`
              : `You have ${activeLeads.length} active leads and ${followUps.length} pending follow-ups.`
            }
          </p>
          <div className="flex gap-3 mt-5">
            <Link to="/daily" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors backdrop-blur-sm">
              <FileText size={14} /> Daily Notes <ArrowRight size={14} />
            </Link>
            <Link to="/tasks" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors backdrop-blur-sm">
              <BarChart3 size={14} /> Tasks <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`bg-surface rounded-2xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-300 animate-slide-up`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-xs text-text-muted font-medium mt-1">{stat.label}</p>
              </div>
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-md ${stat.shadow}`}>
                <stat.icon size={18} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Notes */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-brand-500" />
              <h2 className="font-semibold">Recent Notes</h2>
            </div>
            <Link to="/daily" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentNotes.length === 0 ? (
              <div className="p-8 text-center">
                <FileText size={28} className="mx-auto mb-2 text-text-light opacity-30" />
                <p className="text-sm text-text-muted">No notes yet.</p>
              </div>
            ) : (
              recentNotes.slice(0, 5).map(note => (
                <div key={note.id} className="px-5 py-3.5 hover:bg-surface-alt/50 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold">{note.note_date}</span>
                    <span className="flex items-center gap-1 text-xs text-text-muted">
                      {note.manager_reply ? (
                        <><CheckCircle2 size={12} className="text-green-500" /> Replied</>
                      ) : (
                        <><Clock size={12} /> Pending</>
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted line-clamp-2">{parseContent(note.content).slice(0, 120)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Leads */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-purple-500" />
              <h2 className="font-semibold">Active Leads</h2>
            </div>
            <Link to="/leads" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {activeLeads.length === 0 ? (
              <div className="p-8 text-center">
                <Target size={28} className="mx-auto mb-2 text-text-light opacity-30" />
                <p className="text-sm text-text-muted">No active leads.</p>
              </div>
            ) : (
              activeLeads.slice(0, 5).map(lead => (
                <div key={lead.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-surface-alt/50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold">{lead.contact}</p>
                    <p className="text-xs text-text-muted">{lead.company}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      lead.priority === 'high' ? 'bg-red-50 text-red-600' :
                      lead.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {lead.priority}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-600 capitalize">
                      {lead.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Admin: Team Overview */}
      {isAdmin && teamMembers.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-brand-500" />
              <h2 className="font-semibold">Team Members</h2>
            </div>
            <Link to="/admin/team" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              Manage <ChevronRight size={12} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {teamMembers.map((member, i) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:shadow-md hover:border-brand-200 transition-all duration-200 animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">
                  {member.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{member.display_name}</p>
                  <p className="text-[11px] text-text-muted capitalize">{member.position ?? 'Member'}</p>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  (member.status ?? 'active') === 'active' ? 'bg-green-400 shadow-sm shadow-green-200' : 'bg-gray-300'
                }`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
