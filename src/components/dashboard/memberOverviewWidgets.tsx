import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts'
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  ChevronRight,
  FileText,
  Flame,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { APP_ROUTES } from '../../app/routes'
import { useMemberOverviewContext } from '../../contexts/MemberOverviewContext'
import { buildMemberFlywheelChartData, getKpiTrendLabel } from '../../domain/dashboard/memberOverview'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import type { TeamMember } from '../../types'
import MyTasksSection from './MyTasksSection'

// Stage tokens shared between the activity feed + status pills.
// Sourced from the v1.0 design system (Deliver/Capture/Share/Attract/Book).
type Stage = 'deliver' | 'capture' | 'share' | 'attract' | 'book'
const STAGE_STYLES: Record<Stage, { dot: string; text: string; bg: string; ring: string }> = {
  deliver: { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30' },
  capture: { dot: 'bg-sky-400',     text: 'text-sky-300',     bg: 'bg-sky-500/10',     ring: 'ring-sky-500/30' },
  share:   { dot: 'bg-violet-400',  text: 'text-violet-300',  bg: 'bg-violet-500/10',  ring: 'ring-violet-500/30' },
  attract: { dot: 'bg-amber-400',   text: 'text-amber-300',   bg: 'bg-amber-500/10',   ring: 'ring-amber-500/30' },
  book:    { dot: 'bg-rose-400',    text: 'text-rose-300',    bg: 'bg-rose-500/10',    ring: 'ring-rose-500/30' },
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
 * Today Schedule — refreshed per v1.0 design system "Today's sessions" card.
 * Time gutter on left, name+subtitle in middle, status pill on right.
 */
export function TodayCalendarWidget() {
  const { todaySessions, loading, error } = useMemberOverviewContext()
  const status = <WidgetStatus error={error} loading={loading} />
  if (loading || error) return status

  if (todaySessions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold/10 ring-1 ring-gold/20 mb-2">
            <CalendarIcon size={18} className="text-gold" aria-hidden="true" />
          </div>
          <p className="text-[14px] font-medium text-text">No sessions today</p>
          <p className="text-[12px] text-text-light mt-0.5">Your day is open.</p>
        </div>
      </div>
    )
  }

  const now = new Date()

  return (
    <div className="flex flex-col h-full -mx-1">
      {todaySessions.map((session) => {
        const formatted = formatTime12(session.start_time)
        const [hourMin, ampm] = formatted.split(' ')
        const sessionStatus = computeSessionStatus(session.start_time, session.end_time, now)
        const sessionType = session.session_type.replace(/_/g, ' ')
        const sessionTypeCap = sessionType.charAt(0).toUpperCase() + sessionType.slice(1)
        return (
          <div
            key={session.id}
            className="flex items-stretch gap-3 px-1 py-3 rounded-lg hover:bg-surface-hover/40 transition-colors"
          >
            <div className="shrink-0 w-14 text-right border-r border-border/40 pr-3 flex flex-col justify-center">
              <p className="text-[15px] font-semibold tracking-tight text-text leading-none">{hourMin}</p>
              <p className="text-[10px] font-medium text-text-light tracking-wider uppercase mt-0.5">{ampm}</p>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-[14px] font-medium text-text truncate">
                {session.client_name ?? 'Studio Session'} <span className="text-text-light font-normal">— {sessionTypeCap}</span>
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
      })}
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
 * TeamTasksWidget — Overview's "My tasks · Across all flywheel stages" surface.
 * Delegates to MyTasksSection per the v1.0 design system rendering.
 * Frame title + description come from the widget registry, so the section
 * starts directly with filter pills.
 */
export function TeamTasksWidget() {
  return <MyTasksSection />
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
        className="flex-1 overflow-x-auto overflow-y-hidden"
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
