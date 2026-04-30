import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

const CATEGORY_STYLES: Record<NotificationCategory, { icon: typeof MessageSquare; tint: string; bg: string; ring: string }> = {
  forum:   { icon: MessageSquare,  tint: 'text-violet-300', bg: 'bg-violet-500/15', ring: 'ring-violet-500/30' },
  task:    { icon: ClipboardList,  tint: 'text-gold',       bg: 'bg-gold/15',       ring: 'ring-gold/30' },
  booking: { icon: Calendar,       tint: 'text-sky-300',    bg: 'bg-sky-500/15',    ring: 'ring-sky-500/30' },
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
  useEffect(() => {
    const chatSub = supabase
      .channel('overview-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['overview-notifications'] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(chatSub)
    }
  }, [queryClient])

  // Realtime — assignment_notifications for the current user.
  useEffect(() => {
    if (!profile?.id) return
    const sub = supabase
      .channel(`overview-assignment-notifications:${profile.id}`)
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
      window.dispatchEvent(
        new CustomEvent('highlight-session', { detail: { sessionId: n.session_id } }),
      )
      window.location.href = '/sessions'
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 ring-1 ring-rose-500/40 text-rose-300 text-[10px] font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" aria-hidden="true" />
              {totalUnread} New
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto -mx-1">
        {notifQuery.isLoading ? (
          <div className="h-full flex items-center justify-center text-text-light py-6">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : notifQuery.error ? (
          <div className="flex items-center gap-2 text-sm text-amber-300 px-2 py-3">
            <AlertCircle size={16} className="shrink-0" />
            <span className="truncate">Could not load notifications</span>
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-4 py-6">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold/10 ring-1 ring-gold/20 mb-2">
              <MessageSquare size={18} className="text-gold" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-medium text-text">No channels yet</p>
            <p className="text-[12px] text-text-light mt-0.5">Create one in the Forum.</p>
          </div>
        ) : (
          channels.map((c) => {
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

            // Forum violet (matches CategoryBadge for forum) — used for
            // expanded-state border + the speech-bubble button hover/active
            // states so the row reads as a violet-themed entity end to end.
            const expandedRingClass = isExpanded
              ? 'bg-violet-500/10 border-violet-500/40'
              : 'border-transparent ' + (unread
                  ? 'bg-gold/8 hover:bg-gold/12 hover:border-gold/20'
                  : 'bg-white/[0.018] hover:bg-white/[0.04] hover:border-white/10')

            return (
              <div
                key={c.channel_id}
                className={`relative rounded-xl border transition-[background-color,border-color] duration-150 ease-out ${expandedRingClass}`}
              >
                <div className={`flex items-start gap-2.5 ${rowPad}`}>
                  {/* Speech-bubble = the inline-reply trigger. Buttoned
                      with a hover glow + active push so it reads as
                      clickable; aria-expanded reflects the row state. */}
                  <button
                    type="button"
                    onClick={toggleExpand}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? `Close reply to ${c.channel_name}` : `Reply to ${c.channel_name}`}
                    title={isExpanded ? 'Close' : 'Quick reply'}
                    className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full ring-1 transition-all duration-150 active:scale-95 focus-ring ${
                      isExpanded
                        ? 'bg-violet-500/30 ring-violet-400/60 text-violet-200 shadow-[0_0_0_3px_rgba(167,139,250,0.18)]'
                        : 'bg-violet-500/15 ring-violet-500/30 text-violet-300 hover:bg-violet-500/25 hover:ring-violet-400/50 hover:shadow-[0_0_0_3px_rgba(167,139,250,0.12)]'
                    }`}
                  >
                    <MessageSquare size={13} aria-hidden="true" />
                  </button>

                  {/* Title + preview = also a quick-reply trigger (same
                      behavior as the speech-bubble icon). The full-Forum
                      navigation lives in the small "Open #channel" link
                      inside the expanded form below. */}
                  <button
                    type="button"
                    onClick={toggleExpand}
                    aria-expanded={isExpanded}
                    className="flex-1 min-w-0 text-left -my-1 py-1 rounded-md hover:bg-white/[0.02] transition-colors focus-ring"
                  >
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-[13px] truncate ${
                          unread ? 'font-bold text-text' : 'font-semibold text-text-muted'
                        }`}
                      >
                        #{c.channel_name}
                      </p>
                      {unread && (
                        <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none tabular-nums">
                          {c.unread_count > 9 ? '9+' : c.unread_count}
                        </span>
                      )}
                    </div>
                    {hasMessage ? (
                      <p className={`text-[12px] truncate mt-0.5 ${unread ? 'text-text' : 'text-text-light'}`}>
                        <span className="font-medium">{c.latest_sender}:</span>{' '}
                        <span className={unread ? 'text-text' : 'text-text-muted'}>{c.latest_content}</span>
                      </p>
                    ) : (
                      <p className="text-[12px] text-text-light italic mt-0.5">No messages yet</p>
                    )}
                    {c.latest_created_at && (
                      <p className="text-[10px] text-text-light mt-0.5">{relativeTime(c.latest_created_at)}</p>
                    )}
                  </button>
                </div>

                {/* Inline quick-reply. Single-line textarea (rows=1, padding
                    trimmed) so it doesn't dominate the row. Same
                    `cubic-bezier(0.16, 1, 0.3, 1)` ease-out-expo as the
                    dropdown opening so the expansion feels consistent. */}
                {isExpanded && (
                  <div
                    className="px-3 pb-3 pt-1 space-y-1.5"
                    style={{
                      animation: 'fadeIn 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
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
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={channelHref}
                        className="inline-flex items-center gap-1 text-[10px] text-text-light hover:text-violet-300 transition-colors"
                        onClick={() => {
                          setExpandedChannelId(null)
                          setReplyText('')
                        }}
                      >
                        <ExternalLink size={10} aria-hidden="true" /> Open #{c.channel_name}
                      </Link>
                      <div className="flex items-center gap-1.5">
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
                    </div>
                    <p className="text-[10px] text-text-light/70">⌘/Ctrl + Enter to send · Esc to cancel</p>
                  </div>
                )}
              </div>
            )
          })
        )}

        {assignments.length > 0 && (
          <>
            <div className="mx-2 mt-4 mb-2 flex items-center gap-2">
              <Bell size={11} className="text-gold/70" aria-hidden="true" />
              <p className="text-[11px] font-semibold tracking-[0.06em] text-gold/70">
                ASSIGNMENTS
              </p>
              <div className="flex-1 h-px bg-white/[0.05]" aria-hidden="true" />
            </div>
            {assignments.map((n) => {
              const unread = !n.is_read
              const cat = categoryFor(n)
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleAssignmentClick(n)}
                  className={`w-full group relative flex items-start gap-2.5 ${rowPad} rounded-xl border border-transparent transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.995] text-left ${
                    unread
                      ? 'bg-gold/8 hover:bg-gold/12 hover:border-gold/20'
                      : 'bg-white/[0.018] hover:bg-white/[0.04] hover:border-white/10'
                  }`}
                >
                  <CategoryBadge category={cat} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-[13px] truncate ${
                          unread ? 'font-bold text-text' : 'font-semibold text-text-muted'
                        }`}
                      >
                        {n.title}
                      </p>
                      {unread && (
                        <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none tabular-nums">
                          NEW
                        </span>
                      )}
                    </div>
                    {n.body && (
                      <p className={`text-[12px] truncate mt-0.5 ${unread ? 'text-text' : 'text-text-light'}`}>
                        {n.body}
                      </p>
                    )}
                    <p className="text-[10px] text-text-light mt-0.5">{relativeTime(n.created_at)}</p>
                  </div>
                </button>
              )
            })}
          </>
        )}

        {channels.length === 0 && assignments.length === 0 && !notifQuery.isLoading && !notifQuery.error && (
          <div className="flex flex-col items-center justify-center text-center px-4 py-8 text-text-light">
            <Inbox size={20} className="mb-2" aria-hidden="true" />
            <p className="text-[12px]">All caught up.</p>
          </div>
        )}
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
