import type { TeamMember, ExpandedSchedule } from '../../types'
import type { MemberColor } from '../../lib/calendar/memberColors'
import { resolveScheduleColor } from '../../lib/calendar/teamScheduleColors'
import MemberAvatar from '../members/MemberAvatar'

interface WeekDay {
  day: string
  date: string
  key: string
}

interface TeamScheduleGridProps {
  weekDays: WeekDay[]
  members: TeamMember[]
  schedulesByDate: Record<string, ExpandedSchedule[]>
  timeOffByDate: Record<string, ExpandedSchedule[]>
  teamMemberColors: Map<string, MemberColor>
  gridStartHour: number
  gridEndHour: number
  selectedDate: string
}

function minutesOfDay(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/**
 * Team Schedule tab body — member-rows-down-the-side layout replacing
 * the old shared hour-grid overlay. Each member gets one row, one
 * fixed color (see `teamScheduleColors.ts`), and one mini-timeline
 * cell per day sized/positioned by their REAL start/end time, so
 * "who is working when" reads without hovering. Bookings keeps the
 * original Google-Calendar-style hour grid entirely untouched — this
 * component only renders on the Team Schedule tab.
 *
 * 2026-07-28 — see docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md "Locked
 * decisions" for the approved direction (mockups: calendar_page_
 * revamp_preview, team_schedule_toggle_active_preview).
 */
export default function TeamScheduleGrid({
  weekDays,
  members,
  schedulesByDate,
  timeOffByDate,
  teamMemberColors,
  gridStartHour,
  gridEndHour,
  selectedDate,
}: TeamScheduleGridProps) {
  const axisStart = gridStartHour * 60
  const axisEnd = gridEndHour * 60
  const pct = (min: number) => {
    const p = ((min - axisStart) / (axisEnd - axisStart)) * 100
    return Math.max(0, Math.min(100, p))
  }

  if (members.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-[13px] text-text-muted">
        No active team members to show.
      </div>
    )
  }

  return (
    <div className="px-3 py-3">
      <div className="grid grid-cols-[132px_repeat(7,1fr)] gap-x-2 gap-y-1">
        <div />
        {weekDays.map((wd) => (
          <div
            key={wd.key}
            className={`text-center py-1.5 rounded-md ${wd.key === selectedDate ? 'bg-gold/[0.08]' : ''}`}
          >
            <p className={`text-[10px] font-semibold uppercase ${wd.key === selectedDate ? 'text-gold' : 'text-text-muted'}`}>
              {wd.day}
            </p>
            <p className={`text-[9px] ${wd.key === selectedDate ? 'text-gold' : 'text-text-light'}`}>{wd.date}</p>
          </div>
        ))}

        {members.map((member) => {
          const color = resolveScheduleColor(member, teamMemberColors)
          return (
            <div key={member.id} className="contents">
              <div className="flex items-center gap-2 py-1.5 min-w-0">
                <span
                  className="shrink-0 rounded-full"
                  style={{ boxShadow: `0 0 0 2px ${color.accent}` }}
                >
                  <MemberAvatar member={member} size="xs" />
                </span>
                <span className="text-[12px] font-semibold text-text truncate">
                  {member.display_name?.split(/\s+/)[0] ?? 'Member'}
                </span>
              </div>
              {weekDays.map((wd) => {
                const dayOff = (timeOffByDate[wd.key] ?? []).filter((s) => s.member_id === member.id)
                const dayWork = (schedulesByDate[wd.key] ?? []).filter((s) => s.member_id === member.id)
                if (dayOff.length > 0) {
                  return (
                    <div key={wd.key} className="flex items-center justify-center h-[26px]">
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-sky-300/70">Off</span>
                    </div>
                  )
                }
                if (dayWork.length === 0) {
                  return <div key={wd.key} className="h-[26px]" />
                }
                return (
                  <div key={wd.key} className="relative h-[26px] rounded-md bg-border/50">
                    {dayWork.map((s) => {
                      const startMin = minutesOfDay(s.starts_at)
                      const endMin = minutesOfDay(s.ends_at)
                      const left = pct(startMin)
                      const right = pct(endMin)
                      return (
                        <div
                          key={s.key}
                          className="absolute top-0 h-full rounded-md"
                          style={{
                            left: `${left}%`,
                            width: `${Math.max(3, right - left)}%`,
                            background: color.accent,
                          }}
                          title={`${member.display_name ?? 'Member'} · ${formatClockTime(s.starts_at)}–${formatClockTime(s.ends_at)}`}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
