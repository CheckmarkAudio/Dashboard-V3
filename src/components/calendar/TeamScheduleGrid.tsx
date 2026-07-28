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

// Compact "10a"/"2p" form for the inline block label + the reference
// ruler row — full "10:00 AM" is too wide to fit inside a short shift.
function formatCompactHour(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h < 12 ? 'a' : 'p'
  const hour12 = ((h + 11) % 12) + 1
  return m === 0 ? `${hour12}${period}` : `${hour12}:${m.toString().padStart(2, '0')}${period}`
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
 *
 * v2 (2026-07-28) — director tried it live: "hard to tell the actual
 * time slot, it just looks like a block with no markers." Cells were
 * 26px tall with nothing but color. Now: taller cells (44px) with the
 * shift's own start–end time printed directly on the block, plus a
 * shared hour ruler (7a/11a/3p/7p) under each day header so a block's
 * position also reads against a fixed reference, not just its label.
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
  const rulerHours = [gridStartHour, Math.round((gridStartHour + gridEndHour) / 2) - 2, Math.round((gridStartHour + gridEndHour) / 2) + 2, gridEndHour]
  const rulerLabel = (h: number) => {
    const period = h < 12 || h === 24 ? 'a' : 'p'
    const hour12 = ((h + 11) % 12) + 1
    return `${hour12}${period}`
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
      <div className="grid grid-cols-[144px_repeat(7,1fr)] gap-x-2 gap-y-2">
        <div />
        {weekDays.map((wd) => (
          <div
            key={wd.key}
            className={`text-center pt-2 pb-1 rounded-t-md ${wd.key === selectedDate ? 'bg-gold/[0.08]' : ''}`}
          >
            <p className={`text-[11px] font-semibold uppercase ${wd.key === selectedDate ? 'text-gold' : 'text-text-muted'}`}>
              {wd.day}
            </p>
            <p className={`text-[10px] ${wd.key === selectedDate ? 'text-gold' : 'text-text-light'}`}>{wd.date}</p>
          </div>
        ))}

        {/* Shared hour ruler — one per day column, directly above the
            member rows, so a block's left edge can be read against a
            fixed reference (not just its own printed time). */}
        <div />
        {weekDays.map((wd) => (
          <div key={`ruler-${wd.key}`} className="flex justify-between px-1 text-[9px] text-text-light/70 tracking-wide">
            {rulerHours.map((h) => (
              <span key={h}>{rulerLabel(h)}</span>
            ))}
          </div>
        ))}

        {members.map((member) => {
          const color = resolveScheduleColor(member, teamMemberColors)
          return (
            <div key={member.id} className="contents">
              <div className="flex items-center gap-2 py-1 min-w-0">
                <span
                  className="shrink-0 rounded-full"
                  style={{ boxShadow: `0 0 0 2px ${color.accent}` }}
                >
                  <MemberAvatar member={member} size="sm" />
                </span>
                <span className="text-[13px] font-semibold text-text truncate">
                  {member.display_name?.split(/\s+/)[0] ?? 'Member'}
                </span>
              </div>
              {weekDays.map((wd) => {
                const dayOff = (timeOffByDate[wd.key] ?? []).filter((s) => s.member_id === member.id)
                const dayWork = (schedulesByDate[wd.key] ?? []).filter((s) => s.member_id === member.id)
                if (dayOff.length > 0) {
                  return (
                    <div key={wd.key} className="flex items-center justify-center h-11 rounded-md bg-sky-950/20 border border-sky-400/20">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-300/80">Off</span>
                    </div>
                  )
                }
                if (dayWork.length === 0) {
                  return <div key={wd.key} className="h-11 rounded-md bg-border/20" />
                }
                return (
                  <div key={wd.key} className="relative h-11 rounded-md bg-border/50">
                    {dayWork.map((s) => {
                      const startMin = minutesOfDay(s.starts_at)
                      const endMin = minutesOfDay(s.ends_at)
                      const left = pct(startMin)
                      const right = pct(endMin)
                      const widthPct = Math.max(6, right - left)
                      return (
                        <div
                          key={s.key}
                          className="absolute top-0 h-full rounded-md flex items-center justify-center overflow-hidden px-0.5"
                          style={{
                            left: `${left}%`,
                            width: `${widthPct}%`,
                            background: color.accent,
                          }}
                          title={`${member.display_name ?? 'Member'} · ${formatClockTime(s.starts_at)}–${formatClockTime(s.ends_at)}`}
                        >
                          <span
                            className="text-[10px] font-bold text-white whitespace-nowrap leading-none"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}
                          >
                            {formatCompactHour(s.starts_at)}–{formatCompactHour(s.ends_at)}
                          </span>
                        </div>
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
