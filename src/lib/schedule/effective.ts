import type { ExpandedSchedule } from '../../types'
import { mergeIntervals, subtractIntervals, type Interval } from '../time/intervals.ts'

export interface EffectiveScheduleWindow {
  start: string
  end: string
}

function toInterval(entry: ExpandedSchedule): Interval | null {
  const start = Date.parse(entry.starts_at)
  const end = Date.parse(entry.ends_at)
  return Number.isFinite(start) && Number.isFinite(end) && end > start
    ? { start, end }
    : null
}

/**
 * Resolve the work windows that are actually in force for one member.
 *
 * Approved recurring and one-off work intervals are unioned first, then
 * approved time-off intervals are subtracted. Pending/denied rows never
 * change the effective schedule.
 */
export function resolveEffectiveWorkWindows(
  expanded: ExpandedSchedule[],
  memberId: string,
): EffectiveScheduleWindow[] {
  const approved = expanded.filter(
    (entry) => entry.member_id === memberId && entry.status === 'approved',
  )
  const work = approved
    .filter((entry) => (entry.kind ?? 'work') === 'work')
    .map(toInterval)
    .filter((interval): interval is Interval => interval !== null)
  const timeOff = approved
    .filter((entry) => entry.kind === 'time_off')
    .map(toInterval)
    .filter((interval): interval is Interval => interval !== null)

  return subtractIntervals(mergeIntervals(work), timeOff).map((interval) => ({
    start: new Date(interval.start).toISOString(),
    end: new Date(interval.end).toISOString(),
  }))
}
