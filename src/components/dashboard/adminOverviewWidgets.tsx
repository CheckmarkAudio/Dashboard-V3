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
import { useAdminOverviewContext } from '../../contexts/AdminOverviewContext'
import { Badge, ListPanel, ListRow } from '../ui'

function formatTimeLabel(value?: string | null): string {
  if (!value) return 'All day'
  const [hourText = '0', minuteText = '00'] = value.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`
}

export function TeamFocusWidget() {
  const { snapshot, loading, error } = useAdminOverviewContext()

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

      {/* Skin pass 2026-05-06 — member list flattened to booking-style:
          inset-panel + divide-theme hairlines, per-row card chrome
          dropped. Each member is a flat row inside the bordered panel. */}
      <div className="inset-panel">
        <div className="divide-y divide-theme">
        {snapshot.members.slice(0, 5).map((member) => {
          const pct = member.dailyTotal > 0 ? Math.round((member.dailyDone / member.dailyTotal) * 100) : 0
          return (
            <div key={member.id} className="px-3 py-2.5 hover:bg-surface-hover transition-colors">
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
                <div className="mt-2 h-1.5 rounded-full bg-surface-alt border border-border overflow-hidden">
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
    </div>
  )
}

export function ApprovalQueueWidget() {
  const { snapshot, loading, error } = useAdminOverviewContext()

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
  const { schedule: events, loading, error } = useAdminOverviewContext()

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

  // Skin pass 2026-05-06 (rev2) — full nested-panel pattern: a pure-
  // white `<ListPanel>` with its own bold title + subtitle, sitting
  // inside the slightly-dimmed widget frame. The frame's own title
  // is suppressed via `hideTitle: true` in the registry so we don't
  // duplicate the heading. Each event is a `<ListRow>` with the
  // calendar icon on the left and the time as a neutral pill on the
  // right — needle-thin dividers between rows.
  return (
    <ListPanel title="Today's sessions">
      {events.map((event) => (
        <ListRow
          key={event.id}
          icon={
            <span className="icon-tile-gold w-8 h-8">
              <CalendarDays size={14} className="text-gold" aria-hidden="true" />
            </span>
          }
          title={event.title}
          meta={
            [event.member_name, event.subtitle].filter(Boolean).join(' · ') ||
            'Studio event'
          }
          right={
            <Badge variant="neutral" size="sm">
              {formatTimeLabel(event.start_time)}
            </Badge>
          }
        />
      ))}
    </ListPanel>
  )
}

export function AdminShortcutsWidget() {
  const links = [
    { to: APP_ROUTES.admin.team, label: 'Team Manager', icon: Users },
    { to: APP_ROUTES.admin.members, label: 'Reviews & KPIs', icon: CheckCircle2 },
    { to: APP_ROUTES.admin.templates, label: 'Templates', icon: ClipboardCheck },
    { to: APP_ROUTES.member.calendar, label: 'Calendar', icon: CalendarDays },
  ]

  // Skin pass 2026-05-06 (rev2) — nested-panel pattern: pure-white
  // `<ListPanel>` with its own title + subtitle, inside the dimmed
  // widget frame (frame title suppressed via `hideTitle: true`).
  // Each shortcut is a `<ListRow to={…}>` so `ListRow` renders a
  // real `<Link>` with hover + focus.
  return (
    <ListPanel title="Quick links">
      {links.map(({ to, label, icon: Icon }) => (
        <ListRow
          key={to}
          to={to}
          icon={
            <span className="icon-tile-gold w-8 h-8">
              <Icon size={14} className="text-gold" aria-hidden="true" />
            </span>
          }
          title={label}
          right={<ArrowRight size={14} className="text-text-light" aria-hidden="true" />}
        />
      ))}
    </ListPanel>
  )
}
