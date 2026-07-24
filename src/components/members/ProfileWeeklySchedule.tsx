import { useMemo } from 'react'
import { CalendarRange, Loader2, Palmtree } from 'lucide-react'
import { useTeamSchedule } from '../../lib/schedule/useTeamSchedule'
import {
  formatTimeOffDateRange,
  formatTimeRange,
  startOfWeek,
  toLocalDateString,
  weekdayLabel,
} from '../../lib/schedule/expand'
import type { Weekday } from '../../types'

/**
 * Read-only weekly schedule rendered on the Profile page for the
 * member whose page is being viewed. Two stacked panels:
 *
 *   1. Recurring weekly hours — one row per weekday with the time
 *      range. Days the member doesn't work show "Off".
 *   2. Upcoming one-off blocks — next 14 days of approved exceptions
 *      (coverage shifts, special hours). Hidden when there are none
 *      so the section doesn't read as "missing data".
 *
 * No editing affordances here — admin manages from Members → Work
 * Scheduler (PR 1). Member proposes from Overview → My Schedule
 * widget (PR 3). This is purely a "what's my schedule" reference.
 */
interface ProfileWeeklyScheduleProps {
  memberId: string
}

export default function ProfileWeeklySchedule({ memberId }: ProfileWeeklyScheduleProps) {
  // Pull 14 days starting Monday of the current week — enough range
  // to catch the rest of this week's one-offs + next week's.
  const range = useMemo(() => {
    const start = startOfWeek(new Date())
    const end = new Date(start)
    end.setDate(end.getDate() + 13)
    return { from: toLocalDateString(start), to: toLocalDateString(end) }
  }, [])

  // Approved-only — pending member proposals don't surface on the
  // public profile (member sees those on the Overview widget).
  const { recurring, blocks, loading } = useTeamSchedule({
    range,
    memberId,
    includePending: false,
  })

  // Index recurring rules by weekday → list. A member can have more
  // than one slot per day (e.g. 9–12 morning shift + 4–8 evening).
  const recurringByWeekday = useMemo(() => {
    const map = new Map<Weekday, typeof recurring>()
    for (const r of recurring) {
      if (!r.active) continue
      const list = map.get(r.weekday) ?? []
      list.push(r)
      map.set(r.weekday, list)
    }
    // Sort each day's slots by start time so a member with multiple
    // shifts reads top-to-bottom in chronological order.
    for (const list of map.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time))
    }
    return map
  }, [recurring])

  // Future-only approved one-offs in the next 14 days.
  const upcomingBlocks = useMemo(() => {
    const now = Date.now()
    return blocks
      .filter((b) => b.status === 'approved' && new Date(b.ends_at).getTime() > now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }, [blocks])

  // Render weekdays in the studio's natural reading order: Mon → Sun.
  // (We allow weekend rows, just push them last for readability.)
  const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0]

  return (
    <div>
      <h2 className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <CalendarRange size={11} aria-hidden="true" />
        Weekly Schedule
      </h2>
      {loading ? (
        <div className="flex items-center justify-center py-6 text-text-muted">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Recurring weekly hours ── */}
          <div className="rounded-lg border border-border bg-surface-alt/30 overflow-hidden">
            <table className="w-full text-left">
              <tbody>
                {WEEKDAY_ORDER.map((w) => {
                  const slots = recurringByWeekday.get(w) ?? []
                  const isOff = slots.length === 0
                  return (
                    <tr key={w} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 w-20 text-[12px] uppercase tracking-wider font-semibold text-text-muted">
                        {weekdayLabel(w, 'long')}
                      </td>
                      <td className="px-3 py-2 text-[13px]">
                        {isOff ? (
                          <span className="text-text-light italic">Off</span>
                        ) : (
                          <span className="flex flex-wrap gap-x-3 gap-y-1">
                            {slots.map((s) => (
                              <span
                                key={s.id}
                                className="inline-flex items-center gap-1 text-text"
                                title={s.note ?? undefined}
                              >
                                <span className="font-medium">{formatTimeRange(s.start_time, s.end_time)}</span>
                                {s.note && (
                                  <span className="text-[11px] text-text-light">· {s.note}</span>
                                )}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Upcoming one-off blocks (next 14 days) ── */}
          {upcomingBlocks.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-text-muted mb-2">
                Upcoming exceptions
              </p>
              <div className="space-y-1">
                {upcomingBlocks.map((b) => {
                  const starts = new Date(b.starts_at)
                  const ends = new Date(b.ends_at)
                  const isTimeOff = b.kind === 'time_off'
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border ${
                        isTimeOff ? 'border-sky-500/30 bg-sky-500/10' : 'border-purple-500/20 bg-purple-700/10'
                      }`}
                    >
                      {isTimeOff && <Palmtree size={12} className="text-sky-300 shrink-0" aria-hidden="true" />}
                      <span className="text-[12px] font-semibold text-text">
                        {isTimeOff
                          ? formatTimeOffDateRange(b.starts_at, b.ends_at)
                          : starts.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      {isTimeOff ? (
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-sky-300">Time off</span>
                      ) : (
                        <span className="text-[11px] text-text-muted">
                          {starts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          {' – '}
                          {ends.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                      {b.note && (
                        <span className="text-[11px] text-text-light ml-1 truncate">· {b.note}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {recurring.length === 0 && upcomingBlocks.length === 0 && (
            <p className="text-[12px] text-text-light italic px-3 py-4 text-center">
              No schedule set yet. Admin can add recurring hours from Members → Work Scheduler.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
