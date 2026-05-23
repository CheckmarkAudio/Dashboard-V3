import { useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, Bell, Calendar, CheckCheck, ClipboardList, ExternalLink,
  Inbox, Loader2, MessageSquare, Send,
} from 'lucide-react'
import { APP_ROUTES } from '../../app/routes'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchAssignmentNotifications,
  markAllAssignmentNotificationsRead,
  markAssignmentNotificationRead,
} from '../../lib/queries/assignments'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'
import type { AssignmentNotification } from '../../types/assignments'
import TaskReassignRequestModal from '../tasks/TaskReassignRequestModal'

/**
 * NotificationsPanel — the actual notification list, lifted out of
 * `ForumNotificationsWidget` so the top-bar dropdown bell (PR #65)
 * and the historical Overview widget can both render the same surface.
 *
 * Self-contained: owns its own React Query state, realtime
 * subscriptions, and click handlers. Renders rows for two data
 * sources interleaved into one list:
 *   - Forum channels (`get_channel_notifications` RPC) — message
 *     activity per chat channel; click routes to /content?channel=…
 *   - Assignments (`fetchAssignmentNotifications`) — task / session /
 *     reassignment notifications; click routes per the original
 *     subject (highlight task, jump to /sessions, etc.).
 *
 * PR #65 — each row gets a category icon so the user can tell at a
 * glance whether something is forum / task / booking related:
 *   - forum  → MessageSquare in violet
 *   - task   → ClipboardList in gold
 *   - booking → Calendar in sky-blue
 *
 * Props:
 *   onItemClick    — fired when a row is clicked (after the panel's
 *                    own routing). The dropdown uses this to keep
 *                    itself open per the user's request ("dropdown
 *                    stays down until you x out"); the widget passes
 *                    a no-op.
 *   compact        — `true` shrinks padding for the floating dropdown,
 *                    `false` keeps the original widget look.
 */
export type NotificationCategory = 'forum' | 'task' | 'booking'

// Translucent badge styles. rev17: bumped bg/ring opacity so the
// pills hold up on light backgrounds without losing their dark-bg
// look. Text colors stay on the light Tailwind shades (violet-300
// etc.) but auto-darken in light mode via the global accent-text
// overrides in `src/index.css`.
const CATEGORY_STYLES: Record<NotificationCategory, { icon: typeof MessageSquare; tint: string; bg: string; ring: string }> = {
  forum:   { icon: MessageSquare,  tint: 'text-violet-300', bg: 'bg-violet-500/35', ring: 'ring-violet-500/60' },
  task:    { icon: ClipboardList,  tint: 'text-gold',       bg: 'bg-gold/35',       ring: 'ring-gold/60'       },
  booking: { icon: Calendar,       tint: 'text-sky-300',    bg: 'bg-sky-500/35',    ring: 'ring-sky-500/60'    },
}

function categoryFor(n: AssignmentNotification): NotificationCategory {
  if (n.session_id) return 'booking'
  return 'task'
}

