import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Bell,
  CalendarPlus,
  Check,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  Clock,
  Hash,
  Inbox,
  Loader2,
  MessageSquare,
  Send,
  Shield,
  Target,
  Users,
  X,
} from 'lucide-react'
import { APP_ROUTES } from '../../app/routes'
import { useAuth } from '../../contexts/AuthContext'
import { useAdminOverviewContext } from '../../contexts/AdminOverviewContext'
import { supabase } from '../../lib/supabase'
import {
  fetchAssignmentNotifications,
  fetchTeamAssignedTasks,
  markAllAssignmentNotificationsRead,
  markAssignmentNotificationRead,
} from '../../lib/queries/assignments'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import { fetchKPIDefinitions, fetchKPIEntries, kpiKeys } from '../../lib/queries/kpi'
import { useToast } from '../Toast'
import CreateBookingModal from '../CreateBookingModal'
import MultiTaskCreateModal from '../tasks/requests/MultiTaskCreateModal'
import TaskReassignRequestModal from '../tasks/TaskReassignRequestModal'
import type { TeamMember } from '../../types'
import type { AssignmentNotification } from '../../types/assignments'
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

type Stage = 'deliver' | 'capture' | 'share' | 'attract' | 'book'
const STAGE_STYLES: Record<Stage, { dot: string; text: string; bg: string; ring: string; label: string }> = {
  deliver: { dot: 'bg-blue-400',   text: 'text-blue-300',   bg: 'bg-blue-500/5',   ring: 'ring-blue-500/15',   label: 'Deliver' },
  capture: { dot: 'bg-violet-400', text: 'text-violet-300', bg: 'bg-violet-500/5', ring: 'ring-violet-500/15', label: 'Capture' },
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

// PR #41 reorg — Assign widget shrinks to 2 tiles (Task + Session)
// per the sketch. Studio task is now reachable via the scope toggle
// inside AdminTaskCreateModal; Task-Group / template-based assignment
// will be folded into the Task modal's "Add from template" flow in
// PR #42, replacing the standalone AssignGroupModal tile.
type AssignFlow = 'session' | 'task' | null

export function AdminAssignWidget() {
  const queryClient = useQueryClient()
  const [flow, setFlow] = useState<AssignFlow>(null)

  const handleClose = () => {
    setFlow(null)
    // Keep the invalidate so `RecentAssignmentsSection` on the
    // Assign page refreshes after a flow closes. The feed is no
    // longer rendered inside this widget (PR #21) — per user's
    // spec the 3 tiles stay always visible and history lives in
    // the full-width strip below the 3-column board.
    void queryClient.invalidateQueries({ queryKey: ['admin-recent-assignments'] })
  }

  return (
    <div className="flex flex-col h-full justify-center">
      {/* Two primary CTAs — always visible, no internal scroll.
          PR #47: compacted to a twin-button row matching the Edit
          widget's pattern so the two widgets read as a visually
          consistent pair in col 2 (Assign on top of Edit) at the
          same rowSpan 0.5 height. Hint text dropped — Members /
          Studio toggle is discoverable once the modal opens. */}
      <div className="grid grid-cols-2 gap-2">
        <AssignTile
          icon={CheckSquare}
          label="+Task"
          onClick={() => setFlow('task')}
        />
        <AssignTile
          icon={CalendarPlus}
          label="+Booking"
          onClick={() => setFlow('session')}
        />
      </div>

      {/* Flow modals — Session uses the existing booking flow; Task
          opens the new row-by-row MultiTaskCreateModal (PR #42) with
          a Members/Studio toggle + Add-from-template sub-flow. */}
      {flow === 'session' && <CreateBookingModal onClose={handleClose} />}
      {flow === 'task' && <MultiTaskCreateModal onClose={handleClose} />}
    </div>
  )
}

// AssignTile — PR #47: compact twin-button form matching the Edit
// widget's `EditButton` so Assign + Edit stack as a visually
// consistent pair in col 2 of the Assign page. Icon + label inline,
// no hint text. Same gradient + ring treatment as EditButton.
function AssignTile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-bold bg-gradient-to-b from-gold/15 to-gold/5 text-gold ring-1 ring-gold/30 hover:from-gold/20 hover:to-gold/10 transition-colors focus-ring"
    >
      <Icon size={14} />
      {label}
    </button>
  )
}

