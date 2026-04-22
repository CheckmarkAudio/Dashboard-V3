import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts'
import {
  AlertCircle,
  Bell,
  Calendar as CalendarIcon,
  Check,
  ChevronRight,
  FileText,
  Flame,
  Inbox,
  Loader2,
  MessageSquare,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { APP_ROUTES } from '../../app/routes'
import { useAuth } from '../../contexts/AuthContext'
import { useMemberOverviewContext } from '../../contexts/MemberOverviewContext'
import { buildMemberFlywheelChartData, getKpiTrendLabel } from '../../domain/dashboard/memberOverview'
import {
  fetchAssignmentNotifications,
  markAssignmentNotificationRead,
} from '../../lib/queries/assignments'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import { supabase } from '../../lib/supabase'
import type { TeamMember } from '../../types'
import type { AssignmentNotification } from '../../types/assignments'
import MyTasksCard from '../tasks/MyTasksCard'
import CreateBookingModal from '../CreateBookingModal'

// Stage tokens shared between the activity feed + status pills.
// Sourced from the v1.0 design system (Deliver/Capture/Share/Attract/Book).
type Stage = 'deliver' | 'capture' | 'share' | 'attract' | 'book'
const STAGE_STYLES: Record<Stage, { dot: string; text: string; bg: string; ring: string }> = {
  deliver: { dot: 'bg-blue-400',   text: 'text-blue-300',   bg: 'bg-blue-500/5',   ring: 'ring-blue-500/15' },
  capture: { dot: 'bg-violet-400', text: 'text-violet-300', bg: 'bg-violet-500/5', ring: 'ring-violet-500/15' },
  share:   { dot: 'bg-cyan-400',   text: 'text-cyan-300',   bg: 'bg-cyan-500/5',   ring: 'ring-cyan-500/15' },
  attract: { dot: 'bg-pink-400',   text: 'text-pink-300',   bg: 'bg-pink-500/5',   ring: 'ring-pink-500/15' },
  book:    { dot: 'bg-orange-400', text: 'text-orange-300', bg: 'bg-orange-500/5', ring: 'ring-orange-500/15' },
}

function splitClockParts(value: string): [string, string] {
  const [left = '0', right = '0'] = value.split(':')
  return [left, right]
}

function parseClock(value: string): [number, number] {
  const [hours, minutes] = splitClockParts(value)
  return [Number(hours), Number(minutes)]
}

function formatTime12(t: string): string {
  const [h, m] = parseClock(t)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`
}

function durationLabel(start: string, end: string): string {
  const [sh, sm] = parseClock(start)
  const [eh, em] = parseClock(end)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  const hrs = Math.floor(mins / 60)
  const rm = mins % 60
  return hrs > 0 ? `${hrs}h${rm > 0 ? ` ${rm}m` : ''}` : `${rm}m`
}

function WidgetStatus({ error, loading }: { error: string | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-light">
        <Loader2 size={18} className="animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center gap-2 text-sm text-amber-300">
        <AlertCircle size={16} />
        <span>{error}</span>
      </div>
    )
  }

  return null
}

export function TeamSnapshotWidget() {
  const { daily, streak, todayNote, mustDoSubmission, loading, error } = useMemberOverviewContext()
  const status = <WidgetStatus error={error} loading={loading} />
  if (loading || error) return status

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-alt/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-text-light">Daily Progress</span>
            <Check size={14} className="text-gold" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-text">
            {daily.completedCount}/{daily.totalCount}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${daily.percentage}%`, backgroundColor: daily.percentage === 100 ? '#10b981' : '#C9A84C' }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-alt/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-text-light">Streak</span>
            <Flame size={14} className="text-orange-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-text">{streak} days</p>
          <p className="mt-1 text-[11px] text-text-light">Consecutive fully completed days</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">Today’s must-do</p>
            <p className="text-[11px] text-text-light">
              {mustDoSubmission ? 'Submitted and logged' : 'Still needs to be submitted today'}
            </p>
          </div>
          <Link to={APP_ROUTES.member.tasks} className="text-sm font-medium text-gold hover:underline shrink-0">
            Open tasks
          </Link>
        </div>
        <div className="rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <FileText size={14} className="text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-text">Daily note</p>
              <p className="text-[11px] text-text-light">
                {todayNote ? 'Submitted for today' : 'Not submitted yet'}
              </p>
            </div>
          </div>
          <Link to="/notes" className="text-sm font-medium text-gold hover:underline shrink-0">
            {todayNote ? 'View' : 'Submit'}
          </Link>
        </div>
      </div>
    </div>
  )
}

