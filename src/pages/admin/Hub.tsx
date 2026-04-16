import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useToast } from '../../components/Toast'
import {
  Badge,
  Button,
  CalendarWeek,
  Card,
  EmptyState,
  PageHeader,
  type BadgeVariant,
} from '../../components/ui'
import ApprovalsPanel from '../../components/admin/ApprovalsPanel'
import MemberAssignmentsPanel from '../../components/admin/MemberAssignmentsPanel'
import WorkspacePanel from '../../components/dashboard/WorkspacePanel'
import { WORKSPACE_WIDGET_DEFINITIONS } from '../../components/dashboard/widgetRegistry'
import { loadWeekEvents } from '../../lib/calendar'
import { addDays, startOfWeek } from '../../lib/time'
import { getWorkspaceScopeForRole } from '../../domain/workspaces/registry'
import type { TeamMember, ChecklistItem, CalendarEvent } from '../../types'
import {
  UsersRound, LayoutDashboard, ListChecks, Clock, Calendar, User as UserIcon,
  Mail, Shield, UserCheck, Check, ExternalLink, Loader2,
} from 'lucide-react'

type HubTab = 'overview' | 'tasks' | 'approvals' | 'calendar'

interface MemberSnapshot {
  member: TeamMember
  dailyDone: number
  dailyTotal: number
  pendingRequests: number
}

/**
 * Phase 5.4 — Unified admin Hub.
 *
 * A single landing page at `/admin` that gives admins everything they
 * need to orchestrate the team without bouncing between Templates,
 * MyTeam, TeamManager, and Dashboard. Left rail = team member list,
 * right side = tabbed workspace.
 *
 * Four tabs:
 *   Overview   — per-member summary cards + jump links to existing admin pages
 *   Tasks      — selected member's daily checklist items, read-only view
 *                with deep-link to DailyChecklist for editing
 *   Approvals  — embeds <ApprovalsPanel /> (Phase 5.3)
 *   Calendar   — placeholder until Phase 5.5 lands the calendar component
 *
 * The existing `/admin/team`, `/admin/templates`, `/admin/my-team`,
 * `/admin/health`, and `/admin/settings` routes remain live. They're
 * reachable from "Jump to…" deep links on the Overview tab and from the
 * sidebar admin menu. Phase 5.4 doesn't delete them — it adds a better
 * top-level surface.
 */
