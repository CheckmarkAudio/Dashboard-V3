import { useState } from 'react'
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

export function TodayCalendarWidget() {
  const { todaySessions, loading, error } = useMemberOverviewContext()
  const status = <WidgetStatus error={error} loading={loading} />
  if (loading || error) return status

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 mb-3">
        <CalendarIcon size={14} className="text-gold" />
        <p className="text-[11px] text-text-light">{dateLabel}</p>
      </div>
      {todaySessions.length > 0 ? (
        <div className="space-y-0">
          {todaySessions.map((session) => (
            <div key={session.id} className="py-3 border-b border-border/20 last:border-0 first:pt-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[14px] font-medium text-text tracking-tight">{session.client_name ?? 'Studio Session'}</p>
                <span className="text-[10px] font-semibold text-gold bg-gold/10 px-1.5 py-0.5 rounded">
                  {durationLabel(session.start_time, session.end_time)}
                </span>
              </div>
              <p className="text-[12px] text-text-muted capitalize">{session.session_type.replace(/_/g, ' ')}</p>
              <p className="text-[12px] text-text-light mt-0.5">
                {formatTime12(session.start_time)} - {formatTime12(session.end_time)}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-semibold text-gold/70 bg-gold/5 border border-gold/15 px-1.5 py-0.5 rounded">
                  {session.status}
                </span>
                <span className="text-[10px] text-text-light">{session.room ?? 'Room TBD'}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-text-light italic py-6 text-center">No sessions scheduled for today</p>
      )}
    </div>
  )
}

export function TeamTasksWidget() {
  const { daily, loading, error } = useMemberOverviewContext()
  const [showCompleted, setShowCompleted] = useState(false)
  const status = <WidgetStatus error={error} loading={loading} />
  if (loading || error) return status

  const visibleTasks = daily.items
    .filter((item) => showCompleted || !item.is_completed)
    .slice(0, 8)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex bg-surface-alt rounded-lg p-0.5 border border-border">
          {['Open', 'All'].map((option) => (
            <button
              key={option}
              onClick={() => setShowCompleted(option === 'All')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium tracking-tight transition-all ${
                (showCompleted ? 'All' : 'Open') === option ? 'bg-gold/12 text-gold' : 'text-text-light hover:text-text-muted'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <Link to={APP_ROUTES.member.tasks} className="text-xs font-medium text-gold hover:underline">
          Open checklist
        </Link>
      </div>
      <div className="flex-1 space-y-0">
        {visibleTasks.map((task) => (
          <div key={task.id} className={`flex items-center gap-2 py-[11px] border-b border-border/30 last:border-0 ${task.is_completed ? 'opacity-40' : ''}`}>
            <button onClick={() => void daily.toggleItem(task.id)} className="shrink-0">
              <div className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-all ${
                task.is_completed ? 'bg-gold/30 border-gold/40' : 'border-border-light hover:border-gold/50'
              }`}>
                {task.is_completed && <Check size={11} className="text-gold" />}
              </div>
            </button>
            <span className={`flex-1 text-[14px] font-normal tracking-tight truncate min-w-0 ${task.is_completed ? 'line-through text-text-light' : 'text-text-muted'}`}>
              {task.item_text}
            </span>
            <span className="text-[11px] shrink-0 tabular-nums text-text-light">{task.category}</span>
          </div>
        ))}
        {visibleTasks.length === 0 && (
          <div className="py-8 text-center text-sm text-text-light italic">
            {showCompleted ? 'No tasks have been generated for today.' : 'You are caught up for the day.'}
          </div>
        )}
      </div>
      <div className="pt-4 mt-auto text-[11px] text-text-light">
        Click any task to mark it complete and keep your day moving.
      </div>
    </div>
  )
}

/**
 * TeamDirectoryWidget — quick-reference row of teammates on Overview.
 *
 * Horizontal avatar strip sourced from `intern_users` via the shared
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
