import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  FolderPlus,
  Hash,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Shield,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react'
import { APP_ROUTES } from '../../app/routes'
import { useAuth } from '../../contexts/AuthContext'
import { useAdminOverviewContext } from '../../contexts/AdminOverviewContext'
import { supabase } from '../../lib/supabase'
import { chatSupabase } from '../../lib/chatSupabase'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import { fetchKPIDefinitions, fetchKPIEntries, kpiKeys } from '../../lib/queries/kpi'
import { useToast } from '../Toast'
import CreateBookingModal from '../CreateBookingModal'
import type { TeamMember } from '../../types'
import type { EnrichedApprovalRequest } from '../../domain/dashboard/adminOverview'

// ─── Shared atoms ────────────────────────────────────────────────────

function todayEyebrow(): string {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase()
}

function TodayAnchor({ right }: { right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2 shrink-0">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-gold/70">
        TODAY · {todayEyebrow()}
      </p>
      {right}
    </div>
  )
}

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type Stage = 'deliver' | 'capture' | 'share' | 'attract' | 'book'
const STAGE_STYLES: Record<Stage, { dot: string; text: string; bg: string; ring: string; label: string }> = {
  deliver: { dot: 'bg-blue-400',   text: 'text-blue-300',   bg: 'bg-blue-500/5',   ring: 'ring-blue-500/15',   label: 'Deliver' },
  capture: { dot: 'bg-purple-400', text: 'text-purple-300', bg: 'bg-purple-500/5', ring: 'ring-purple-500/15', label: 'Capture' },
  share:   { dot: 'bg-cyan-400',   text: 'text-cyan-300',   bg: 'bg-cyan-500/5',   ring: 'ring-cyan-500/15',   label: 'Share'   },
  attract: { dot: 'bg-pink-400',   text: 'text-pink-300',   bg: 'bg-pink-500/5',   ring: 'ring-pink-500/15',   label: 'Attract' },
  book:    { dot: 'bg-orange-400', text: 'text-orange-300', bg: 'bg-orange-500/5', ring: 'ring-orange-500/15', label: 'Book'    },
}

// ─── Assign widget ───────────────────────────────────────────────────
//
// Big rectangle on the top-left of admin Hub. Three primary CTAs —
// Session, Task, Group — each opening a focused flow. Recent
// assignments strip below so admins see continuity of what they've
// been delegating without bouncing to the Templates page.

type RecentAssignment = {
  id: string
  kind: 'session' | 'task' | 'group'
  title: string
  assignee: string
  when: string
}

async function fetchRecentAssignments(limit = 4): Promise<RecentAssignment[]> {
  // Pulls the N most recent sessions (with assigned_to) + task_assignments
  // and stitches them into a unified "what did I just delegate" feed.
  const [sessionsRes, assignmentsRes, membersRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, client_name, session_type, session_date, start_time, assigned_to, created_at')
      .not('assigned_to', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('task_assignments')
      .select('id, intern_id, created_at, report_templates(name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('team_members')
      .select('id, display_name')
      .eq('status', 'active'),
  ])
  type NameRow = { id: string; display_name: string }
  const nameById = new Map<string, string>(
    ((membersRes.data ?? []) as NameRow[]).map((m) => [m.id, m.display_name]),
  )

  type SessionRow = {
    id: string
    client_name: string | null
    session_type: string
    session_date: string
    assigned_to: string | null
    created_at: string
  }
  // Supabase returns related rows as arrays even for 1:1 FKs, so normalize
  // via `unknown` then narrow. We only ever want the first template.
  type AssignmentRow = {
    id: string
    intern_id: string | null
    created_at: string
    report_templates: { name: string }[] | { name: string } | null
  }

  const sessionRows: RecentAssignment[] = ((sessionsRes.data ?? []) as SessionRow[]).map((s) => ({
    id: `sess-${s.id}`,
    kind: 'session',
    title: s.client_name ?? s.session_type.replace(/_/g, ' '),
    assignee: s.assigned_to ? nameById.get(s.assigned_to) ?? 'Someone' : 'Unassigned',
    when: s.created_at,
  }))
  const taskRows: RecentAssignment[] = ((assignmentsRes.data ?? []) as unknown as AssignmentRow[]).map((a) => {
    const tmpl = Array.isArray(a.report_templates) ? a.report_templates[0] : a.report_templates
    return {
      id: `task-${a.id}`,
      kind: 'group',
      title: tmpl?.name ?? 'Template',
      assignee: a.intern_id ? nameById.get(a.intern_id) ?? 'Someone' : 'Position-level',
      when: a.created_at,
    }
  })

  return [...sessionRows, ...taskRows]
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, limit)
}