export default function AdminHub() {
  useDocumentTitle('Team Hub - Checkmark Audio')
  const { isAdmin, appRole, profile } = useAuth()
  const { toast } = useToast()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<HubTab>('overview')
  const [snapshots, setSnapshots] = useState<Map<string, MemberSnapshot>>(new Map())

  const loadMembers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('intern_users')
      .select('*')
      .eq('status', 'active')
      .order('display_name')
    if (error) {
      console.error('[Hub] load members:', error)
      toast('Failed to load team members', 'error')
      setLoading(false)
      return
    }
    const list = (data ?? []) as TeamMember[]
    setMembers(list)

    // Compute per-member snapshot: today's daily progress + pending approvals
    // count. Parallel fetch to keep Hub load snappy.
    if (list.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const memberIds = list.map(m => m.id)

      const [instancesRes, pendingRes] = await Promise.all([
        supabase
          .from('intern_checklist_instances')
          .select('id, intern_id')
          .eq('frequency', 'daily')
          .eq('period_date', today)
          .in('intern_id', memberIds),
        supabase
          .from('task_edit_requests')
          .select('id, requested_by')
          .eq('status', 'pending')
          .in('requested_by', memberIds),
      ])

      const instMap = new Map<string, { id: string; intern_id: string }>()
      for (const inst of (instancesRes.data ?? []) as Array<{ id: string; intern_id: string }>) {
        instMap.set(inst.intern_id, inst)
      }
      const instanceIds = Array.from(instMap.values()).map(i => i.id)

      const itemsRes = instanceIds.length > 0
        ? await supabase
            .from('intern_checklist_items')
            .select('instance_id, is_completed')
            .in('instance_id', instanceIds)
        : { data: [] as Array<{ instance_id: string; is_completed: boolean }> }

      const itemsByInstance = new Map<string, { done: number; total: number }>()
      for (const row of (itemsRes.data ?? []) as Array<{ instance_id: string; is_completed: boolean }>) {
        const entry = itemsByInstance.get(row.instance_id) ?? { done: 0, total: 0 }
        entry.total += 1
        if (row.is_completed) entry.done += 1
        itemsByInstance.set(row.instance_id, entry)
      }

      const pendingByMember = new Map<string, number>()
      for (const p of (pendingRes.data ?? []) as Array<{ requested_by: string }>) {
        pendingByMember.set(p.requested_by, (pendingByMember.get(p.requested_by) ?? 0) + 1)
      }

      const nextSnapshots = new Map<string, MemberSnapshot>()
      for (const m of list) {
        const inst = instMap.get(m.id)
        const stats = inst ? itemsByInstance.get(inst.id) : undefined
        nextSnapshots.set(m.id, {
          member: m,
          dailyDone: stats?.done ?? 0,
          dailyTotal: stats?.total ?? 0,
          pendingRequests: pendingByMember.get(m.id) ?? 0,
        })
      }
      setSnapshots(nextSnapshots)
    } else {
      setSnapshots(new Map())
    }

    setLoading(false)
  }, [toast])

  useEffect(() => { loadMembers() }, [loadMembers])

  const selectedMember = useMemo(
    () => (selectedId ? members.find(m => m.id === selectedId) ?? null : null),
    [members, selectedId],
  )

  if (!isAdmin) {
    return (
      <EmptyState
        icon={Shield}
        title="Admins only"
        description="This workspace is reserved for team admins and owners."
      />
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      <PageHeader
        icon={UsersRound}
        title="Team Hub"
        subtitle="Everything you need to orchestrate your team, in one place."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadMembers}
              loading={loading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left rail — member list */}
        <aside className="space-y-2">
          <div className="bg-surface rounded-2xl border border-border p-2">
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-label">Team · {members.length}</span>
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors focus-ring ${
                  selectedId === null
                    ? 'bg-gold/10 text-gold'
                    : 'text-text-muted hover:text-text hover:bg-surface-hover'
                }`}
              >
                <LayoutDashboard size={14} aria-hidden="true" />
                Team overview
              </button>
              {loading && members.length === 0 ? (
                <div className="px-3 py-4 flex items-center justify-center">
                  <Loader2 size={14} className="animate-spin text-text-light" aria-hidden="true" />
                </div>
              ) : (
                members.map(m => {
                  const snap = snapshots.get(m.id)
                  const hasPending = (snap?.pendingRequests ?? 0) > 0
                  const isSelected = selectedId === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors focus-ring ${
                        isSelected
                          ? 'bg-gold/10 text-gold'
                          : 'text-text-muted hover:text-text hover:bg-surface-hover'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full bg-gold/15 text-gold flex items-center justify-center text-[10px] font-bold shrink-0"
                        aria-hidden="true"
                      >
                        {m.display_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 truncate">{m.display_name}</span>
                      {hasPending && (
                        <Badge variant="warning" size="sm">
                          {snap?.pendingRequests}
                        </Badge>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </aside>

        {/* Right side — tabs + content */}
        <section className="space-y-4 min-w-0">
          {/* Tab bar */}
          <div role="tablist" aria-label="Hub sections" className="flex gap-1 bg-surface-alt/50 p-1 rounded-xl border border-border w-fit">
            {([
              { key: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
              { key: 'tasks' as const, label: 'Tasks', icon: ListChecks },
              { key: 'approvals' as const, label: 'Approvals', icon: Clock },
              { key: 'calendar' as const, label: 'Calendar', icon: Calendar },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all focus-ring ${
                  tab === key ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={15} aria-hidden="true" /> {label}
                </span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'overview' && (
            <OverviewTab
              members={members}
              snapshots={snapshots}
              selectedMember={selectedMember}
              loading={loading}
              role={appRole}
              userId={profile?.id ?? 'guest'}
            />
          )}
          {tab === 'tasks' && (
            <TasksTab selectedMember={selectedMember} />
          )}
          {tab === 'approvals' && (
            <ApprovalsPanel />
          )}
          {tab === 'calendar' && (
            <CalendarTab selectedMember={selectedMember} />
          )}
        </section>
      </div>
    </div>
  )
}

// ─── Overview tab ────────────────────────────────────────────────────

function OverviewTab({
  members,
  snapshots,
  selectedMember,
  loading,
  role,
  userId,
}: {
  members: TeamMember[]
  snapshots: Map<string, MemberSnapshot>
  selectedMember: TeamMember | null
  loading: boolean
  role: 'owner' | 'admin' | 'member'
  userId: string
}) {
  const scope = getWorkspaceScopeForRole(role)
  const definitions = WORKSPACE_WIDGET_DEFINITIONS.filter((widget) => widget.scopes.includes(scope))

  if (loading && members.length === 0) {
    return (
      <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
        <Loader2 size={20} className="animate-spin text-gold" aria-hidden="true" />
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <EmptyState
        icon={UsersRound}
        title="No team members yet"
        description="Add your first member from Team Manager to populate the Hub."
        action={
          <Link
            to="/admin/team"
            className="inline-flex items-center gap-1 text-sm text-gold hover:underline"
          >
            Open Team Manager <ExternalLink size={12} aria-hidden="true" />
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <WorkspacePanel
        role={role}
        userId={userId}
        scope={scope}
        definitions={definitions}
        controlsTitle="Admin Workspace Controls"
        controlsDescription="Admin overview is now widget-based too, so the team command center can evolve without entangling the rest of the admin app."
      />

      {selectedMember ? (
        <MemberDetail member={selectedMember} snapshot={snapshots.get(selectedMember.id)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {members.map(m => (
            <MemberDetail key={m.id} member={m} snapshot={snapshots.get(m.id)} compact />
          ))}
        </div>
      )}
    </div>
  )
}

function MemberDetail({
  member,
  snapshot,
  compact = false,
}: {
  member: TeamMember
  snapshot?: MemberSnapshot
  compact?: boolean
}) {
  const done = snapshot?.dailyDone ?? 0
  const total = snapshot?.dailyTotal ?? 0
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const hasPending = (snapshot?.pendingRequests ?? 0) > 0

  const positionBadge: BadgeVariant =
    member.position === 'owner' ? 'gold'
    : member.position === 'engineer' ? 'warning'
    : member.position === 'producer' ? 'stage-book'
    : member.position === 'artist_development' ? 'stage-share'
    : member.position === 'marketing_admin' ? 'success'
    : 'info'

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-full bg-gold/15 text-gold flex items-center justify-center text-sm font-bold shrink-0"
          aria-hidden="true"
        >
          {member.display_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{member.display_name}</h3>
            {member.role === 'admin' && (
              <Badge variant="gold" size="sm" icon={<Shield size={9} aria-hidden="true" />}>
                Admin
              </Badge>
            )}
          </div>
          <p className="text-xs text-text-muted truncate flex items-center gap-1 mt-0.5">
            <Mail size={11} className="shrink-0" aria-hidden="true" />
            {member.email ?? '—'}
          </p>
          {member.position && (
            <div className="mt-1.5">
              <Badge variant={positionBadge} size="sm">
                {member.position}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Daily progress */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted flex items-center gap-1">
            <ListChecks size={11} aria-hidden="true" />
            Today's tasks
          </span>
          <span className="tabular-nums font-medium">
            {total > 0 ? `${done}/${total}` : 'none yet'}
          </span>
        </div>
        {total > 0 && (
          <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: pct === 100 ? '#10b981' : '#C9A84C',
              }}
            />
          </div>
        )}
      </div>

      {/* Pending approvals */}
      {hasPending && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          <Clock size={11} className="text-amber-400" aria-hidden="true" />
          <Badge variant="warning" size="sm">
            {snapshot?.pendingRequests} pending
          </Badge>
          <span className="text-text-muted">· see Approvals tab</span>
        </div>
      )}

      {!compact && (
        <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-2">
          <DeepLink to="/admin/team" label="Team Manager" />
          <DeepLink to="/admin/my-team" label="Reviews & KPIs" />
          <DeepLink to="/admin/templates" label="Templates" />
          <DeepLink to="/daily" label="Daily Checklist" />
        </div>
      )}
    </Card>
  )
}

function DeepLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors px-2 py-1.5 rounded-md hover:bg-gold/5 focus-ring"
    >
      <ExternalLink size={10} aria-hidden="true" />
      {label}
    </Link>
  )
}

// ─── Tasks tab ───────────────────────────────────────────────────────
// Shows the selected member's current daily + weekly checklist items
// (read-only). For direct editing, admins still use the Daily Tasks page
// or the AdminChecklistEditor on the Dashboard. This tab is primarily an
// at-a-glance view during approvals.

function TasksTab({ selectedMember }: { selectedMember: TeamMember | null }) {
  const [items, setItems] = useState<Array<ChecklistItem & { instance_id: string }>>([])
  const [loading, setLoading] = useState(false)
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily')

  useEffect(() => {
    if (!selectedMember) {
      setItems([])
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data: inst, error: instErr } = await supabase
        .from('intern_checklist_instances')
        .select('id')
        .eq('intern_id', selectedMember.id)
        .eq('frequency', frequency)
        .eq('period_date', today)
        .maybeSingle()
      if (cancelled) return
      if (instErr) {
        console.error('[Hub Tasks] instance lookup:', instErr)
        setLoading(false)
        return
      }
      if (!inst) {
        setItems([])
        setLoading(false)
        return
      }
      const { data: itemRows, error: itemErr } = await supabase
        .from('intern_checklist_items')
        .select('*')
        .eq('instance_id', inst.id)
        .order('sort_order')
      if (cancelled) return
      if (itemErr) {
        console.error('[Hub Tasks] items lookup:', itemErr)
        setLoading(false)
        return
      }
      setItems((itemRows ?? []) as Array<ChecklistItem & { instance_id: string }>)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [selectedMember, frequency])

  if (!selectedMember) {
    return (
      <EmptyState
        icon={UsersRound}
        title="Pick a member from the left"
        description="Select a team member to see their current checklist at a glance."
      />
    )
  }

  const grouped = items.reduce<Record<string, typeof items>>((acc, it) => {
    const cat = it.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(it)
    return acc
  }, {})
  const categories = Object.keys(grouped)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserIcon size={14} className="text-gold" aria-hidden="true" />
            {selectedMember.display_name}'s checklist
          </h3>
          <p className="text-xs text-text-muted mt-0.5">Read-only snapshot for the current period.</p>
        </div>
        <div className="flex gap-1 bg-surface-alt/50 p-1 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setFrequency('daily')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors focus-ring ${
              frequency === 'daily' ? 'bg-surface text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setFrequency('weekly')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors focus-ring ${
              frequency === 'weekly' ? 'bg-surface text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            Weekly
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
          <Loader2 size={20} className="animate-spin text-gold" aria-hidden="true" />
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={`No ${frequency} items for today`}
          description="This member has no generated checklist for the current period. Assign a template in the Team Manager or publish yours from the Dashboard."
          action={
            <Link
              to="/admin/templates"
              className="inline-flex items-center gap-1 text-sm text-gold hover:underline"
            >
              Open Templates <ExternalLink size={12} aria-hidden="true" />
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {categories.map(cat => (
            <Card key={cat} flush>
              <div className="px-5 py-3 border-b border-border">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">{cat}</p>
              </div>
              <ul className="divide-y divide-border/40">
                {grouped[cat]!.map(it => (
                  <li key={it.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        it.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-border-light'
                      }`}
                      aria-hidden="true"
                    >
                      {it.is_completed && <Check size={10} className="text-white" />}
                    </div>
                    <span className={`text-sm ${it.is_completed ? 'text-text-light line-through' : 'text-text'}`}>
                      {it.item_text}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          <div className="flex items-center gap-2 text-xs text-text-muted pt-1">
            <UserCheck size={12} aria-hidden="true" />
            <span>For direct editing, open the Daily Checklist page.</span>
            <Link to="/daily" className="text-gold hover:underline inline-flex items-center gap-1">
              Open <ExternalLink size={10} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}

      {/* Phase 6.3.5 — Assignment surfaces (templates, projects,
          students, pipeline artists). Lets admins fully configure the
          member's workload from one place without bouncing between
          Templates, Projects, Education, and Pipeline. */}
      <div className="pt-4 border-t border-border">
        <MemberAssignmentsPanel member={selectedMember} />
      </div>
    </div>
  )
}

// ─── Calendar tab (Phase 5.5) ────────────────────────────────────────
// Reuses CalendarWeek. If a member is selected, shows only their
// events; otherwise shows the full team with member-name chips.

function CalendarTab({ selectedMember }: { selectedMember: TeamMember | null }) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const scope = selectedMember ? selectedMember.id : 'team'
      const { events: evs } = await loadWeekEvents({ weekStart, scope })
      if (cancelled) return
      setEvents(evs)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [weekStart, selectedMember])

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
        <Loader2 size={20} className="animate-spin text-gold" aria-hidden="true" />
      </div>
    )
  }

  return (
    <CalendarWeek
      weekStart={weekStart}
      events={events}
      onPrevWeek={() => setWeekStart((d) => addDays(d, -7))}
      onNextWeek={() => setWeekStart((d) => addDays(d, 7))}
      onToday={() => setWeekStart(startOfWeek(new Date()))}
      showMemberChip={!selectedMember}
      title={selectedMember ? `${selectedMember.display_name}'s week` : 'Entire team'}
      onEventClick={(ev) => {
        if (ev.href) window.location.assign(import.meta.env.BASE_URL + ev.href.replace(/^\//, ''))
      }}
    />
  )
}
