import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarRange,
  Edit3,
  Loader2,
  Users,
} from 'lucide-react'
import { useTeamSchedule } from '../../lib/schedule/useTeamSchedule'
import {
  endOfWeek,
  startOfWeek,
  toLocalDateString,
} from '../../lib/schedule/expand'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import type { ExpandedSchedule } from '../../types'

/**
 * Admin Hub widget — Employee Schedule.
 *
 * Glance-able weekly digest of who's on shift across the team, with
 * an "Edit schedule" action that deep-links to Members → Work
 * Scheduler. Sits at the front of the Hub carousel per user direction
 * ("Widget Order: Approvals, Employee Schedule, Notifications").
 *
 * Renders 7 day rows (Mon→Sun). Each row shows a wrapped list of
 * member chips (display name + time range) — same purple chip
 * treatment as the Calendar overlay + MyScheduleWidget for visual
 * consistency. Pending request count surfaces as a small amber badge
 * in the header so admins notice when there's something to review
 * without leaving the Hub.
 */
export default function AdminEmployeeScheduleWidget() {
  // Always pin to the current week. A future iteration could add
  // chevrons, but the Hub widget is meant as "this week at a glance" —
  // a tighter mental model than a navigable week view.
  const weekStart = useMemo(() => startOfWeek(new Date()), [])
  const range = useMemo(
    () => ({
      from: toLocalDateString(weekStart),
      to: toLocalDateString(endOfWeek(weekStart)),
    }),
    [weekStart],
  )

  // includePending=true so the header pending badge counts something;
  // pending entries get filtered out of the day-row body below.
  const { expanded, pendingBlocks, loading } = useTeamSchedule({
    range,
    includePending: true,
  })

  // Member name lookup. Cached at the page level — first fetch warms
  // every surface that uses the same teamMemberKeys.list() query key.
  const { data: members = [] } = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
    staleTime: 60_000,
  })
  const memberNameById = useMemo(() => {
    const map = new Map<string, string>()
    members.forEach((m) => map.set(m.id, m.display_name || 'Member'))
    return map
  }, [members])

  // Bucket approved-only entries by date for the day rows. Pending
  // proposals live in the header badge only — admins act on them via
  // Members → Work Scheduler (where the Pending Requests panel surfaces
  // approve/deny inline).
  const days = useMemo(() => {
    const out: { key: string; date: Date; entries: ExpandedSchedule[] }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      out.push({ key: toLocalDateString(d), date: d, entries: [] })
    }
    const byKey = new Map(out.map((d) => [d.key, d]))
    for (const e of expanded) {
      if (e.status !== 'approved') continue
      const key = toLocalDateString(new Date(e.starts_at))
      const bucket = byKey.get(key)
      if (bucket) bucket.entries.push(e)
    }
    // Each day's chips sort by start time; alphabetical tie-break by
    // member name for stable rendering across re-fetches.
    for (const d of out) {
      d.entries.sort((a, b) => {
        if (a.starts_at !== b.starts_at) return a.starts_at < b.starts_at ? -1 : 1
        const an = memberNameById.get(a.member_id) ?? ''
        const bn = memberNameById.get(b.member_id) ?? ''
        return an.localeCompare(bn)
      })
    }
    return out
  }, [expanded, weekStart, memberNameById])

  const weekLabel = useMemo(() => {
    const end = endOfWeek(weekStart)
    const s = weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })
    const e = end.toLocaleDateString([], { month: 'short', day: 'numeric' })
    return `${s} – ${e}`
  }, [weekStart])

  // Count distinct members staffed this week — a quick "5 on schedule"
  // header stat that's more informative than a raw row count.
  const stafedCount = useMemo(() => {
    const ids = new Set<string>()
    for (const d of days) {
      for (const e of d.entries) ids.add(e.member_id)
    }
    return ids.size
  }, [days])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Users size={13} className="text-purple-300 shrink-0" aria-hidden="true" />
          <span className="text-[11px] text-text-light truncate">
            {weekLabel} · {stafedCount} staffed
          </span>
          {pendingBlocks.length > 0 && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[10px] font-semibold"
              title={`${pendingBlocks.length} pending schedule request${pendingBlocks.length === 1 ? '' : 's'} awaiting review`}
            >
              {pendingBlocks.length} pending
            </span>
          )}
        </div>
        <Link
          to="/admin/team"
          aria-label="Edit team schedule"
          title="Open Members → Work Scheduler"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-border bg-surface-alt text-text-muted hover:text-gold hover:border-gold/40 transition-colors"
        >
          <Edit3 size={11} aria-hidden="true" />
          Edit
        </Link>
      </div>

      {/* Body — 7 day stacked list */}
      <div className="flex-1 overflow-y-auto pr-0.5">
        {loading ? (
          <div className="h-24 flex items-center justify-center text-text-muted">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          </div>
        ) : stafedCount === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8">
            <CalendarRange size={20} className="text-text-light mb-2" aria-hidden="true" />
            <p className="text-[12px] text-text-muted">No schedule set for this week.</p>
            <Link
              to="/admin/team"
              className="text-[11px] text-gold hover:underline mt-2"
            >
              Set up Work Scheduler
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {days.map((d) => (
              <DayRow
                key={d.key}
                date={d.date}
                entries={d.entries}
                memberNameById={memberNameById}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DayRow({
  date,
  entries,
  memberNameById,
}: {
  date: Date
  entries: ExpandedSchedule[]
  memberNameById: Map<string, string>
}) {
  const dayName = date.toLocaleDateString([], { weekday: 'short' })
  const dayNum = date.toLocaleDateString([], { day: 'numeric' })
  const isToday = toLocalDateString(date) === toLocalDateString(new Date())
  return (
    <div className={`flex items-start gap-2 px-2 py-1.5 rounded-md ${isToday ? 'bg-gold/[0.05]' : ''}`}>
      <div className="w-9 shrink-0 text-center">
        <p className={`text-[10px] uppercase font-semibold ${isToday ? 'text-gold' : 'text-text-muted'}`}>
          {dayName}
        </p>
        <p className={`text-[11px] ${isToday ? 'text-gold' : 'text-text-light'}`}>{dayNum}</p>
      </div>
      <div className="flex-1 min-w-0">
        {entries.length === 0 ? (
          <p className="text-[10px] text-text-light italic pt-0.5">—</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {entries.map((e) => {
              const starts = new Date(e.starts_at)
              const ends = new Date(e.ends_at)
              const time = `${starts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–${ends.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
              const memberName = memberNameById.get(e.member_id) ?? 'Member'
              return (
                <span
                  key={e.key}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-purple-500/20 bg-purple-700/10 text-[11px] text-purple-100"
                  title={`${memberName} · ${time}${e.note ? ` · ${e.note}` : ''}`}
                >
                  <span className="font-semibold truncate max-w-[110px]">{memberName}</span>
                  <span className="opacity-70">{time}</span>
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