/**
 * Status pill for sessions — Live (rose pulse) | Wrapped (emerald) | "In 42m" (neutral).
 * Computes against current wall-clock time, not session metadata, so the pill
 * stays accurate as the day progresses without a refetch.
 */
function computeSessionStatus(start: string, end: string, now: Date): { label: string; tone: 'live' | 'wrapped' | 'upcoming' } {
  const today = new Date(now)
  const [sh, sm] = parseClock(start)
  const [eh, em] = parseClock(end)
  const startDate = new Date(today); startDate.setHours(sh, sm, 0, 0)
  const endDate = new Date(today);   endDate.setHours(eh, em, 0, 0)
  if (now > endDate) return { label: 'Wrapped', tone: 'wrapped' }
  if (now >= startDate) return { label: 'Live', tone: 'live' }
  const minsUntil = Math.round((startDate.getTime() - now.getTime()) / 60000)
  if (minsUntil < 60) return { label: `In ${minsUntil}m`, tone: 'upcoming' }
  const hrs = Math.floor(minsUntil / 60)
  const mins = minsUntil % 60
  return { label: mins > 0 ? `In ${hrs}h ${mins}m` : `In ${hrs}h`, tone: 'upcoming' }
}

function SessionStatusPill({ status }: { status: ReturnType<typeof computeSessionStatus> }) {
  const styleMap = {
    live:     'bg-rose-500/10 text-rose-300 ring-rose-500/30',
    wrapped:  'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
    upcoming: 'bg-surface-alt text-text-muted ring-border-light',
  } as const
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium tracking-tight ring-1 ${styleMap[status.tone]}`}>
      {status.tone === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" aria-hidden="true" />}
      {status.label}
    </span>
  )
}

/**
 * Calendar widget — TODAY anchor + Mon-Sun weekday strip + today's
 * session list. The weekday strip ensures the widget has visible
 * structure even when the day is empty (no sessions). Pattern lifted
 * from src/pages/Calendar.tsx so the widget feels like a mini version
 * of the full Calendar page.
 */
function buildWeekdayStrip(): { date: Date; label: string; dayNum: number; isToday: boolean }[] {
  // Week starts on Monday (matches Calendar.tsx convention).
  const today = new Date()
  const day = today.getDay() // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const todayKey = today.toDateString()
  return labels.map((label, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return { date: d, label, dayNum: d.getDate(), isToday: d.toDateString() === todayKey }
  })
}

export function TodayCalendarWidget() {
  const { todaySessions, loading, error } = useMemberOverviewContext()
  // Note: chrome (TODAY eyebrow + weekday strip) renders regardless of
  // data state — those are date-derived, not Supabase-dependent. Only
  // the session list inside shows loading/error.
  const weekdays = buildWeekdayStrip()
  const now = new Date()
  const todayLabel = now
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase()

  return (
    <div className="flex flex-col h-full">
      {/* TODAY eyebrow — matches the Tasks widget pattern. */}
      <p className="text-[11px] font-semibold tracking-[0.06em] text-gold/70 mb-2 shrink-0">
        TODAY · {todayLabel}
      </p>

      {/* Weekday strip — Mon-Sun. Today highlighted in gold. */}
      <div className="grid grid-cols-7 gap-1 mb-3 shrink-0">
        {weekdays.map((d) => (
          <div
            key={d.label}
            // Today's tile gets a richer gold gradient with a white
            // highlight line at the top, matching the mockup. Other
            // days use a subtle resting background.
            className={`flex flex-col items-center justify-center py-2 rounded-xl transition-colors ${
              d.isToday
                ? 'bg-gradient-to-b from-gold/28 to-gold/12 ring-1 ring-gold/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'bg-white/[0.02] hover:bg-white/[0.04] border border-transparent hover:border-white/8'
            }`}
          >
            <p
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                d.isToday ? 'text-gold' : 'text-text-light'
              }`}
            >
              {d.label}
            </p>
            <p
              className={`text-[16px] font-bold tabular-nums leading-tight mt-0.5 ${
                d.isToday ? 'text-gold' : 'text-text'
              }`}
            >
              {d.dayNum}
            </p>
          </div>
        ))}
      </div>

      {/* Today's sessions list — internal scroll if many.
          Loading/error scoped here so the chrome above stays visible. */}
      <div className="flex-1 min-h-0 overflow-hidden -mx-1">
        {loading ? (
          <div className="h-full flex items-center justify-center text-text-light">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="h-full flex items-center gap-2 text-sm text-amber-300 px-2">
            <AlertCircle size={16} />
            <span className="truncate">{error}</span>
          </div>
        ) : todaySessions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold/10 ring-1 ring-gold/20 mb-2">
              <CalendarIcon size={18} className="text-gold" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-medium text-text">Your day is open</p>
            <p className="text-[12px] text-text-light mt-0.5">No sessions scheduled today.</p>
          </div>
        ) : (
          todaySessions.map((session) => {
            const formatted = formatTime12(session.start_time)
            const [hourMin, ampm] = formatted.split(' ')
            const sessionStatus = computeSessionStatus(session.start_time, session.end_time, now)
            const sessionType = session.session_type.replace(/_/g, ' ')
            const sessionTypeCap = sessionType.charAt(0).toUpperCase() + sessionType.slice(1)
            return (
              <div
                key={session.id}
                // Lift on hover — subtle border and brighter bg so
                // the session row reads as tappable.
                className="flex items-stretch gap-3 px-2 py-2.5 rounded-xl border border-transparent bg-white/[0.018] hover:bg-white/[0.04] hover:border-white/10 transition-all"
              >
                <div className="shrink-0 w-14 text-right border-r border-border/40 pr-3 flex flex-col justify-center">
                  <p className="text-[15px] font-semibold tracking-tight text-text leading-none">{hourMin}</p>
                  <p className="text-[10px] font-medium text-text-light tracking-wider uppercase mt-0.5">{ampm}</p>
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-[14px] font-medium text-text truncate">
                    {session.client_name ?? 'Studio Session'}{' '}
                    <span className="text-text-light font-normal">— {sessionTypeCap}</span>
                  </p>
                  <p className="text-[11px] text-text-light truncate mt-0.5">
                    {sessionTypeCap} · {session.room ?? 'Room TBD'} · {durationLabel(session.start_time, session.end_time)}
                  </p>
                </div>
                <div className="shrink-0 self-center">
                  <SessionStatusPill status={sessionStatus} />
                </div>
              </div>
            )
          })
        )}
      </div>

    </div>
  )
}