// ─── AssignGroupModal removed (PR #41) ─────────────────────────────
// PR #11 introduced this as the standalone "apply a template
// wholesale" flow behind a 3rd Assign tile. PR #41 reduces the
// Assign widget to 2 tiles per the user sketch. PR #42 will revive
// the template-application flow as an "Add from template" sub-flow
// inside the new row-by-row +Task modal — letting admins pick which
// items from a template to add, instead of applying it wholesale.
// Until #42 lands, the full Assign wizard on /admin/templates
// covers the gap.



// ─── Flywheel widget ─────────────────────────────────────────────────
//
// Team-wide snapshot of the 5 flywheel stages. Each row shows the
// stage, current aggregate KPI progress (% of target), and a mini bar.
// Links to /admin/health for the full analytics page.

type StageKey = Lowercase<'Deliver' | 'Capture' | 'Share' | 'Attract' | 'Book'>

export function AdminFlywheelWidget() {
  const { profile } = useAuth()
  const defsQuery = useQuery({
    queryKey: kpiKeys.definitions(),
    queryFn: fetchKPIDefinitions,
  })
  const entriesQuery = useQuery({
    queryKey: kpiKeys.entries(),
    queryFn: fetchKPIEntries,
  })
  // PR #27 — pull team-wide assigned_tasks so the flywheel reflects
  // real task activity per stage. Completed = opaque, assigned-but-
  // not-yet-done = translucent in the bar below each stage. Same
  // cache key the Tasks page + member widgets use, so the fetch is
  // deduped by react-query.
  const tasksQuery = useQuery({
    queryKey: ['team-assigned-tasks', profile?.id ?? 'none', 'all'] as const,
    queryFn: () => fetchTeamAssignedTasks(profile!.id, { includeCompleted: true }),
    enabled: Boolean(profile?.id),
  })

  // PR #28 — include tasksQuery in the loading + error surface so
  // the widget doesn't silently show "no tasks tagged" while the
  // team task RPC is still in flight or has failed.
  const loading = defsQuery.isLoading || entriesQuery.isLoading || tasksQuery.isLoading
  const error = defsQuery.error ?? entriesQuery.error ?? tasksQuery.error

  const stages = useMemo(() => {
    const defs = defsQuery.data ?? []
    const entries = entriesQuery.data ?? []
    const tasks = tasksQuery.data ?? []

    // Task category strings are Title-cased ('Deliver', ...) — the
    // FlywheelStagePicker emits exactly these. Normalize to the
    // lowercase StageKey used for lookups against STAGE_STYLES.
    const tasksByStage = new Map<StageKey, { total: number; completed: number }>()
    for (const t of tasks) {
      if (!t.category) continue
      const key = t.category.toLowerCase() as StageKey
      if (!['deliver', 'capture', 'share', 'attract', 'book'].includes(key)) continue
      const bucket = tasksByStage.get(key) ?? { total: 0, completed: 0 }
      bucket.total += 1
      if (t.is_completed) bucket.completed += 1
      tasksByStage.set(key, bucket)
    }

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
      const taskStats = tasksByStage.get(key) ?? { total: 0, completed: 0 }
      return {
        key,
        label: s.label,
        style: s,
        pct,
        kpiCount: bucket?.defs.length ?? 0,
        taskTotal: taskStats.total,
        taskCompleted: taskStats.completed,
      }
    })
  }, [defsQuery.data, entriesQuery.data, tasksQuery.data])

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
          stages.map((s) => {
            // PR #27 — Task-completion portion of the bar. Each stage
            // now surfaces real task activity: opaque = completed,
            // translucent = assigned-but-not-yet-done. Empty background
            // (zero tasks tagged) shows neutral surface.
            const taskPct = s.taskTotal > 0
              ? Math.round((s.taskCompleted / s.taskTotal) * 100)
              : 0
            const openCount = s.taskTotal - s.taskCompleted
            return (
              <div key={s.key} className="rounded-lg bg-surface-alt/40 border border-border/40 px-3 py-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`inline-flex items-center gap-2 text-[13px] font-bold ${s.style.text}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${s.style.dot}`} aria-hidden="true" />
                    {s.label}
                  </span>
                  <span className="text-[12px] tabular-nums text-text font-semibold">
                    {s.taskTotal > 0 ? (
                      <span>
                        {s.taskCompleted}<span className="text-text-light">/{s.taskTotal}</span>
                      </span>
                    ) : s.pct !== null ? (
                      `${s.pct}%`
                    ) : (
                      <span className="text-text-light italic font-normal">no tasks tagged</span>
                    )}
                  </span>
                </div>
                {/* Dual-opacity task bar: opaque completed segment +
                    translucent assigned-but-open segment on the same
                    track. Full width when all tasks done; empty when
                    no tasks tagged to this stage. */}
                <div className="h-2 rounded-full bg-surface overflow-hidden relative">
                  {s.taskTotal > 0 ? (
                    <div className="absolute inset-0 flex">
                      <div
                        className={`h-full ${s.style.dot} transition-all duration-500`}
                        style={{ width: `${taskPct}%` }}
                        aria-label={`${s.taskCompleted} completed`}
                      />
                      <div
                        className={`h-full ${s.style.dot} transition-all duration-500`}
                        style={{
                          width: `${100 - taskPct}%`,
                          opacity: 0.3,
                        }}
                        aria-label={`${openCount} open`}
                      />
                    </div>
                  ) : (
                    // Fallback: if no tasks tagged, show the KPI-based
                    // bar so the widget isn't empty on a fresh install.
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${s.pct === null ? '' : s.style.dot}`}
                      style={{ width: `${s.pct ?? 4}%`, opacity: s.pct === null ? 0.25 : 1 }}
                    />
                  )}
                </div>
                <p className="text-[10px] text-text-light mt-1">
                  {s.taskTotal > 0 ? (
                    <>
                      {s.taskCompleted} done · {openCount} open
                      {s.kpiCount > 0 && ` · ${s.kpiCount} KPI${s.kpiCount === 1 ? '' : 's'}`}
                    </>
                  ) : s.kpiCount === 0 ? (
                    'Tracking zero KPIs · no tasks tagged'
                  ) : (
                    `${s.kpiCount} KPI${s.kpiCount === 1 ? '' : 's'} linked · no tasks tagged`
                  )}
                </p>
              </div>
            )
          })
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

// PR #48 — bulk-acknowledge every channel for the caller. Mirrors the
// helper in memberOverviewWidgets; both widgets share the underlying
// RPC and the same react-query cache keys so a single click on either
// page invalidates both.
async function markAllChannelsRead(): Promise<{ channels_marked: number }> {
  const { data, error } = await supabase.rpc('mark_all_channels_read')
  if (error) throw error
  return data as { channels_marked: number }
}

export function AdminNotificationsWidget() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const [postOpen, setPostOpen] = useState(false)
  const [channelOpen, setChannelOpen] = useState(false)
  // PR #39 — mirror the member-side reassign modal so admins can
  // approve/decline peer-to-peer reassignment requests from the Hub
  // (matching the ForumNotificationsWidget wiring on Overview).
  const [reassignModalOpen, setReassignModalOpen] = useState(false)

  const notifQuery = useQuery({
    queryKey: ['overview-notifications'],
    queryFn: fetchChannelNotifications,
    refetchInterval: 60_000,
  })

  // PR #7 — same assignment-notifications fetch admins use. Admins
  // see their own assignment events here (rare — admins don't usually
  // receive assignments — but symmetric with the member widget).
  const assignmentsQuery = useQuery({
    queryKey: ['overview-assignment-notifications', profile?.id],
    queryFn: () => fetchAssignmentNotifications(profile!.id, { unreadOnly: false, limit: 20 }),
    enabled: Boolean(profile?.id),
    refetchInterval: 60_000,
  })

  useEffect(() => {
    const chatSub = supabase
      .channel('hub-admin-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['overview-notifications'] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(chatSub)
    }
  }, [queryClient])

  useEffect(() => {
    if (!profile?.id) return
    const sub = supabase
      .channel(`hub-admin-assignment-notifications:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assignment_notifications',
          filter: `recipient_id=eq.${profile.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['overview-assignment-notifications', profile.id] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(sub)
    }
  }, [queryClient, profile?.id])

  const channels = notifQuery.data ?? []
  const channelUnread = channels.reduce((acc, c) => acc + (c.unread_count ?? 0), 0)
  const assignments = assignmentsQuery.data ?? []
  const assignmentUnread = assignments.filter((n) => !n.is_read).length
  const totalUnread = channelUnread + assignmentUnread

  // PR #48 — bulk-acknowledge both sections in one click. Mirrors the
  // member-side handler; the cache keys are shared so a click on
  // either widget clears the other's badge too.
  const handleMarkAllRead = () => {
    if (totalUnread === 0) return
    const assignmentsCacheKey = ['overview-assignment-notifications', profile?.id] as const
    const nowIso = new Date().toISOString()
    queryClient.setQueryData<ChannelNotification[]>(['overview-notifications'], (prev) =>
      prev?.map((c) => ({ ...c, unread_count: 0, last_read_at: nowIso })) ?? prev,
    )
    queryClient.setQueryData<AssignmentNotification[]>([...assignmentsCacheKey], (prev) =>
      prev?.map((row) => ({ ...row, is_read: true, read_at: row.read_at ?? nowIso })) ?? prev,
    )
    void Promise.all([
      markAllChannelsRead(),
      markAllAssignmentNotificationsRead(),
    ]).catch(() => {
      void queryClient.invalidateQueries({ queryKey: ['overview-notifications'] })
      void queryClient.invalidateQueries({ queryKey: assignmentsCacheKey })
    })
  }

  const handleChannelClick = (channelId: string) => {
    queryClient.setQueryData<ChannelNotification[]>(['overview-notifications'], (prev) =>
      prev?.map((c) => (c.channel_id === channelId ? { ...c, unread_count: 0 } : c)) ?? prev,
    )
    void markChannelRead(channelId).catch(() => {
      void queryClient.invalidateQueries({ queryKey: ['overview-notifications'] })
    })
  }

  const handleAssignmentClick = (n: AssignmentNotification) => {
    if (!profile?.id) return
    const cacheKey = ['overview-assignment-notifications', profile.id] as const
    queryClient.setQueryData<AssignmentNotification[]>([...cacheKey], (prev) =>
      prev?.map((row) => (row.id === n.id ? { ...row, is_read: true, read_at: new Date().toISOString() } : row)) ?? prev,
    )
    void markAssignmentNotificationRead(n.id).catch(() => {
      void queryClient.invalidateQueries({ queryKey: cacheKey })
    })
    // ─── Route by notification subject ─────────────────────────────
    // PR #13: session_id  → /sessions + highlight-session
    // PR #26: task_request_id 'submitted' → Hub approvals queue
    // PR #11: batch_id    → highlight-task in MyTasksCard
    if (n.session_id) {
      window.dispatchEvent(
        new CustomEvent('highlight-session', { detail: { sessionId: n.session_id } }),
      )
      window.location.href = '/sessions'
      return
    }
    if (n.task_request_id && n.notification_type === 'task_request_submitted') {
      // Admin clicks a "new task request" notification → jump to the
      // Hub where the Approvals column renders the pending queue.
      if (window.location.pathname !== '/admin') {
        window.location.href = '/admin'
      }
      return
    }
    if (n.task_request_id) {
      // Admin viewing their own approved/rejected notification (rare,
      // but possible if an admin submitted their own request). Use
      // the member routing logic.
      if (n.notification_type === 'task_request_approved' && n.task_request?.approved_task_id) {
        window.dispatchEvent(
          new CustomEvent('highlight-task', {
            detail: { taskId: n.task_request.approved_task_id },
          }),
        )
        return
      }
      return
    }

    // PR #39 — peer-to-peer reassignment parity with the member widget.
    if (n.task_reassign_request_id) {
      if (n.notification_type === 'task_reassign_requested') {
        setReassignModalOpen(true)
        return
      }
      if (n.notification_type === 'task_reassign_approved') {
        void queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] })
        return
      }
      return
    }

    // Task-assign notification — highlight the task from this batch.
    window.dispatchEvent(
      new CustomEvent('highlight-task', { detail: { batchId: n.batch_id } }),
    )
  }

  return (
    <div className="flex flex-col h-full">
      <TodayAnchor
        right={
          totalUnread > 0 ? (
            <div className="flex items-center gap-1.5">
              {/* PR #48 — Mark-all-read. */}
              <button
                type="button"
                onClick={handleMarkAllRead}
                title="Mark all as read"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface text-text-muted ring-1 ring-border text-[10px] font-bold tracking-wider uppercase hover:text-gold hover:ring-gold/40 transition-colors focus-ring"
              >
                <CheckCheck size={11} aria-hidden="true" />
                Mark all read
              </button>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 ring-1 ring-rose-500/40 text-rose-300 text-[10px] font-bold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" aria-hidden="true" />
                {totalUnread} New
              </span>
            </div>
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

      <div className="flex-1 min-h-0 overflow-auto -mx-1">
        {notifQuery.isLoading ? (
          <div className="h-full flex items-center justify-center text-text-light">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : notifQuery.error ? (
          <div className="h-full flex items-center gap-2 text-sm text-amber-300 px-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="truncate">Could not load notifications</span>
          </div>
        ) : channels.length === 0 && assignments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold/10 ring-1 ring-gold/20 mb-2">
              <MessageSquare size={18} className="text-gold" aria-hidden="true" />
            </div>
            <p className="text-[13px] font-medium text-text">No notifications</p>
            <p className="text-[11px] text-text-light mt-0.5">Hit Channel to create one.</p>
          </div>
        ) : (
          <>
            {channels.map((c) => {
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
            })}

            {/* PR #7 — admin's assignment notifications (rare; admins
                don't usually receive assignments themselves). */}
            {assignments.length > 0 && (
              <>
                <div className="mx-1.5 mt-3 mb-1.5 flex items-center gap-2">
                  <Bell size={10} className="text-gold/70" aria-hidden="true" />
                  <p className="text-[10px] font-semibold tracking-[0.06em] text-gold/70">ASSIGNMENTS</p>
                  <div className="flex-1 h-px bg-white/[0.05]" aria-hidden="true" />
                </div>
                {assignments.map((n) => {
                  const unread = !n.is_read
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleAssignmentClick(n)}
                      className={`w-full group flex items-start gap-2 px-1.5 py-1.5 rounded-lg transition-colors text-left ${
                        unread ? 'bg-gold/5 hover:bg-gold/10' : 'hover:bg-surface-hover/40'
                      }`}
                    >
                      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                        unread ? 'bg-gold/20 ring-1 ring-gold/50 text-gold' : 'bg-surface-alt border border-border-light text-text-muted'
                      }`}>
                        <Inbox size={12} aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-[12px] truncate ${unread ? 'font-bold text-text' : 'font-semibold text-text-muted'}`}>
                            {n.title}
                          </p>
                          {unread && (
                            <span className="shrink-0 inline-flex items-center justify-center px-1.5 h-[14px] rounded-full bg-rose-500 text-white text-[9px] font-bold leading-none uppercase">
                              New
                            </span>
                          )}
                        </div>
                        {n.body && (
                          <p className={`text-[11px] truncate ${unread ? 'text-text' : 'text-text-light'}`}>
                            {n.body}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>

      {postOpen && <PostToChannelModal channels={channels} onClose={() => { setPostOpen(false); void notifQuery.refetch() }} />}
      {channelOpen && <CreateChannelModal onClose={() => { setChannelOpen(false); void notifQuery.refetch() }} />}
      {/* PR #39 — reassignment approve/decline modal. */}
      {reassignModalOpen && (
        <TaskReassignRequestModal onClose={() => setReassignModalOpen(false)} />
      )}
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
      const { error } = await supabase.from('chat_messages').insert({
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
      const { error } = await supabase.from('chat_channels').insert({
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
