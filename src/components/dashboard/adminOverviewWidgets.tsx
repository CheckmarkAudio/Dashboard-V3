import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Users,
} from 'lucide-react'
import { APP_ROUTES } from '../../app/routes'
import { loadAdminOverviewSnapshot, loadAdminTodaySchedule } from '../../domain/dashboard/adminOverview'
import type { AdminOverviewSnapshot } from '../../domain/dashboard/adminOverview'
import type { CalendarEvent } from '../../types'

function formatTimeLabel(value?: string | null): string {
  if (!value) return 'All day'
  const [hourText = '0', minuteText = '00'] = value.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`
}

function useAdminOverviewSnapshotState() {
  const [snapshot, setSnapshot] = useState<AdminOverviewSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadAdminOverviewSnapshot()
      .then((next) => {
        if (cancelled) return
        setSnapshot(next)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load overview data'
        setError(message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { snapshot, loading, error }
}

function useAdminTodayScheduleState() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadAdminTodaySchedule()
      .then((next) => {
        if (cancelled) return
        setEvents(next)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load today schedule'
        setError(message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { events, loading, error }
}

export function TeamFocusWidget() {
  const { snapshot, loading, error } = useAdminOverviewSnapshotState()

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-light">
        <Loader2 size={18} className="animate-spin" />
      </div>
    )
  }

  if (error || !snapshot) {
    return (
      <div className="h-full flex items-center gap-2 text-sm text-amber-300">
        <AlertCircle size={16} />
        <span>{error ?? 'Unable to load team focus'}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface-alt/60 p-3">
          <p className="text-[11px] uppercase tracking-wide text-text-light">Active Team</p>
          <p className="mt-2 text-2xl font-semibold text-text">{snapshot.activeMembers}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-alt/60 p-3">
          <p className="text-[11px] uppercase tracking-wide text-text-light">Daily Complete</p>
          <p className="mt-2 text-2xl font-semibold text-text">
            {snapshot.fullyCompleteMembers}/{snapshot.membersWithDailyTasks}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-alt/60 p-3">
          <p className="text-[11px] uppercase tracking-wide text-text-light">Submitted Today</p>
          <p className="mt-2 text-2xl font-semibold text-text">{snapshot.submittedTodayCount}</p>
        </div>
      </div>

      <div className="space-y-2">
        {snapshot.members.slice(0, 5).map((member) => {
          const pct = member.dailyTotal > 0 ? Math.round((member.dailyDone / member.dailyTotal) * 100) : 0
          return (
            <div key={member.id} className="rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text truncate">{member.displayName}</p>
                  <p className="text-[11px] text-text-light capitalize">{member.position.replace(/_/g, ' ')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-text tabular-nums">
                    {member.dailyTotal > 0 ? `${member.dailyDone}/${member.dailyTotal}` : 'No tasks'}
                  </p>
                  <p className={`text-[11px] ${member.submittedToday ? 'text-emerald-400' : 'text-text-light'}`}>
                    {member.submittedToday ? 'Submitted' : 'Awaiting submission'}
                  </p>
                </div>
              </div>
              {member.dailyTotal > 0 && (
                <div className="mt-2 h-1.5 rounded-full bg-surface border border-border/40 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#10b981' : '#C9A84C' }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ApprovalQueueWidget() {
  const { snapshot, loading, error } = useAdminOverviewSnapshotState()

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-light">
        <Loader2 size={18} className="animate-spin" />
      </div>
    )
  }

  if (error || !snapshot) {
    return (
      <div className="h-full flex items-center gap-2 text-sm text-amber-300">
        <AlertCircle size={16} />
        <span>{error ?? 'Unable to load approvals'}</span>
      </div>
    )
  }

  const totalPending = snapshot.pendingEditRequests + snapshot.pendingSubmissionReviews

  return (
    <div className="h-full flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-surface-alt/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-text-light">Needs Review</span>
            <ClipboardCheck size={14} className="text-gold" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-text">{totalPending}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-2.5">
          <p className="text-sm font-medium text-text">Task edit requests</p>
          <p className="mt-1 text-xl font-semibold text-text">{snapshot.pendingEditRequests}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-2.5">
          <p className="text-sm font-medium text-text">Unreviewed submissions</p>
          <p className="mt-1 text-xl font-semibold text-text">{snapshot.pendingSubmissionReviews}</p>
        </div>
      </div>
      <Link
        to={APP_ROUTES.admin.hub}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:underline"
      >
        Open approvals workspace <ArrowRight size={14} />
      </Link>
    </div>
  )
}

export function AdminScheduleWidget() {
  const { events, loading, error } = useAdminTodayScheduleState()

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

  if (events.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm italic text-text-light">
        No sessions or meetings scheduled for today.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div key={event.id} className="rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text">{event.title}</p>
              <p className="mt-1 text-[11px] text-text-light">
                {[event.member_name, event.subtitle].filter(Boolean).join(' · ') || 'Studio event'}
              </p>
            </div>
            <span className="text-xs font-semibold text-gold shrink-0">
              {formatTimeLabel(event.start_time)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdminShortcutsWidget() {
  const links = [
    { to: APP_ROUTES.admin.team, label: 'Team Manager', icon: Users },
    { to: APP_ROUTES.admin.members, label: 'Reviews & KPIs', icon: CheckCircle2 },
    { to: APP_ROUTES.admin.templates, label: 'Templates', icon: ClipboardCheck },
    { to: APP_ROUTES.member.calendar, label: 'Calendar', icon: CalendarDays },
  ]

  return (
    <div className="space-y-2">
      {links.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex items-center justify-between rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-3 text-sm font-medium text-text transition-colors hover:border-gold/40 hover:text-gold"
        >
          <span className="flex items-center gap-2">
            <Icon size={15} className="text-gold" />
            {label}
          </span>
          <ArrowRight size={14} />
        </Link>
      ))}
    </div>
  )
}