/**
 * Team Activity — placeholder feed showing what the screenshot's "Team
 * activity" section will look like. Mock data until the flywheel event
 * ledger ships (Phase 2 of the original blueprint), at which point this
 * reads from the immutable event table instead.
 */
const MOCK_ACTIVITY: { id: string; stage: Stage; actor: string; text: string; timeAgo: string }[] = [
  { id: '1', stage: 'share',   actor: 'Ava K.',     text: 'published a new BTS reel for Sage Linden',                  timeAgo: '12m ago' },
  { id: '2', stage: 'deliver', actor: 'Jordan L.',  text: "marked 'Masters — Tiger Beatz' as ready for delivery",      timeAgo: '34m ago' },
  { id: '3', stage: 'book',    actor: 'Richard B.', text: 'booked a recurring lesson block with Anna P.',              timeAgo: '2h ago' },
  { id: '4', stage: 'capture', actor: 'System',     text: 'captured 4 new leads from the Beat Leasing landing',        timeAgo: '3h ago' },
  { id: '5', stage: 'attract', actor: 'Marcus R.',  text: 'added a new invoice for The Artists Café',                  timeAgo: 'Yesterday' },
]

/**
 * Booking Snapshot — compact upcoming counter + "Book a Session" CTA.
 *
 * The CTA opens the canonical CreateBookingModal (same one Sessions.tsx
 * and Calendar.tsx use), so a booking made from Overview behaves
 * identically to one made from any other entry point. After save, the
 * Member context refetches automatically via MemberOverviewProvider.
 *
 * Like the Calendar widget, the chrome (TODAY eyebrow + count + CTA)
 * renders regardless of data state. Loading/error scope only to the
 * "Next session" detail line.
 */
