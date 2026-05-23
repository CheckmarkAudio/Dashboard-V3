// Expand recurring weekly rules + one-off blocks into a flat list of
// ExpandedSchedule entries for a given date range. Used by every
// consumer surface — Calendar overlay, Overview widget, Profile page.
//
// The function is intentionally pure + sync. Callers (useTeamSchedule)
// fetch the raw rows once and pass them in; UI re-renders just
// re-derive the expansion. No date library dependency — we operate
// in the browser's local timezone, which matches the studio TZ for
// the team in practice. If we ever need cross-TZ rendering we can
// thread the studio TZ through here.

import type {
  ExpandedSchedule,
  ScheduleBlock,
  ScheduleRecurring,
  Weekday,
} from '../../types'

/** Inclusive date range (YYYY-MM-DD strings). */
export interface DateRange {
  from: string
  to: string
}

/** Parse "YYYY-MM-DD" into a Date at local midnight. */
function parseLocalDate(s: string): Date {
  const parts = s.split('-').map(Number)
  const y = parts[0] ?? 1970
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

/** Format a Date as "YYYY-MM-DD" in local time. */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Iterate dates from `from` to `to` inclusive. Returns a fresh
 * array of Date objects all at local midnight.
 */
function eachDay(range: DateRange): Date[] {
  const start = parseLocalDate(range.from)
  const end = parseLocalDate(range.to)
  const days: Date[] = []
  const cur = new Date(start)
  while (cur <= end) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

/**
 * Combine a YYYY-MM-DD date + HH:MM:SS time into a local-timestamp
 * Date. Useful when projecting a recurring rule onto a specific day.
 */
function combineDateTime(date: Date, time: string): Date {
  const [h, m, s] = time.split(':').map(Number)
  const out = new Date(date)
  out.setHours(h ?? 0, m ?? 0, s ?? 0, 0)
  return out
}

/**
 * Check whether a recurring rule is active on a given date.
 * Both effective_from + effective_until are inclusive; nulls = no
 * bound. `active=false` rules are filtered out by the caller before
 * we even get here, but we double-check anyway for safety.
 */
function ruleAppliesOn(rule: ScheduleRecurring, day: Date): boolean {
  if (!rule.active) return false
  const dayStr = formatLocalDate(day)
  if (rule.effective_from && dayStr < rule.effective_from) return false
  if (rule.effective_until && dayStr > rule.effective_until) return false
  return day.getDay() === rule.weekday
}

/**
 * Expand recurring rules + blocks into a single flat list across the
 * range. Blocks with status='denied' are filtered out; status='pending'
 * is kept (the caller decides whether to render it — member's own
 * view yes, team-wide view no).
 */
export function expandSchedule({
  recurring,
  blocks,
  range,
}: {
  recurring: ScheduleRecurring[]
  blocks: ScheduleBlock[]
  range: DateRange
}): ExpandedSchedule[] {
  const out: ExpandedSchedule[] = []
  const days = eachDay(range)

  // Recurring rules → one entry per (rule, applicable day).
  for (const rule of recurring) {
    if (!rule.active) continue
    for (const day of days) {
      if (!ruleAppliesOn(rule, day)) continue
      const starts = combineDateTime(day, rule.start_time)
      const ends = combineDateTime(day, rule.end_time)
      const dayStr = formatLocalDate(day)
      out.push({
        key: `recurring:${rule.id}:${dayStr}`,
        member_id: rule.member_id,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        source: 'recurring',
        source_id: rule.id,
        status: 'approved',
        note: rule.note,
      })
    }
  }

  // One-off blocks → drop denied, pass-through approved + pending.
  const rangeStart = parseLocalDate(range.from)
  const rangeEnd = parseLocalDate(range.to)
  rangeEnd.setHours(23, 59, 59, 999)
  for (const block of blocks) {
    if (block.status === 'denied') continue
    const blockStart = new Date(block.starts_at)
    if (blockStart > rangeEnd) continue
    const blockEnd = new Date(block.ends_at)
    if (blockEnd < rangeStart) continue
    out.push({
      key: `block:${block.id}`,
      member_id: block.member_id,
      starts_at: block.starts_at,
      ends_at: block.ends_at,
      source: 'block',
      source_id: block.id,
      status: block.status,
      note: block.note,
    })
  }

  // Stable order — by start time, then member_id for tie-break.
  out.sort((a, b) => {
    if (a.starts_at !== b.starts_at) return a.starts_at < b.starts_at ? -1 : 1
    return a.member_id < b.member_id ? -1 : 1
  })

  return out
}

// ─── Small date helpers shared by callers ───────────────────────────

/** Monday of the given date's week. (ISO week — Mon as first day.) */
export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun..6=Sat
  // Shift back so Monday is the start.
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

/** Sunday at 23:59:59 of the given date's week. */
export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

/** Format a YYYY-MM-DD given a Date in local time. */
export function toLocalDateString(d: Date): string {
  return formatLocalDate(d)
}

/** Display label for a Weekday number (short form, "Mon"). */
export function weekdayLabel(w: Weekday, length: 'short' | 'long' = 'short'): string {
  const names =
    length === 'short'
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return names[w] ?? ''
}

/**
 * "9:00 AM – 5:30 PM" formatter for a recurring rule's start/end
 * time strings. Forgiving — falls back to the raw "HH:MM" if the
 * Intl call throws.
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatHM(startTime)} – ${formatHM(endTime)}`
}

function formatHM(time: string): string {
  const [hStr, mStr] = time.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (Number.isNaN(h) || Number.isNaN(m)) return time
  const d = new Date()
  d.setHours(h, m, 0, 0)
  try {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return `${hStr}:${mStr}`
  }
}