type AssignFlow = 'session' | 'task' | 'group' | null

export function AdminAssignWidget() {
  const queryClient = useQueryClient()
  const [flow, setFlow] = useState<AssignFlow>(null)

  // Fetch ~12 recent assignments so the scrollable feed fills the 2×2
  // widget height without leaving a big empty block. The original 4-item
  // version left ~60% of the widget blank on a full-height grid row.
  const recentQuery = useQuery({
    queryKey: ['admin-recent-assignments'],
    queryFn: () => fetchRecentAssignments(12),
  })
  const recent = recentQuery.data ?? []

  // Roll up kind counts so the strip above the feed gives admins
  // something quantitative to anchor on.
  const counts = {
    sessions: recent.filter((r) => r.kind === 'session').length,
    tasks: recent.filter((r) => r.kind === 'task').length,
    groups: recent.filter((r) => r.kind === 'group').length,
  }

  const handleClose = () => {
    setFlow(null)
    void queryClient.invalidateQueries({ queryKey: ['admin-recent-assignments'] })
  }

  return (
    <div className="flex flex-col h-full">
      <TodayAnchor />

      {/* Three big primary CTAs — one per assignable thing. Taller
          (p-4 + bigger icons) so they read as primary actions rather
          than a pill strip. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0">
        <AssignTile
          tone="sky"
          icon={CalendarPlus}
          label="Session"
          hint="Book a studio session"
          count={counts.sessions}
          onClick={() => setFlow('session')}
        />
        <AssignTile
          tone="emerald"
          icon={Plus}
          label="Task"
          hint="Add one to a member's day"
          count={counts.tasks}
          onClick={() => setFlow('task')}
        />
        <AssignTile
          tone="violet"
          icon={FolderPlus}
          label="Task Group"
          hint="Apply a checklist template"
          count={counts.groups}
          onClick={() => setFlow('group')}
        />
      </div>

      {/* Recent assignments strip. Denser rows + scroll so a busy week
          fills the widget; a quiet week shows a centered empty state. */}
      <div className="mt-3 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-1.5 shrink-0">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-text-light">
            Recently assigned
          </p>
          {recent.length > 0 && (
            <span className="text-[10px] text-text-light">{recent.length} total</span>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-hidden -mx-1 space-y-0.5">
          {recentQuery.isLoading ? (
            <div className="flex items-center gap-2 px-2 py-2 text-text-light">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-[12px]">Loading…</span>
            </div>
          ) : recent.length === 0 ? (
            // Top-aligned empty state + "ideas to try" tips. Previously
            // this state was vertically centered inside a 2-row widget
            // cell which made the widget look like a giant void. The
            // tips now fill the space with something useful so the
            // widget feels intentional even on a fresh install.
            <div className="px-1 py-1 space-y-3">
              <div className="flex items-start gap-2.5 px-1">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-gold/10 ring-1 ring-gold/20 flex items-center justify-center">
                  <Sparkles size={15} className="text-gold" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-text leading-tight">Nothing assigned yet</p>
                  <p className="text-[11px] text-text-light leading-snug mt-0.5">
                    Pick a tile above to send out your first delegation.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/30 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-1 px-1">
                  Ideas to try
                </p>
                <AssignTip icon={CalendarPlus} tone="sky" text="Book next week's first session" />
                <AssignTip icon={Plus} tone="emerald" text="Drop a one-off task into a member's day" />
                <AssignTip icon={FolderPlus} tone="violet" text="Apply the Daily Checklist to a new hire" />
              </div>
            </div>
          ) : (
            recent.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-surface-hover/40 transition-colors"
              >
                <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                  r.kind === 'session' ? 'bg-sky-500/15 text-sky-300'
                  : r.kind === 'task'  ? 'bg-emerald-500/15 text-emerald-300'
                  :                      'bg-violet-500/15 text-violet-300'
                }`}>
                  {r.kind === 'session' ? <CalendarPlus size={13} />
                    : r.kind === 'task' ? <Plus size={13} />
                    : <FolderPlus size={13} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium text-text truncate leading-tight">{r.title}</p>
                  <p className="text-[10.5px] text-text-light truncate leading-tight">
                    {r.kind === 'session' ? 'Session' : r.kind === 'task' ? 'Task' : 'Task Group'} · {r.assignee}
                  </p>
                </div>
                <span className="text-[10px] text-text-light shrink-0">{relativeTime(r.when)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Flow modals */}
      {flow === 'session' && <CreateBookingModal onClose={handleClose} />}
      {flow === 'task' && <AssignTaskModal onClose={handleClose} />}
      {flow === 'group' && <AssignGroupModal onClose={handleClose} />}
    </div>
  )
}

// Inline tip row — mirrors the kind-icon styling of the tile row so
// empty-state hints feel like "here's what each tile does" rather
// than generic tutorial copy.
function AssignTip({
  icon: Icon,
  tone,
  text,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  tone: 'sky' | 'emerald' | 'violet'
  text: string
}) {
  const toneMap = {
    sky:     'bg-sky-500/10 text-sky-300',
    emerald: 'bg-emerald-500/10 text-emerald-300',
    violet:  'bg-violet-500/10 text-violet-300',
  }[tone]
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${toneMap}`}>
        <Icon size={12} />
      </div>
      <p className="text-[12px] text-text-muted leading-snug">{text}</p>
    </div>
  )
}

function AssignTile({
  tone,
  icon: Icon,
  label,
  hint,
  count,
  onClick,
}: {
  tone: 'sky' | 'emerald' | 'violet'
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  hint: string
  count?: number
  onClick: () => void
}) {
  const toneMap = {
    sky:     { ring: 'ring-sky-500/40',     bg: 'bg-sky-500/10',     text: 'text-sky-300',     hover: 'hover:bg-sky-500/20'     },
    emerald: { ring: 'ring-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-300', hover: 'hover:bg-emerald-500/20' },
    violet:  { ring: 'ring-violet-500/40',  bg: 'bg-violet-500/10',  text: 'text-violet-300',  hover: 'hover:bg-violet-500/20'  },
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left p-3.5 rounded-xl ring-1 ${toneMap.ring} ${toneMap.bg} ${toneMap.hover} transition-colors focus-ring`}
    >
      <div className="flex items-start justify-between">
        <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${toneMap.text} bg-surface/70`}>
          <Icon size={19} />
        </div>
        {count !== undefined && count > 0 && (
          <span className={`text-[11px] font-bold ${toneMap.text} tabular-nums`}>{count}</span>
        )}
      </div>
      <p className={`mt-2 text-[15px] font-bold ${toneMap.text} leading-tight`}>{label}</p>
      <p className="text-[11px] text-text-light leading-snug mt-0.5">{hint}</p>
    </button>
  )
}

// ─── AssignTaskModal — adds ONE item to a member's daily checklist ──

function AssignTaskModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const [memberId, setMemberId] = useState('')
  const [text, setText] = useState('')
  const [category, setCategory] = useState('Ad-hoc')
  const [saving, setSaving] = useState(false)

  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })
  const members = (teamQuery.data ?? []).filter((m) => m.status?.toLowerCase() !== 'inactive')

  const submit = async () => {
    if (!memberId || !text.trim()) return
    setSaving(true)
    try {
      // Find today's daily instance for that member, create it if missing.
      const today = new Date().toISOString().slice(0, 10)
      const { data: existing } = await supabase
        .from('team_checklist_instances')
        .select('id')
        .eq('intern_id', memberId)
        .eq('frequency', 'daily')
        .eq('period_date', today)
        .maybeSingle()
      let instanceId = existing?.id
      if (!instanceId) {
        const { data: created, error: createErr } = await supabase
          .from('team_checklist_instances')
          .insert({ intern_id: memberId, frequency: 'daily', period_date: today })
          .select('id')
          .single()
        if (createErr) throw createErr
        instanceId = created!.id
      }
      const { error: itemErr } = await supabase
        .from('team_checklist_items')
        .insert({
          instance_id: instanceId,
          category,
          item_text: text.trim(),
          sort_order: Date.now() % 100000,
        })
      if (itemErr) throw itemErr
      toast('Task assigned', 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to assign task', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-text">Assign a Task</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover" aria-label="Close">
            <X size={16} className="text-text-light" />
          </button>
        </div>
        <p className="text-[12px] text-text-light">
          Adds one item to today's daily checklist for the chosen member.
        </p>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">Member</span>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
          >
            <option value="">Pick a teammate…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">Task</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Edit the Thursday BTS reel"
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">Category</span>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-text-light hover:text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!memberId || !text.trim() || saving}
            className="px-4 py-2 rounded-lg bg-gold text-black text-sm font-bold disabled:opacity-50 hover:bg-gold-muted"
          >
            {saving ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AssignGroupModal — wires a template to a member ────────────────

type TemplateRow = { id: string; name: string; type: string; position: string | null }

function AssignGroupModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const { profile } = useAuth()
  const [memberId, setMemberId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [saving, setSaving] = useState(false)

  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })
  const members = (teamQuery.data ?? []).filter((m) => m.status?.toLowerCase() !== 'inactive')

  useEffect(() => {
    supabase
      .from('report_templates')
      .select('id, name, type, position')
      .order('name')
      .then(({ data }) => setTemplates((data ?? []) as TemplateRow[]))
  }, [])

  const submit = async () => {
    if (!memberId || !templateId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('task_assignments')
        .insert({
          template_id: templateId,
          intern_id: memberId,
          is_active: true,
          assigned_by: profile?.id ?? null,
        })
      if (error) throw error
      toast('Task group assigned', 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to assign group', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-text">Assign a Task Group</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover" aria-label="Close">
            <X size={16} className="text-text-light" />
          </button>
        </div>
        <p className="text-[12px] text-text-light">Applies a checklist template to the chosen member.</p>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">Member</span>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
          >
            <option value="">Pick a teammate…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">Template</span>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
          >
            <option value="">Pick a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-text-light hover:text-text">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!memberId || !templateId || saving}
            className="px-4 py-2 rounded-lg bg-gold text-black text-sm font-bold disabled:opacity-50 hover:bg-gold-muted"
          >
            {saving ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Flywheel widget ─────────────────────────────────────────────────
//
// Team-wide snapshot of the 5 flywheel stages. Each row shows the
// stage, current aggregate KPI progress (% of target), and a mini bar.
// Links to /admin/health for the full analytics page.

type StageKey = Lowercase<'Deliver' | 'Capture' | 'Share' | 'Attract' | 'Book'>

export function AdminFlywheelWidget() {
  const defsQuery = useQuery({
    queryKey: kpiKeys.definitions(),
    queryFn: fetchKPIDefinitions,
  })
  const entriesQuery = useQuery({
    queryKey: kpiKeys.entries(),
    queryFn: fetchKPIEntries,
  })

  const loading = defsQuery.isLoading || entriesQuery.isLoading
  const error = defsQuery.error ?? entriesQuery.error

  const stages = useMemo(() => {
    const defs = defsQuery.data ?? []
    const entries = entriesQuery.data ?? []
    const byStage = new Map<StageKey, { defs: typeof defs; totalPct: number; count: number }>()
    for (const d of defs) {
      const stage = d.flywheel_stage as StageKey
      const bucket = byStage.get(stage) ?? { defs: [], totalPct: 0, count: 0 }
      const kpiEntries = entries.filter((e) => e.kpi_id === d.id)
      const latest = kpiEntries[kpiEntries.length - 1]?.value
      if (d.target_value && latest != null) {
        const pct = Math.min(100, Math.round((Number(latest) / Number(d.target_value)) * 100))
        bucket.totalPct += pct
        bucket.count += 1
      }
      bucket.defs.push(d)
      byStage.set(stage, bucket)
    }
    const stageOrder: StageKey[] = ['deliver', 'capture', 'share', 'attract', 'book']
    return stageOrder.map((key) => {
      const s = STAGE_STYLES[key]
      const bucket = byStage.get(key)
      const pct = bucket && bucket.count > 0 ? Math.round(bucket.totalPct / bucket.count) : null
      return {
        key,
        label: s.label,
        style: s,
        pct,
        kpiCount: bucket?.defs.length ?? 0,
      }
    })
  }, [defsQuery.data, entriesQuery.data])

  // Summary figures for the header strip — total KPIs tracked + overall
  // aggregate % (average of the stages that have data). Gives admins
  // something quantitative at the top of the widget instead of making
  // them scan every bar.
  const totalKpis = stages.reduce((acc, s) => acc + s.kpiCount, 0)
  const backedStages = stages.filter((s) => s.pct !== null)
  const overallPct = backedStages.length > 0
    ? Math.round(backedStages.reduce((acc, s) => acc + (s.pct ?? 0), 0) / backedStages.length)
    : null

  return (
    <div className="flex flex-col h-full">
      <TodayAnchor
        right={
          !loading && !error && overallPct !== null ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 ring-1 ring-gold/40 text-gold text-[10px] font-bold tracking-wider uppercase">
              <Target size={9} /> {overallPct}% overall
            </span>
          ) : null
        }
      />

      {/* KPI summary strip — shows how many KPIs exist + how many
          stages currently have data. Without this the widget's header
          is just a date and feels empty on a 2-row-tall card. */}
      {!loading && !error && (
        <div className="grid grid-cols-2 gap-2 mb-3 shrink-0">
          <div className="rounded-lg bg-surface-alt/60 border border-border/50 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-text-light font-semibold">KPIs Tracked</p>
            <p className="text-[18px] font-bold text-text tabular-nums leading-tight mt-0.5">{totalKpis}</p>
          </div>
          <div className="rounded-lg bg-surface-alt/60 border border-border/50 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-text-light font-semibold">Stages With Data</p>
            <p className="text-[18px] font-bold text-text tabular-nums leading-tight mt-0.5">
              {backedStages.length}<span className="text-text-light text-[14px]">/5</span>
            </p>
          </div>
        </div>
      )}

      {/* Stage bars — each row is bigger so five of them fill the
          remaining space without needing justify-center spacing. */}
      <div className="flex-1 min-h-0 space-y-2.5">
        {loading ? (
          <div className="h-full flex items-center justify-center text-text-light">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="h-full flex items-center gap-2 text-sm text-amber-300 px-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="truncate">Could not load KPI data</span>
          </div>
        ) : (
          stages.map((s) => (
            <div key={s.key} className="rounded-lg bg-surface-alt/40 border border-border/40 px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`inline-flex items-center gap-2 text-[13px] font-bold ${s.style.text}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${s.style.dot}`} aria-hidden="true" />
                  {s.label}
                </span>
                <span className="text-[12px] tabular-nums text-text font-semibold">
                  {s.pct === null ? <span className="text-text-light italic font-normal">no KPI yet</span> : `${s.pct}%`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${s.pct === null ? '' : s.style.dot}`}
                  style={{ width: `${s.pct ?? 4}%`, opacity: s.pct === null ? 0.25 : 1 }}
                />
              </div>
              <p className="text-[10px] text-text-light mt-1">
                {s.kpiCount === 0 ? 'Tracking zero KPIs' : `${s.kpiCount} KPI${s.kpiCount === 1 ? '' : 's'} linked`}
              </p>
            </div>
          ))
        )}
      </div>

    </div>
  )
}

// ─── Notifications widget (admin) ───────────────────────────────────
//
// Reuses the same `get_channel_notifications` RPC as the member widget
// (src/components/dashboard/memberOverviewWidgets.tsx) but adds two
// admin-only quick actions: + Post (to any channel) and + Channel
// (create a new #channel). Unread tracking is shared user-state.

type ChannelNotification = {
  channel_id: string
  channel_name: string
  channel_slug: string
  unread_count: number
  latest_id: string | null
  latest_content: string | null
  latest_sender: string | null
  latest_initial: string | null
  latest_created_at: string | null
  last_read_at: string | null
}

async function fetchChannelNotifications(): Promise<ChannelNotification[]> {
  const { data, error } = await supabase.rpc('get_channel_notifications')
  if (error) throw error
  return (data ?? []) as ChannelNotification[]
}

async function markChannelRead(channelId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_channel_read', { p_channel_id: channelId })
  if (error) throw error
}

export function AdminNotificationsWidget() {
  const queryClient = useQueryClient()
  const [postOpen, setPostOpen] = useState(false)
  const [channelOpen, setChannelOpen] = useState(false)

  const notifQuery = useQuery({
    queryKey: ['overview-notifications'],
    queryFn: fetchChannelNotifications,
    refetchInterval: 60_000,
  })

  useEffect(() => {
    const sub = supabase
      .channel('hub-admin-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['overview-notifications'] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(sub)
    }
  }, [queryClient])

  const channels = notifQuery.data ?? []
  const totalUnread = channels.reduce((acc, c) => acc + (c.unread_count ?? 0), 0)

  const handleChannelClick = (channelId: string) => {
    queryClient.setQueryData<ChannelNotification[]>(['overview-notifications'], (prev) =>
      prev?.map((c) => (c.channel_id === channelId ? { ...c, unread_count: 0 } : c)) ?? prev,
    )
    void markChannelRead(channelId).catch(() => {
      void queryClient.invalidateQueries({ queryKey: ['overview-notifications'] })
    })
  }

  return (
    <div className="flex flex-col h-full">
      <TodayAnchor
        right={
          totalUnread > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 ring-1 ring-rose-500/40 text-rose-300 text-[10px] font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" aria-hidden="true" />
              {totalUnread} New
            </span>
          ) : null
        }
      />

      {/* Admin quick-actions: post + create channel. */}
      <div className="grid grid-cols-2 gap-2 mb-2 shrink-0">
        <button
          type="button"
          onClick={() => setPostOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-gold/15 text-gold ring-1 ring-gold/30 text-[11px] font-bold hover:bg-gold/25 transition-colors"
        >
          <Send size={12} /> Post
        </button>
        <button
          type="button"
          onClick={() => setChannelOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-surface-alt text-text ring-1 ring-border text-[11px] font-bold hover:bg-surface-hover transition-colors"
        >
          <Hash size={12} /> Channel
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden -mx-1">
        {notifQuery.isLoading ? (
          <div className="h-full flex items-center justify-center text-text-light">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : notifQuery.error ? (
          <div className="h-full flex items-center gap-2 text-sm text-amber-300 px-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="truncate">Could not load notifications</span>
          </div>
        ) : channels.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold/10 ring-1 ring-gold/20 mb-2">
              <MessageSquare size={18} className="text-gold" aria-hidden="true" />
            </div>
            <p className="text-[13px] font-medium text-text">No channels</p>
            <p className="text-[11px] text-text-light mt-0.5">Hit Channel to create one.</p>
          </div>
        ) : (
          channels.map((c) => {
            const unread = c.unread_count > 0
            const initial = c.latest_initial ?? '#'
            return (
              <Link
                key={c.channel_id}
                to={`${APP_ROUTES.member.content}${c.channel_slug ? `?channel=${c.channel_slug}` : ''}`}
                onClick={() => handleChannelClick(c.channel_id)}
                className={`group flex items-start gap-2 px-1.5 py-1.5 rounded-lg transition-colors ${
                  unread ? 'bg-gold/5 hover:bg-gold/10' : 'hover:bg-surface-hover/40'
                }`}
              >
                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold ${
                  unread
                    ? 'bg-gold/20 ring-1 ring-gold/50 text-gold'
                    : 'bg-surface-alt border border-border-light text-text-muted'
                }`}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-[12px] truncate ${unread ? 'font-bold text-text' : 'font-semibold text-text-muted'}`}>
                      #{c.channel_name}
                    </p>
                    {unread && (
                      <span className="shrink-0 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold leading-none tabular-nums">
                        {c.unread_count > 9 ? '9+' : c.unread_count}
                      </span>
                    )}
                  </div>
                  {c.latest_id && (
                    <p className={`text-[11px] truncate ${unread ? 'text-text' : 'text-text-light'}`}>
                      <span className="font-medium">{c.latest_sender}:</span>{' '}
                      {c.latest_content}
                    </p>
                  )}
                </div>
              </Link>
            )
          })
        )}
      </div>

      {postOpen && <PostToChannelModal channels={channels} onClose={() => { setPostOpen(false); void notifQuery.refetch() }} />}
      {channelOpen && <CreateChannelModal onClose={() => { setChannelOpen(false); void notifQuery.refetch() }} />}
    </div>
  )
}

function PostToChannelModal({
  channels,
  onClose,
}: {
  channels: ChannelNotification[]
  onClose: () => void
}) {
  const { toast } = useToast()
  const { profile } = useAuth()
  const [channelId, setChannelId] = useState(channels[0]?.channel_id ?? '')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!channelId || !content.trim()) return
    setSaving(true)
    try {
      const name = profile?.display_name ?? 'Admin'
      const { error } = await chatSupabase.from('chat_messages').insert({
        channel_id: channelId,
        sender_name: name,
        sender_id: profile?.id ?? 'admin',
        sender_initial: name.charAt(0).toUpperCase(),
        content: content.trim(),
      })
      if (error) throw error
      toast('Posted', 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Post failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-text">Post to Forum</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover" aria-label="Close">
            <X size={16} className="text-text-light" />
          </button>
        </div>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">Channel</span>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
          >
            {channels.map((c) => (
              <option key={c.channel_id} value={c.channel_id}>#{c.channel_name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">Message</span>
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What do you want the team to know?"
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-text-light hover:text-text">Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={!channelId || !content.trim() || saving}
            className="px-4 py-2 rounded-lg bg-gold text-black text-sm font-bold disabled:opacity-50 hover:bg-gold-muted inline-flex items-center gap-1.5"
          >
            <Send size={13} /> {saving ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateChannelModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const { profile } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const cleaned = name.trim()
    if (!cleaned) return
    setSaving(true)
    try {
      const slug = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      const { error } = await chatSupabase.from('chat_channels').insert({
        name: cleaned,
        slug,
        description: description.trim() || null,
        created_by: profile?.display_name ?? 'Admin',
      })
      if (error) throw error
      toast(`Channel #${cleaned} created`, 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create channel failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-text">New Channel</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover" aria-label="Close">
            <X size={16} className="text-text-light" />
          </button>
        </div>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">Channel name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Releases"
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-light">Description (optional)</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this channel for?"
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm focus-ring"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-text-light hover:text-text">Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || saving}
            className="px-4 py-2 rounded-lg bg-gold text-black text-sm font-bold disabled:opacity-50 hover:bg-gold-muted"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Team widget (admin) ────────────────────────────────────────────
//
// Horizontal avatar strip of active teammates. Nothing corporate —
// first names, gold initials, status dots (active = emerald), role
// chips underneath. Click a tile = profile. Admins get a + tile at
// the end to jump to Team Manager.

export function AdminTeamWidget() {
  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })

  const members = (teamQuery.data ?? []).filter((m) => m.status?.toLowerCase() !== 'inactive')

  return (
    <div className="flex flex-col h-full">
      <TodayAnchor
        right={
          <span className="text-[10px] font-semibold tracking-wider text-text-light uppercase">
            {members.length} active
          </span>
        }
      />

      <div className="flex-1 min-h-0">
        {teamQuery.isLoading ? (
          <div className="flex items-center gap-2 px-2 py-2 text-text-light">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-[12px]">Loading…</span>
          </div>
        ) : teamQuery.error ? (
          <div className="flex items-center gap-2 text-sm text-amber-300 px-2 py-2">
            <AlertCircle size={14} className="shrink-0" />
            <span className="text-[12px] truncate">Could not load team</span>
          </div>
        ) : members.length === 0 ? (
          // Top-aligned empty state to match the Assign widget — keeps
          // the widget from looking hollowed out when the team is empty.
          <div className="flex items-start gap-2.5 px-1 py-1">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-gold/10 ring-1 ring-gold/20 flex items-center justify-center">
              <Users size={15} className="text-gold" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-text leading-tight">No active members yet</p>
              <p className="text-[11px] text-text-light leading-snug mt-0.5">
                Invite the crew from Team Manager — they'll show up here with online dots.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 py-2">
            {members.map((m: TeamMember) => {
              const initial = m.display_name.charAt(0).toUpperCase()
              const firstName = m.display_name.split(' ')[0] ?? m.display_name
              const isAdmin = m.role === 'admin'
              return (
                <Link
                  key={m.id}
                  to={`/profile/${m.id}`}
                  title={`${m.display_name}${m.position ? ` — ${m.position}` : ''}`}
                  className="group flex flex-col items-center gap-1 w-[60px] focus-ring rounded-lg"
                >
                  <div className="relative">
                    <div className="w-11 h-11 rounded-full bg-surface-alt border-2 border-border-light text-gold flex items-center justify-center text-[14px] font-bold group-hover:border-gold/60 transition-colors">
                      {initial}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-surface" aria-hidden="true" />
                  </div>
                  <span className="text-[11px] font-semibold text-text truncate max-w-full">{firstName}</span>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full bg-gold/15 text-gold text-[9px] font-bold uppercase tracking-wider">
                      <Shield size={7} /> Admin
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Approvals widget ───────────────────────────────────────────────
//
// Pulls pending task_edit_requests from the shared AdminOverviewContext
// (already memoized + enriched with requester names). Inline approve /
// reject via the `approve_task_edit_request` RPC and direct UPDATE.
// If there are zero, show a friendly all-caught-up state instead of a
// bare "0" number.

function ApprovalStat({
  label,
  count,
  tone,
}: {
  label: string
  count: number
  tone: 'emerald' | 'sky' | 'rose'
}) {
  const toneMap = {
    emerald: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/30',
    sky: 'text-sky-300 bg-sky-500/10 ring-sky-500/30',
    rose: 'text-rose-300 bg-rose-500/10 ring-rose-500/30',
  }[tone]
  return (
    <div className={`rounded-lg ring-1 px-2 py-1.5 ${toneMap}`}>
      <p className="text-[9px] uppercase tracking-wider font-semibold leading-none">{label}</p>
      <p className="text-[16px] font-bold tabular-nums leading-tight mt-0.5">{count}</p>
    </div>
  )
}

export function AdminApprovalsWidget() {
  const { approvalRequests, loading, error, refetch } = useAdminOverviewContext()
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const requests = approvalRequests

  const approve = async (req: EnrichedApprovalRequest) => {
    setBusyId(req.id)
    const { error: err } = await supabase.rpc('approve_task_edit_request', {
      p_request_id: req.id,
      p_apply_to_template: true,
    })
    setBusyId(null)
    if (err) {
      toast(err.message || 'Approve failed', 'error')
      return
    }
    toast('Approved', 'success')
    await refetch()
  }

  const reject = async (req: EnrichedApprovalRequest) => {
    setBusyId(req.id)
    const { error: err } = await supabase
      .from('task_edit_requests')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', req.id)
    setBusyId(null)
    if (err) {
      toast(err.message || 'Reject failed', 'error')
      return
    }
    toast('Rejected', 'success')
    await refetch()
  }

  // Split by change type so the summary chips at top convey what's
  // actually pending at a glance.
  const byType = {
    add: requests.filter((r) => r.change_type === 'add').length,
    rename: requests.filter((r) => r.change_type === 'rename').length,
    delete: requests.filter((r) => r.change_type === 'delete').length,
  }

  return (
    <div className="flex flex-col h-full">
      <TodayAnchor
        right={
          requests.length > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 ring-1 ring-amber-500/40 text-amber-300 text-[10px] font-bold tracking-wider uppercase">
              <Clock size={9} /> {requests.length} pending
            </span>
          ) : null
        }
      />

      {/* Summary chips — adds / renames / deletes. Gives the 1×2 widget
          something to render above the list so it never looks empty
          even when the list is short. */}
      {!loading && !error && requests.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mb-3 shrink-0">
          <ApprovalStat label="Adds" count={byType.add} tone="emerald" />
          <ApprovalStat label="Renames" count={byType.rename} tone="sky" />
          <ApprovalStat label="Deletes" count={byType.delete} tone="rose" />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden -mx-1 space-y-1">
        {loading ? (
          <div className="h-full flex items-center justify-center text-text-light">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="h-full flex items-center gap-2 text-sm text-amber-300 px-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="truncate">Could not load approvals</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
              <CheckCircle2 size={26} className="text-emerald-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-text">All caught up</p>
              <p className="text-[12px] text-text-light mt-1 leading-relaxed max-w-[220px]">
                No pending approvals. Task edit requests from the team will show up here with one-click Approve / Reject.
              </p>
            </div>
          </div>
        ) : (
          requests.map((req) => {
            const busy = busyId === req.id
            const action = req.change_type === 'add' ? 'add'
                        : req.change_type === 'delete' ? 'remove'
                        : 'rename'
            return (
              <div
                key={req.id}
                className="px-2 py-2 rounded-lg bg-surface-alt/40 border border-border/40 hover:bg-surface-hover/30 transition-colors"
              >
                <p className="text-[12px] text-text leading-snug">
                  <span className="font-semibold">{req.requester_display_name}</span>
                  <span className="text-text-light"> wants to </span>
                  <span className="font-medium">{action}</span>
                </p>
                <p className="text-[11px] text-text-muted truncate mt-0.5">
                  {req.proposed_text ?? req.previous_text ?? '(no text)'}
                </p>
                <div className="flex gap-1.5 mt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => approve(req)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 text-[10px] font-bold hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                  >
                    <Check size={10} /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => reject(req)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-alt text-text-muted ring-1 ring-border text-[10px] font-bold hover:text-rose-300 hover:ring-rose-500/30 transition-colors disabled:opacity-50"
                  >
                    <X size={10} /> Reject
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

    </div>
  )
}