export function BookingSnapshotWidget() {
  const { todaySessions, loading, error, refetch } = useMemberOverviewContext()
  const [showBooking, setShowBooking] = useState(false)

  const todayLabel = new Date()
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase()

  // Sort by start_time so "next" really is the soonest upcoming.
  const now = new Date()
  const upcoming = (todaySessions ?? [])
    .filter((s) => {
      const [eh, em] = parseClock(s.end_time)
      const end = new Date(now); end.setHours(eh, em, 0, 0)
      return end > now
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
  const next = upcoming[0]

  return (
    <div className="flex flex-col h-full">
      {/* TODAY eyebrow — matches Tasks + Calendar widget pattern. */}
      <p className="text-[11px] font-semibold tracking-[0.06em] text-gold/70 mb-2 shrink-0">
        TODAY · {todayLabel}
      </p>

      {/* "Book a Session" CTA — placed at the top of the widget so the
          primary action is the first thing the eye lands on. Opens the
          canonical CreateBookingModal (same one Sessions.tsx and
          Calendar.tsx use). Horizontal inset (`mx-0.5`) pulls the pill
          in from the card edges; the widget chrome then shows the
          supporting counter + next-session detail below. */}
      <button
        type="button"
        onClick={() => setShowBooking(true)}
        className="mx-0.5 mb-3 py-2 rounded-xl bg-gold hover:bg-gold-muted text-black text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0"
      >
        <Plus size={15} aria-hidden="true" />
        Book a Session
      </button>

      {/* Counter + next-session detail. Flows top-down below the CTA;
          `min-h-0 overflow-hidden` prevents overflow if content grows. */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <p className="text-[11px] uppercase tracking-wider text-text-light font-medium">
          Upcoming today
        </p>
        {/* Magazine-cover number — dropped 56 → 44px so a narrow
            column fits the counter + session detail + CTA button
            within the card without vertical overflow. */}
        <p className="mt-2 text-[44px] leading-none font-light tracking-[-0.04em] text-text tabular-nums">
          {loading ? '–' : upcoming.length}
        </p>
        <p className="mt-1 text-[12px] text-text-light">
          {loading ? 'loading…' : upcoming.length === 1 ? 'session left' : 'sessions left'}
        </p>

        {/* Next-session detail — error state scoped here so chrome stays. */}
        {error ? (
          <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2 text-[12px] text-amber-300">
            <AlertCircle size={14} className="shrink-0" />
            <span className="truncate">Could not load sessions</span>
          </div>
        ) : next ? (
          <div className="mt-3 pt-3 border-t border-border/40 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-text-light font-medium">
              Next
            </p>
            <p className="mt-1 text-[13px] font-medium text-text truncate">
              {next.client_name ?? 'Studio Session'}
            </p>
            <p className="text-[11px] text-gold mt-0.5 truncate">
              {formatTime12(next.start_time)} · {next.room ?? 'Room TBD'}
            </p>
          </div>
        ) : !loading ? (
          <p className="mt-3 pt-3 border-t border-border/40 text-[12px] text-text-light italic">
            Nothing else today.
          </p>
        ) : null}
      </div>

      {showBooking && (
        <CreateBookingModal
          onClose={() => {
            setShowBooking(false)
            void refetch()
          }}
        />
      )}
    </div>
  )
}

/**
 * Notifications widget — Discord-style per-channel unread tracking.
 *
 * Pulls `get_channel_notifications()` RPC (migration
 * `channel_notifications_rpc`): returns every channel with its latest
 * message preview + unread count for the calling user (computed against
 * their row in `chat_channel_reads`). Channels with unread messages sort
 * first, then most-recently-active, then alphabetical.
 *
 * Clicking a row calls `mark_channel_read(channel_id)` (optimistic update
 * to the react-query cache so the badge clears instantly) and navigates
 * to /content?channel=slug. Opening the Forum page itself will later
 * mark channels read too — that wiring lives on `Content.tsx`.
 *
 * Realtime: subscribes to INSERT on `chat_messages` across all channels
 * and refetches on any change. A single project-wide subscription keeps
 * cost minimal vs. one channel per row.
 *
 * Empty state (no messages anywhere) still shows the full channel list
 * so users understand the widget's structure before activity starts.
 */
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

export function ForumNotificationsWidget() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const todayLabel = new Date()
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase()

  const notifQuery = useQuery({
    queryKey: ['overview-notifications'],
    queryFn: fetchChannelNotifications,
    // Refresh every 60s to keep "Xm ago" labels + unread counts fresh
    // without waiting for realtime to kick (covers missed events too).
    refetchInterval: 60_000,
  })

  // PR #7 — parallel fetch for assignment notifications. Only enabled
  // when we have a profile id; server-side guard enforces caller ==
  // p_user_id so we never fire it as an unauthed request.
  const assignmentsQuery = useQuery({
    queryKey: ['overview-assignment-notifications', profile?.id],
    queryFn: () => fetchAssignmentNotifications(profile!.id, { unreadOnly: false, limit: 20 }),
    enabled: Boolean(profile?.id),
    refetchInterval: 60_000,
  })

  // Realtime — any new chat_messages insert anywhere triggers a refetch
  // of channel unread counts. See PR #7 for the parallel subscription
  // on assignment_notifications below.
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

  // Realtime — new assignment_notifications for THIS user (filter on
  // recipient_id) trigger a refetch of the assignments list. Cleanup
  // mirrors the chat subscription.
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

  // Optimistic mark-read — update cache before RPC returns so the badge
  // clears on click with no visible delay.
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
      // On error, revert by invalidating so the server-truth returns.
      void queryClient.invalidateQueries({ queryKey: ['overview-notifications'] })
    })
  }

  // PR #7 — optimistic mark-read for assignment notifications. Same
  // cache-first pattern as channels.
  //
  // PR #11 — ALSO dispatches a `highlight-task` CustomEvent so that
  // MyTasksCard (wherever it's mounted) scrolls the matching row
  // into view and flashes a gold ring. Click the notification →
  // "here's where your new task is."
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

    // Highlight the task(s) from this batch in MyTasksCard. The card
    // finds the first task whose `batch.id` matches and flashes it.
    window.dispatchEvent(
      new CustomEvent('highlight-task', { detail: { batchId: n.batch_id } }),
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* TODAY eyebrow + total unread pill — matches sibling widgets. */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <p className="text-[11px] font-semibold tracking-[0.06em] text-gold/70">
          TODAY · {todayLabel}
        </p>
        {totalUnread > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 ring-1 ring-rose-500/40 text-rose-300 text-[10px] font-bold tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" aria-hidden="true" />
            {totalUnread} New
          </span>
        )}
      </div>

      {/* Channel rows — internal scroll keeps the page non-scrolling. */}
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
        ) : channels.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
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
            const initial = c.latest_initial ?? '#'
            return (
              <Link
                key={c.channel_id}
                to={`${APP_ROUTES.member.content}${c.channel_slug ? `?channel=${c.channel_slug}` : ''}`}
                onClick={() => handleChannelClick(c.channel_id)}
                // Lift on hover — border + brighter bg so the row
                // reads as clickable. Unread channels stay tinted gold.
                className={`group relative flex items-start gap-2.5 px-2 py-2 rounded-xl border border-transparent transition-all ${
                  unread
                    ? 'bg-gold/8 hover:bg-gold/12 hover:border-gold/20'
                    : 'bg-white/[0.018] hover:bg-white/[0.04] hover:border-white/10'
                }`}
              >
                {/* Avatar — sender initial of latest message, or # if empty. */}
                <div
                  className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-colors ${
                    unread
                      ? 'bg-gold/20 ring-1 ring-gold/50 text-gold'
                      : 'bg-surface-alt border border-border-light text-text-muted'
                  }`}
                >
                  {initial}
                </div>

                <div className="flex-1 min-w-0">
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
                </div>
              </Link>
            )
          })
        )}

        {/* PR #7 — Assignments section. Renders below channels when the
            current user has any assignment notifications. Same widget
            shell, two data sources, one unified unread pill above. */}
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
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleAssignmentClick(n)}
                  className={`w-full group relative flex items-start gap-2.5 px-2 py-2 rounded-xl border border-transparent transition-all text-left ${
                    unread
                      ? 'bg-gold/8 hover:bg-gold/12 hover:border-gold/20'
                      : 'bg-white/[0.018] hover:bg-white/[0.04] hover:border-white/10'
                  }`}
                >
                  <div
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      unread
                        ? 'bg-gold/20 ring-1 ring-gold/50 text-gold'
                        : 'bg-surface-alt border border-border-light text-text-muted'
                    }`}
                  >
                    <Inbox size={14} aria-hidden="true" />
                  </div>
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
      </div>

    </div>
  )
}

