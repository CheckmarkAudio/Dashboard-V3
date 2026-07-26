import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Loader2, Users } from 'lucide-react'
import { fetchTeamMembers, teamMemberKeys } from '../../lib/queries/teamMembers'
import { useTeamSchedule } from '../../lib/schedule/useTeamSchedule'
import { toLocalDateString } from '../../lib/schedule/expand'
import {
  buildActivityDay,
  type ActivityDayModel,
  type SegmentKind,
} from '../../lib/activity/buildActivityDay'
import {
  fetchTeamActivityEvents,
  fetchTeamPresenceSessions,
  toScheduledWindows,
  memberActivityKeys,
} from '../../lib/activity/queries'
import MemberAvatar from '../members/MemberAvatar'
import type { TeamMember } from '../../types'

// Shared axis for every row so bars line up and are directly
// comparable at a glance — same 7a–9p window MyActivityTodayWidget
// defaults to for an ordinary day.
const AXIS_START_HOUR = 7
const AXIS_END_HOUR = 21

const SEGMENT_COLOR: Record<SegmentKind, string> = {
  on: '#34d399',
  late: '#fbbf24',
  off: '#60a5fa',
}

function startOfLocalDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

/**
 * AdminTeamActivityWidget — "Team Activity" (Admin Hub).
 *
 * The admin counterpart to MyActivityTodayWidget: one compact
 * presence-vs-schedule bar per team member, all sharing the same
 * fixed axis so admins can compare who's on-schedule / late /
 * off-schedule at a glance. Deliberately simpler than the personal
 * widget — no per-event markers or activity feed, just the bar,
 * since the point here is a team-wide scan, not one person's detail
 * (that's what clicking through to their profile is for).
 *
 * One team-wide presence query + one team-wide events query (both
 * RLS-scoped to the admin's team, no member filter) cover every row —
 * N members costs the same 2 round trips as 1 member would.
 */
export default function AdminTeamActivityWidget() {
  const now = new Date()
  const dayStart = useMemo(() => startOfLocalDay(now), []) // eslint-disable-line react-hooks/exhaustive-deps
  const dayEnd = useMemo(() => new Date(dayStart.getTime() + 24 * 60 * 60_000), [dayStart])
  const dayKey = toLocalDateString(dayStart)
  const fromIso = dayStart.toISOString()
  const toIso = dayEnd.toISOString()

  const teamQuery = useQuery({
    queryKey: teamMemberKeys.list(),
    queryFn: fetchTeamMembers,
    staleTime: 60_000,
  })
  const presenceQuery = useQuery({
    queryKey: memberActivityKeys.teamPresence(dayKey),
    queryFn: () => fetchTeamPresenceSessions(fromIso, toIso),
    refetchInterval: 60_000,
  })
  const eventsQuery = useQuery({
    queryKey: memberActivityKeys.teamEvents(dayKey),
    queryFn: () => fetchTeamActivityEvents(fromIso, toIso),
    refetchInterval: 60_000,
  })
  const { expanded: scheduleExpanded, loading: scheduleLoading } = useTeamSchedule({
    range: { from: dayKey, to: dayKey },
    includePending: false,
  })

  const members = useMemo(
    () => (teamQuery.data ?? []).filter((m) => m.status !== 'inactive'),
    [teamQuery.data],
  )

  const rows = useMemo(() => {
    return members.map((member) => {
      const presence = (presenceQuery.data ?? []).filter((s) => s.member_id === member.id)
      const events = (eventsQuery.data ?? []).filter((e) => e.member_id === member.id)
      const scheduledWindows = toScheduledWindows(scheduleExpanded, member.id)
      const model = buildActivityDay({
        presenceSessions: presence,
        events,
        scheduledWindows,
        dayStart,
        dayEnd,
        now,
      })
      return { member, model }
      // `now` is a render-time snapshot (widget re-renders every 60s via
      // the query refetch interval above) — deliberately not in deps.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })
  }, [members, presenceQuery.data, eventsQuery.data, scheduleExpanded, dayStart, dayEnd])

  const loading = teamQuery.isLoading || presenceQuery.isLoading || eventsQuery.isLoading || scheduleLoading
  const openSessionIds = useMemo(
    () => new Set((presenceQuery.data ?? []).filter((s) => s.ended_at === null).map((s) => s.member_id)),
    [presenceQuery.data],
  )
  const activeCount = openSessionIds.size

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-2 shrink-0 text-[11px] font-semibold tracking-[0.06em] text-gold/70">
        TEAM ACTIVITY · {activeCount} ACTIVE NOW
      </p>

      <div className="-mx-1 flex-1 min-h-0 overflow-y-auto px-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-text-light">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface ring-1 ring-border">
              <Users size={16} className="text-text-light" aria-hidden="true" />
            </div>
            <p className="text-[12px] text-text-light">No team members yet.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {rows.map(({ member, model }) => (
              <TeamActivityRow
                key={member.id}
                member={member}
                model={model}
                now={now}
                dayStart={dayStart}
                isActiveNow={openSessionIds.has(member.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function TeamActivityRow({
  member,
  model,
  now,
  dayStart,
  isActiveNow,
}: {
  member: TeamMember
  model: ActivityDayModel
  now: Date
  dayStart: Date
  isActiveNow: boolean
}) {
  const axisStartMs = dayStart.getTime() + AXIS_START_HOUR * 3600_000
  const axisEndMs = dayStart.getTime() + AXIS_END_HOUR * 3600_000
  const pct = (ms: number) => {
    const p = ((ms - axisStartMs) / (axisEndMs - axisStartMs)) * 100
    return Math.max(0, Math.min(100, p))
  }
  return (
    <li className="flex items-center gap-2.5 rounded-xl bg-surface/60 px-2 py-2 ring-1 ring-border/60 transition-colors hover:bg-surface-hover hover:ring-gold/30">
      <MemberAvatar member={member} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-text">{member.display_name}</p>
        <div className="relative mt-1 h-3.5 rounded-full bg-surface-alt/70" aria-hidden="true">
          {model.scheduledWindow && (
            <div
              className="absolute top-0 h-full rounded-full border border-dashed border-gold/40 bg-gold/[0.08]"
              style={{
                left: `${pct(Date.parse(model.scheduledWindow.start))}%`,
                width: `${Math.max(1, pct(Date.parse(model.scheduledWindow.end)) - pct(Date.parse(model.scheduledWindow.start)))}%`,
              }}
              title={`Scheduled ${new Date(model.scheduledWindow.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${new Date(model.scheduledWindow.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
            />
          )}
          {model.segments.map((s, i) => {
            const left = pct(Date.parse(s.start))
            const right = pct(Date.parse(s.end))
            return (
              <div
                key={i}
                className="absolute top-0.5 h-2.5 rounded-full"
                style={{ left: `${left}%`, width: `${Math.max(0.6, right - left)}%`, background: SEGMENT_COLOR[s.kind] }}
                title={`${s.kind === 'on' ? 'On schedule' : s.kind === 'late' ? 'Late start' : 'Off-schedule'} · ${new Date(s.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–${new Date(s.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
              />
            )
          })}
          <div
            className="absolute top-[-1px] h-[18px] w-[2px] rounded-full bg-gold"
            style={{ left: `${pct(now.getTime())}%` }}
            title="Now"
          />
        </div>
      </div>
      {isActiveNow && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
          <Activity size={9} aria-hidden="true" />
          {model.activeMinutes}m
        </span>
      )}
    </li>
  )
}