function CategoryBadge({ category }: { category: NotificationCategory }) {
  const style = CATEGORY_STYLES[category]
  const Icon = style.icon
  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full ring-1 ${style.bg} ${style.ring} ${style.tint}`}
      aria-label={`Category: ${category}`}
      title={category}
    >
      <Icon size={13} aria-hidden="true" />
    </span>
  )
}

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

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, now - then)
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

async function markAllChannelsRead(): Promise<{ channels_marked: number }> {
  const { data, error } = await supabase.rpc('mark_all_channels_read')
  if (error) throw error
  return data as { channels_marked: number }
}

interface NotificationsPanelProps {
  onItemClick?: () => void
  /** When true, render in the lighter dropdown style. */
  compact?: boolean
  /** Optional eyebrow row above the list (e.g. "TODAY · WED, APR 30"). */
  eyebrow?: React.ReactNode
}

export default function NotificationsPanel({ onItemClick, compact = false, eyebrow }: NotificationsPanelProps) {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  // PR #161 — `NotificationsPanel` mounts in TWO places at once: the
  // top-bar bell dropdown AND the historical Overview widget on `/`.
  // Supabase Realtime returns the SAME channel instance for the same
  // name, so the second mount's `.on('postgres_changes', …)` runs
  // against an already-subscribed channel and throws
  // `cannot add postgres_changes callbacks for realtime:overview-notifications after subscribe()`.
  // Using a per-instance `useId()` suffix gives each mount its own
  // dedicated channel, killing the collision and the crash.
  const instanceId = useId()
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  // PR #68 (rev) — inline channel reply. Clicking a channel row expands
  // it to reveal a textarea + Send. Stays open until the user clears it
  // or sends, so the expanded state survives a refetch.
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)

  const notifQuery = useQuery({
    queryKey: ['overview-notifications'],
    queryFn: fetchChannelNotifications,
    refetchInterval: 60_000,
  })

  const assignmentsQuery = useQuery({
    queryKey: ['overview-assignment-notifications', profile?.id],
    queryFn: () => fetchAssignmentNotifications(profile!.id, { unreadOnly: false, limit: 20 }),
    enabled: Boolean(profile?.id),
    refetchInterval: 60_000,
  })

  // Realtime — chat_messages anywhere triggers a refetch of channel unread.
  // Channel name suffixed with `instanceId` so the bell-dropdown mount
  // and the Overview-widget mount don't collide on the same Realtime
  // channel (see comment on `instanceId` above).
  useEffect(() => {
    const chatSub = supabase
      .channel(`overview-notifications:${instanceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['overview-notifications'] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(chatSub)
    }
  }, [queryClient, instanceId])

  // Realtime — assignment_notifications for the current user.
  // Same per-instance suffix as above so simultaneous mounts each get
  // their own dedicated channel.
  useEffect(() => {
    if (!profile?.id) return
    const sub = supabase
      .channel(`overview-assignment-notifications:${profile.id}:${instanceId}`)
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
  }, [queryClient, profile?.id, instanceId])

  const channels = notifQuery.data ?? []
  const channelUnread = channels.reduce((acc, c) => acc + (c.unread_count ?? 0), 0)
  const assignments = assignmentsQuery.data ?? []
  const assignmentUnread = assignments.filter((n) => !n.is_read).length

  // Skin pass 2026-05-06 — "High Priority" filter. Currently aliased
  // to "unread": for channels = `unread_count > 0`, for assignments =
  // `!is_read`. When a real `priority` field gets added to either
  // table, swap the predicate here. Filter UI is the toggle button
  // in the panel header (next to "Mark all read"). Default OFF so
  // the panel still shows the full list on first render.
  const [highPriorityOnly, setHighPriorityOnly] = useState(false)
  const visibleChannels = highPriorityOnly
    ? channels.filter((c) => c.unread_count > 0)
    : channels
  const visibleAssignments = highPriorityOnly
    ? assignments.filter((n) => !n.is_read)
    : assignments
  const totalUnread = channelUnread + assignmentUnread

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
    queryClient.setQueryData<ChannelNotification[]>(['overview-notifications'], (prev) => {
      if (!prev) return prev
      return prev.map((c) =>
        c.channel_id === channelId
          ? { ...c, unread_count: 0, last_read_at: new Date().toISOString() }
          : c,
      )
    })
    void markChannelRead(channelId).catch(() => {
      void queryClient.invalidateQueries({ queryKey: ['overview-notifications'] })
    })
    onItemClick?.()
  }

  const handleAssignmentClick = (n: AssignmentNotification) => {
    if (!profile?.id) return
    const cacheKey = ['overview-assignment-notifications', profile.id] as const
    queryClient.setQueryData<AssignmentNotification[]>([...cacheKey], (prev) => {
      if (!prev) return prev
      return prev.map((row) =>
        row.id === n.id ? { ...row, is_read: true, read_at: new Date().toISOString() } : row,
      )
    })
    void markAssignmentNotificationRead(n.id).catch(() => {
      void queryClient.invalidateQueries({ queryKey: cacheKey })
    })

    if (n.session_id) {
      // 2026-05-07 link audit — was `window.location.href = '/sessions'`
      // (full page reload). Switched to React Router navigate() so the
      // SPA stays warm + the highlight-session event listener on the
      // Sessions page (registered in Sessions.tsx via the
      // HIGHLIGHT_EVENT useEffect) catches the dispatched event without
      // a remount race.
      window.dispatchEvent(
        new CustomEvent('highlight-session', { detail: { sessionId: n.session_id } }),
      )
      navigate('/sessions')
      return
    }

    if (n.task_request_id) {
      if (n.notification_type === 'task_request_approved' && n.task_request?.approved_task_id) {
        window.dispatchEvent(
          new CustomEvent('highlight-task', {
            detail: { taskId: n.task_request.approved_task_id },
          }),
        )
        return
      }
      if (n.notification_type === 'task_request_rejected') {
        window.dispatchEvent(new CustomEvent('expand-task-requests'))
        return
      }
      return
    }

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

    window.dispatchEvent(
      new CustomEvent('highlight-task', { detail: { batchId: n.batch_id } }),
    )
    onItemClick?.()
  }

  const rowPad = compact ? 'px-3 py-2' : 'px-2 py-2'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 shrink-0 px-1">
        {eyebrow ?? <span />}
        <div className="flex items-center gap-1.5">
          {/* Skin pass 2026-05-06 — High Priority filter. Toggles
              `highPriorityOnly`; currently aliased to "unread only"
              for both channels and assignments. The pill flips to a
              rose-tinted active state when on. */}
          <button
            type="button"
            onClick={() => setHighPriorityOnly((v) => !v)}
            aria-pressed={highPriorityOnly}
            title={highPriorityOnly ? 'Showing high-priority only — click to show all' : 'Show high-priority only'}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ring-1 transition-colors focus-ring ${
              highPriorityOnly
                ? 'bg-rose-500/15 ring-rose-500/40 text-rose-400'
                : 'bg-surface ring-border text-text-muted hover:text-rose-400 hover:ring-rose-500/40'
            }`}
          >
            High Priority
          </button>
          {totalUnread > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              title="Mark all as read"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface text-text-muted ring-1 ring-border text-[10px] font-bold tracking-wider uppercase hover:text-gold hover:ring-gold/40 transition-colors focus-ring"
            >
              <CheckCheck size={11} aria-hidden="true" />
              Mark all read
            </button>
          )}
          {totalUnread > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/35 ring-1 ring-rose-500/60 text-rose-300 text-[10px] font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" aria-hidden="true" />
              {totalUnread} New
            </span>
          )}
        </div>
      </div>

      {/* Skin pass 2026-05-06 — wrap the scrollable channels +
          assignments area in `.inset-panel` chrome (matches booking
          + Task Requests). Channels and assignments are flattened
          to flat rows separated by `divide-y divide-theme`; the
          per-row `rounded-xl border` chrome was dropped. State
          (unread / expanded / hover) is now communicated by bg
          tint alone. The scroller is inside the panel so
          `overflow:hidden` doesn't fight `overflow-auto`. */}
      <div className="flex-1 min-h-0 inset-panel">
        <div className="h-full overflow-auto">
        {notifQuery.isLoading ? (
          <div className="h-full flex items-center justify-center text-text-light py-6">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : notifQuery.error ? (
          <div className="flex items-center gap-2 text-sm text-amber-300 px-2 py-3">
            <AlertCircle size={16} className="shrink-0" />
            <span className="truncate">Could not load notifications</span>
          </div>
        ) : visibleChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-4 py-6">
            <div className="icon-tile-gold w-10 h-10 mb-2">
              <MessageSquare size={18} className="text-gold" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-medium text-text">No channels yet</p>
            <p className="text-[12px] text-text-light mt-0.5">Create one in the Forum.</p>
          </div>
        ) : (
          <>
            {/* Skin pass 2026-05-06 — section header band for FORUMS,
                mirrors the ASSIGNMENTS treatment below. No `border-t`
                here because this is the FIRST section inside the
                inset-panel; the panel's own top border + the band's
                `bg-surface-alt/40` define the upper edge. The
                trailing channel rows + ASSIGNMENTS block both
                inherit the same section-band rhythm so the panel
                reads as a clean two-section layout. */}
            <div className="px-3 py-2 flex items-center gap-2 bg-surface-alt/40">
              <MessageSquare size={11} className="text-gold/70" aria-hidden="true" />
              <p className="text-[11px] font-semibold tracking-[0.06em] text-gold/70">
                FORUMS
              </p>
            </div>
            <div className="divide-y divide-theme">
            {visibleChannels.map((c) => {
            const hasMessage = !!c.latest_id
            const unread = c.unread_count > 0
            const isExpanded = expandedChannelId === c.channel_id

            const toggleExpand = () => {
              if (isExpanded) {
                setExpandedChannelId(null)
                setReplyText('')
              } else {
                setExpandedChannelId(c.channel_id)
                setReplyText('')
                handleChannelClick(c.channel_id)
              }
            }

            const submitReply = async () => {
              const text = replyText.trim()
              if (!text || replyBusy) return
              setReplyBusy(true)
              try {
                const name = profile?.display_name ?? 'Member'
                const { error } = await supabase.from('chat_messages').insert({
                  channel_id: c.channel_id,
                  sender_name: name,
                  sender_id: profile?.id ?? '',
                  sender_initial: name.charAt(0).toUpperCase(),
                  content: text,
                })
                if (error) throw error
                toast(`Sent to #${c.channel_name}`, 'success')
                setReplyText('')
                setExpandedChannelId(null)
                // PR #68 (rev) — mark this channel read for the SENDER so
                // their own message doesn't bump their unread badge. Without
                // this, the realtime INSERT triggers a refetch that counts
                // the just-sent message as unread for everyone, including
                // the sender.
                void markChannelRead(c.channel_id).catch(() => { /* noop */ })
                void queryClient.invalidateQueries({ queryKey: ['overview-notifications'] })
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Send failed', 'error')
              } finally {
                setReplyBusy(false)
              }
            }

            const channelHref = `${APP_ROUTES.member.content}${c.channel_slug ? `?channel=${c.channel_slug}` : ''}`

            // Skin pass 2026-05-06 — flattened from rounded-xl card to
            // flat row inside the inset-panel + divide-theme stack.
            // State (unread / expanded / hover) communicated by bg
            // tint alone now that the divide-theme line provides the
            // separation. Forum violet still tints the expanded row.
            const stateBg = isExpanded
              ? 'bg-violet-500/10'
              : unread
                ? 'bg-gold/8 hover:bg-gold/12'
                : 'hover:bg-surface-hover'

            return (
              <div
                key={c.channel_id}
                className={`relative transition-[background-color] duration-150 ease-out ${stateBg}`}
              >
                <div className={`flex items-start gap-2 ${rowPad}`}>
                  {/* 2026-05-19 — twin circular buttons on the left
                      give the user a clear choice: "reply here" vs
                      "open the full thread." Both are tactile + share
                      the same violet palette so they read as a pair.
                      Previously the only "go to forum" link was a
                      tiny text-link buried inside the expanded reply
                      form — easy to miss when the user actually
                      wants to jump into the thread to respond
                      properly with formatting / attachments. */}
                  <div className="shrink-0 flex items-center gap-1">
                    {/* Speech-bubble = the inline-reply trigger.
                        Buttoned with a hover glow + active push so it
                        reads as clickable; aria-expanded reflects the
                        row state. */}
                    <button
                      type="button"
                      onClick={toggleExpand}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? `Close reply to ${c.channel_name}` : `Reply to ${c.channel_name}`}
                      title={isExpanded ? 'Close' : 'Quick reply'}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full ring-1 transition-all duration-150 active:scale-95 focus-ring ${
                        isExpanded
                          ? 'bg-violet-500/30 ring-violet-400/60 text-violet-200 shadow-[0_0_0_3px_rgba(167,139,250,0.18)]'
                          : 'bg-violet-500/15 ring-violet-500/30 text-violet-300 hover:bg-violet-500/25 hover:ring-violet-400/50 hover:shadow-[0_0_0_3px_rgba(167,139,250,0.12)]'
                      }`}
                    >
                      <MessageSquare size={13} aria-hidden="true" />
                    </button>

                    {/* Open-in-forum pill. Per user "make the new
                        link a bit more obvious" — promoted from a
                        twin circular icon to a pill with icon +
                        "Open" label so it reads as an explicit
                        affordance, not just decoration. Same h-7 +
                        violet palette as the speech-bubble so the
                        two still read as a coherent pair, but the
                        label removes any ambiguity about what it
                        does + invites the click. */}
                    <Link
                      to={channelHref}
                      aria-label={`Open #${c.channel_name} in forum`}
                      title="Open in forum"
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-full ring-1 bg-violet-500/15 ring-violet-500/30 text-violet-200 text-[10px] font-bold uppercase tracking-wider hover:bg-violet-500/30 hover:ring-violet-400/60 hover:text-white hover:shadow-[0_0_0_3px_rgba(167,139,250,0.18)] transition-all duration-150 active:scale-95 focus-ring"
                    >
                      <ExternalLink size={11} strokeWidth={2.6} aria-hidden="true" />
                      Open
                    </Link>
                  </div>

                  {/* Title + preview = also a quick-reply trigger (same
                      behavior as the speech-bubble icon). The full-Forum
                      navigation also lives in the dedicated
                      ExternalLink button to the left. */}
                  <button
                    type="button"
                    onClick={toggleExpand}
                    aria-expanded={isExpanded}
                    className="flex-1 min-w-0 text-left -my-1 py-1 rounded-md hover:bg-surface-hover transition-colors focus-ring"
                  >
                    <div className="flex items-center gap-2">
                      {/* Skin pass 2026-05-06 — unread indicator is a
                          small red dot (matches the assignment-row dot
                          treatment). The unread COUNT badge moved to
                          the right column with the date so the title
                          row stays clean. */}
                      {unread && (
                        <span
                          className="shrink-0 w-2 h-2 rounded-full bg-rose-500"
                          aria-label="New messages"
                        />
                      )}
                      <p
                        className={`text-[13px] truncate ${
                          unread ? 'font-bold text-text' : 'font-semibold text-text-muted'
                        }`}
                      >
                        #{c.channel_name}
                      </p>
                    </div>
                    {/* 2026-05-23 — collapsed row no longer shows the
                        message preview text. Per user: at-a-glance
                        should only carry the channel #, the inline
                        icons (Reply + Open) on the left, and the
                        timestamp on the right. The full most-recent
                        message is revealed below in the expanded
                        quick-reply panel so admins still get the
                        context they need when actually responding —
                        just not in the always-on collapsed view.
                        Empty-state still shows so admins see which
                        channels haven't gotten any traffic. */}
                    {!hasMessage && (
                      <p className="text-[12px] text-text-light italic mt-0.5">No messages yet</p>
                    )}
                  </button>

                  {/* Skin pass 2026-05-06 — right column: most-recent
                      message date + (when unread) the unread count
                      badge stacked below it. Date moved off the body
                      so it doesn't compete with title for vertical
                      space; matches the assignment-row right-column
                      treatment. */}
                  <div className="shrink-0 flex flex-col items-end gap-1 mt-0.5">
                    {c.latest_created_at && (
                      <span
                        className="text-[10px] text-text-light tabular-nums whitespace-nowrap"
                        title={new Date(c.latest_created_at).toLocaleString()}
                      >
                        {relativeTime(c.latest_created_at)}
                      </span>
                    )}
                    {unread && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none tabular-nums">
                        {c.unread_count > 9 ? '9+' : c.unread_count}
                      </span>
                    )}
                  </div>
                </div>

                {/* Inline quick-reply. Single-line textarea (rows=1, padding
                    trimmed) so it doesn't dominate the row. Same
                    `cubic-bezier(0.16, 1, 0.3, 1)` ease-out-expo as the
                    dropdown opening so the expansion feels consistent. */}
                {isExpanded && (
                  <div
                    className="px-3 pb-3 pt-1 space-y-2"
                    style={{
                      animation: 'fadeIn 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    {/* 2026-05-23 — full most-recent message surfaces
                        here when the row is expanded for quick-reply.
                        Per user: "expand the forum notification for
                        quick respond... to the full most recent
                        message... so you can quick respond knowing
                        the full message you are responding to." Soft
                        violet-tinted quote box with the sender name +
                        full body. line-clamp-4 caps egregious walls
                        of text at ~4 lines so the widget can't blow
                        out vertically; full content always available
                        via the Open pill if they need more. */}
                    {hasMessage && c.latest_content && (
                      <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-2.5 py-2 text-[12px]">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-violet-300/80 mb-1">
                          {c.latest_sender}
                        </p>
                        <p className="text-text whitespace-pre-wrap break-words line-clamp-4 leading-snug">
                          {c.latest_content}
                        </p>
                      </div>
                    )}
                    <textarea
                      autoFocus
                      rows={1}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          void submitReply()
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setExpandedChannelId(null)
                          setReplyText('')
                        }
                      }}
                      placeholder={`Reply to #${c.channel_name}…`}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-surface-alt border border-violet-500/25 text-[12px] text-text placeholder:text-text-light focus:border-violet-400/60 focus:outline-none resize-none min-h-[34px]"
                    />
                    {/* 2026-05-19 — dropped the redundant "Open
                        #channel" text-link that used to live here.
                        The new prominent "Open" pill in the row
                        header (visible in both collapsed AND
                        expanded states) replaces it. */}
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedChannelId(null)
                          setReplyText('')
                        }}
                        className="px-2 py-1 rounded-md text-[11px] font-medium text-text-light hover:text-text transition-colors focus-ring"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void submitReply()}
                        disabled={!replyText.trim() || replyBusy}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-violet-500 text-white text-[11px] font-bold hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
                      >
                        <Send size={11} aria-hidden="true" />
                        {replyBusy ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                    <p className="text-[10px] text-text-light/70">⌘/Ctrl + Enter to send · Esc to cancel</p>
                  </div>
                )}
              </div>
            )
          })}
          </div>
          </>
        )}

        {visibleAssignments.length > 0 && (
          <>
            {/* Skin pass — section header for ASSIGNMENTS gets its own
                divider via border-t theme-divider + a soft surface-alt
                bg band, matching the table-head treatment used on the
                booking nested panel. */}
            <div className="border-t theme-divider px-3 py-2 flex items-center gap-2 bg-surface-alt/40">
              <Bell size={11} className="text-gold/70" aria-hidden="true" />
              <p className="text-[11px] font-semibold tracking-[0.06em] text-gold/70">
                ASSIGNMENTS
              </p>
            </div>
            <div className="divide-y divide-theme">
            {visibleAssignments.map((n) => {
              const unread = !n.is_read
              const cat = categoryFor(n)
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleAssignmentClick(n)}
                  className={`w-full group relative flex items-start gap-2.5 ${rowPad} transition-[background-color,transform] duration-150 ease-out active:scale-[0.995] text-left ${
                    unread
                      ? 'bg-gold/8 hover:bg-gold/12'
                      : 'hover:bg-surface-hover'
                  }`}
                >
                  <CategoryBadge category={cat} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {/* Skin pass 2026-05-06 — NEW pill replaced with a
                          small red dot. Same unread cue, less chrome. */}
                      {unread && (
                        <span
                          className="shrink-0 w-2 h-2 rounded-full bg-rose-500"
                          aria-label="New"
                        />
                      )}
                      <p
                        className={`text-[13px] truncate ${
                          unread ? 'font-bold text-text' : 'font-semibold text-text-muted'
                        }`}
                      >
                        {n.title}
                      </p>
                    </div>
                    {n.body && (
                      <p className={`text-[12px] truncate mt-0.5 ${unread ? 'text-text' : 'text-text-light'}`}>
                        {n.body}
                      </p>
                    )}
                  </div>
                  {/* Skin pass 2026-05-06 — assigned date moved from
                      below the body to the row's right edge so it
                      doesn't compete with the title for vertical space.
                      Uses `n.created_at` which is when the notification
                      (= assignment) was created. */}
                  <span
                    className="shrink-0 text-[10px] text-text-light tabular-nums whitespace-nowrap mt-0.5"
                    title={new Date(n.created_at).toLocaleString()}
                  >
                    {relativeTime(n.created_at)}
                  </span>
                </button>
              )
            })}
            </div>
          </>
        )}

        {visibleChannels.length === 0 && visibleAssignments.length === 0 && !notifQuery.isLoading && !notifQuery.error && (
          <div className="flex flex-col items-center justify-center text-center px-4 py-8 text-text-light">
            <Inbox size={20} className="mb-2" aria-hidden="true" />
            <p className="text-[12px]">All caught up.</p>
          </div>
        )}
        </div>
      </div>

      {reassignModalOpen && (
        <TaskReassignRequestModal onClose={() => setReassignModalOpen(false)} />
      )}
    </div>
  )
}

/**
 * Hook to compute the total unread count without subscribing the
 * caller to the full panel render. Drives the bell-button badge.
 */
export function useTotalUnreadCount(): number {
  const { profile } = useAuth()
  const channelsQuery = useQuery({
    queryKey: ['overview-notifications'],
    queryFn: fetchChannelNotifications,
    refetchInterval: 60_000,
  })
  const assignmentsQuery = useQuery({
    queryKey: ['overview-assignment-notifications', profile?.id],
    queryFn: () => fetchAssignmentNotifications(profile!.id, { unreadOnly: false, limit: 20 }),
    enabled: Boolean(profile?.id),
    refetchInterval: 60_000,
  })
  const channels = channelsQuery.data ?? []
  const assignments = assignmentsQuery.data ?? []
  return (
    channels.reduce((acc, c) => acc + (c.unread_count ?? 0), 0) +
    assignments.filter((n) => !n.is_read).length
  )
}