export function TeamActivityWidget() {
  return (
    <div className="flex flex-col h-full -mx-1">
      <div className="flex-1 space-y-0">
        {MOCK_ACTIVITY.map((item) => {
          const ss = STAGE_STYLES[item.stage]
          const stageCap = item.stage.charAt(0).toUpperCase() + item.stage.slice(1)
          return (
            <div
              key={item.id}
              className="flex items-start gap-3 px-1 py-3 rounded-lg hover:bg-surface-hover/30 transition-colors"
            >
              <span
                className={`shrink-0 mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ss.bg} ${ss.text} ring-1 ${ss.ring}`}
              >
                <span className={`w-1 h-1 rounded-full ${ss.dot}`} aria-hidden="true" />
                {stageCap}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-text leading-snug">
                  <span className="font-medium">{item.actor}</span> {item.text}
                </p>
                <p className="text-[10px] text-text-light mt-0.5">{item.timeAgo}</p>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-text-light italic mt-2 px-1">
        Activity feed is mock data until the flywheel event ledger ships.
      </p>
    </div>
  )
}

/**
 * TeamTasksWidget — Overview's personal task widget. Renders the SAME
 * MyTasksCard component used on the /daily Tasks page so checking a
 * task on Overview shows pending on /daily and vice versa (state lives
 * in MyTasksContext at the app root). Widget id stays `team_tasks` so
 * existing layout configs keep resolving — registry title/description
 * was updated to "My Tasks" / "Personal queue."
 */
export function TeamTasksWidget() {
  // `embedded` — no outer `widget-card` wrapper + no duplicate "My Tasks"
  // title. The parent `DashboardWidgetFrame` already renders both.
  return <MyTasksCard embedded />
}

/**
 * TeamDirectoryWidget — quick-reference row of teammates on Overview.
 *
 * Horizontal avatar strip sourced from `team_members` via the shared
 * react-query cache. Active members surface first; inactive fall to
 * the end at reduced opacity so they're findable but de-emphasized.
 * Each avatar links to the member's profile page. Empty state covers
 * the pre-onboarding case where no members exist yet.
 */
export function TeamDirectoryWidget() {
  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
  })

  if (teamQuery.isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-text-light">
        <Loader2 size={18} className="animate-spin" />
      </div>
    )
  }

  if (teamQuery.error) {
    return (
      <div className="h-full flex items-center gap-2 text-sm text-amber-300">
        <AlertCircle size={16} />
        <span>Could not load team: {(teamQuery.error as Error).message}</span>
      </div>
    )
  }

  const members: TeamMember[] = teamQuery.data ?? []

  if (members.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-center">
        <div>
          <Users size={20} className="text-text-light mx-auto mb-2" aria-hidden="true" />
          <p className="text-[13px] text-text-light italic">No team members yet.</p>
        </div>
      </div>
    )
  }

  // Active first, inactive last (dimmed). Treat anything not explicitly
  // 'inactive' (case-insensitive) as active so the default status or
  // missing status still shows up.
  const ordered = [...members].sort((a, b) => {
    const aInactive = a.status?.toLowerCase() === 'inactive'
    const bInactive = b.status?.toLowerCase() === 'inactive'
    if (aInactive === bInactive) return a.display_name.localeCompare(b.display_name)
    return aInactive ? 1 : -1
  })

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1"
        aria-label="Team members — scroll horizontally for more"
      >
        <div className="flex gap-4 py-2">
          {ordered.map((m) => {
            const inactive = m.status?.toLowerCase() === 'inactive'
            const initial = m.display_name?.charAt(0)?.toUpperCase() ?? '?'
            return (
              <Link
                key={m.id}
                to={`/profile/${m.id}`}
                className={`group flex flex-col items-center gap-1.5 shrink-0 w-[72px] focus-ring rounded-lg transition-all ${
                  inactive ? 'opacity-50 hover:opacity-80' : 'hover:-translate-y-0.5'
                }`}
                title={m.position ? `${m.display_name} — ${m.position}` : m.display_name}
              >
                <div className="w-12 h-12 rounded-full bg-surface-alt border-2 border-border-light text-gold flex items-center justify-center text-[15px] font-bold shrink-0 group-hover:border-gold/50 transition-colors">
                  {initial}
                </div>
                <span className="text-[11px] font-medium text-text-muted tracking-tight truncate max-w-full group-hover:text-text transition-colors">
                  {m.display_name.split(' ')[0]}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
      <p className="text-[11px] text-text-light mt-2">
        Click a teammate to open their profile.
      </p>
    </div>
  )
}

export function FlywheelSummaryWidget() {
  const { daily, todaySessions, mustDoSubmission, primaryKpi, kpiEntries, loading, error } = useMemberOverviewContext()
  const status = <WidgetStatus error={error} loading={loading} />
  if (loading || error) return status

  const chartData = buildMemberFlywheelChartData(
    daily.percentage,
    todaySessions.length,
    !!mustDoSubmission,
    primaryKpi,
    kpiEntries,
  )
  const kpiTrendLabel = getKpiTrendLabel(kpiEntries)

  // Recharts needs a numeric value; unbacked stages render with value 0
  // but we style them differently via Cell fill/opacity so they read as
  // "coming soon" rather than "zero."
  const recharts = chartData.map((entry) => ({
    name: entry.name,
    pct: entry.pct ?? 0,
    backed: entry.backed,
  }))

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <Link to={APP_ROUTES.admin.analytics} className="flex items-center gap-1 group">
          <h3 className="text-[14px] font-bold text-text tracking-tight group-hover:text-gold transition-colors">Flywheel Today</h3>
          <ChevronRight size={12} className="text-text-light group-hover:text-gold transition-colors" />
        </Link>
        <span className="text-[10px] text-text-light">
          {daily.completedCount} / {daily.totalCount} tasks complete
        </span>
      </div>
      {primaryKpi && (
        <div className="mb-3 flex items-center gap-2 text-xs text-text-light">
          <Target size={13} className="text-gold" />
          <span className="truncate">{primaryKpi.name}</span>
          {kpiTrendLabel === 'up' && <TrendingUp size={13} className="text-emerald-400" />}
          {kpiTrendLabel === 'down' && <TrendingDown size={13} className="text-red-400" />}
        </div>
      )}
      <div className="h-[110px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={recharts}>
            <Bar dataKey="pct" radius={[4, 4, 0, 0]} barSize={30}>
              {recharts.map((entry) => (
                <Cell
                  key={entry.name}
                  fill="#C9A84C"
                  fillOpacity={entry.backed ? 0.72 : 0.22}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between px-1 mt-1">
        {chartData.map((entry) => (
          <span
            key={entry.name}
            className={`text-[9px] ${entry.backed ? 'text-text-light' : 'text-text-light/50 italic'}`}
            title={entry.backed ? undefined : 'Awaiting flywheel event ledger'}
          >
            {entry.name}
          </span>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-text-light">Tasks</p>
          <p className="mt-1 text-lg font-semibold text-text">{daily.percentage}%</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-text-light">Sessions</p>
          <p className="mt-1 text-lg font-semibold text-text">{todaySessions.length}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-text-light">Must-Do</p>
          <p className="mt-1 text-lg font-semibold text-text">{mustDoSubmission ? 'Done' : 'Open'}</p>
        </div>
      </div>
    </div>
  )
}
